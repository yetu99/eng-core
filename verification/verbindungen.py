"""Unabhängige Gegenrechnung Pressverband (Modul verbindungen, eng-core 0.17.0), Konzept fachtools/konzept_pv.md Abschn. 4 und 6.

Eigene Python-Umsetzung ohne die Formeln des Kerns:
  Fugendruck aus der Verträglichkeit der Lamé-Verschiebungen u_A(r_F) − u_I(r_F) = U_w/2 (statt Hilfsgröße K),
  zulässiger Fugendruck aus der größten Schubspannung (σ_max − σ_min)/2 ≤ R_eL/(√3·S_P) mit σ_z = 0 (Lamé-Konstanten),
  Spannungen aus den Lamé-Konstanten A, B, ζ mit scipy brentq (statt Bisektion), ζ_zul ebenso, eigener Leser der Fachdaten
  (data/fd/fit_it.json, fit_shaft_dev.json, pv_rz.json, pv_chamfer.json), eigene Aufzählung des Passungsvorschlags,
  Grenzabmaße zusätzlich gegen Einzelwerte aus ISO 286-2 (zweite Ablesung, geprüft mit pv/build/pruef_werte_fd12.py B1, B2).
Literaturfälle (Toleranz nach Rundung der Quelle): DIN 7190-1 A.1 bis A.7, Roloff/Matek 27 Bsp. 12.2, DIN Tab. 5.
Jeder Prüffall trägt module='verbindungen'.
"""
import json, math, os
from scipy.optimize import brentq

HERE = os.path.dirname(os.path.abspath(__file__))
FD = os.path.join(os.path.dirname(HERE), 'data', 'fd')
_ld = lambda f: json.load(open(os.path.join(FD, f + '.json'), encoding='utf8'))
IT = sorted(_ld('fit_it'), key=lambda r: r['d_over_mm'])
DEV = sorted(_ld('fit_shaft_dev'), key=lambda r: r['d_over_mm'])
RZ = {r['ra_um']: r['rz_um'] for r in _ld('pv_rz')}
CHAMFER = sorted(_ld('pv_chamfer'), key=lambda r: r['d_over_mm'])
FIELDS = ['p', 'r', 's', 't', 'u', 'v', 'x', 'y', 'z']
S3 = math.sqrt(3)

def row_of(rows, D):
    for i, r in enumerate(rows):
        if (D > r['d_over_mm'] or (i == 0 and D >= r['d_over_mm'])) and (r['d_to_mm'] is None or D <= r['d_to_mm']): return r
    return None

def limits(D, hole, field, grade):
    """Grenzabmaße in mm: Bohrung H (EI 0, ES IT), Welle ei aus Tab. 5, es = ei + IT; None, wenn nicht definiert."""
    it, dv = row_of(IT, D), row_of(DEV, D)
    if it is None or dv is None or dv[field] is None: return None
    ES, ei = it[f'it{hole}'] / 1e3, dv[field] / 1e3
    es = ei + it[f'it{grade}'] / 1e3
    return dict(ES=ES, ei=ei, es=es, Uk=ei - ES, Ug=es)

# ---------------------------------------------------------------- Lamé
def lame_AB(a, b, pi, pa):
    """σ_r = A − B/r², σ_t = A + B/r² für den Ring a ≤ r ≤ b (a = 0: Vollzylinder)."""
    A = (pi * a * a - pa * b * b) / (b * b - a * a); B = (pi - pa) * a * a * b * b / (b * b - a * a)
    return A, B

def stresses(a, b, pi, pa, r):
    A, B = lame_AB(a, b, pi, pa)
    if r == 0: return A, A
    return A - B / r / r, A + B / r / r

def u_radial(a, b, pi, pa, r, E, mu):
    sr, st = stresses(a, b, pi, pa, r)
    return r / E * (st - mu * sr)

def coef(inp):
    """Übermaß je Fugendruck: U_w/p = 2·(u_A(r_F) − u_I(r_F))/p aus den Lamé-Verschiebungen (p = 1)."""
    rF, rA, rI = inp['DF'] / 2, inp['DaA'] / 2, inp['DiI'] / 2
    h, s = inp['hub'], inp['shaft']
    return 2 * (u_radial(rF, rA, 1.0, 0.0, rF, h['E'], h['mu']) - u_radial(rI, rF, 0.0, 1.0, rF, s['E'], s['mu']))

