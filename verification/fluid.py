"""Unabhängige Gegenrechnung Rohrhydraulik (Modul fluid, eng-core 0.11.0, ab 0.13.0 mit RH b).

Eigene Python-Umsetzung: IAPWS-IF97 Region 1 und 4 (R7-97(2012)), Viskosität IAPWS R12-08 (μ̄₂ = 1), Colebrook mit
scipy brentq (statt Newton), eigene Strangrechnung (Knoten, Energiebilanz), eigener Leser der Fachdaten (data/fd/*.json),
eigene Bisektion bzw. brentq für die Aufgaben B und C. Prüfwerte:
  P1 IF97 Tab. 5 (v), P2 IF97 Tab. 35 (p_s), P3 R12-08 Tab. 4 (11 Punkte), P4 Roloff TB 18-9 Wasser (Plausibilität),
  P5 Roloff 27 Bsp. 18.2, P6 Dubbel 26 Bd. 1 Abb. 17.16, P7 Hagen-Poiseuille, P8 Colebrook-Raster, P9 Grenzfälle VDI-WA L1.2,
  P10 Energiebilanz, P11 Rückeinsetzen Aufgaben B und C, P12 Borda-Carnot zwei Formen.
RH b (0.13.0, konzept_rh_b.md Abschn. 6): P20 IF97 w (Tab. 5), P21 Reader-Harris/Gallagher gegen ISO 5167-2 Tab. A.10,
  P22 Pumpe analytisch, P23 Betriebspunkt mit scipy fsolve auf der eigenen Strangrechnung, P24 Modellgesetze und Ausgleich
  (numpy.polyfit), P25 NPSH_A analytisch, P26 NPSH_A aus eigenen Knotendrücken, P27 Joukowsky und Stoßabminderung,
  P29 Walther, P30 bis P32 nicht kreisförmige Querschnitte, P33 und P34 Messung, P35 Überdruckhöhe, P36 Chaudhry Beispiel.
Jeder Prüffall trägt module='fluid' (Zählung je Modul in pruefung.py).
"""
import json, math, os
import numpy as np
from scipy.optimize import brentq, fsolve, minimize_scalar

HERE = os.path.dirname(os.path.abspath(__file__))
FD = os.path.join(os.path.dirname(HERE), 'data', 'fd')
_fd = lambda f: {r['id']: r for r in json.load(open(os.path.join(FD, f + '.json'), encoding='utf8'))}
FLUIDS, FVALS, ROUGH, LOSS, PIPES, VEL = (_fd(x) for x in ('fluids', 'fluid_values', 'roughness', 'loss_coeff', 'pipe_sizes', 'velocity_guide'))
FLOWM, SHAPE, WAVE, BULK, OILS = (_fd(x) for x in ('flowmeter', 'shape_factor', 'wave_speed', 'bulk_modulus', 'oil_grades'))

# ---------------------------------------------------------------- IAPWS
R = 461.526
I1 = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 8, 8, 21, 23, 29, 30, 31, 32]
J1 = [-2, -1, 0, 1, 2, 3, 4, 5, -9, -7, -1, 0, 1, 3, -3, 0, 1, 3, 17, -4, 0, 6, -5, -2, 10, -8, -11, -6, -29, -31, -38, -39, -40, -41]
N1 = [0.14632971213167, -0.84548187169114, -0.37563603672040e1, 0.33855169168385e1, -0.95791963387872, 0.15772038513228, -0.16616417199501e-1,
      0.81214629983568e-3, 0.28319080123804e-3, -0.60706301565874e-3, -0.18990068218419e-1, -0.32529748770505e-1, -0.21841717175414e-1,
      -0.52838357969930e-4, -0.47184321073267e-3, -0.30001780793026e-3, 0.47661393906987e-4, -0.44141845330846e-5, -0.72694996297594e-15,
      -0.31679644845054e-4, -0.28270797985312e-5, -0.85205128120103e-9, -0.22425281908000e-5, -0.65171222895601e-6, -0.14341729937924e-12,
      -0.40516996860117e-6, -0.12734301741641e-8, -0.17424871230634e-9, -0.68762131295531e-18, 0.14478307828521e-19, 0.26335781662795e-22,
      -0.11947622640071e-22, 0.18228094581404e-23, -0.93537087292458e-25]
N4 = [0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2, 0.12020824702470e5, -0.32325550322333e7, 0.14915108613530e2,
      -0.48232657361591e4, 0.40511340542057e6, -0.23855557567849, 0.65017534844798e3]
H0 = [1.67752, 2.20462, 0.6366564, -0.241605]
HIJ = {(0, 0): 5.20094e-1, (1, 0): 8.50895e-2, (2, 0): -1.08374, (3, 0): -2.89555e-1, (0, 1): 2.22531e-1, (1, 1): 9.99115e-1, (2, 1): 1.88797,
       (3, 1): 1.26613, (5, 1): 1.20573e-1, (0, 2): -2.81378e-1, (1, 2): -9.06851e-1, (2, 2): -7.72479e-1, (3, 2): -4.89837e-1, (4, 2): -2.57040e-1,
       (0, 3): 1.61913e-1, (1, 3): 2.57399e-1, (0, 4): -3.25372e-2, (3, 4): 6.98452e-2, (4, 5): 8.72102e-3, (3, 6): -4.35673e-3, (5, 6): -5.93264e-4}

def v_if97(T, p):
    pi, tau = p / 16.53e6, 1386.0 / T
    gp = sum(-n * i * (7.1 - pi) ** (i - 1) * (tau - 1.222) ** j for n, i, j in zip(N1, I1, J1))
    return R * T / p * pi * gp

def ps_if97(T):
    th = T + N4[8] / (T - N4[9])
    A = th * th + N4[0] * th + N4[1]; B = N4[2] * th * th + N4[3] * th + N4[4]; C = N4[5] * th * th + N4[6] * th + N4[7]
    return (2 * C / (-B + math.sqrt(B * B - 4 * A * C))) ** 4 * 1e6

