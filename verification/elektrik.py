"""Unabhängige Gegenrechnung Modul elektrik (eng-core 0.19.0, Werkzeug Stromwerk).

Eigene Python-Umsetzung mit anderen Verfahren als der Kern:
  - Netzwerk: Sparse-Tableau-Analyse (alle Zweigströme und Knotenspannungen als Unbekannte, Kirchhoff + Zweiggleichungen,
    numpy.linalg.solve), Batterie als ein Zweig U = U_0 + R_i · I statt innerem Knoten, idealer Übertrager über
    Zweigpaare. Der Kern rechnet mit modifizierter Knotenpunktanalyse (Leitwertstempel, Hilfszeilen nur für Quellen).
  - Ersatzwiderstand: Laplace-Matrix und Pseudoinverse R_ab = (e_a − e_b)ᵀ L⁺ (e_a − e_b), Kurzschlüsse durch Knotenverschmelzung.
  - Vorlagen und Rechner: geschlossene Formeln neu getippt, E-Reihen E48/E96 aus round(10^(i/n), 2), E6 bis E24 nach Liste.
Prüffälle EL-P (Netzwerke und Literaturbeispiele), EL-Z (Zufallsnetze), EL-F (Fehlerfälle), EL-Q (Ersatzwiderstand),
EL-B (Frequenzgang), EL-V (Vorlagen), EL-T (Rechner), EL-E (E-Reihen). Netzwerke absolut 1e-10 (V, A, W), sonst relativ.
"""
import math
import numpy as np

TOL_ABS = 1e-10
TOL_REL = 1e-12
MOD = 'elektrik'
R_MIN = 1e-6

# ---------------------------------------------------------------- Netzwerk: Sparse-Tableau-Analyse
NONLIN = {'led', 'diode', 'z_diode', 'npn', 'pnp', 'n_mosfet'}
TERM = {'gleichspannungsquelle': ('plus', 'minus'), 'batterie': ('plus', 'minus'), 'gleichstromquelle': ('plus', 'minus'),
        'wechselspannungsquelle': ('plus', 'minus'), 'digitalpin': ('pin', 'gnd'), 'transformator': ('p1', 'p2')}


def branches(e, w):
    """Zweige eines Bauteils: (a, b, alpha, beta, gamma) für alpha·(v_a − v_b) + beta·i = gamma; w = None: Gleichstrom."""
    k, p, P = e['kind'], e['pins'], e['params']
    ac = w is not None
    if k in NONLIN or k in ('masse', 'knoten', 'voltmeter', 'transformator'): return []
    a, b = (p[TERM[k][0]], p[TERM[k][1]]) if k in TERM else (p.get('a'), p.get('b'))
    if k == 'widerstand': return [(a, b, 1, -P['r_ohm'], 0)]
    if k == 'lampe': return [(a, b, 1, -P['u_nenn_V'] ** 2 / P['p_nenn_W'], 0)]
    if k == 'potentiometer':
        x, R = P['position'], P['r_ohm']
        return [(a, p['s'], 1, -max(x * R, R_MIN), 0), (p['s'], b, 1, -max((1 - x) * R, R_MIN), 0)]
    if k == 'kondensator': return [(a, b, -1j * w * P['c_F'], 1, 0)] if ac else []
    if k == 'spule':
        r = P.get('r_ohm', 0) or 0
        return [(a, b, 1, -(r + 1j * w * P['l_H']), 0)] if ac else [(a, b, 1, -r, 0)]
    if k == 'gleichspannungsquelle': return [(a, b, 1, 0, 0 if ac else P['u_V'])]
    if k == 'digitalpin': return [(a, b, 1, 0, 0 if ac or P['zustand'] == 'LOW' else P['u_high_V'])]
    if k == 'batterie': return [(a, b, 1, -P['r_i_ohm'], 0 if ac else P['u_V'])]
    if k == 'gleichstromquelle': return [] if ac else [(a, b, 0, 1, -P['i_A'])]
    if k == 'wechselspannungsquelle':
        u = P['u_eff_V'] * np.exp(1j * math.radians(P.get('phase_deg', 0))) if ac else 0
        return [(a, b, 1, 0, u)]
    if k in ('schalter', 'taster', 'amperemeter'):
        closed = k == 'amperemeter' or P.get('geschlossen' if k == 'schalter' else 'gedrueckt') is True
        return [(a, b, 1, 0, 0)] if closed else []
    raise ValueError(k)