def tau_max(a, b, pi, pa, r):
    sr, st = stresses(a, b, pi, pa, r)
    return (max(sr, st, 0.0) - min(sr, st, 0.0)) / 2

def strength(m): return m['Rm'] if m['brittle'] else m['Re']

def pzul(inp):
    """Zulässige Fugendrücke aus τ_max ≤ R/(√3·S_P) (σ_z = 0), je Teil an der kritischen Stelle (p = 1 skaliert)."""
    rF, rA, rI = inp['DF'] / 2, inp['DaA'] / 2, inp['DiI'] / 2
    tA = tau_max(rF, rA, 1.0, 0.0, rF)
    tI = max(tau_max(rI, rF, 0.0, 1.0, rI), tau_max(rI, rF, 0.0, 1.0, rF))
    return strength(inp['hub']) / (S3 * inp['SPA']) / tA, strength(inp['shaft']) / (S3 * inp['SPI']) / tI

def rz(spec): return spec['Rz'] if spec['kind'] == 'rz' else RZ[spec['Ra']]

# ---------------------------------------------------------------- elastisch-plastisch (DIN 7190-1 Abschn. 4.3, brentq)
def zeta_for(QA, p, ReL):
    f = lambda z: 2 * math.log(z) - (QA * z) ** 2 + 1 - S3 * p / ReL
    if f(1.0) > 0 or f(1 / QA) < 0: return None
    return brentq(f, 1.0, 1 / QA, xtol=1e-15, rtol=1e-15)

def plastic(inp):
    QA, ReLA, ReLI, E = inp['DF'] / inp['DaA'], inp['hub']['Re'], inp['shaft']['Re'], inp['hub']['E']
    pPA = 2 * ReLA / S3 if QA < 1 / math.e else -2 * ReLA * math.log(QA) / S3
    pPI = 2 * ReLI / S3
    pz = min(pPI / inp['SPI'], pPA / inp['SPA'])
    zz = zeta_for(QA, pz, ReLA)
    return dict(pPA=pPA, pPI=pPI, zetaZul=zz, xiZul=2 / S3 * zz * zz * ReLA / E, xiEl=2 / S3 * ReLA / E, pEl=(1 - QA * QA) * ReLA / S3)