def mu_r12(T, rho):
    Tb, rb = T / 647.096, rho / 322.0
    m0 = 100 * math.sqrt(Tb) / sum(h / Tb ** i for i, h in enumerate(H0))
    m1 = math.exp(rb * sum(h * (1 / Tb - 1) ** i * (rb - 1) ** j for (i, j), h in HIJ.items()))
    return 1e-6 * m0 * m1

# ---------------------------------------------------------------- Strang (eigene Umsetzung)
def lam_py(Re, eps):
    if Re < 2320: return 64.0 / Re
    return brentq(lambda l: 1 / math.sqrt(l) + 2 * math.log10(2.51 / (Re * math.sqrt(l)) + eps / 3.71), 1e-6, 10.0, xtol=1e-16, rtol=1e-15, maxiter=500)

def fluid_py(f):
    s = f['spec']
    if s['kind'] == 'wasser':
        rho = 1 / v_if97(f['T'], f['p']); return rho, mu_r12(f['T'], rho) / rho, ps_if97(f['T'])
    if s['kind'] == 'hand': return s['rho'], s['nu'], None
    if s['kind'] == 'walther': return s['rho'], walther_py(s['walther'], f['T']), None
    v = FVALS[s['valueId']]
    return (v['rho_kg_m3'] if v['rho_kg_m3'] is not None else s['rho']), v['nu_mm2_s'] * 1e-6, None

def bend_py(surface, rd):
    pts = sorted((r['param_value'], r['zeta']) for r in LOSS.values() if r['element'] == f'Bogen 90°, {surface}')
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        if x0 <= rd <= x1: return z0 + (z1 - z0) * (rd - x0) / (x1 - x0)
    raise ValueError(rd)

def line_py(inp, Q, dvar=None):
    rho, nu, ps = fluid_py(inp['fluid']); g = inp['g']
    els = inp['elements']; out = []
    for e in els:
        if e['kind'] != 'rohr': out.append(dict(kind=e['kind'], v=None, dp=0.0, L=0.0, dz=0.0)); continue
        gk = e['geom']; A = None; phi = 1.0
        if gk['kind'] == 'd': d = gk['d']
        elif gk['kind'] == 'var': d = dvar
        elif gk['kind'] == 'section': A, U, phi = section_py(gk['section']); d = 4 * A / U
        else: d = (PIPES[gk['pipeId']]['d_a_mm'] - 2 * gk['wall'] * 1e3) / 1e3
        rk = e['rough']; k = rk['k'] if rk['kind'] == 'hand' else ROUGH[rk['id']]['k_' + rk['which'] + '_mm'] * 1e-3
        A = math.pi * d * d / 4 if A is None else A; v = Q / A; Re = v * d / nu
        lam = phi * 64.0 / Re if Re < 2320 else lam_py(Re, k / d)
        out.append(dict(kind='rohr', d=d, A=A, v=v, Re=Re, lam=lam, L=e['L'], dz=e['dz'], dp=lam * e['L'] / d * rho * v * v / 2))
    def pv(i, step):
        while 0 <= i < len(out):
            if out[i]['kind'] == 'rohr': return out[i]
            i += step
        return None
    for i, e in enumerate(els):
        if e['kind'] in ('rohr', 'pumpe'): continue
        if e['kind'] == 'zeta': lc = LOSS[e['lossId']]; z, ref, n = lc['zeta'], lc['ref_section'], e['count']
        elif e['kind'] == 'bogen': z, ref, n = bend_py(e['surface'], e['rd']), None, e['count']
        elif e['kind'] == 'erweiterung':
            a, b = pv(i - 1, -1), pv(i + 1, 1); z, ref, n = (1 - a['A'] / b['A']) ** 2, '1', 1
        else: z, ref, n = e['zeta'], e['ref'], e['count']
        src = pv(i + 1, 1) if ref == '2' else pv(i - 1, -1) if ref == '1' else (pv(i - 1, -1) or pv(i + 1, 1))
        out[i].update(dp=n * z * rho * src['v'] ** 2 / 2, zeta=n * z)
    nn = len(out); vN = []
    for i in range(nn + 1):
        if i == 0: vN.append(0.0 if inp['start']['v0'] else pv(0, 1)['v'])
        elif i == nn: vN.append(0.0 if inp['end']['v0'] else pv(nn - 1, -1)['v'])
        else:
            a, b = out[i - 1], out[i]
            vN.append(a['v'] if a['kind'] == 'rohr' else b['v'] if b['kind'] == 'rohr' else (pv(i - 1, -1) or pv(i, 1))['v'])
    z = [inp['start']['z']]
    for o in out: z.append(z[-1] + o['dz'])
    dpV = sum(o['dp'] for o in out)
    dpErf = (inp['end']['p'] - inp['start']['p']) + rho * g * (z[-1] - z[0]) + rho / 2 * (vN[-1] ** 2 - vN[0] ** 2) + dpV
    # Knotendrücke rückwärts vom Ende (unabhängig von der Vorwärtsrechnung des Kerns)
    p = [0.0] * (nn + 1); p[nn] = inp['end']['p']
    for i in range(nn - 1, -1, -1):
        p[i] = p[i + 1] - rho / 2 * (vN[i] ** 2 - vN[i + 1] ** 2) - rho * g * (z[i] - z[i + 1]) + out[i]['dp'] - (dpErf if els[i]['kind'] == 'pumpe' else 0.0)
    H = [p[i] / (rho * g) + vN[i] ** 2 / (2 * g) + z[i] for i in range(nn + 1)]
    pL = inp.get('pAmb', 101325.0)
    return dict(rho=rho, nu=nu, ps=ps, out=out, dpV=dpV, dpErf=dpErf, pA=p[0], pMin=min(p), H=H, p=p, vN=vN, hpe=[(x - pL) / (rho * g) for x in p],
                dpR=sum(o['dp'] for o in out if o['kind'] == 'rohr'), dpZ=sum(o['dp'] for o in out if o['kind'] != 'rohr'))