def sta(net, w=None):
    """Knotenspannungen, Bauteilgrößen (u, i, s) über Sparse-Tableau. Gibt None zurück, wenn singulär."""
    els = net['elements']
    br = []          # (a, b, alpha, beta, gamma, owner)
    xf = []          # Übertrager: (index p-Zweig, index s-Zweig, n)
    for e in els:
        for t in branches(e, w): br.append((*t, e['id']))
        if e['kind'] == 'transformator' and w is not None:
            p, P = e['pins'], e['params']
            ip = len(br); br.append((p['p1'], p['p2'], None, None, None, e['id']))
            is_ = len(br); br.append((p['s1'], p['s2'], None, None, None, e['id'] + '#s'))
            xf.append((ip, is_, P['n2'] / P['n1']))
    nodes = list(net['nodes'])
    # Bezug je Teilnetz (leitende Zweige; Stromquellen nicht)
    par = {n: n for n in nodes}
    def f(x):
        while par[x] != x: x = par[x]
        return x
    for (a, b, al, be, ga, o) in br:
        if al is None or al != 0: par[f(b)] = f(a)
    g = net.get('ground')
    refs = {}
    for n in nodes:
        r = f(n)
        if r not in refs: refs[r] = n
    if g in nodes: refs[f(g)] = g
    ref = {n: refs[f(n)] for n in nodes}
    vi = {n: i for i, n in enumerate([n for n in nodes if ref[n] != n])}
    nv, nb = len(vi), len(br)
    A = np.zeros((nv + nb, nv + nb), complex); z = np.zeros(nv + nb, complex)
    for j, (a, b, al, be, ga, o) in enumerate(br):
        if a in vi: A[vi[a], nv + j] += 1
        if b in vi: A[vi[b], nv + j] -= 1
    xmap = {}
    for (ip, is_, n) in xf: xmap[ip] = ('u', is_, n); xmap[is_] = ('i', ip, n)
    for j, (a, b, al, be, ga, o) in enumerate(br):
        r = nv + j
        if j in xmap:
            kind, other, n = xmap[j]
            if kind == 'u':   # u_s − n · u_p = 0 (Zeile des p-Zweigs)
                oa, ob = br[other][0], br[other][1]
                for nd, s in ((oa, 1), (ob, -1), (a, -n), (b, n)):
                    if nd in vi: A[r, vi[nd]] += s
            else:             # i_p + n · i_s = 0 (Zeile des s-Zweigs)
                A[r, nv + other] = 1; A[r, nv + j] = n
            continue
        if a in vi: A[r, vi[a]] += al
        if b in vi: A[r, vi[b]] -= al
        A[r, nv + j] += be; z[r] = ga
    try:
        if abs(np.linalg.det(A)) < 1e-300 or np.linalg.cond(A) > 1e14: return None
        x = np.linalg.solve(A, z)
    except np.linalg.LinAlgError:
        return None
    V = {n: (x[vi[n]] if n in vi else 0) for n in nodes}
    res = {}
    for e in els:
        k, p = e['kind'], e['pins']
        if k in NONLIN or k in ('masse', 'knoten'): continue
        ta, tb = TERM.get(k, ('a', 'b'))
        if p.get(ta) is None or p.get(tb) is None: continue
        if k == 'transformator' and w is None: pass
        u = V[p[ta]] - V[p[tb]]
        js = [j for j, t in enumerate(br) if t[5] in (e['id'], e['id'] + '#s')]
        i = x[nv + js[0]] if js else 0
        s = sum((V[br[j][0]] - V[br[j][1]]) * np.conj(x[nv + j]) for j in js) if js else 0
        res[e['id']] = (u, i, s)
    return V, res


def dc_ref(net, util=True):
    V, res = sta(net)
    v = dict(ok=1.0, nFail=0.0)
    for n in net['nodes']: v[f'V_{n}'] = float(np.real(V[n]))
    bal = 0.0
    for e in net['elements']:
        if e['id'] not in res: continue
        u, i, s = res[e['id']]
        v[f'U_{e["id"]}'] = float(np.real(u)); v[f'I_{e["id"]}'] = float(np.real(i)); v[f'P_{e["id"]}'] = float(np.real(s)); bal += float(np.real(s))
        P = e['params']
        if util and e['kind'] == 'widerstand' and P.get('p_max_W'): v[f'util_{e["id"]}'] = abs(float(np.real(s))) / P['p_max_W']
        if util and e['kind'] == 'kondensator' and P.get('u_max_V'): v[f'util_{e["id"]}'] = abs(float(np.real(u))) / P['u_max_V']
    v['bal'] = bal
    v['nFail'] = float(sum(1 for k, a in v.items() if k.startswith('util_') and a > 1))
    return v


def ac_ref(net, f):
    V, res = sta(net, 2 * math.pi * f)
    v = dict(ok=1.0, nFail=0.0)
    for n in net['nodes']: v[f'Vre_{n}'] = float(np.real(V[n])); v[f'Vim_{n}'] = float(np.imag(V[n]))
    for e in net['elements']:
        if e['id'] not in res: continue
        u, i, s = res[e['id']]; k = e['id']
        v.update({f'Ure_{k}': float(np.real(u)), f'Uim_{k}': float(np.imag(u)), f'Ire_{k}': float(np.real(i)), f'Iim_{k}': float(np.imag(i)),
                  f'Sre_{k}': float(np.real(s)), f'Sim_{k}': float(np.imag(s))})
    return v


def sweep_ref(net, a, b, f0, f1, n):
    fs = [f0 * (f1 / f0) ** (k / (n - 1)) for k in range(n)]
    v = dict(ok=1.0, n=float(n)); g = []
    for k, fr in enumerate(fs):
        V, _ = sta(net, 2 * math.pi * fr); h = V[b] / V[a]
        g.append(20 * math.log10(abs(h))); v[f'g_{k}'] = g[-1]; v[f'ph_{k}'] = math.degrees(math.atan2(h.imag, h.real))
    kp = int(np.argmax(g)); lvl = g[kp] - 10 * math.log10(2)
    v['fPeak'] = fs[kp]; v['gPeak'] = g[kp]
    cross = []
    for k in range(1, n):
        d0, d1 = g[k - 1] - lvl, g[k] - lvl
        if d0 * d1 < 0:
            t = d0 / (d0 - d1); cross.append(10 ** (math.log10(fs[k - 1]) + t * (math.log10(fs[k]) - math.log10(fs[k - 1]))))
    v['n3'] = float(len(cross))
    for k, c in enumerate(cross): v[f'f3_{k}'] = c
    return v


