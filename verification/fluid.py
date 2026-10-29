"""Unabhängige Gegenrechnung Rohrhydraulik (Modul fluid, eng-core 0.11.0).

Eigene Python-Umsetzung: IAPWS-IF97 Region 1 und 4 (R7-97(2012)), Viskosität IAPWS R12-08 (μ̄₂ = 1), Colebrook mit
scipy brentq (statt Newton), eigene Strangrechnung (Knoten, Energiebilanz), eigener Leser der Fachdaten (data/fd/*.json),
eigene Bisektion bzw. brentq für die Aufgaben B und C. Prüfwerte:
  P1 IF97 Tab. 5 (v), P2 IF97 Tab. 35 (p_s), P3 R12-08 Tab. 4 (11 Punkte), P4 Roloff TB 18-9 Wasser (Plausibilität),
  P5 Roloff 27 Bsp. 18.2, P6 Dubbel 26 Bd. 1 Abb. 17.16, P7 Hagen-Poiseuille, P8 Colebrook-Raster, P9 Grenzfälle VDI-WA L1.2,
  P10 Energiebilanz, P11 Rückeinsetzen Aufgaben B und C, P12 Borda-Carnot zwei Formen.
Jeder Prüffall trägt module='fluid' (Zählung je Modul in pruefung.py).
"""
import json, math, os
from scipy.optimize import brentq

HERE = os.path.dirname(os.path.abspath(__file__))
FD = os.path.join(os.path.dirname(HERE), 'data', 'fd')
_fd = lambda f: {r['id']: r for r in json.load(open(os.path.join(FD, f + '.json'), encoding='utf8'))}
FLUIDS, FVALS, ROUGH, LOSS, PIPES, VEL = (_fd(x) for x in ('fluids', 'fluid_values', 'roughness', 'loss_coeff', 'pipe_sizes', 'velocity_guide'))

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
        gk = e['geom']
        if gk['kind'] == 'd': d = gk['d']
        elif gk['kind'] == 'var': d = dvar
        else: d = (PIPES[gk['pipeId']]['d_a_mm'] - 2 * gk['wall'] * 1e3) / 1e3
        rk = e['rough']; k = rk['k'] if rk['kind'] == 'hand' else ROUGH[rk['id']]['k_' + rk['which'] + '_mm'] * 1e-3
        A = math.pi * d * d / 4; v = Q / A; Re = v * d / nu; lam = lam_py(Re, k / d)
        out.append(dict(kind='rohr', d=d, A=A, v=v, Re=Re, lam=lam, L=e['L'], dz=e['dz'], dp=lam * e['L'] / d * rho * v * v / 2))
    def pv(i, step):
        while 0 <= i < len(out):
            if out[i]['kind'] == 'rohr': return out[i]
            i += step
        return None
    for i, e in enumerate(els):
        if e['kind'] == 'rohr': continue
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
        p[i] = p[i + 1] - rho / 2 * (vN[i] ** 2 - vN[i + 1] ** 2) - rho * g * (z[i] - z[i + 1]) + out[i]['dp']
    H = [p[i] / (rho * g) + vN[i] ** 2 / (2 * g) + z[i] for i in range(nn + 1)]
    return dict(rho=rho, nu=nu, ps=ps, out=out, dpV=dpV, dpErf=dpErf, pA=p[0], pMin=min(p), H=H,
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