# ---------------------------------------------------------------- Fälle
P0 = 101325.0
def T(c): return c + 273.15
def fv(name, t): return next(v['id'] for v in FVALS.values() if FLUIDS[v['fluid_id']]['name'] == name and v['t_c'] == t)
def rg(state): return next(r['id'] for r in ROUGH.values() if r['state'] == state)
def lcid(el, dn=None): return next(r['id'] for r in LOSS.values() if r['element'] == el and (dn is None or r['dn_min'] == dn))
def pid(norm, series, da): return next(r['id'] for r in PIPES.values() if r['norm'] == norm and r['series'] == series and r['d_a_mm'] == da)
def vgid(case): return next(r['id'] for r in VEL.values() if r['case'] == case)

def zh(z, ref, n=1, label=None): return dict(kind='zetaHand', zeta=z, ref=ref, count=n, **({'label': label} if label else {}))
def rohr(L, geom, rough, dz=0.0): return dict(kind='rohr', L=L, geom=geom, rough=rough, dz=dz)

K1 = dict(fluid=dict(spec=dict(kind='wasser'), T=T(10), p=P0), Q=300 / 3600, g=9.81, eta=0.7, velocityGuideId=None,
          start=dict(p=P0, z=0, v0=True), end=dict(p=P0, v0=True),
          elements=[zh(3, '2'), rohr(280, dict(kind='d', d=0.3099), dict(kind='tab', id=rg('zementiert'), which='max'), 10), zh(6, None, 2), zh(0.8, None), zh(0.8, None, 3), zh(1, '1')])
kH = dict(kind='hand', k=0.04e-3)
K2 = dict(fluid=dict(spec=dict(kind='hand', rho=1000, nu=1e-6), T=T(20), p=P0), Q=8e-3, g=9.81, eta=None, velocityGuideId=None,
          start=dict(p=1e5, z=7, v0=True), end=dict(p=1e5, v0=False),
          elements=[zh(0.5, '2'), rohr(35, dict(kind='d', d=0.08), kH, -2), zh(0.05, '2'), rohr(25, dict(kind='d', d=0.06), kH), zh(0.11, None),
                    rohr(13, dict(kind='d', d=0.06), kH), zh(0.11, None), rohr(25, dict(kind='d', d=0.06), kH), zh(0.3, '2'), rohr(0, dict(kind='d', d=0.08), kH)])
K3 = dict(fluid=dict(spec=dict(kind='tabelle', valueId=fv('Spindelöl', 20)), T=T(20), p=P0), Q=20 / 60000, g=9.81, eta=0.8, velocityGuideId=vgid('viskose Flüssigkeiten allgemein'),
          start=dict(p=6e5 + P0, z=0, v0=False), end=dict(p=P0, v0=False),
          elements=[rohr(4, dict(kind='norm', pipeId=pid('DIN EN 10220', 'Reihe 1', 21.3), wall=0.002), dict(kind='tab', id=rg('neu, mit Walzhaut'), which='max'), 0.5),
                    dict(kind='bogen', surface='glatt', rd=3, count=2), dict(kind='erweiterung'),
                    rohr(6, dict(kind='norm', pipeId=pid('DIN EN 10220', 'Reihe 1', 26.9), wall=0.002), dict(kind='tab', id=rg('neu, mit Walzhaut'), which='max')),
                    dict(kind='zeta', lossId=lcid('Schieber', 20), count=1)])
K4 = dict(fluid=dict(spec=dict(kind='tabelle', valueId=fv('Hydrauliköl ISO VG 46', 40), rho=870), T=T(40), p=P0), Q=0, g=9.81, eta=None, velocityGuideId=None,
          start=dict(p=P0, z=0, v0=True), end=dict(p=P0, v0=True),
          elements=[dict(kind='zeta', lossId=lcid('Verengung, abgerundet'), count=1), rohr(15, dict(kind='d', d=0.02), dict(kind='hand', k=1e-5)), dict(kind='zeta', lossId=lcid('Ausströmung'), count=1)])
K5 = dict(fluid=dict(spec=dict(kind='wasser'), T=T(20), p=P0), Q=10 / 3600, g=9.81, eta=0.65, velocityGuideId=vgid('Hauptleitung'),
          start=dict(p=P0, z=0, v0=True), end=dict(p=P0, v0=True),
          elements=[dict(kind='zeta', lossId=lcid('Verengung, abgerundet'), count=1), rohr(120, dict(kind='var'), dict(kind='hand', k=7e-6), 6),
                    dict(kind='bogen', surface='glatt', rd=2, count=4), dict(kind='zeta', lossId=lcid('Ausströmung'), count=1)])
K6 = dict(fluid=dict(spec=dict(kind='tabelle', valueId=fv('Glyzerin', 20)), T=T(20), p=P0), Q=0.5 / 60000, g=9.81, eta=None, velocityGuideId=None,
          start=dict(p=P0, z=0, v0=False), end=dict(p=P0, v0=False), elements=[rohr(2, dict(kind='d', d=0.01), dict(kind='hand', k=1e-6))])