def req_ref(net, a, b):
    """Laplace-Pseudoinverse; Quellen entfernt, Kurzschlüsse verschmolzen."""
    edges = []
    for e in net['elements']:
        k, p, P = e['kind'], e['pins'], e['params']
        if k == 'widerstand': edges.append((p['a'], p['b'], P['r_ohm']))
        elif k == 'lampe': edges.append((p['a'], p['b'], P['u_nenn_V'] ** 2 / P['p_nenn_W']))
        elif k == 'potentiometer': edges += [(p['a'], p['s'], max(P['position'] * P['r_ohm'], R_MIN)), (p['s'], p['b'], max((1 - P['position']) * P['r_ohm'], R_MIN))]
        elif k == 'spule': edges.append((p['a'], p['b'], P.get('r_ohm', 0) or 0))
        elif k == 'amperemeter' or (k == 'schalter' and P.get('geschlossen') is True) or (k == 'taster' and P.get('gedrueckt') is True): edges.append((p['a'], p['b'], 0))
    par = {}
    def f(x):
        par.setdefault(x, x)
        while par[x] != x: x = par[x]
        return x
    for (x, y, r) in edges:
        f(x); f(y)
        if r == 0: par[f(y)] = f(x)
    f(a); f(b)
    if f(a) == f(b): return 0.0
    res = [(f(x), f(y), r) for (x, y, r) in edges if r > 0 and f(x) != f(y)]
    ns = sorted({n for x, y, _ in res for n in (x, y)} | {f(a), f(b)})
    ix = {n: i for i, n in enumerate(ns)}
    L = np.zeros((len(ns), len(ns)))
    for x, y, r in res:
        g = 1 / r; i, j = ix[x], ix[y]; L[i, i] += g; L[j, j] += g; L[i, j] -= g; L[j, i] -= g
    d = np.zeros(len(ns)); d[ix[f(a)]] = 1; d[ix[f(b)]] = -1
    # Verbindung prüfen: Komponente von a
    seen, st = {f(a)}, [f(a)]
    while st:
        n = st.pop()
        for x, y, _ in res:
            for u, w_ in ((x, y), (y, x)):
                if u == n and w_ not in seen: seen.add(w_); st.append(w_)
    if f(b) not in seen: return None
    return float(d @ np.linalg.pinv(L) @ d)


# ---------------------------------------------------------------- Tabellen und Normwerte
E = {6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8], 12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
     24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]}
E[48] = [round(10 ** (i / 48), 2) for i in range(48)]
E[96] = [round(10 ** (i / 96), 2) for i in range(96)]


def e_pick(x, n):
    vals = sorted(float('%.12g' % (m * 10.0 ** d)) for d in range(-15, 16) for m in E[n])
    lo = max(v for v in vals if v <= float('%.12g' % x)); hi = min(v for v in vals if v >= float('%.12g' % x))
    near = hi if math.log(hi / x) <= math.log(x / lo) else lo
    return near, lo, hi


COL = {'schwarz': (0, 0, None), 'braun': (1, 1, 1), 'rot': (2, 2, 2), 'orange': (3, 3, 0.05), 'gelb': (4, 4, 0.02), 'gruen': (5, 5, 0.5), 'blau': (6, 6, 0.25),
       'violett': (7, 7, 0.1), 'grau': (8, 8, 0.01), 'weiss': (9, 9, None), 'gold': (None, -1, 5), 'silber': (None, -2, 10)}


# ---------------------------------------------------------------- Vorlagen (geschlossene Formeln)
def sheet_ref(sid, mode, x):
    n = int(x.get('e_reihe', 24)); k = {}
    U = x.get('u_V')
    def norm(v, higher=False):
        near, lo, hi = e_pick(v, n); return hi if higher else near
    if sid == 'S1':
        R1, RL = x['r1_ohm'], x['r_last_ohm']
        if mode == 'auslegen':
            r2 = R1 * x['u2_V'] / (U - x['u2_V']); k['r2_ohm'] = r2; R2 = norm(r2); k['r2_norm'] = R2
        else: R2 = x['r2_ohm']
        p = 1 / (1 / R2 + 1 / RL); u2 = U * R2 / (R1 + R2); u2l = U * p / (R1 + p)
        k.update(u2_V=u2, u2l_V=u2l, il_A=u2l / RL, iq_A=u2l / R2, q=RL / R2, du=(u2 - u2l) / u2)
    elif sid in ('S2', 'S3'):
        hp = sid == 'S3'; R, C, f = x.get('r_ohm'), x.get('c_F'), x['f_Hz']
        if mode == 'auslegen':
            if hp: r = 1 / (2 * math.pi * x['fg_Hz'] * C); k['r_ohm'] = r; R = norm(r); k['r_norm'] = R
            else: c = 1 / (2 * math.pi * x['fg_Hz'] * R); k['c_F'] = c; C = norm(c); k['c_norm'] = C
        w = 2 * math.pi * f; H = (1j * w * R * C / (1 + 1j * w * R * C)) if hp else 1 / (1 + 1j * w * R * C)
        k.update(fg_Hz=1 / (2 * math.pi * R * C), tau_s=R * C, h=abs(H), g_dB=20 * math.log10(abs(H)), phi_deg=math.degrees(np.angle(H)), ua_V=abs(H) * U)
    elif sid == 'S4':
        R, L = x['r_ohm'], x['l_H']
        if mode == 'auslegen':
            c = 1 / (L * (2 * math.pi * x['f0_Hz']) ** 2); k['c_F'] = c; C = norm(c); k['c_norm'] = C
        else: C = x['c_F']
        w0 = 1 / math.sqrt(L * C); f0 = w0 / (2 * math.pi); Q = w0 * L / R
        # Grenzfrequenzen aus |Z| = √2 · R: ω² L C ∓ ω R C − 1 = 0
        wu = (-R * C + math.sqrt((R * C) ** 2 + 4 * L * C)) / (2 * L * C); wo = (R * C + math.sqrt((R * C) ** 2 + 4 * L * C)) / (2 * L * C)
        k.update(f0_Hz=f0, q=Q, b_Hz=(wo - wu) / (2 * math.pi), fu_Hz=wu / (2 * math.pi), fo_Hz=wo / (2 * math.pi), i0_A=U / R, uc0_V=U / (w0 * C * R))
    elif sid == 'S5':
        UF, IF = x['u_f_V'], x['i_f_A']
        if mode == 'auslegen':
            r = (U - UF) / IF; k['r_ohm'] = r; R = norm(r, True); k['r_norm'] = R
        else: R = x['r_ohm']
        I = (U - UF) / R; k.update(i_A=I, pr_W=I * I * R, pled_W=UF * I)
    elif sid == 'S6':
        C, t = x['c_F'], x['t_s']
        if mode == 'auslegen':
            r = x['tau_s'] / C; k['r_ohm'] = r; R = norm(r); k['r_norm'] = R
        else: R = x['r_ohm']
        T = R * C; k.update(tau_s=T, ul_V=U - U * math.exp(-t / T), ue_V=U * math.exp(-t / T), i_A=U / R * math.exp(-t / T), t99_s=T * math.log(100), t01_s=T * math.log(100), w_J=C * U * U / 2)
    elif sid == 'S7':
        R1, R2, R3 = x['r1_ohm'], x['r2_ohm'], x['r3_ohm']
        if mode == 'auslegen':
            r = R2 * R3 / R1; k['r4_ohm'] = r; R4 = norm(r); k['r4_norm'] = R4
        else: R4 = x['r4_ohm']
        k['ud_V'] = U * (R2 * (R3 + R4) - R4 * (R1 + R2)) / ((R1 + R2) * (R3 + R4))
    elif sid == 'S8':
        R, t = x['r_ohm'], x['t_s']
        if mode == 'auslegen':
            l = x['tau_s'] * R; k['l_H'] = l; L = norm(l); k['l_norm'] = L
        else: L = x['l_H']
        T = L / R; I = U / R; k.update(tau_s=T, i_A=I - I * math.exp(-t / T), ul_V=U * math.exp(-t / T), ie_A=I, w_J=L * I * I / 2)
    return k


