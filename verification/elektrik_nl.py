"""Unabhängige Gegenrechnung Halbleiter, Pinstrom und Leitungsströme (eng-core 0.21.0, Modul elektrik, Konzept v1.1 Abschn. 4.7).

Andere Verfahren als der Kern (MNA mit Begleitmodellen, Newton mit pnjlim, G_min- und Quellenstufung, Laplace-Lösung der Drähte):
  - Netz: Sparse-Tableau (alle Zweigströme unbekannt) mit den Halbleitern als nichtlineare Knotenströme im vollen Residuum,
    gelöst mit scipy.optimize.root (Powell-Hybrid, numerische Jacobi-Matrix) über eine Homotopie der Quellen in 40 festen
    Schritten, danach Nachiteration bis zum Rest 1e-13 · Σ|I|. Bahnwiderstand als eigener Zweig.
  - Einzelfälle geschlossen: Diode an Widerstand über Lambert W, Transistorstufen über geschachtelte Bisektion (brentq),
    MOSFET über brentq auf der Kennlinie bzw. geschlossen, Z-Diode über brentq.
  - Kleinsignal: eigene analytische Ableitungen, komplexes Sparse-Tableau mit gesteuerten Knotenströmen.
  - Leitungsströme: numpy.linalg.lstsq (minimale Norm) auf der Inzidenzmatrix.
  - Pinstrom: eigener Leser von data/fd/mcu_*.json.
Modellannahmen wie Konzept v1.1 (gleich umzusetzen, nicht Teil der Verfahrenswahl): U_T bei 25 °C, Exponent ab 80 linear,
G_min = 1e-12 S parallel zu den Übergängen und zwischen Drain und Source.
"""
import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import brentq, root
from scipy.special import lambertw

K_B, Q_E = 1.380649e-23, 1.602176634e-19
UT = K_B * 298.15 / Q_E
GMIN = 1e-12
XMAX = 80.0
FD = Path(__file__).resolve().parent.parent / 'data' / 'fd'
NONLIN = {'led', 'diode', 'z_diode', 'npn', 'pnp', 'n_mosfet'}


def lexp(x):
    return math.exp(x) if x <= XMAX else math.exp(XMAX) * (1 + x - XMAX)


def dlexp(x):
    return math.exp(min(x, XMAX))


# ---------------------------------------------------------------- Modelle (eigene Umsetzung)
def dmodel(e):
    P, k = e['params'], e['kind']
    n = P.get('n', 2.0 if k == 'led' else 1.8)
    rs = P.get('r_s_ohm', 0.0)
    uf = P.get('u_f_V', 0.7)
    iF = P['i_f_A'] if k == 'led' else P.get('i_f_A', 0.01)
    Is = iF / (math.exp((uf - rs * iF) / (n * UT)) - 1)
    z = (P['u_z_V'], P.get('i_zt_A', 0.005), P.get('n_z', 1.0)) if k == 'z_diode' else None
    return dict(Is=Is, n=n, rs=rs, z=z)


def diode_i(m, u):
    i = m['Is'] * (lexp(u / (m['n'] * UT)) - 1) + GMIN * u
    if m['z']:
        uz, izt, nz = m['z']; i -= izt * lexp(-(u + uz) / (nz * UT))
    return i


def diode_g(m, u):
    g = m['Is'] / (m['n'] * UT) * dlexp(u / (m['n'] * UT)) + GMIN
    if m['z']:
        uz, izt, nz = m['z']; g += izt / (nz * UT) * dlexp(-(u + uz) / (nz * UT))
    return g


def bmodel(e):
    P = e['params']
    return dict(s=1 if e['kind'] == 'npn' else -1, Is=P.get('i_c_ref_A', 1e-3) / math.exp(P.get('u_be_ref_V', 0.65) / UT), bf=P['beta'], br=P.get('beta_r', 1.0))


def bjt_i(m, ube, ubc):
    """Klemmenströme (I_C, I_B) in das Bauteil hinein, mit G_min B–E und B–C."""
    s = m['s']; a, b = s * ube, s * ubc
    ef, er = lexp(a / UT), lexp(b / UT)
    ic = s * (m['Is'] * (ef - er) - m['Is'] / m['br'] * (er - 1)) - GMIN * ubc
    ib = s * (m['Is'] / m['bf'] * (ef - 1) + m['Is'] / m['br'] * (er - 1)) + GMIN * (ube + ubc)
    return ic, ib