# ---------------------------------------------------------------- Rechenlauf
def run(inp):
    o = {}
    DF, lF, DaA, DiI = inp['DF'], inp['lF'], inp['DaA'], inp['DiI']
    QA, QI, AF = DF / DaA, DiI / DF, math.pi * DF * lF
    G = 0.4 * (rz(inp['rzA']) + rz(inp['rzI'])) / 1e3
    c = coef(inp); pA, pI = pzul(inp)
    o.update(QA=QA, QI=QI, AF=AF, G=G, pzulA=pA, pzulI=pI, K=c * inp['hub']['E'] / DF)   # K über U_w = K·p·D_F/E_A (Gl. (18)) aus der Verschiebung
    Ft = 2 * inp['T'] / DF; Fres = math.hypot(inp['Fax'], Ft); FR = inp['Sr'] * inp['KA'] * Fres
    o['FR'] = FR
    perf = FR / (AF * inp['nuR']) if Fres > 0 else None
    o['perf'] = perf
    ep = None
    if inp['plastic']: ep = plastic(inp); o.update(pPA=ep['pPA'], pPI=ep['pPI'], zetaZul=ep['zetaZul'], xiZul=ep['xiZul'])
    if inp['task'] == 'B':
        if ep and perf > ep['pEl']:
            z = zeta_for(QA, perf, inp['hub']['Re']); Uu = 2 / S3 * z * z * inp['hub']['Re'] / inp['hub']['E'] * DF + G
            Uo = ep['xiZul'] * DF + G
        else:
            Uu = c * perf + G; Uo = c * min(pA, pI) + G
        o.update(Uu=Uu, Uo=Uo, PT=Uo - Uu)
        cands = select(DF, Uu, Uo); o['nCand'] = len(cands)
        if cands: o.update(c0=code(cands[0]), c0Uk=cands[0]['Uk'], c0Ug=cands[0]['Ug'])
    fit = inp['fit']
    if fit is None: return o
    if fit['kind'] == 'iso': L = limits(DF, fit['hole'], fit['field'], fit['grade']); Uk, Ug = L['Uk'], L['Ug']
    else: Uk, Ug = fit['Uk'], fit['Ug']
    o.update(Uk=Uk, Ug=Ug)
    side = {}
    for k, U in (('min', Uk), ('max', Ug)):
        Uw = U - G; xi = Uw / DF
        if ep and xi > ep['xiEl']:
            z = math.sqrt(S3 * xi * inp['hub']['E'] / (2 * inp['hub']['Re']))
            p = inp['hub']['Re'] / S3 * (1 + 2 * math.log(z) - (QA * z) ** 2); q = (z * z - 1) * QA * QA / (1 - QA * QA)
            o.update({f'zeta_{k}': z, f'q_{k}': q, f'ep_{k}': 1.0})
        else:
            p = Uw / c; o[f'ep_{k}'] = 0.0
        o.update({f'Uw_{k}': Uw, f'xi_{k}': xi, f'p_{k}': p}); side[k] = p
    pmin, pmax = side['min'], side['max']
    o['T'] = math.pi / 2 * DF * DF * lF * pmin * inp['nuR'] / inp['Sr']; o['Faxt'] = math.pi * DF * lF * pmin * inp['nuR'] / inp['Sr']
    o['SPA'] = inp['SPA'] * pA / pmax; o['SPI'] = inp['SPI'] * pI / pmax
    rF, rA, rI = DF / 2, DaA / 2, DiI / 2
    srF, tAi = stresses(rF, rA, pmax, 0, rF); _, tAa = stresses(rF, rA, pmax, 0, rA)
    _, tIa = stresses(rI, rF, 0, pmax, rF); _, tIi = stresses(rI, rF, 0, pmax, rI)
    o.update(tAi=tAi, tAa=tAa, tIa=tIa, tIi=tIi, vA=2 * tau_max(rF, rA, pmax, 0, rF), vI=2 * max(tau_max(rI, rF, 0, pmax, rI), tau_max(rI, rF, 0, pmax, rF)))
    o['dDaA'] = 2 * u_radial(rF, rA, pmax, 0, rA, inp['hub']['E'], inp['hub']['mu'])
    j = inp['joining']
    if j['kind'] == 'laengs':
        o['Fe'] = math.pi * DF * lF * inp['nuL'] * pmax
        r = row_of(CHAMFER, DF) if DF > CHAMFER[0]['d_over_mm'] else None
        o['le'] = r['le_mm'] if r else DF ** (1 / 3)
    else:
        aA = inp['hub']['alphaHeat']; aI = inp['shaft']['alphaCool'] if j['thetaI'] < j['thetaR'] else inp['shaft']['alphaHeat']
        Us = 0.001 * DF if j['clearance'] == 'din' else Ug / 2; UF = Ug + Us
        # Temperatur, bei der die Bohrung um U_F größer ist als die Welle bei ϑ_I: D_F·(1 + α_A·Δϑ_A) = D_F·(1 + α_I·Δϑ_I) + U_F
        o.update(Us=Us, UF=UF, thetaA=j['thetaR'] + (UF / DF + aI * (j['thetaI'] - j['thetaR'])) / aA)
        if j['thetaAzul'] is not None: o['Umax'] = DF * (aA * (j['thetaAzul'] - j['thetaR']) - aI * (j['thetaI'] - j['thetaR'])) - Us
    if inp['spinN'] is not None:
        n = inp['spinN'] / 60; E, mu, rho = inp['hub']['E'], inp['hub']['mu'], inp['hub']['rho'] * 1e-12
        xi = o['xi_min']; u = math.pi * n * DaA
        # Abheben: Fugendruck aus Fliehkraft gleich p im Stillstand (DIN Gl. (58)), Druckabfall quadratisch in u (Gl. (57))
        uab = math.sqrt(4 * E * xi / ((3 + mu) * rho))
        o.update(u=u, uab=uab, pn=(1 - (u / uab) ** 2) * pmin, ng=uab / (math.pi * DaA), lim54=(3 + mu) / (3 + mu + (1 - mu) * QA * QA) * inp['hub']['Re'] / E,
                 lim55=inp['shaft']['Re'] / (QA * QA * E), ratio10=u / (math.sqrt(0.1) * uab))
        o['Tn'] = o['T'] * o['pn'] / pmin
    # Rutschen mit dem kleinsten Fugendruck im Betrieb (Stillstand p_min, bei Drehzahl p_n nach DIN Gl. (57))
    if Fres > 0: o['SrIst'] = o.get('pn', pmin) * AF * inp['nuR'] / (inp['KA'] * Fres)
    return o