def add_cases(cases, ref):
    add_cases_b(cases, ref)
    def case(id_, c, vals, tol):
        c = dict(c, id=id_, module='fluid'); cases.append(c); ref[id_] = (vals, tol)
    # P1 bis P3: IAPWS mit gedruckten Prüfwerten
    for Tk, p, v in [(300, 3e6, 0.100215168e-2), (300, 80e6, 0.971180894e-3), (500, 3e6, 0.120241800e-2)]:
        case(f'RH-P1 IF97 Tab. 5 T {Tk} K p {p/1e6:g} MPa', dict(type='water', T=Tk, p=p), dict(v=v), 1e-8)
        case(f'RH-P1 IF97 Python T {Tk} K p {p/1e6:g} MPa', dict(type='water', T=Tk, p=p), dict(v=v_if97(Tk, p), rho=1 / v_if97(Tk, p)), 1e-12)
    for Tk, ps in [(300, 0.353658941e-2), (500, 0.263889776e1), (600, 0.123443146e2)]:
        case(f'RH-P2 IF97 Tab. 35 T {Tk} K', dict(type='psat', T=Tk), dict(ps=ps * 1e6), 1e-8)
    for Tk, rho, mu in [(298.15, 998, 889.735100), (298.15, 1200, 1437.649467), (373.15, 1000, 307.883622), (433.15, 1, 14.538324), (433.15, 1000, 217.685358),
                        (873.15, 1, 32.619287), (873.15, 100, 35.802262), (873.15, 600, 77.430195), (1173.15, 1, 44.217245), (1173.15, 100, 47.640433), (1173.15, 400, 64.154608)]:
        # Toleranz: halbe Einheit der letzten gedruckten Stelle (6 Nachkommastellen in µPa·s)
        case(f'RH-P3 R12-08 Tab. 4 T {Tk} K rho {rho}', dict(type='visc', T=Tk, rho=rho), dict(mu=mu * 1e-6), max(1e-8, 0.5e-6 / mu))
    # P4: Roloff TB 18-9 Wasser bei 1 bar (Plausibilität, Tabelle 4 Stellen)
    for v in sorted((v for v in FVALS.values() if FLUIDS[v['fluid_id']]['name'] == 'Wasser'), key=lambda r: r['t_c']):
        tol = 2e-3 if v['t_c'] == 0 else 1e-3
        case(f'RH-P4 TB 18-9 Wasser {v["t_c"]} °C Dichte', dict(type='water', T=T(v['t_c']), p=1e5), dict(rho=v['rho_kg_m3']), tol)
        case(f'RH-P4 TB 18-9 Wasser {v["t_c"]} °C Viskosität', dict(type='water', T=T(v['t_c']), p=1e5), dict(nu=v['nu_mm2_s'] * 1e-6), 1e-2)
    # P5, P6: Literaturfälle (gedruckte Zahlen) und Python-Strang
    def line_case(name, inp, task, book=None, btol=None, keys=('dpErf', 'dpV', 'dpR', 'dpZ', 'pA', 'pMin')):
        c = dict(type='fluid', inp=inp, task=task)
        if task['kind'] == 'A':
            py = line_py(inp, inp['Q'])
            vals = {k: py[k] for k in keys}
            for i, o in enumerate(py['out']):
                if o['kind'] == 'rohr': vals.update({f'lam{i}': o['lam'], f'Re{i}': o['Re'], f'v{i}': o['v']})
            # Energiebilanz (P10): H_A − H_E − Σ h_v = 0 im Kern; Python prüft dieselbe Bilanz rückwärts gerechnet
            assert abs(py['H'][0] - py['H'][-1] - py['dpV'] / (py['rho'] * inp['g'])) < 1e-9
            vals['dH'] = 0.0
            case(f'{name} (Python)', c, vals, 1e-9)
        if book: case(f'{name} (Buchwerte)', c, book, btol)
    line_case('RH-P5 Roloff Bsp. 18.2', K1, dict(kind='A'), dict(dpErf=120062, dpGeo=98070, P=15000 * 120062 / 126000), 5e-3)
    # Roloff rundet v auf 1,10 m/s (genau 1,1048) und rechnet mit ν = 1,307·10⁻⁶ (IAPWS 1,3063·10⁻⁶), daher 1 %
    line_case('RH-P5 Roloff Bsp. 18.2 v und Re', K1, dict(kind='A'), dict(Re1=260800, v1=1.10), 1e-2)
    line_case('RH-P5 Roloff Bsp. 18.2 λ', K1, dict(kind='A'), dict(lam1=0.019), 1.5e-2)
    line_case('RH-P6 Dubbel Abb. 17.16', K2, dict(kind='A'), dict(hv=9.88, pAh=18.21, Re1=127200, Re3=169800), 5e-3)
    # Dubbel rundet λ₂ auf 0,0200 (Colebrook 0,01988), daher 1 %
    line_case('RH-P6 Dubbel Abb. 17.16 λ', K2, dict(kind='A'), dict(lam1=0.0197, lam3=0.0200), 1e-2)
    # P7 Hagen-Poiseuille (laminar, Glyzerin)
    rho, nu, _ = fluid_py(K6['fluid']); d, L, Q = 0.01, 2.0, K6['Q']
    case('RH-P7 Hagen-Poiseuille Glyzerin', dict(type='fluid', inp=K6, task=dict(kind='A')), dict(dpV=128 * rho * nu * L * Q / (math.pi * d ** 4)), 1e-12)
    line_case('RH-K6 Glyzerin laminar', K6, dict(kind='A'))
    # P8 Colebrook-Raster gegen brentq
    for Re in (4e3, 1e4, 1e5, 1e6, 1e7, 1e8):
        for eps in (0.0, 1e-6, 1e-4, 1e-3, 1e-2, 0.05):
            case(f'RH-P8 Colebrook Re {Re:g} eps {eps:g}', dict(type='colebrook', Re=Re, eps=eps), dict(lam=lam_py(Re, eps)), 1e-10)
    # P9 Grenzfälle VDI-WA L1.2: glatt Gl. (7), vollrau Gl. (9), Blasius Gl. (5)
    lpk = brentq(lambda l: 1 / math.sqrt(l) - (2 * math.log10(1e6 * math.sqrt(l)) - 0.8), 1e-4, 1)
    case('RH-P9 glatt Prandtl-Kármán Re 1e6', dict(type='colebrook', Re=1e6, eps=0.0), dict(lam=lpk), 5e-3)
    case('RH-P9 vollrau Gl. (9) eps 1e-3', dict(type='colebrook', Re=1e8, eps=1e-3), dict(lam=1 / (2 * math.log10(1e3) + 1.14) ** 2), 2e-3)
    case('RH-P9 Blasius Re 1e4', dict(type='colebrook', Re=1e4, eps=0.0), dict(lam=0.3164 / 1e4 ** 0.25), 3e-2)
    # P10 Energiebilanz und P12 Borda-Carnot in den Strangfällen (dH = 0, Erweiterung K3)
    line_case('RH-K3 Spindelöl, Bogen, Erweiterung, Schieber', K3, dict(kind='A'))
    o = line_py(K3, K3['Q'])['out']
    A1, A2, v1, v2 = o[0]['A'], o[3]['A'], o[0]['v'], o[3]['v']
    case('RH-P12 Borda-Carnot zwei Formen (Dubbel ζ₂ bezogen auf v₂)', dict(type='fluid', inp=K3, task=dict(kind='A')), dict(zeta2=(A2 / A1 - 1) ** 2 * v2 ** 2 / v1 ** 2), 1e-12)
    # P11 Aufgaben B und C (eigene Lösung mit brentq, Rückeinsetzen im Kern)
    Qb = brentq(lambda q: line_py(K4, q)['dpErf'] - 2e5, 1e-9, 1.0, xtol=1e-18, rtol=1e-14)
    case('RH-P11 Aufgabe B ISO VG 46', dict(type='fluid', inp=K4, task=dict(kind='B', dpAvail=2e5)), dict(Q=Qb, backB=1.0), 1e-9)
    dm = brentq(lambda d: line_py(K5, K5['Q'], d)['dpErf'] - 1.5e5, 1e-3, 1.0, xtol=1e-16, rtol=1e-14)
    cands = sorted(((r['d_a_mm'] - 2 * min(r['walls_mm'])) / 1e3, r['id']) for r in PIPES.values() if r['norm'] == 'DIN 8074' and r['series'] == 'SDR 11')
    dg = next(d for d, _ in cands if d >= dm)
    case('RH-P11 Aufgabe C PE SDR 11', dict(type='fluid', inp=K5, task=dict(kind='C', dpAllow=1.5e5, select=dict(norm='DIN 8074', series='SDR 11', minWall=None))),
         dict(dMin=dm, dGew=dg, backC=1.0, dpErf=line_py(K5, K5['Q'], dg)['dpErf']), 1e-8)