def bjt_jac(m, ube, ubc):
    s = m['s']; a, b = s * ube, s * ubc
    df, dr = dlexp(a / UT) / UT, dlexp(b / UT) / UT
    Is = m['Is']
    return [[Is * df, -Is * dr - Is / m['br'] * dr - GMIN], [Is / m['bf'] * df + GMIN, Is / m['br'] * dr + GMIN]]


def mmodel(e):
    P = e['params']; uth = P['u_th_V']
    return dict(uth=uth, k=1 / (P['r_on_ohm'] * (P.get('u_gs_ref_V', 10.0) - uth)))


def _mos_fwd(m, ugs, uds):
    ov = ugs - m['uth']
    if ov <= 0: return 0.0, 0.0, 0.0
    if uds < ov: return m['k'] * (ov * uds - uds * uds / 2), m['k'] * uds, m['k'] * (ov - uds)
    return m['k'] / 2 * ov * ov, m['k'] * ov, 0.0


def mos_i(m, ugs, uds):
    if uds >= 0: return _mos_fwd(m, ugs, uds)[0] + GMIN * uds
    return -_mos_fwd(m, ugs - uds, -uds)[0] + GMIN * uds


def mos_jac(m, ugs, uds):
    if uds >= 0:
        _, gm, gds = _mos_fwd(m, ugs, uds); return [[gm, gds + GMIN]]
    _, gm, gds = _mos_fwd(m, ugs - uds, -uds); return [[-gm, gm + gds + GMIN]]


def devices(net):
    out = []
    for e in net['elements']:
        k, p = e['kind'], e['pins']
        if k in ('led', 'diode', 'z_diode'):
            m = dmodel(e); j = p['anode'] if m['rs'] == 0 else e['id'] + '#j'
            out.append(dict(e=e, t='d', m=m, a=p['anode'], k=p['kathode'], j=j))
        elif k in ('npn', 'pnp'): out.append(dict(e=e, t='q', m=bmodel(e), b=p['b'], c=p['c'], em=p['e']))
        elif k == 'n_mosfet': out.append(dict(e=e, t='m', m=mmodel(e), g=p['g'], d=p['d'], s=p['s']))
    return out


def dev_terms(d, V):
    """Klemmenströme in das Bauteil hinein als {Knoten: I} und {Pin: I}."""
    if d['t'] == 'd':
        i = diode_i(d['m'], V[d['j']] - V[d['k']])
        return [(d['j'], i), (d['k'], -i)], dict(anode=i, kathode=-i)
    if d['t'] == 'q':
        ic, ib = bjt_i(d['m'], V[d['b']] - V[d['em']], V[d['b']] - V[d['c']])
        return [(d['c'], ic), (d['b'], ib), (d['em'], -ic - ib)], dict(c=ic, b=ib, e=-ic - ib)
    i = mos_i(d['m'], V[d['g']] - V[d['s']], V[d['d']] - V[d['s']])
    return [(d['d'], i), (d['s'], -i)], dict(d=i, s=-i, g=0.0)