def select(D, Uu, Uo):
    out, mid = [], (Uu + Uo) / 2
    for h in (6, 7, 8):
        for f in FIELDS:
            for g in (5, 6, 7, 8):
                L = limits(D, h, f, g)
                if L and L['Uk'] >= Uu * (1 - 1e-9) and L['Ug'] <= Uo * (1 + 1e-9):
                    out.append(dict(hole=h, field=f, grade=g, Uk=L['Uk'], Ug=L['Ug'], d=abs((L['Uk'] + L['Ug']) / 2 - mid), iso=(h, g) in ((6, 5), (7, 6), (8, 7), (8, 8))))
    return sorted(out, key=lambda x: (x['d'], x['hole'], FIELDS.index(x['field']), x['grade']))

def code(c): return c['hole'] * 1000 + FIELDS.index(c['field']) * 10 + c['grade']

# ---------------------------------------------------------------- Fälle (Eingaben wie scripts/pv-faelle.ts, dort die Beschreibung)
def mat(E, mu, Re, **o):
    m = dict(label='', E=E, mu=mu, Re=Re, Rm=None, A=None, alphaHeat=11e-6, alphaCool=8.5e-6, rho=7850, brittle=False); m.update(o); return m
def quer(thetaAzul=None, thetaI=20, clearance='din'): return dict(kind='quer', thetaR=20, thetaI=thetaI, clearance=clearance, thetaAzul=thetaAzul)
def base(**o):
    b = dict(task='A', DF=50, lF=50, DaA=100, DiI=0, hub=mat(215000, 0.3, 300), shaft=mat(215000, 0.3, 200), rzA=dict(kind='rz', Rz=6), rzI=dict(kind='rz', Rz=6),
             fit=None, T=0, Fax=0, KA=1, Sr=1, SPA=1.1, SPI=1.1, nuR=0.1, nuL=None, joining=quer(), plastic=False, spinN=None); b.update(o); return b