# ================================================================ RH b (eng-core 0.13.0)
def w_if97(T, p):
    """Schallgeschwindigkeit IF97 Region 1 (Tab. 3), Ableitungen eigen nach Tab. 4."""
    pi, tau = p / 16.53e6, 1386.0 / T; a, b = 7.1 - pi, tau - 1.222
    gp = sum(-n * i * a ** (i - 1) * b ** j for n, i, j in zip(N1, I1, J1))
    gpp = sum(n * i * (i - 1) * a ** (i - 2) * b ** j for n, i, j in zip(N1, I1, J1))
    gtt = sum(n * a ** i * j * (j - 1) * b ** (j - 2) for n, i, j in zip(N1, I1, J1))
    gpt = sum(-n * i * a ** (i - 1) * j * b ** (j - 1) for n, i, j in zip(N1, I1, J1))
    return math.sqrt(R * T * gp ** 2 / ((gp - tau * gpt) ** 2 / (tau ** 2 * gtt) - gpp))

def walther_py(w, T):
    C = w['C']; W = lambda nu: math.log10(math.log10(nu * 1e6 + C))
    m = (W(w['nu1']) - W(w['nu2'])) / (math.log10(w['T2']) - math.log10(w['T1'])); K = W(w['nu1']) + m * math.log10(w['T1'])
    return (10 ** (10 ** (K - m * math.log10(T))) - C) * 1e-6

def phi_py(section, x):
    pts = sorted((r['param_value'], r['phi']) for r in SHAPE.values() if r['section'] == section)
    return float(np.interp(x, [a for a, _ in pts], [b for _, b in pts]))

def section_py(sec):
    if sec['kind'] == 'ring': return math.pi * (sec['da'] ** 2 - sec['di'] ** 2) / 4, math.pi * (sec['da'] + sec['di']), phi_py('Kreisring', sec['da'] / sec['di'])
    if sec['kind'] == 'rechteck': return sec['b'] * sec['h'], 2 * (sec['b'] + sec['h']), phi_py('Rechteck', min(sec['b'], sec['h']) / max(sec['b'], sec['h']))
    return sec['A'], sec['U'], 1.0

def rhg_py(beta, Re, D, taps):
    Dmm = D * 1e3
    L1, L2 = {'eck': (0.0, 0.0), 'D': (1.0, 0.47), 'flansch': (25.4 / Dmm, 25.4 / Dmm)}[taps]
    A = (19000 * beta / Re) ** 0.8; M2 = 2 * L2 / (1 - beta)
    C = (0.5961 + 0.0261 * beta ** 2 - 0.216 * beta ** 8 + 0.000521 * (1e6 * beta / Re) ** 0.7 + (0.0188 + 0.0063 * A) * beta ** 3.5 * (1e6 / Re) ** 0.3
         + (0.043 + 0.080 * math.exp(-10 * L1) - 0.123 * math.exp(-7 * L1)) * (1 - 0.11 * A) * beta ** 4 / (1 - beta ** 4) - 0.031 * (M2 - 0.8 * M2 ** 1.1) * beta ** 1.3)
    return C + (0.011 * (0.75 - beta) * (2.8 - Dmm / 25.4) if Dmm < 71.12 else 0.0)