# ---------------------------------------------------------------- Gleichstrom nichtlinear (Sparse-Tableau, Homotopie, hybr)
def solve_dc(net, branches_fn, steps=40):
    devs = devices(net)
    nodes = list(net['nodes'])
    br = []
    for e in net['elements']:
        if e['kind'] in NONLIN:
            continue
        for t in branches_fn(e, None): br.append((*t, e['id']))
    for d in devs:
        if d['t'] == 'd' and d['m']['rs'] > 0:
            nodes.append(d['j']); br.append((d['a'], d['j'], 1, -d['m']['rs'], 0, d['e']['id'] + '#rs'))
    g = net['ground']
    # Bezug: Masse; Teilnetze ohne Masse wie im Kern nicht vorgesehen (Prüffälle haben Masse)
    vi = {n: i for i, n in enumerate([n for n in nodes if n != g])}
    nv, nb = len(vi), len(br)

    def unpack(x):
        V = {n: (x[vi[n]] if n in vi else 0.0) for n in nodes}
        return V, x[nv:]

    def F(x, lam):
        V, ib = unpack(x)
        r = np.zeros(nv + nb)
        for j, (a, b, al, be, ga, o) in enumerate(br):
            if a in vi: r[vi[a]] += ib[j]
            if b in vi: r[vi[b]] -= ib[j]
            r[nv + j] = al * (V[a] - V[b]) + be * ib[j] - lam * ga
        for d in devs:
            for n, i in dev_terms(d, V)[0]:
                if n in vi: r[vi[n]] += i
        return r

    def jac(x, lam):
        J = np.zeros((nv + nb, nv + nb))
        for k in range(nv + nb):
            h = 1e-7 * max(1.0, abs(x[k])); xp, xm = x.copy(), x.copy(); xp[k] += h; xm[k] -= h
            J[:, k] = (F(xp, lam) - F(xm, lam)) / (2 * h)
        return J

    def damped(x, lam, it=200):
        # Rückfallverfahren: Newton mit numerischer Jacobi-Matrix und Rückschritt (Armijo) auf ||F||
        for _ in range(it):
            r = F(x, lam); nr = np.linalg.norm(r)
            if nr <= 1e-14 * max(1.0, np.abs(x).max()): break
            dx = np.linalg.lstsq(jac(x, lam), r, rcond=None)[0]; a = 1.0
            while a > 1e-12 and np.linalg.norm(F(x - a * dx, lam)) > (1 - 1e-4 * a) * nr: a /= 2
            x = x - a * dx
        return x

    x = np.zeros(nv + nb)
    for s in range(1, steps + 1):
        lam = s / steps
        sol = root(F, x, args=(lam,), method='hybr', options=dict(xtol=1e-15, maxfev=20000))
        ok = np.isfinite(sol.x).all() and np.abs(F(sol.x, lam)).max() <= 1e-9 * max(1.0, np.abs(sol.x).max())
        x = sol.x if ok else damped(x, lam)
    # Nachiteration mit eigener numerischer Jacobi-Matrix (zentral)
    for _ in range(20):
        r = F(x, 1.0)
        scale = 1e-13 * max(1e-12, np.abs(x[nv:]).sum() + 1e-12)
        if np.abs(r).max() <= scale: break
        x = x - np.linalg.lstsq(jac(x, 1.0), r, rcond=None)[0]
    res = np.abs(F(x, 1.0)).max()
    V, ib = unpack(x)
    if res > 1e-11 * max(1.0, float(np.abs(ib).max())):
        raise RuntimeError(f'Gegenrechnung nichtlinear ohne Konvergenz (Rest {res:.3g})')
    return dict(V=V, br=br, ib=ib, devs=devs, res=res)


def dc_ref_nl(net, branches_fn, term, util=True, pins=True, wires=True):
    S = solve_dc(net, branches_fn)
    V, br, ib = S['V'], S['br'], S['ib']
    v = dict(ok=1.0)
    for n in net['nodes']: v[f'V_{n}'] = float(V[n])
    bal = 0.0
    I_of = {}
    for e in net['elements']:
        k, p = e['kind'], e['pins']
        if k in NONLIN or k in ('masse', 'knoten'): continue
        ta, tb = term.get(k, ('a', 'b'))
        if p.get(ta) is None or p.get(tb) is None: continue
        js = [j for j, t in enumerate(br) if t[5] == e['id']]
        u = V[p[ta]] - V[p[tb]]
        i = ib[js[0]] if js else 0.0
        s = sum((V[br[j][0]] - V[br[j][1]]) * ib[j] for j in js)
        v[f'U_{e["id"]}'] = float(u); v[f'I_{e["id"]}'] = float(i); v[f'P_{e["id"]}'] = float(s); bal += s; I_of[e['id']] = i
        P = e['params']
        if util and k == 'widerstand' and P.get('p_max_W'): v[f'util_{e["id"]}'] = abs(s) / P['p_max_W']
        if util and k == 'kondensator' and P.get('u_max_V'): v[f'util_{e["id"]}'] = abs(u) / P['u_max_V']
        # Klemmenströme linearer Zweipole: in das Bauteil hinein am Pin a = i
        if js and k in ('widerstand', 'lampe', 'gleichspannungsquelle', 'batterie', 'digitalpin', 'schalter', 'taster', 'amperemeter', 'spule'):
            v[f'Ip_{e["id"]}_{ta}'] = float(i); v[f'Ip_{e["id"]}_{tb}'] = float(-i)
    for d in S['devs']:
        e = d['e']; _, cur = dev_terms(d, V)
        pinsN = dict(anode=d['a'], kathode=d['k']) if d['t'] == 'd' else dict(b=d['b'], c=d['c'], e=d['em']) if d['t'] == 'q' else dict(g=d['g'], d=d['d'], s=d['s'])
        P = sum(V[pinsN[k]] * cur[k] for k in cur)
        a, b, i = (d['a'], d['k'], cur['anode']) if d['t'] == 'd' else (d['c'], d['em'], cur['c']) if d['t'] == 'q' else (d['d'], d['s'], cur['d'])
        v[f'U_{e["id"]}'] = float(V[a] - V[b]); v[f'I_{e["id"]}'] = float(i); v[f'P_{e["id"]}'] = float(P); bal += P
        for k2, c in cur.items(): v[f'Ip_{e["id"]}_{k2}'] = float(c)
        pp = e['params']
        if util:
            if e['kind'] in ('led', 'diode') and pp.get('i_max_A'): v[f'util_{e["id"]}'] = abs(i) / pp['i_max_A']
            if e['kind'] == 'z_diode' and pp.get('p_tot_W'): v[f'util_{e["id"]}'] = abs(P) / pp['p_tot_W']
            if e['kind'] in ('npn', 'pnp') and (pp.get('i_c_max_A') or pp.get('p_tot_W')):
                v[f'util_{e["id"]}'] = max(abs(i) / pp['i_c_max_A'] if pp.get('i_c_max_A') else 0, abs(P) / pp['p_tot_W'] if pp.get('p_tot_W') else 0)
            if e['kind'] == 'n_mosfet' and pp.get('i_d_max_A'): v[f'util_{e["id"]}'] = abs(i) / pp['i_d_max_A']
    v['bal'] = float(bal)
    if pins: v.update(pin_ref(net, I_of))
    if wires and net.get('wires'): v.update(wire_ref(net, v))
    return v