fax = lambda p, DF, lF, nu: p * math.pi * DF * lF * nu
U_A1 = 2 * 90 / ((1 - 0.25) * 215000) * 50 + 0.4 * 12 / 1e3
AL, ST3 = dict(hub=mat(70000, 0.3, 150), shaft=mat(215000, 0.3, 300), DiI=10, DaA=125, SPA=1.2, SPI=1.2), None
EP = dict(hub=mat(215000, 0.3, 400, A=15), shaft=mat(215000, 0.3, 400, A=15), rzA=dict(kind='rz', Rz=8), rzI=dict(kind='rz', Rz=8), SPA=1.25, SPI=1.1, plastic=True)
GJL = mat(115000, 0.25, None, Rm=180, brittle=True, alphaHeat=10e-6, alphaCool=8e-6, A=0.5)
CASES = {
    'P-PV1': base(task='B', Fax=fax(90, 50, 50, 0.1)),
    'P-PV2': base(fit=dict(kind='manual', Uk=0.075, Ug=0.075)),
    'P-PV3': base(task='B', Fax=fax(50, 50, 50, 0.1), **AL),
    'P-PV4': base(fit=dict(kind='manual', Uk=0.065, Ug=0.065), **AL),
    'P-PV5': base(task='B', Fax=fax(220, 50, 50, 0.1), **EP),
    'P-PV6': base(fit=dict(kind='manual', Uk=0.19, Ug=0.19), **EP),
    'P-PV7a': base(fit=dict(kind='manual', Uk=U_A1, Ug=U_A1), spinN=10000, T=100e3),
    'P-PV7b': base(fit=dict(kind='manual', Uk=U_A1, Ug=U_A1), spinN=20000, T=100e3),
    'P-PV8': base(task='B', DF=80, DaA=190, lF=115, hub=GJL, shaft=mat(210000, 0.3, 295), rzA=dict(kind='rz', Rz=6.3), rzI=dict(kind='rz', Rz=6.3), T=1.2e6, Sr=1.5, SPA=2, SPI=1.1, nuR=0.16,
                  fit=dict(kind='iso', hole=6, field='r', grade=6), joining=quer(None, 20, 'half')),
    'P-PV9': base(DF=160, DaA=320, lF=160, DiI=60, hub=mat(210000, 0.3, 650), shaft=mat(210000, 0.3, 430), rzA=dict(kind='ra', Ra=1.6), rzI=dict(kind='ra', Ra=0.8),
                  fit=dict(kind='iso', hole=7, field='u', grade=6), T=20e6, Sr=1.5, nuR=0.14, joining=quer(300, -195.8)),
    'P-PV16': base(DF=40, DaA=80, lF=40, hub=mat(210000, 0.3, 335), shaft=mat(210000, 0.3, 430), fit=dict(kind='iso', hole=7, field='s', grade=6), T=150e3, Fax=2000, Sr=1.5, nuR=0.08, nuL=0.11, joining=dict(kind='laengs')),
    'P-PV17': base(DF=100, DaA=160, lF=80, hub=mat(210000, 0.3, 235), shaft=mat(210000, 0.3, 650), fit=dict(kind='iso', hole=7, field='r', grade=6), T=1e6, Sr=1.5, nuR=0.06, nuL=0.07, joining=dict(kind='laengs')),
    'P-PV18': base(task='B', DF=60, DaA=120, lF=70, hub=mat(210000, 0.3, 355), shaft=mat(210000, 0.3, 650), T=800e3, Sr=1.5, nuR=0.14, fit=dict(kind='iso', hole=7, field='s', grade=6), joining=quer(300)),
}
# Literaturwerte (Rundung der Quelle als Toleranz); Übermaße in mm, Geschwindigkeiten in mm/s
LIT = {
    'P-PV1': (dict(pzulA=118.1, pzulI=210, Uu=0.0608), 5e-3),
    'P-PV2': (dict(p_max=112.9), 5e-3),
    'P-PV3': (dict(pzulA=60.6, pzulI=138.6, K=1.936, Uu=0.0738), 3e-3),
    'P-PV4': (dict(p_max=43.5), 2e-3),
    'P-PV5': (dict(pPA=320.2, pPI=462.0, Uu=0.1494, zetaZul=1.308), 2e-3),
    'P-PV6': (dict(zeta_max=1.309, p_max=256.4, q_max=0.237), 3e-3),
    'P-PV7a': (dict(uab=192.5e3, u=52.4e3, lim54=1.325e-3, lim55=3.721e-3), 2e-3),
    'P-PV7b': (dict(pn=63.4, u=104.7e3), 2e-3),
    'P-PV8': (dict(K=2.06, perf=9.7, Uu=0.019, pzulA=42.8, Uo=0.066, PT=0.047, Uk=0.024, Ug=0.062, thetaA=136.25), 1e-2),
    'P-PV9': (dict(Uk=0.150, Ug=0.215), 1e-12),
}
# ISO 286-2 (zweite Ablesung, Tab. 6 H, Tab. 27 r, 28 s, 29 u): (D, Feld) → (oberes, unteres Abmaß) in µm
ISO2 = {(80, 'H6'): (19, 0), (80, 'r6'): (62, 43), (80, 'r5'): (56, 43), (160, 'H7'): (40, 0), (160, 'u6'): (215, 190), (40, 'H7'): (25, 0), (40, 's6'): (59, 43),
        (100, 'H7'): (35, 0), (100, 'r6'): (73, 51), (60, 'H7'): (30, 0), (60, 's6'): (72, 53), (60, 't6'): (85, 66)}