def meter_py(m):
    D, d, rho, nu, dev = m['D'], m['d'], m['rho'], m['nu'], m['device']; beta = d / D; At = math.pi * d * d / 4
    Re = lambda Q: 4 * Q / (math.pi * D * nu)
    def C(Q):
        if dev['kind'] == 'blende': return rhg_py(beta, Re(Q), D, dev['taps'])
        if dev['variant'] is None: return dev['C']
        rows = sorted((r for r in FLOWM.values() if r['variant'] == dev['variant']), key=lambda r: r['re_min'])
        hit = [r for r in rows if r['re_min'] <= Re(Q) and (r['re_max'] is None or Re(Q) <= r['re_max'])]
        return (hit[0] if hit else rows[0] if Re(Q) < rows[0]['re_min'] else rows[-1])['c']   # außerhalb: nächste Zeile (Warnung im Kern)
    dpQ = lambda Q: rho / 2 * (Q * math.sqrt(1 - beta ** 4) / (C(Q) * At)) ** 2
    if m['mode']['kind'] == 'Q': Q = m['mode']['Q']; dp = dpQ(Q)
    else: dp = m['mode']['dp']; Q = brentq(lambda q: dpQ(q) - dp, 1e-12, 10.0, xtol=1e-16, rtol=1e-15)
    c = C(Q); o = dict(C=c, Q=Q, dp=dp, Re=Re(Q), beta=beta)
    if dev['kind'] == 'blende':
        s = math.sqrt(1 - beta ** 4 * (1 - c * c)); o['dw'] = (s - c * beta * beta) / (s + c * beta * beta) * dp
    elif dev.get('xi') is not None: o['dw'] = dev['xi'] * dp
    if 'dw' in o: vD = Q / (math.pi * D * D / 4); o['zeta'] = o['dw'] / (rho * vD * vD / 2)
    return o

def surge_py(s):
    f, w = s['fluid'], s['wave']
    if f['kind'] == 'wasser': rho = 1 / v_if97(f['T'], f['p']); K = rho * w_if97(f['T'], f['p']) ** 2
    elif f['kind'] == 'tabelle': r = BULK[f['id']]; rho, K = r['rho_kg_m3'], r['k_gpa'] * 1e9
    else: rho, K = f['rho'], f['K']
    psi = None
    if w['kind'] == 'starr': a = math.sqrt(K / rho)
    elif w['kind'] == 'richtwert': a = WAVE[w['id']]['a_m_s']
    elif w['kind'] == 'hand': a = w['a']
    else:
        D, e, nu = w['D'], w['e'], w['nu']
        if w['wall'] == 'duenn': psi = D / e * {'a': 1 - nu * nu, 'b': 1 - 0.5 * nu, 'c': 1.0}[w['anchor']]
        else:
            Ri, Ro = D / 2, D / 2 + e
            psi = 2 * (1 + nu) * ((Ro ** 2 + Ri ** 2) / (Ro ** 2 - Ri ** 2) - 2 * nu * Ri ** 2 / (Ro ** 2 - Ri ** 2)) if w['anchor'] == 'a' else 2 * ((Ro ** 2 + Ri ** 2) / (Ro ** 2 - Ri ** 2) + nu)
        a = math.sqrt(K / (rho * (1 + K / w['E'] * psi)))
    tR = 2 * s['L'] / a
    dp = rho * a * s['dv'] if s['tS'] <= tR else rho * a * s['dv'] * tR / s['tS']
    o = dict(a=a, tR=tR, dp=dp, pMax=s['p'] + dp, pMin=s['p'] - dp, fast=float(s['tS'] <= tR))
    if psi is not None: o['psi'] = psi
    return o

def pump_py(inp, pump):
    """Betriebspunkt mit scipy fsolve auf der eigenen Strangrechnung, Kennlinien mit numpy.polyfit (eigen)."""
    P = sorted(pump['points'], key=lambda x: x['Q'])
    cH = np.polyfit([x['Q'] for x in P], [x['H'] for x in P], 2)
    E = [x for x in P if x['eta'] is not None]; N = [x for x in P if x['npsh'] is not None]
    cE = np.polyfit([x['Q'] for x in E], [x['eta'] for x in E], 2) if len(E) >= 3 else None
    cN = np.polyfit([x['Q'] for x in N], [x['npsh'] for x in N], 2) if len(N) >= 3 else None
    rho = fluid_py(inp['fluid'])[0]; g = inp['g']
    HA = lambda q: line_py(inp, q)['dpErf'] / (rho * g)
    H = lambda r, q: r * r * np.polyval(cH, q / r)
    if pump['speed']['kind'] == 'n': r = pump['speed']['n'] / pump['n0']
    else:
        Qs = pump['speed']['Q']; has = HA(Qs); r = brentq(lambda x: H(x, Qs) - has, Qs / P[-1]['Q'], 3.0, xtol=1e-15, rtol=1e-15)
    q0 = 0.5 * r * (P[0]['Q'] + P[-1]['Q'])
    Q = float(fsolve(lambda q: [H(r, q[0]) - HA(q[0])], [q0], xtol=1e-14)[0])
    Hb = float(H(r, Q)); L = line_py(inp, Q)
    o = dict(Qop=Q, Hop=Hb, r=r, HA=L['dpErf'] / (rho * g), pStart=L['p'][0], backD=1.0)
    if cE is not None:
        eta = float(np.polyval(cE, Q / r)); o.update(etaB=eta, Pu=rho * g * Q * Hb, Ppump=rho * g * Q * Hb / eta)
        qb = minimize_scalar(lambda q: -np.polyval(cE, q), bounds=(P[0]['Q'], P[-1]['Q']), method='bounded', options=dict(xatol=1e-14)).x   # Bestpunkt numerisch (statt Scheitelformel)
        o['nq'] = 333 * pump['n0'] * math.sqrt(qb) / (g * float(np.polyval(cH, qb))) ** 0.75
    k = next(i for i, e in enumerate(inp['elements']) if e['kind'] == 'pumpe')
    pv = L['ps'] if L['ps'] is not None else pump['pv']
    if pv is not None: o['npshA'] = (L['p'][k] + rho * L['vN'][k] ** 2 / 2 - pv) / (rho * g)
    if cN is not None:
        o['npshR'] = r ** pump['npshExp'] * float(np.polyval(cN, Q / r))
        if 'npshA' in o: o['reserve'] = o['npshA'] - o['npshR']
    return o