def tool_ref(tid, x):
    if tid == 'R1':
        rings = int(x['ringe']); nd = rings - 2; cs = [x[f'ring{i + 1}'] for i in range(rings)]
        m = 0
        for c in cs[:nd]: m = 10 * m + COL[c][0]
        R = float('%.12g' % (m * 10.0 ** COL[cs[nd]][1])); t = COL[cs[nd + 1]][2] / 100
        return dict(r_ohm=R, tol=t, rmin_ohm=R - R * t, rmax_ohm=R + R * t)
    if tid == 'R2':
        near, lo, hi = e_pick(x['wert'], int(x['e_reihe'])); return dict(nearest=near, lower=lo, upper=hi, dev=near / x['wert'] - 1)
    if tid == 'R3':
        g, U, I, R, P = x['gegeben'], x.get('u_V'), x.get('i_A'), x.get('r_ohm'), x.get('p_W')
        if g == 'U und R': I = U / R; P = U * I
        elif g == 'U und I': R = U / I; P = U * I
        elif g == 'I und R': U = I * R; P = U * I
        elif g == 'P und U': I = P / U; R = U / I
        elif g == 'P und R': I = math.sqrt(P / R); U = I * R
        elif g == 'P und I': U = P / I; R = U / I
        return dict(u_V=U, i_A=I, r_ohm=R, p_W=P)
    if tid == 'R4':
        n, m, eta = x.get('n_reihe', 1), x.get('m_parallel', 1), x.get('nutzbar', 1)
        Wh = n * x['u_V'] * m * x['kapazitaet_Ah']; th = eta * m * x['kapazitaet_Ah'] / x['i_A']
        return dict(u_ges_V=n * x['u_V'], c_ges_Ah=m * x['kapazitaet_Ah'], e_Wh=Wh, e_J=Wh * 3600, t_h=th, t_s=th * 3600, c_rate=x['i_A'] / (m * x['kapazitaet_Ah']))
    if tid == 'R5':
        U, I, cp = x['u_V'], x['i_A'], x['cos_phi']; S = 3 * (U / math.sqrt(3)) * I
        star = x['schaltung'] == 'Stern'
        return dict(s_VA=S, p_W=S * cp, q_var=S * math.sin(math.acos(cp)), u_str_V=U / math.sqrt(3) if star else U, i_str_A=I if star else I / math.sqrt(3))
    if tid == 'R6':
        P, nr, U, eta, cp = x['p_W'], x['n_rpm'], x['u_V'], x['eta'], x['cos_phi']; f, p = x.get('f_Hz', 50), x.get('polpaare', 2)
        ns = 60 * f / p
        return dict(m_Nm=P * 60 / (2 * math.pi * nr), p_zu_W=P / eta, i_A=P / eta / (math.sqrt(3) * U * cp), ns_rpm=ns, s=1 - nr / ns)


# ---------------------------------------------------------------- Netze
def E_(id_, kind, pins, **params): return dict(id=id_, kind=kind, pins=pins, params=params, label=id_)
def net(nodes, *els, ground='0'): return dict(nodes=nodes, ground=ground, elements=list(els) + ([E_('GND', 'masse', dict(a=ground))] if ground else []))

P1 = net(['1', '2', '3', '0'], E_('U1', 'gleichspannungsquelle', dict(plus='1', minus='0'), u_V=12.0), E_('A1', 'amperemeter', dict(a='1', b='3')),
         E_('R1', 'widerstand', dict(a='3', b='2'), r_ohm=100.0, p_max_W=0.25), E_('R2', 'widerstand', dict(a='2', b='0'), r_ohm=200.0, p_max_W=0.25),
         E_('R3', 'widerstand', dict(a='2', b='0'), r_ohm=300.0, p_max_W=0.25), E_('V1', 'voltmeter', dict(a='3', b='2')))