# ---------------------------------------------------------------- Pinstrom (eigener Leser der Fachdaten)
def _fd(name): return json.loads((FD / f'{name}.json').read_text(encoding='utf-8'))


def pin_ref(net, I_of):
    boards = {b['board']: b for b in _fd('mcu_boards')}
    lim = {(l['mcu'], l['quantity']): l['value_a'] for l in _fd('mcu_limits')}
    groups = _fd('mcu_port_groups'); pmap = {(p['board'], p['pin']): p['port'] for p in _fd('mcu_pins')}
    v, sums, gs = {}, {}, {}
    for e in net['elements']:
        if e['kind'] != 'digitalpin' or e['id'] not in I_of: continue
        bd = boards.get(e['params'].get('board') or 'Uno')
        if not bd: continue
        mcu, i = bd['mcu'], -I_of[e['id']]
        v[f'pin_{e["id"]}'] = float(i)
        aabs = abs(i) / lim[(mcu, 'i_pin_abs')] if (mcu, 'i_pin_abs') in lim else None
        if (mcu, 'i_pin_ref') in lim: aref, esp = abs(i) / lim[(mcu, 'i_pin_ref')], False
        else: aref, esp = abs(i) / lim[(mcu, 'i_oh_typ' if i >= 0 else 'i_ol_typ')], True
        if aabs is not None: v[f'aAbs_{e["id"]}'] = aabs
        v[f'aRef_{e["id"]}'] = aref
        lvl = 2 if (aabs is not None and aabs > 1) or (esp and aref > 1) else 1 if (esp and aref > 0.8) or (not esp and aref > 1) else 0
        v[f'lvl_{e["id"]}'] = float(lvl)
        s = sums.setdefault(bd['board'], [mcu, 0.0, 0.0]); s[1 if i >= 0 else 2] += abs(i)
        port = pmap.get((bd['board'], e['params'].get('pin')))
        if port:
            for g in groups:
                if g['mcu'] == mcu and port in g['ports'] and (g['direction'] == 'source') == (i >= 0): gs[g['id']] = gs.get(g['id'], 0.0) + abs(i)
    for b, (mcu, so, si) in sums.items(): v[f'bsum_{b}'] = max(so, si) / lim[(mcu, 'i_sum')]
    return v


# ---------------------------------------------------------------- Leitungsströme (lstsq)
def wire_ref(net, v):
    ws = net['wires']; ends = []
    for w in ws:
        for x in (w['a'], w['b']):
            k = (x['el'], x['pin'])
            if k not in ends: ends.append(k)
    B = np.zeros((len(ends), len(ws)))
    for j, w in enumerate(ws):
        B[ends.index((w['b']['el'], w['b']['pin'])), j] += 1; B[ends.index((w['a']['el'], w['a']['pin'])), j] -= 1
    s = np.array([v.get(f'Ip_{el}_{pin}', 0.0) for el, pin in ends])
    i = np.linalg.lstsq(B, s, rcond=None)[0]
    return {f'W_{w["id"]}': float(i[j]) for j, w in enumerate(ws)}