def add_cases_b(cases, ref):
    import sys; sys.path.insert(0, HERE)
    def case(id_, c, vals, tol):
        c = dict(c, id=id_, module='fluid'); cases.append(c); ref[id_] = (vals, tol)
    F = json.load(open(os.path.join(HERE, 'fluid_b_faelle.json'), encoding='utf8'))   # aus scripts/fluid-faelle.ts (npx tsx scripts/fluid-b-json.ts)
    lines = {f['id']: f for f in F['lines']}; mess = {f['id']: f for f in F['mess']}; stoss = {f['id']: f for f in F['stoss']}
    # P20 IF97 Schallgeschwindigkeit
    for Tk, p, w in [(300, 3e6, 0.150773921e4), (300, 80e6, 0.163469054e4), (500, 3e6, 0.124071337e4)]:
        case(f'RH-P20 IF97 Tab. 5 w T {Tk} K p {p/1e6:g} MPa', dict(type='sound', T=Tk, p=p), dict(w=w), 1e-8)
        case(f'RH-P20 IF97 Python w T {Tk} K p {p/1e6:g} MPa', dict(type='sound', T=Tk, p=p), dict(w=w_if97(Tk, p)), 1e-12)
    # P21 Reader-Harris/Gallagher gegen ISO 5167-2 Tab. A.10 (Flansch, D = 760 mm), Tabelle vierstellig
    for beta, Re, Ct in [(0.10, 5e3, 0.6006), (0.30, 1e6, 0.5987), (0.40, 3e4, 0.6054), (0.50, 1e5, 0.6065), (0.60, 1e7, 0.6031), (0.20, 1e4, 0.6016), (0.56, 3e5, 0.6062)]:
        D, nu = 0.76, 1e-6
        m = dict(device=dict(kind='blende', taps='flansch'), D=D, d=beta * D, rho=1000.0, nu=nu, mode=dict(kind='Q', Q=Re * math.pi * D * nu / 4))
        case(f'RH-P21 ISO 5167-2 Tab. A.10 beta {beta} Re {Re:g}', dict(type='meter', inp=m), dict(C=Ct), 1e-4)
        case(f'RH-P21 RHG Python beta {beta} Re {Re:g}', dict(type='meter', inp=m), dict(C=rhg_py(beta, Re, D, 'flansch')), 1e-12)
    # P22 Pumpe analytisch (K7): Q = √(25/0,0026) m³/h, H = 15 + 0,001·Q²; Drehzahl 0,9·n₀; Soll-Förderstrom
    K7 = lines['RH-K7']; Qa = math.sqrt(25 / 0.0026)
    case('RH-P22 Pumpe analytisch n0', dict(type='fluid', inp=K7['inp'], task=K7['task']), dict(Qop=Qa / 3600, Hop=15 + 0.001 * Qa ** 2, backD=1.0), 1e-9)
    t9 = json.loads(json.dumps(K7['task'])); t9['pump']['speed'] = dict(kind='n', n=0.9 * t9['pump']['n0']); Q9 = math.sqrt((40 * 0.81 - 15) / 0.0026)
    case('RH-P22 Pumpe analytisch 0,9 n0', dict(type='fluid', inp=K7['inp'], task=t9), dict(Qop=Q9 / 3600, Hop=15 + 0.001 * Q9 ** 2, r=0.9), 1e-9)
    ts = json.loads(json.dumps(K7['task'])); ts['pump']['speed'] = dict(kind='Qsoll', Q=Q9 / 3600)
    case('RH-P22 Pumpe analytisch Soll-Förderstrom', dict(type='fluid', inp=K7['inp'], task=ts), dict(Qop=Q9 / 3600, r=0.9), 1e-9)
    # P24 Ausgleichspolynom: drei Punkte exakt, vier Punkte gegen numpy.polyfit
    xs = [x['Q'] for x in K7['task']['pump']['points']]; ys = [x['H'] for x in K7['task']['pump']['points']]
    case('RH-P24 Ausgleich drei Punkte exakt', dict(type='pumpfit', xs=xs, ys=ys), dict(c0=40.0, c2=-0.0016 * 3600 ** 2, r2=1.0), 1e-12)
    PB = lines['RH-K8']['task']['pump']['points']; cB = np.polyfit([x['Q'] for x in PB], [x['H'] for x in PB], 2)
    case('RH-P24 Ausgleich vier Punkte numpy.polyfit', dict(type='pumpfit', xs=[x['Q'] for x in PB], ys=[x['H'] for x in PB]), dict(c0=float(cB[2]), c1=float(cB[1]), c2=float(cB[0])), 1e-10)
    # P23, P26 Betriebspunkt und NPSH mit fsolve auf dem eigenen Strang (K8 Drehzahl, K9 Soll-Förderstrom)
    for kid in ('RH-K8', 'RH-K9'):
        f = lines[kid]; o = pump_py(f['inp'], f['task']['pump'])
        case(f'RH-P23 {kid} Betriebspunkt fsolve', dict(type='fluid', inp=f['inp'], task=f['task']), o, 1e-8)
    # P25 NPSH_A analytisch: Pumpe 3 m über dem Saugspiegel ohne Saugverlust, p_v 2 339,2 Pa von Hand: NPSH_A = (p − p_v)/(ρg) − 3 m
    a25 = json.loads(json.dumps(K7['inp'])); a25['elements'] = [dict(kind='rohr', label='Saugrohr', L=0, geom=dict(kind='d', d=0.1), rough=dict(kind='hand', k=1e-5), dz=3)] + a25['elements']
    a25['elements'][2]['dz'] = 12
    t25 = json.loads(json.dumps(K7['task'])); t25['pump']['pv'] = 2339.2
    case('RH-P25 NPSH_A analytisch', dict(type='fluid', inp=a25, task=t25), dict(npshA=(101325 - 2339.2) / (1000 * 9.81) - 3), 1e-12)
    # Strangfälle RH b (Querschnitte, Walther, Überdruckhöhe) gegen den eigenen Strang
    for kid in ('RH-K10', 'RH-K11'):
        f = lines[kid]; py = line_py(f['inp'], f['inp']['Q'])
        vals = dict(dpErf=py['dpErf'], dpV=py['dpV'], pA=py['pA'])
        for i, o in enumerate(py['out']):
            if o['kind'] == 'rohr': vals.update({f'lam{i}': o['lam'], f'Re{i}': o['Re'], f'v{i}': o['v']})
        vals.update({f'hpe{i}': h for i, h in enumerate(py['hpe'])})
        case(f'{kid} (Python)', dict(type='fluid', inp=f['inp'], task=f['task']), vals, 1e-9)
    # P29 Walther HLP 46: Stützpunkte exakt, ν bei 0 °C eigen und unter dem Grenzwert DIN 51524-2
    wl = lines['RH-K10']['inp']['fluid']['spec']['walther']
    for T, nu in [(wl['T1'], wl['nu1']), (wl['T2'], wl['nu2'])]:
        case(f'RH-P29 Walther Stützpunkt {T - 273.15:g} °C', dict(type='walther', inp=wl, T=T), dict(nu=nu), 1e-9)
    case('RH-P29 Walther 0 °C (Python)', dict(type='walther', inp=wl, T=273.15), dict(nu=walther_py(wl, 273.15)), 1e-12)
    og = next(r for r in OILS.values() if r['grade'] == 'HLP 46')
    assert walther_py(wl, 273.15) * 1e6 <= og['nu0_max_mm2_s'], 'Walther HLP 46 bei 0 °C über dem Grenzwert DIN 51524-2'
    # P30 bis P32: Rechteck analytisch, Quadrat laminar φ = 0,88, Kreisrohr über A und U = Kreisrohr
    def one(sec, Q, nu=1e-6, k=1e-5):
        return dict(fluid=dict(spec=dict(kind='hand', rho=1000, nu=nu), T=293.15, p=101325), Q=Q, g=9.81, eta=None, velocityGuideId=None,
                    start=dict(p=101325, z=0, v0=False), end=dict(p=101325, v0=False), elements=[dict(kind='rohr', L=10, geom=sec, rough=dict(kind='hand', k=k), dz=0)])
    r30 = one(dict(kind='section', section=dict(kind='rechteck', b=0.1, h=0.05)), 0.01)
    case('RH-P30 Rechteck 100 × 50 mm: Re mit d_h = 4A/U', dict(type='fluid', inp=r30, task=dict(kind='A')), dict(Re0=(0.01 / 0.005) * (4 * 0.005 / 0.3) / 1e-6), 1e-12)
    r31 = one(dict(kind='section', section=dict(kind='rechteck', b=0.02, h=0.02)), 1e-5)
    Re31 = (1e-5 / 4e-4) * 0.02 / 1e-6
    case('RH-P31 Quadrat laminar λ = 0,88·64/Re', dict(type='fluid', inp=r31, task=dict(kind='A')), dict(lam0=0.88 * 64 / Re31), 1e-12)
    d = 0.05; ra = one(dict(kind='section', section=dict(kind='au', A=math.pi * d * d / 4, U=math.pi * d)), 5e-3); rc = one(dict(kind='d', d=d), 5e-3)
    case('RH-P32 Kreisrohr über A und U = Kreisrohr', dict(type='fluid', inp=ra, task=dict(kind='A')), dict(dpV=line_py(rc, 5e-3)['dpV']), 1e-12)
    # Messung: Fälle M1 bis M4 (Python), P33 Rundlauf, P34 Venturi ideal = Dubbel S. 317
    for mid, f in mess.items():
        o = meter_py(f['inp']); case(f'{mid} Messung (Python)', dict(type='meter', inp=f['inp']), o, 1e-9)
    m1 = mess['RH-M1']['inp']; back = dict(m1, mode=dict(kind='dp', dp=meter_py(m1)['dp']))
    case('RH-P33 Blende Rundlauf V̇ → Δp → V̇', dict(type='meter', inp=back), dict(Q=m1['mode']['Q']), 1e-9)
    vi = dict(device=dict(kind='venturi', variant=None, C=1.0, xi=None), D=0.1, d=0.05, rho=1000.0, nu=1e-6, mode=dict(kind='dp', dp=2e4))
    A1, A2 = math.pi * 0.1 ** 2 / 4, math.pi * 0.05 ** 2 / 4
    case('RH-P34 Venturi ideal (Dubbel Bd. 1 S. 317)', dict(type='meter', inp=vi), dict(Q=A1 * math.sqrt(2 * 2e4 / 1000 / ((A1 / A2) ** 2 - 1))), 1e-9)
    # Druckstoß: S1 bis S6 (Python), P27 Roloff, P36 Chaudhry Buchwert
    for sid, f in stoss.items():
        case(f'{sid} Druckstoß (Python)', dict(type='surge', inp=f['inp']), surge_py(f['inp']), 1e-12)
    s2 = stoss['RH-S2']['inp']; rho20 = 1 / v_if97(293.15, 101325)
    case('RH-P27 Roloff Gl. (18.20), (18.22)', dict(type='surge', inp=s2), dict(tR=1.6, dp=rho20 * 1000 * 1.5 * 1.6 / 6), 1e-12)
    case('RH-P36 Chaudhry Beispiel Rohr 1 (Buchwert 724 m/s)', dict(type='surge', inp=stoss['RH-S1']['inp']), dict(a=724.0), 5e-3)
    # P35 Überdruckhöhe: h_pe = h_p − p_L/(ρ·g) an allen Knoten von RH-K1 (Python)
    py = line_py(K1, K1['Q'])
    case('RH-P35 Überdruckhöhe RH-K1', dict(type='fluid', inp=K1, task=dict(kind='A')), {f'hpe{i}': h for i, h in enumerate(py['hpe'])}, 1e-9)