P2 = net(['1', '2', '3', '4', '0'], E_('B1', 'batterie', dict(plus='1', minus='0'), u_V=9.0, r_i_ohm=0.5, kapazitaet_Ah=0.5),
         E_('P1', 'potentiometer', dict(a='1', b='0', s='2'), r_ohm=10000.0, position=0.3), E_('R1', 'widerstand', dict(a='2', b='3'), r_ohm=4700.0, p_max_W=0.25),
         E_('H1', 'lampe', dict(a='3', b='0'), u_nenn_V=12.0, p_nenn_W=5.0), E_('S1', 'schalter', dict(a='1', b='4'), geschlossen=True), E_('R2', 'widerstand', dict(a='4', b='0'), r_ohm=220.0, p_max_W=0.5))
P3 = net(['1', '2', '3', '4', '0'], E_('I1', 'gleichstromquelle', dict(plus='1', minus='0'), i_A=0.01), E_('R1', 'widerstand', dict(a='1', b='0'), r_ohm=1000.0),
         E_('L1', 'spule', dict(a='1', b='2'), l_H=0.1, r_ohm=12.0), E_('R2', 'widerstand', dict(a='2', b='0'), r_ohm=470.0), E_('C1', 'kondensator', dict(a='2', b='3'), c_F=1e-6, u_max_V=6.3),
         E_('R3', 'widerstand', dict(a='3', b='0'), r_ohm=1000.0), E_('S1', 'schalter', dict(a='2', b='4'), geschlossen=False), E_('R4', 'widerstand', dict(a='4', b='0'), r_ohm=10.0),
         E_('U2', 'gleichspannungsquelle', dict(plus='3', minus='4'), u_V=1.5))
P4 = net(['1', '2', '3', '0'], E_('U1', 'gleichspannungsquelle', dict(plus='1', minus='0'), u_V=10.0), E_('R1', 'widerstand', dict(a='1', b='2'), r_ohm=1000.0),
         E_('R2', 'widerstand', dict(a='2', b='0'), r_ohm=1200.0), E_('R3', 'widerstand', dict(a='1', b='3'), r_ohm=820.0), E_('R4', 'widerstand', dict(a='3', b='0'), r_ohm=1500.0),
         E_('R5', 'widerstand', dict(a='2', b='3'), r_ohm=330.0))
P5 = net(['1', '2', '0'], E_('AC1', 'wechselspannungsquelle', dict(plus='1', minus='0'), u_eff_V=1.0, f_Hz=1000.0, phase_deg=0.0),
         E_('R1', 'widerstand', dict(a='1', b='2'), r_ohm=1000.0), E_('C1', 'kondensator', dict(a='2', b='0'), c_F=1e-7, u_max_V=50.0))
P6 = net(['1', '2', '3', '0'], E_('AC1', 'wechselspannungsquelle', dict(plus='1', minus='0'), u_eff_V=230.0, f_Hz=50.0, phase_deg=30.0),
         E_('R1', 'widerstand', dict(a='1', b='2'), r_ohm=10.0), E_('L1', 'spule', dict(a='2', b='3'), l_H=0.01, r_ohm=0.4), E_('C1', 'kondensator', dict(a='3', b='0'), c_F=1e-7))
P7 = net(['1', '2', '3', '4', '0'], E_('AC1', 'wechselspannungsquelle', dict(plus='1', minus='0'), u_eff_V=230.0, f_Hz=50.0, phase_deg=0.0),
         E_('T1', 'transformator', dict(p1='1', p2='0', s1='2', s2='0'), n1=230.0, n2=12.0), E_('R1', 'widerstand', dict(a='2', b='3'), r_ohm=4.0),
         E_('L1', 'spule', dict(a='3', b='0'), l_H=0.02, r_ohm=0.0), E_('T2', 'transformator', dict(p1='1', p2='0', s1='4', s2='5'), n1=100.0, n2=50.0),
         E_('R2', 'widerstand', dict(a='4', b='5'), r_ohm=100.0))
P7['nodes'] = ['1', '2', '3', '4', '5', '0']
P8 = net(['1', '2', '3', '0'], E_('PIN', 'digitalpin', dict(pin='1', gnd='0'), zustand='HIGH', u_high_V=5.0), E_('R1', 'widerstand', dict(a='1', b='2'), r_ohm=220.0),
         E_('LED1', 'led', dict(anode='2', kathode='3'), u_f_V=2.0, i_f_A=0.02, i_max_A=0.03, farbe='rot'), E_('R2', 'widerstand', dict(a='3', b='0'), r_ohm=1000.0))
P9 = net(['1', '2', '0'], E_('B1', 'batterie', dict(plus='1', minus='0'), u_V=12.0, r_i_ohm=0.2, kapazitaet_Ah=7.0),
         E_('AC1', 'wechselspannungsquelle', dict(plus='2', minus='1'), u_eff_V=2.0, f_Hz=1000.0, phase_deg=0.0), E_('R1', 'widerstand', dict(a='2', b='0'), r_ohm=10.0),
         E_('C1', 'kondensator', dict(a='2', b='0'), c_F=1e-5))


def rand_dc(seed):
    g = np.random.RandomState(seed); n = 6; nodes = [str(i) for i in range(1, n)] + ['0']; els = []
    for i in range(1, n):  # Baum
        els.append(E_(f'R{len(els)}', 'widerstand', dict(a=nodes[i - 1], b=nodes[g.randint(0, i)] if i > 1 else '0'), r_ohm=float(10 ** g.uniform(1, 4))))
    for _ in range(5):
        a, b = g.choice(len(nodes), 2, replace=False); els.append(E_(f'R{len(els)}', 'widerstand', dict(a=nodes[a], b=nodes[b]), r_ohm=float(10 ** g.uniform(1, 4))))
    par = {x: x for x in nodes}
    def f(x):
        while par[x] != x: x = par[x]
        return x
    k = 0
    while k < 2:
        a, b = g.choice(len(nodes), 2, replace=False)
        if f(nodes[a]) == f(nodes[b]): continue
        par[f(nodes[b])] = f(nodes[a]); els.append(E_(f'U{k}', 'gleichspannungsquelle', dict(plus=nodes[a], minus=nodes[b]), u_V=float(g.uniform(-24, 24)))); k += 1
    a, b = g.choice(len(nodes), 2, replace=False); els.append(E_('I0', 'gleichstromquelle', dict(plus=nodes[a], minus=nodes[b]), i_A=float(g.uniform(-0.05, 0.05))))
    return net(nodes, *els)