# ---------------------------------------------------------------- Kleinsignal (komplexes Tableau mit gesteuerten Knotenströmen)
def ac_ref_nl(net, f, branches_fn, term):
    S = solve_dc(net, branches_fn); Vdc = S['V']; w = 2 * math.pi * f
    nodes = list(net['nodes']); br = []
    for e in net['elements']:
        if e['kind'] in NONLIN or e['kind'] == 'transformator': continue
        for t in branches_fn(e, w): br.append((*t, e['id']))
    ctrl = []   # (Knoten des Stroms, Steuerknoten +, −, Leitwert)
    for d in S['devs']:
        if d['t'] == 'd':
            if d['m']['rs'] > 0: nodes.append(d['j']); br.append((d['a'], d['j'], 1, -d['m']['rs'], 0, d['e']['id'] + '#rs'))
            g = diode_g(d['m'], Vdc[d['j']] - Vdc[d['k']])
            ctrl += [(d['j'], d['j'], d['k'], g), (d['k'], d['j'], d['k'], -g)]
        elif d['t'] == 'q':
            J = bjt_jac(d['m'], Vdc[d['b']] - Vdc[d['em']], Vdc[d['b']] - Vdc[d['c']])
            for row, nd in ((0, d['c']), (1, d['b'])):
                for col, (cp, cn) in enumerate(((d['b'], d['em']), (d['b'], d['c']))):
                    ctrl += [(nd, cp, cn, J[row][col]), (d['em'], cp, cn, -J[row][col])]
        else:
            J = mos_jac(d['m'], Vdc[d['g']] - Vdc[d['s']], Vdc[d['d']] - Vdc[d['s']])
            for col, (cp, cn) in enumerate(((d['g'], d['s']), (d['d'], d['s']))):
                ctrl += [(d['d'], cp, cn, J[0][col]), (d['s'], cp, cn, -J[0][col])]
    g0 = net['ground']; vi = {n: i for i, n in enumerate([n for n in nodes if n != g0])}
    nv, nb = len(vi), len(br)
    A = np.zeros((nv + nb, nv + nb), complex); z = np.zeros(nv + nb, complex)
    for j, (a, b, al, be, ga, o) in enumerate(br):
        if a in vi: A[vi[a], nv + j] += 1
        if b in vi: A[vi[b], nv + j] -= 1
        r = nv + j
        if a in vi: A[r, vi[a]] += al
        if b in vi: A[r, vi[b]] -= al
        A[r, nv + j] += be; z[r] = ga
    for nd, cp, cn, g in ctrl:
        if nd not in vi: continue
        if cp in vi: A[vi[nd], vi[cp]] += g
        if cn in vi: A[vi[nd], vi[cn]] -= g
    x = np.linalg.solve(A, z)
    V = {n: (x[vi[n]] if n in vi else 0) for n in nodes}
    v = dict(ok=1.0)
    for n in net['nodes']: v[f'Vre_{n}'] = float(np.real(V[n])); v[f'Vim_{n}'] = float(np.imag(V[n]))
    return v, V


def sweep_ref_nl(net, a, b, f0, f1, n, branches_fn, term):
    fs = [f0 * (f1 / f0) ** (k / (n - 1)) for k in range(n)]
    v = dict(ok=1.0, n=float(n))
    for k, fr in enumerate(fs):
        _, V = ac_ref_nl(net, fr, branches_fn, term); h = V[b] / V[a]
        v[f'g_{k}'] = 20 * math.log10(abs(h)); v[f'ph_{k}'] = math.degrees(math.atan2(h.imag, h.real))
    return v


# ---------------------------------------------------------------- Geschlossene Lösungen
def lambert_diode(U, R, Is, nut):
    """Diode an U über R: I = n U_T / R · W(I_S R / (n U_T) · e^((U + I_S R)/(n U_T))) − I_S."""
    I = nut / R * lambertw(Is * R / nut * math.exp((U + Is * R) / nut)).real - Is
    return I, U - I * R


def bjt_stage(m, Vb, RB, Vcc, RC):
    """NPN-Stufe Emitter an Masse: geschachtelte Bisektion über U_BE (außen) und U_C (innen), mit G_min."""
    def vc_of(vb): return brentq(lambda vc: (Vcc - vc) / RC - bjt_i(m, vb, vb - vc)[0], -1, Vcc + 1, xtol=1e-15, rtol=1e-15)
    vb = brentq(lambda vb: (Vb - vb) / RB - bjt_i(m, vb, vb - vc_of(vb))[1], 0.3, min(Vb, 0.95), xtol=1e-15, rtol=1e-15)
    vc = vc_of(vb); ic, ib = bjt_i(m, vb, vb - vc)
    return dict(vb=vb, vc=vc, ic=ic, ib=ib)