GRID_D = [1, 3, 3.5, 6, 10, 14, 15, 18, 24, 25, 30, 50, 65, 80, 100, 120, 160, 180, 250, 315, 400, 450, 500]
GRID_FITS = [(7, 'p', 6), (6, 's', 5), (8, 'u', 7), (7, 'x', 6), (11, 'z', 11), (6, 't', 5), (8, 'v', 8), (7, 'y', 6), (9, 'r', 9)]
SEL = [(80, 0.019014, 0.066430), (60, 0.021298, 0.111271), (160, 0.05, 0.2), (25, 0.02, 0.06), (400, 0.2, 0.45)]

def add_cases(cases, ref):
    import copy
    for cid, inp in CASES.items():
        cases.append(dict(id=f'{cid} PV', type='pv', inp=copy.deepcopy(inp), module='verbindungen')); ref[f'{cid} PV'] = ({k: v for k, v in run(inp).items() if v is not None}, 1e-9)
        if cid in LIT:
            cases.append(dict(id=f'{cid} PV Literatur', type='pv', inp=copy.deepcopy(inp), module='verbindungen')); ref[f'{cid} PV Literatur'] = LIT[cid]
    # Formelfreigabe 0.17.0 (Seti): Rutschen bei Drehzahl mit p_n, A.7 bei 10 000 1/min S_r,ist = 83,34·7854·0,1/4000 = 16,36
    cases.append(dict(id='P-PV7a PV Rutschen mit p_n', type='pv', inp=copy.deepcopy(CASES['P-PV7a']), module='verbindungen'))
    ref['P-PV7a PV Rutschen mit p_n'] = (dict(SrIst=16.36, pn=83.34), 1e-3)
    cases.append(dict(id='P-PV8 PV Passungsvorschlag', type='pv', inp=copy.deepcopy(CASES['P-PV8']), module='verbindungen'))
    ref['P-PV8 PV Passungsvorschlag'] = (dict(c0=6016.0), 0)   # H6/r6 vor H6/r5 (Konzept P5, Roloff Bsp. 12.2)
    # Identitäten im Kern: Lamé-Verlauf gegen geschlossene Formeln (P-PV10), ΔD_aA gegen u(b) (P-PV14)
    for cid in ('P-PV3', 'P-PV4', 'P-PV9', 'P-PV16'):
        if CASES[cid]['fit'] is None: continue
        cases.append(dict(id=f'{cid} PV Lamé', type='pv', inp=copy.deepcopy(CASES[cid]), module='verbindungen'))
        ref[f'{cid} PV Lamé'] = (dict(lameErr=0.0, uLameErr=0.0), 1e-12)
    for D in GRID_D:
        for h, f, g in GRID_FITS:
            L = limits(D, h, f, g); id_ = f'PV Passung D {D} H{h}/{f}{g}'
            cases.append(dict(id=id_, type='pvfit', D=D, fit=dict(kind='iso', hole=h, field=f, grade=g), module='verbindungen'))
            ref[id_] = (dict(errors=1.0) if L is None else dict(errors=0.0, ES=L['ES'], ei=L['ei'], es=L['es'], Uk=L['Uk'], Ug=L['Ug']), 1e-12)
    for (D, name), (up, lo) in ISO2.items():
        id_ = f'PV ISO 286-2 D {D} {name}'
        if name[0] == 'H': fit, val = dict(kind='iso', hole=int(name[1:]), field='p', grade=6), dict(ES=up / 1e3)
        else: fit, val = dict(kind='iso', hole=7, field=name[0], grade=int(name[1:])), dict(ei=lo / 1e3, es=up / 1e3)
        cases.append(dict(id=id_, type='pvfit', D=D, fit=fit, module='verbindungen')); ref[id_] = (val, 1e-12)
    for D, Uu, Uo in SEL:
        l = select(D, Uu, Uo); id_ = f'PV Vorschlag D {D} Ü {Uu * 1e3:.3f} bis {Uo * 1e3:.3f} µm'
        cases.append(dict(id=id_, type='pvsel', D=D, Uu=Uu, Uo=Uo, module='verbindungen'))
        ref[id_] = (dict(n=len(l), sumUk=sum(x['Uk'] for x in l), sumUg=sum(x['Ug'] for x in l), nIso=sum(x['iso'] for x in l), **({'c0': code(l[0])} if l else {}), **({'c1': code(l[1])} if len(l) > 1 else {})), 1e-12)