def rand_ac(seed):
    g = np.random.RandomState(seed); nodes = ['1', '2', '3', '4', '0']; els = [E_('AC', 'wechselspannungsquelle', dict(plus='1', minus='0'), u_eff_V=float(g.uniform(1, 50)), f_Hz=1000.0, phase_deg=float(g.uniform(-90, 90)))]
    for i in range(1, 4): els.append(E_(f'R{i}', 'widerstand', dict(a=nodes[i - 1], b=nodes[i]), r_ohm=float(10 ** g.uniform(1, 3))))
    els.append(E_('C1', 'kondensator', dict(a='2', b='0'), c_F=float(10 ** g.uniform(-8, -5))))
    els.append(E_('L1', 'spule', dict(a='3', b='0'), l_H=float(10 ** g.uniform(-3, -1)), r_ohm=float(g.uniform(0, 5))))
    els.append(E_('C2', 'kondensator', dict(a='4', b='0'), c_F=float(10 ** g.uniform(-8, -5))))
    els.append(E_('R4', 'widerstand', dict(a='1', b='4'), r_ohm=float(10 ** g.uniform(1, 3))))
    return net(nodes, *els)


def add_cases(cases, ref):
    def case(id_, c, vals, tol, absolute):
        c = dict(c, id=id_, module=MOD)
        if absolute: c['abs'] = True
        cases.append(c); ref[id_] = (vals, tol)

    # ---------------- Gleichstrom
    for id_, nt in (('EL-P1 Reihe und Parallel (Beispiel Stromwerk)', P1), ('EL-P2 Batterie, Potentiometer, Lampe, Schalter', P2),
                    ('EL-P3 Stromquelle, Spule mit r, Kondensator offen, Schalter offen', P3), ('EL-P4 Brücke mit Querwiderstand', P4),
                    ('EL-P8 Digitalpin, LED nicht simuliert', P8), ('EL-P9 Batterie und Wechselquelle bei Gleichstrom', P9)):
        case(id_ + ' DC', dict(type='eldc', net=nt), dc_ref(nt), TOL_ABS, True)
    # Literatur/Lehrbuchwert des Beispiels: R_ges = 220 Ω, I = 54,545 mA, U_R1 = 5,4545 V
    case('EL-P1 Kennwerte von Hand', dict(type='eldc', net=P1), dict(I_R1=12 / 220, U_R1=12 * 100 / 220, U_V1=12 * 100 / 220, I_A1=12 / 220, P_U1=-12 * 12 / 220), 1e-12, False)
    for s in range(20):
        nt = rand_dc(100 + s); case(f'EL-Z{s + 1:02d} Zufallsnetz Gleichstrom', dict(type='eldc', net=nt), dc_ref(nt, util=False), TOL_ABS, True)
    # ---------------- Wechselstrom
    for id_, nt, f in (('EL-P5 RC-Tiefpass 1 kHz', P5, 1000.0), ('EL-P5 RC-Tiefpass bei f_g', P5, 1 / (2 * math.pi * 1e-4)), ('EL-P6 RLC 50 Hz, Phase 30°', P6, 50.0),
                       ('EL-P6 RLC bei Resonanz', P6, 1 / (2 * math.pi * math.sqrt(1e-9))), ('EL-P7 Transformatoren, geerdet und galvanisch getrennt', P7, 50.0),
                       ('EL-P9 Batterie und Wechselquelle bei Wechselstrom', P9, 1000.0)):
        case(id_, dict(type='elac', net=nt, f=f), ac_ref(nt, f), TOL_ABS, True)
    case('EL-P5 Tiefpass bei f_g von Hand', dict(type='elac', net=P5, f=1 / (2 * math.pi * 1e-4)), dict(Vre_2=0.5, Vim_2=-0.5), 1e-12, True)
    for s in range(10):
        nt = rand_ac(200 + s); f = float(10 ** np.random.RandomState(300 + s).uniform(1, 5))
        case(f'EL-Z{s + 21:02d} Zufallsnetz Wechselstrom', dict(type='elac', net=nt, f=f), ac_ref(nt, f), TOL_ABS, True)
    # ---------------- Frequenzgang
    case('EL-B1 RC-Tiefpass 10 Hz bis 100 kHz, 200 Punkte', dict(type='elsweep', net=P5, inNode='1', outNode='2', fMin=10.0, fMax=1e5, n=200), sweep_ref(P5, '1', '2', 10.0, 1e5, 200), TOL_ABS, True)
    case('EL-B2 RLC Bandpass an R1 (Knoten 1 → 2 ergibt U_C-Abgriff)', dict(type='elsweep', net=P6, inNode='1', outNode='3', fMin=100.0, fMax=1e5, n=301), sweep_ref(P6, '1', '3', 100.0, 1e5, 301), 1e-8, True)
    # ---------------- Fehlerfälle
    F1 = net(['1', '0'], E_('U1', 'gleichspannungsquelle', dict(plus='1', minus='0'), u_V=5.0), E_('U2', 'gleichspannungsquelle', dict(plus='1', minus='0'), u_V=5.0), E_('R1', 'widerstand', dict(a='1', b='0'), r_ohm=10.0))
    F2 = net(['1', '0'], E_('U1', 'gleichspannungsquelle', dict(plus='1', minus='0'), u_V=5.0), E_('S1', 'schalter', dict(a='1', b='0'), geschlossen=True))
    F3 = net(['1', '2', '0'], E_('I1', 'gleichstromquelle', dict(plus='1', minus='2'), i_A=1.0), E_('R1', 'widerstand', dict(a='1', b='0'), r_ohm=10.0), E_('C1', 'kondensator', dict(a='2', b='0'), c_F=1e-6))
    F4 = dict(nodes=['1', '2'], ground=None, elements=[E_('U1', 'gleichspannungsquelle', dict(plus='1', minus='2'), u_V=5.0), E_('R1', 'widerstand', dict(a='1', b='2'), r_ohm=10.0)])
    case('EL-F1 Zwei Spannungsquellen parallel', dict(type='eldc', net=F1), dict(ok=0.0, nFail=1.0), 0, False)
    case('EL-F2 Quelle durch Schalter kurzgeschlossen', dict(type='eldc', net=F2), dict(ok=0.0, nFail=1.0), 0, False)
    case('EL-F3 Stromquelle ohne Rückweg (Kondensator offen)', dict(type='eldc', net=F3), dict(ok=1.0, nFail=1.0, V_1=0.0, I_R1=0.0), 0, False)
    case('EL-F4 Ohne Masse: Bezug erster Knoten', dict(type='eldc', net=F4), dict(ok=1.0, nFail=0.0, V_1=0.0, V_2=-5.0, I_R1=0.5), 1e-12, True)
    # ---------------- Ersatzwiderstand
    Q1 = net(['1', '2', '3', '4', '0'], E_('R1', 'widerstand', dict(a='1', b='2'), r_ohm=100.0), E_('R2', 'widerstand', dict(a='2', b='0'), r_ohm=200.0),
             E_('R3', 'widerstand', dict(a='2', b='3'), r_ohm=150.0), E_('R4', 'widerstand', dict(a='3', b='0'), r_ohm=150.0), E_('R5', 'widerstand', dict(a='3', b='4'), r_ohm=47.0),
             E_('U1', 'gleichspannungsquelle', dict(plus='1', minus='0'), u_V=10.0), E_('S1', 'schalter', dict(a='4', b='0'), geschlossen=False))
    for id_, nt, a, b, red in (('EL-Q1 Leiter (Reihe/Parallel), Quelle entfernt, Schalter offen', Q1, '1', '0', 1), ('EL-Q2 Brücke mit Querwiderstand', P4, '1', '0', 0),
                               ('EL-Q3 Beispiel Reihe und Parallel an den Quellenklemmen', P1, '1', '0', 1), ('EL-Q4 Potentiometer, Lampe, geschlossener Schalter', P2, '1', '0', 1),
                               ('EL-Q5 Brücke zwischen den Mittelpunkten (Quelle entfernt: reduzierbar)', P4, '2', '3', 1)):
        r = req_ref(nt, a, b)
        case(id_, dict(type='elreq', net=nt, a=a, b=b), dict(r=r, rMna=r, reducible=float(red), ok=1.0), 1e-12, False)
    case('EL-Q1 Kennwert von Hand', dict(type='elreq', net=Q1, a='1', b='0'), dict(r=100 + 1 / (1 / 200 + 1 / 300)), 1e-12, False)
    Q6 = net(['1', '2', '3', '0'], E_('R1', 'widerstand', dict(a='1', b='2'), r_ohm=100.0), E_('R2', 'widerstand', dict(a='3', b='0'), r_ohm=100.0))
    case('EL-Q6 Keine Verbindung', dict(type='elreq', net=Q6, a='1', b='0'), dict(open=1.0), 0, False)
    # ---------------- Vorlagen
    base = dict(u_V=12.0, r1_ohm=1e4, r2_ohm=1e4, r_last_ohm=1e6, r_ohm=1000.0, c_F=1e-7, f_Hz=1000.0, l_H=0.01, u_f_V=2.0, i_f_A=0.02, t_s=5e-4, r3_ohm=1000.0, r4_ohm=1200.0,
                u2_V=5.0, fg_Hz=1000.0, f0_Hz=5000.0, tau_s=1e-3, e_reihe=24)
    vars_ = {'S1': [{}, dict(r_last_ohm=4700.0)], 'S2': [{}, dict(f_Hz=1591.5494309189535)], 'S3': [{}, dict(f_Hz=50.0)], 'S4': [{}, dict(r_ohm=100.0, l_H=0.1, c_F=1e-6)],
             'S5': [{}, dict(u_V=3.3, u_f_V=1.8, i_f_A=0.01, e_reihe=12)], 'S6': [{}, dict(t_s=0.0)], 'S7': [{}, dict(r4_ohm=1000.0)], 'S8': [{}, dict(t_s=1e-5)]}
    for sid, vs in vars_.items():
        for j, v in enumerate(vs):
            for mode in ('nachrechnen', 'auslegen'):
                x = dict(base, **v)
                case(f'EL-V {sid} {mode} {j + 1}', dict(type='elsheet', sheet=sid, mode=mode, inp=x), {f'k_{kk}': vv for kk, vv in sheet_ref(sid, mode, x).items()}, TOL_REL, False)
    # Lehrbuchwerte der Vorlagen (Konzept elektrik Abschn. 4)
    case('EL-V S2 Grenzfrequenz 1 kΩ, 100 nF', dict(type='elsheet', sheet='S2', mode='nachrechnen', inp=dict(base, f_Hz=1591.5494309189535)), dict(k_fg_Hz=1591.5494309189535, k_g_dB=-10 * math.log10(2), k_phi_deg=-45.0), 1e-12, False)
    case('EL-V S4 RLC 10 Ω, 10 mH, 100 nF', dict(type='elsheet', sheet='S4', mode='nachrechnen', inp=dict(base, r_ohm=10.0, l_H=0.01, c_F=1e-7)), dict(k_f0_Hz=5032.921210448703, k_q=31.622776601683793, k_b_Hz=159.15494309189535), 1e-12, False)
    case('EL-V S5 LED 5 V, 2 V, 220 Ω', dict(type='elsheet', sheet='S5', mode='nachrechnen', inp=dict(base, u_V=5.0, r_ohm=220.0)), dict(k_i_A=3 / 220), 1e-12, False)
    case('EL-V S5 Auslegen 5 V, 2 V, 20 mA → 150 Ω (E24 nächsthöher)', dict(type='elsheet', sheet='S5', mode='auslegen', inp=dict(base, u_V=5.0)), dict(k_r_ohm=150.0, k_r_norm=150.0), 1e-12, False)
    case('EL-V S5 Auslegen 3,3 V, 1,8 V, 10 mA → 150 Ω (E12)', dict(type='elsheet', sheet='S5', mode='auslegen', inp=dict(base, u_V=3.3, u_f_V=1.8, i_f_A=0.01, e_reihe=12)), dict(k_r_norm=150.0), 1e-12, False)
    case('EL-V S1 Fehler U_2 ≥ U', dict(type='elsheet', sheet='S1', mode='auslegen', inp=dict(base, u2_V=13.0)), dict(ok=0.0), 0, False)
    case('EL-V S5 Fehler U ≤ U_F', dict(type='elsheet', sheet='S5', mode='nachrechnen', inp=dict(base, u_V=1.5)), dict(ok=0.0), 0, False)
    # ---------------- Rechner
    tools = [('R1', dict(ringe='4', ring1='gelb', ring2='violett', ring3='rot', ring4='gold')), ('R1', dict(ringe='5', ring1='braun', ring2='schwarz', ring3='schwarz', ring4='braun', ring5='braun')),
             ('R1', dict(ringe='4', ring1='gelb', ring2='violett', ring3='silber', ring4='grau')), ('R1', dict(ringe='4', ring1='rot', ring2='rot', ring3='gold', ring4='rot')),
             ('R2', dict(wert=4300.0, e_reihe='24')), ('R2', dict(wert=5000.0, e_reihe='12')), ('R2', dict(wert=0.0123, e_reihe='96')), ('R2', dict(wert=8.66e6, e_reihe='48')), ('R2', dict(wert=999.0, e_reihe='6')),
             ('R3', dict(gegeben='U und R', u_V=12.0, r_ohm=120.0)), ('R3', dict(gegeben='U und I', u_V=230.0, i_A=0.5)), ('R3', dict(gegeben='I und R', i_A=0.02, r_ohm=150.0)),
             ('R3', dict(gegeben='P und U', p_W=60.0, u_V=230.0)), ('R3', dict(gegeben='P und R', p_W=0.25, r_ohm=1000.0)), ('R3', dict(gegeben='P und I', p_W=2.0, i_A=0.1)),
             ('R4', dict(kapazitaet_Ah=2.0, u_V=3.7, i_A=0.25, nutzbar=0.8)), ('R4', dict(kapazitaet_Ah=3.0, u_V=3.6, i_A=5.0, nutzbar=0.9, n_reihe=4, m_parallel=2)),
             ('R5', dict(u_V=400.0, i_A=10.0, cos_phi=0.85, schaltung='Stern')), ('R5', dict(u_V=400.0, i_A=16.0, cos_phi=0.9, schaltung='Dreieck')),
             ('R6', dict(p_W=1500.0, n_rpm=1450.0, u_V=400.0, eta=0.85, cos_phi=0.82)), ('R6', dict(p_W=4000.0, n_rpm=2900.0, u_V=400.0, eta=0.87, cos_phi=0.86, f_Hz=50.0, polpaare=1))]
    for j, (tid, x) in enumerate(tools):
        case(f'EL-T{j + 1:02d} {tid}', dict(type='eltool', tool=tid, inp=x), tool_ref(tid, x), TOL_REL, False)
    case('EL-T R5 Literaturwert 400 V, 10 A, cos φ 0,85', dict(type='eltool', tool='R5', inp=dict(u_V=400.0, i_A=10.0, cos_phi=0.85, schaltung='Stern')), dict(p_W=5888.972745734183), 1e-12, False)
    case('EL-T R6 Synchrone Drehzahl 50 Hz, p = 2', dict(type='eltool', tool='R6', inp=dict(p_W=1500.0, n_rpm=1450.0, u_V=400.0, eta=0.85, cos_phi=0.82)), dict(k_ns_rpm=1500.0), 1e-12, False)
    case('EL-T R1 Fehler Gold als Ziffer', dict(type='eltool', tool='R1', inp=dict(ringe='4', ring1='gold', ring2='violett', ring3='rot', ring4='gold')), dict(ok=0.0), 0, False)
    # Kennwerte der Rechner als k_-Schlüssel
    for c in cases:
        if c['type'] == 'eltool' and not any(k.startswith('k_') or k == 'ok' for k in ref[c['id']][0]):
            ref[c['id']] = ({f'k_{k}': v for k, v in ref[c['id']][0].items()}, ref[c['id']][1])
    # ---------------- E-Reihen: alle Normwerte einer Dekade treffen sich selbst, Zwischenwerte gegen eigene Auswahl
    g = np.random.RandomState(7)
    for n in (6, 12, 24, 48, 96):
        for m in E[n]:
            x = float('%.12g' % (m * 1000))
            case(f'EL-E E{n} {m:g} kΩ', dict(type='eleseries', x=x, n=n), dict(nearest=x, lower=x, upper=x), 1e-15, False)
        for _ in range(10):
            x = float(10 ** g.uniform(-3, 7)); near, lo, hi = e_pick(x, n)
            case(f'EL-E E{n} {x:.6g}', dict(type='eleseries', x=x, n=n), dict(nearest=near, lower=lo, upper=hi), 1e-15, False)
