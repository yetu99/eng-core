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
    add_sv_cases(cases, ref)


# ================================================================ Schraubenverbindung (eng-core 0.18.0), Konzept fachtools/konzept_sv.md
# Eigene Python-Umsetzung ohne den Code des Kerns, Eingaben gleich (verification/sv_faelle.json aus scripts/sv-faelle.ts):
#   δ_P als Integral ∫dz/(E(z)·A(z)) über den Verformungskörper (scipy quad, je Platte und Abschnitt), nicht Gl. (40);
#   F_M,zul aus σ_red(F) = √((F/A₀)² + 3·(M_G/W_t)²) = ν·R_p0,2 mit W_t = π·d₀³/12 (plastisches Torsionsmoment) über brentq, nicht (R7/2);
#   Φ_K und Φ_n aus dem linearen System Gleichgewicht F_SA + F_PA = F_A und Verträglichkeit F_SA·δ_S − F_PA·δ_P = F_A·δ_PZu
#   (Geradenschnitt der Kennlinien im Verspannungsschaubild, numpy.linalg.solve);
#   Normteil, Länge, Schaft, Bohrung, Setzbetrag, l_e, τ_B/R_m mit eigenem Fachdatenleser.
# Literaturfälle: Roloff/Matek 27 Bsp. 8.1 und 8.3, EKB 9 Seilzug, VDI 2230-1 B1 und B2, Roloff TB 8-1 und TB 8-14.
import numpy as np
from scipy.integrate import quad

SVD = {k: _ld(k) for k in ('threads', 'bolt_grades', 'bolt_geometry', 'clearance_holes', 'sv_embed', 'sv_engagement', 'sv_shear', 'sv_kef', 'sv_pg')}

def sv_thread(d, tid=None):
    for t in SVD['threads']:
        if (tid is not None and t['id'] == tid) or (tid is None and t['series'] == 'regel' and t['d_mm'] == d): return t
    return None

def sv_grade(g, d):
    for r in SVD['bolt_grades']:
        if r['grade'] == g and ((r['d_over_mm'] == 0 and d >= 0) or d > r['d_over_mm']) and d <= r['d_to_mm']: return r
    return None

def sv_parts(norm, d): return [g for g in SVD['bolt_geometry'] if g['norm'] == norm and g['d_mm'] == d]

def sv_part(norm, d, l=None):
    rows = sv_parts(norm, d)
    if not rows: return None
    if l is not None:
        for g in rows:
            if g['l_min_mm'] is not None and g['l_min_mm'] <= l <= g['l_max_mm']: return g
        b = [g for g in rows if g['product_class'] == 'B']
        if b and len(rows) > 1 and l >= b[0]['l_min_mm']: return b[0]
    a = [g for g in rows if g['product_class'] == 'A']
    return a[0] if a else rows[0]

def sv_b(p, l):
    if p['norm'] == 'ISO 4017': return None
    if l <= 125: return p['b1_mm'] if p['b1_mm'] is not None else p['b2_mm']
    if l <= 200: return p['b2_mm'] if p['b2_mm'] is not None else p['b1_mm']
    for k in ('b3_mm', 'b2_mm', 'b1_mm'):
        if p[k] is not None: return p[k]
    return None

def sv_hole(d, cls):
    for h in SVD['clearance_holes']:
        if h['d_mm'] == d: return h[{'fein': 'fine_mm', 'mittel': 'medium_mm', 'grob': 'coarse_mm'}[cls]]
    return None

def sv_le(group, Rm, grade, thread):
    g = '12.9' if grade == '12.9' else '10.9' if grade in ('10.9', '9.8') else '8.8'
    rows = [e for e in SVD['sv_engagement'] if e['material_group'] == group and e['grade'] == g and e['thread'] == thread and Rm > e['rm_over_mpa'] - 1e-9]
    return max(rows, key=lambda e: e['rm_over_mpa']) if rows else None

def sv_kef(typ, la, ak):
    pts = {(k['la_h'], k['ak_h']): k['n'] for k in SVD['sv_kef'] if k['sv_type'] == typ}
    LA, AK = [0, 0.1, 0.2, 0.3], [0, 0.1, 0.3, 0.5]
    # Interpolation mit numpy.interp je Zeile, dann in l_A/h (Randwerte gehalten)
    col = [np.interp(min(ak, 0.5), AK, [pts[(l, a)] for a in AK]) for l in LA]
    return float(np.interp(min(la, 0.3), LA, col))

def sv_tan(model, lK, dW, DAp):
    bL, y = lK / dW, DAp / dW
    return 0.348 + 0.013 * math.log(bL) + 0.193 * math.log(y) if model == 'ESV' else 0.362 + 0.032 * math.log(bL / 2) + 0.153 * math.log(y)

def sv_plate_integral(layers, dW, dh, DA, w, t):
    """∫ dz/(E·π/4·(D(z)² − d_h²)) mit D(z) = min(D_A, d_W + 2·s·tan φ), s = Abstand zur nächsten Auflage (w = 1) bzw. zum Kopf (w = 2)."""
    lK = sum(l['h'] for l in layers); out = []; z0 = 0.0
    def D(z):
        s = min(z, lK - z) if w == 1 else z
        return min(DA, dW + 2 * s * t)
    lV = (DA - dW) / (2 * t) if DA > dW else 0.0
    br = sorted({0.0, lK, lK / 2, lV, lK - lV} if w == 1 else {0.0, lK, lV})
    for L in layers:
        a, b = z0, z0 + L['h']; z0 = b
        cuts = [a] + [z for z in br if a < z < b] + [b]
        s = sum(quad(lambda z: 1 / (L['E'] * math.pi / 4 * (D(z) ** 2 - dh * dh)), cuts[i], cuts[i + 1], epsabs=0, epsrel=1e-13, limit=200)[0] for i in range(len(cuts) - 1))
        out.append(s)
    return out

def sv_fmzul(d2, d0, P, mu, nu, Rp):
    A0, Wt = math.pi / 4 * d0 ** 2, math.pi * d0 ** 3 / 12
    f = lambda F: math.sqrt((F / A0) ** 2 + 3 * (F * d2 / 2 * (P / (math.pi * d2) + 1.155 * mu) / Wt) ** 2) - nu * Rp
    return brentq(f, 1e-6, A0 * Rp * 2, xtol=1e-12, rtol=1e-15)

def sv_split(FA, dS, dP, dPZu, n):
    """F_SA, F_PA aus Gleichgewicht und Verträglichkeit (n = 1), dann Krafteinleitung n: Φ_n = n·Φ_K."""
    if FA == 0: return 0.0, 0.0, (dP + dPZu) / (dS + dP)
    x = np.linalg.solve(np.array([[1.0, 1.0], [dS, -dP]]), np.array([FA, FA * dPZu]))
    PhiK = x[0] / FA
    return n * PhiK * FA, (1 - n * PhiK) * FA, PhiK

def sv_run(inp):
    o = {}
    th = sv_thread(inp['d'], inp['threadId'])
    if th is None: return dict(errors=1.0)
    d, P, d2, d3 = th['d_mm'], th['p_mm'], th['d2_mm'], th['d3_mm']
    dSd = (d2 + d3) / 2; As, Ad3, AN = math.pi / 4 * dSd ** 2, math.pi / 4 * d3 ** 2, math.pi / 4 * d * d
    if inp['gradeManual']: Rp, Rm = inp['gradeManual']['Rp'], inp['gradeManual']['Rm']
    else: g = sv_grade(inp['grade'], d); Rp, Rm = g['yield_min_mpa'], g['rm_min_mpa']
    ES, esv = inp['ES'], inp['joint'] == 'ESV'
    wash = next((g for g in SVD['bolt_geometry'] if g['norm'] == 'ISO 7089' and g['d_mm'] == d), None)
    layers = ([dict(h=wash['h_mm'], E=ES, pG=None, w=True)] if inp['washerHead'] else []) + [dict(p, w=False) for p in inp['plates']] + \
             ([dict(h=wash['h_mm'], E=ES, pG=None, w=True)] if (not esv and inp['washerNut']) else [])
    lK = sum(l['h'] for l in layers)
    nut = None if esv else sv_part('ISO 4032', d)
    l = inp['length']; part = sv_part(inp['norm'], d, l)
    leRow = sv_le(inp['engagement']['group'], inp['engagement']['Rm'], inp['grade'] if not inp['gradeManual'] else '8.8', th['series']) if (esv and inp['engagement']) else None
    if inp['shank'] is None and l is None:
        need = lK + (nut['m_max_mm'] if nut else 0.8 * d) + 2 * P if not esv else lK + (inp['mGes'] if inp['mGes'] is not None else (leRow['le_d_max'] * d if leRow else 1.25 * d) + 2 * P)
        ls = sorted({x for g in sv_parts(inp['norm'], d) for x in g['l_series']})
        def _fits(x):
            pp = sv_part(inp['norm'], d, x); bb = sv_b(pp, x)
            return bb is None or x - bb <= lK * (1 + 1e-9)
        l = next(x for x in ls if x >= need - 1e-9 and _fits(x)); part = sv_part(inp['norm'], d, l)
    if inp['shank'] is not None: shank = inp['shank']
    else:
        b = sv_b(part, l); ls_ = 0 if b is None else max(0, l - b)
        shank = [dict(l=ls_, d=inp['taper'] if inp['taper'] is not None else d)] if ls_ > 0 else []
    lSh = sum(e['l'] for e in shank); lGew = max(0.0, lK - lSh)
    if lSh > lK * (1 + 1e-9): return dict(errors=1.0)
    o.update(lK=lK, lGew=lGew, length=l)
    dmin = min([e['d'] for e in shank], default=1e9); d0 = dmin if dmin < dSd else dSd; A0 = math.pi / 4 * d0 ** 2; o['d0'] = d0
    dh = inp['dh'] if inp['dh'] is not None else sv_hole(d, inp['hole'])
    dWh = inp['dW'] if inp['dW'] is not None else part['dw_min_mm']
    dWp = inp['dW'] if inp['dW'] is not None else (wash['d2_max_mm'] if inp['washerHead'] else dWh)
    dWc = inp['dWcone'] if inp['dWcone'] is not None else dWp
    DKi = max(dh, inp['dha'] or 0); DKm = (dWh + DKi) / 2
    # Auflagen (U3): je Seite Liste (Außen-, Innendurchmesser, p_G); mit Scheibe Kopf/Mutter auf Scheibe und Scheibe auf Platte
    pls = [L for L in layers if not L['w']]
    pGH = inp['pGHead'] if inp['pGHead'] is not None else pls[0]['pG']; pGN = inp['pGNut'] if inp['pGNut'] is not None else pls[-1]['pG']
    con = {'kopf': ([(dWh, wash['d1_min_mm'], inp['pGWasher']), (dWp, DKi, pGH)] if inp['washerHead'] else [(dWp, DKi, pGH)]), 'mutter': []}
    if not esv:
        dWn = nut['dw_min_mm'] if nut else None
        if inp['washerNut']: con['mutter'] = ([(dWn, wash['d1_min_mm'], inp['pGWasher'])] if dWn is not None else []) + [(wash['d2_max_mm'], DKi, pGN)]
        elif dWn is not None and dWn > DKi: con['mutter'] = [(dWn, DKi, pGN)]
    area = lambda a, b: math.pi / 4 * (a * a - b * b)
    Ap = area(*con['kopf'][-1][:2]); o.update(Ap=Ap, DKm=DKm)
    ApN = area(*con['mutter'][-1][:2]) if con['mutter'] else None
    if ApN is not None: o['ApNut'] = ApN
    # Nachgiebigkeit Schraube (Ersatzlängen VDI 5.1.1)
    hexh = inp['norm'] != 'ISO 4762'
    dM = (0.33 * d / (inp['EBI'] * AN)) if esv else 0.4 * d / (ES * AN)
    dS = (0.5 if hexh else 0.4) * d / (ES * AN) + sum(e['l'] / (ES * math.pi / 4 * e['d'] ** 2) for e in shank) + lGew / (ES * Ad3) + 0.5 * d / (ES * Ad3) + dM
    # Platten: Integral über den Verformungskörper
    cm = inp['coneModel'] or inp['joint']; w = 2 if cm == 'ESV' else 1
    DA = inp['DA']; DAp = inp['DAp'] if inp['DAp'] is not None else DA
    t = sv_tan(cm, lK, dWc, DAp); DAGr = dWc + w * lK * t
    dPK = sum(sv_plate_integral(layers, dWc, dh, DA, w, t))
    DAe = min(DA, dWc + lK)
    if DA <= dWc: Aers = math.pi / 4 * (DA ** 2 - dh ** 2)
    else: x = (lK * dWc / DAe ** 2) ** (1 / 3); Aers = math.pi / 4 * (dWc ** 2 - dh ** 2) + math.pi / 8 * dWc * (DAe - dWc) * ((x + 1) ** 2 - 1)
    dPHZ = sum(L['h'] / (Aers * L['E']) for L in layers)
    dP = dPK if inp['plateModel'] == 'kegel' else dPHZ
    o.update(dS=dS, dP=dP, dPK=dPK, dPHZ=dPHZ, Aers=Aers, tanPhi=t, DAGr=DAGr)
    dPZu = (dM if esv else 0.0) if inp['phiZu'] else 0.0
    FAmax = inp['FAmax'] if inp['flange'] is None else inp['flange']['p'] * math.pi / 4 * inp['flange']['dm'] ** 2 / inp['flange']['z']
    FAmin = inp['FAmin']
    FSAmax, FPAmax, PhiK = sv_split(FAmax, dS, dP, dPZu, inp['n'])
    PhiN = inp['n'] * PhiK; FSAmin = PhiN * FAmin
    o.update(PhiK=PhiK, PhiN=PhiN, FAmax=FAmax, FSAmax=FSAmax, FSAmin=FSAmin, FPAmax=FPAmax)
    if inp['kef']: o['kefN'] = sv_kef(inp['kef']['type'], inp['kef']['laH'], inp['kef']['akH'])
    z = inp['torque']['z'] if inp['torque'] else 1
    FQ = inp['FQ'] / z + (2 * inp['torque']['T'] / (inp['torque']['Dt'] * z) if inp['torque'] else 0)
    FKQ = FQ / (inp['qF'] * inp['muT']) + (inp['MY'] / (inp['qF'] * inp['ra'] * inp['muT']) if inp['MY'] > 0 else 0)
    FKerf = max(FKQ, inp['AD'] * inp['pi'] + inp['FKHand'])
    o.update(FQ=FQ, FKQ=FKQ, FKerf=FKerf)
    if inp['fZ'] is not None: fZ = inp['fZ']
    else:
        lo = {'lt10': 0, '10to40': 10, '40to160': 40}[inp['rz']]
        e = next(e for e in SVD['sv_embed'] if e['rz_over_um'] == lo and e['load'] == inp['embedLoad'])
        nA, nT = (1, len(layers)) if esv else (2, len(layers) - 1)
        fZ = (e['f_thread_um'] + nA * e['f_bearing_um'] + nT * e['f_interface_um']) / 1e3
    FZ = fZ / (dS + dP); o.update(fZ=fZ, FZ=FZ)
    dF = 0.0
    if inp['temp']: tp = inp['temp']; dF = lK * (tp['alphaS'] * tp['dTS'] - tp['alphaP'] * tp['dTP']) / (dS + dP)
    o['dFVth'] = dF; loss, gain = max(dF, 0), min(dF, 0)
    FMmin = FKerf + (1 - PhiN) * FAmax + FZ + loss; FMmax = inp['alphaA'] * FMmin
    FMzul = sv_fmzul(d2, d0, P, inp['muG'], inp['nu'], Rp)
    o.update(FMmin=FMmin, FMmax=FMmax, FMzul=FMzul)
    FSmax = FMzul + FSAmax - gain; sigZ = FSmax / A0
    MG = FMzul * d2 / 2 * (P / (math.pi * d2) + 1.155 * inp['muG']); WP = math.pi / 16 * d0 ** 3
    tau = 0.0 if inp['torsionFree'] else MG / WP
    sred = math.hypot(sigZ, math.sqrt(3) * 0.5 * tau); SF = Rp / sred
    o.update(FSmax=FSmax, sigZ=sigZ, MG=MG, WP=WP, tau=tau, sigRedB=sred, SF=SF)
    dyn = abs(FAmax - FAmin) > 1e-9 * max(abs(FAmax), abs(FAmin), 1)
    if dyn:
        sa = (FSAmax - FSAmin) / (2 * As); o['sigA'] = sa
        stain = (not inp['gradeManual']) and inp['grade'].startswith(('A2-', 'A4-'))
        sas = inp['sigmaA'] if inp['sigmaA'] is not None else (None if (stain or inp['gradeManual']) else 0.85 * (150 / d + 45))
        if sas is not None and inp['sigmaA'] is None and inp['rolled'] == 'SG':
            Fm = FMzul + (FSAmax + FSAmin) / 2; sas = (2 - Fm / (As * Rp)) * sas
        if sas is not None and inp['NZ'] is not None and inp['NZ'] < 2e6: sas = sas * (2e6 / inp['NZ']) ** (1 / 6 if inp['rolled'] == 'SG' else 1 / 3)
        if sas is not None: o.update(sigAS=sas, SD=sas / sa)
    FVmax = FMzul - FZ
    pM, pB = FMzul / Ap, (FVmax + max(FSAmax, 0) - gain) / Ap
    o.update(pM=pM, pB=pB)
    Ftab = sv_fmzul(d2, d0, P, inp['muG'], 0.9, Rp)
    pmx = lambda A: 1.4 * Ftab / A if inp['yieldControlled'] else max(FMzul / A, (FVmax + max(FSAmax, 0) - gain) / A)
    o['pMax'] = pmx(Ap)
    for side, key in (('kopf', 'SpHead'), ('mutter', 'SpNut')):
        sp = [pg / pmx(area(a, b)) for a, b, pg in con[side] if pg is not None]
        if sp: o[key] = min(sp)
        o['_miss_' + side] = any(pg is None for _, _, pg in con[side])
    FVmin = FMzul / inp['alphaA'] - FZ - loss; FKR = FVmin - (1 - PhiN) * FAmax
    o.update(FVmin=FVmin, FKRmin=FKR)
    if FKQ > 0: o['SG'] = FKR / FKQ
    if FQ > 0:
        dt = d if inp['shearAt'] == 'schaft' else dSd; At = math.pi / 4 * dt ** 2; o['tauQ'] = FQ / At
        key = inp['grade'].split('-')[1] if inp['grade'].startswith(('A2-', 'A4-')) else inp['grade']
        sr = next((s for s in SVD['sv_shear'] if s['grade'] == key), None)
        if sr and not inp['gradeManual']: o['SA'] = sr['tau_rm'] * Rm * At / FQ
    if esv:
        if leRow: o['le'] = leRow['le_d_max'] * d
        mG = inp['mGes'] if inp['mGes'] is not None else (l - lK if inp['shank'] is None else None)
        if mG is not None: o['mEff'] = mG - 2 * P
    muG, muK = inp['muG'], inp['muK']
    o['MA'] = FMzul * (0.16 * P + 0.58 * d2 * muG + DKm / 2 * muK)
    phi, rho = math.atan(P / (math.pi * d2)), math.atan(muG / math.cos(math.radians(30)))
    o['MAex'] = FMzul * (d2 / 2 * math.tan(phi + rho) + DKm / 2 * muK)
    o['ML'] = FVmax * (d2 / 2 * math.tan(rho - phi) + DKm / 2 * muK); o['MLi'] = FVmax * P / (2 * math.pi)
    # Vorwahl Roloff (8.2), κ-Tabelle linear
    beta = 0.6 if dmin < dSd else (1.1 if lSh > 0 else 0.8)
    kap = float(np.interp(muG, [0.08, 0.10, 0.12, 0.14, 0.20], [1.15, 1.20, 1.25, 1.32, 1.52] if dmin < dSd else [1.11, 1.15, 1.19, 1.24, 1.41]))
    den = Rp / (kap * inp['alphaA']) - beta * ES * fZ / lK
    if den > 0 and max(FAmax, 0) + FKerf > 0: o['AsMin'] = (max(FAmax, 0) + FKerf) / den
    # Nachweise (1 = erfüllt)
    o['ok_montage'] = float(FMmax <= FMzul * (1 + 1e-9)); o['ok_fliessen'] = float(SF >= inp['req']['SF'] * (1 - 1e-9))
    o['ok_restklemmkraft'] = float(FKR >= FKerf - 1e-9 * max(FKerf, 1) and FKR > 0)
    if 'SD' in o: o['ok_dauer'] = float(o['SD'] >= inp['req']['SD'] * (1 - 1e-9))
    if 'SG' in o: o['ok_gleiten'] = float(o['SG'] >= inp['req']['SG'] * (1 - 1e-9))
    for side, key, ok in (('kopf', 'SpHead', 'ok_pressung-kopf'), ('mutter', 'SpNut', 'ok_pressung-mutter')):
        if key in o and o[key] < inp['req']['Sp'] * (1 - 1e-9): o[ok] = 0.0
        elif key in o and not o['_miss_' + side]: o[ok] = 1.0
    del o['_miss_kopf'], o['_miss_mutter']
    if 'SA' in o: o['ok_abscheren'] = float(o['SA'] >= inp['req']['SA'] * (1 - 1e-9))
    if esv and 'le' in o and 'mEff' in o: o['ok_einschraubtiefe'] = float(o['mEff'] >= o['le'] * (1 - 1e-9))
    if not esv: o['ok_einschraubtiefe'] = 1.0
    return o

def sv_abort(inp):
    pH = inp['pGHead'] if inp['pGHead'] is not None else inp['plates'][0]['pG']
    pN = inp['pGNut'] if inp['pGNut'] is not None else inp['plates'][-1]['pG']
    return pH is None or (inp['joint'] == 'DSV' and pN is None) or ((inp['washerHead'] or (inp['joint'] == 'DSV' and inp['washerNut'])) and inp['pGWasher'] is None)

SV_REQ = ('ok_montage', 'ok_fliessen', 'ok_dauer', 'ok_pressung-kopf', 'ok_pressung-mutter', 'ok_restklemmkraft', 'ok_gleiten', 'ok_einschraubtiefe')
def sv_select(inp):
    """Auslegung SV-WAHL: M4 bis M39 × 8.8, 10.9, 12.9, Geometrie aus der Norm; gültig, wenn alle Pflichtnachweise erfüllt (fehlende p_G, l_e: ungültig)."""
    import copy
    out = []
    for d in sorted(t['d_mm'] for t in SVD['threads'] if t['series'] == 'regel'):
        for g in ('8.8', '10.9', '12.9'):
            c = copy.deepcopy(inp); c.update(task='A', d=d, threadId=None, grade=g, gradeManual=None, length=None, shank=None, taper=None, dW=None, dh=None, dha=None, dWcone=None, mGes=None, kef=None)
            try: r = sv_run(c)
            except (StopIteration, TypeError, ValueError, ZeroDivisionError): out.append((d, g, False, 0.0, 'ungültig')); continue
            if r.get('errors'): out.append((d, g, False, 0.0, 'ungültig')); continue
            dyn = abs(r['FAmax'] - c['FAmin']) > 1e-9 * max(abs(r['FAmax']), abs(c['FAmin']), 1)
            need = ['ok_montage', 'ok_fliessen', 'ok_restklemmkraft', 'ok_pressung-kopf'] + (['ok_einschraubtiefe'] if c['joint'] == 'ESV' else []) + (['ok_dauer'] if dyn else []) + (['ok_gleiten'] if r['FKQ'] > 0 else []) + (['ok_pressung-mutter'] if 'ApNut' in r else [])
            st = 'ungültig' if any(r.get(k) == 0.0 for k in need) else 'nicht bewertbar' if any(k not in r for k in need) else 'gültig'
            out.append((d, g, st == 'gültig', r['FMzul'], st))
    return out

# Literaturwerte (Toleranz = Rundung der Quelle, Konzept Abschn. 6), Nachgiebigkeiten in mm/N, Momente in N·mm
SV_LIT = {
    'P-SV1': (dict(dS=2.029e-6, Aers=982, dPHZ=0.254e-6, PhiK=0.111, FZ=4820, FMmax=87000, FMzul=119000, sigAS=46.2, pM=119000 / 181), 5e-3),
    'P-SV1 Φ': (dict(PhiN=0.033), 1.5e-2),
    'P-SV2': (dict(FQ=1870, FKerf=9350, AsMin=34.5, dS=6.28e-6, Aers=397.14, dPHZ=5.40e-7, FZ=1470, FMmax=17310), 3e-3),
    'P-SV2 F_sp': (dict(FMzul=18100), 1e-2),
    'P-SV3': (dict(dS=2.95e-6, DAGr=44.9, dPK=0.363e-6, FZ=2415, FMmin=26921, FMmax=48458, FMzul=64800, MG=58700, WP=218, tau=269.3, sigZ=785.2, SF=1.15, Ap=90, mEff=14.5), 5e-3),
    'P-SV3 Φ und n': (dict(PhiK=0.16, PhiN=0.056, kefN=0.35, SpHead=1.8, MA=108000), 1.5e-2),
    'P-SV3 σ_ASV': (dict(sigAS=48.875), 1e-9),
    'P-SV4': (dict(dS=2.249e-6, DAGr=58.4, dPK=0.781e-6, FZ=3630, FMmin=59630, FMmax=95408, FMzul=118800, Ap=151.5, pM=784, FKRmin=70620, SG=1.26, tauQ=41.8, dPHZ=0.563e-6), 5e-3),
    'P-SV4 exakt': (dict(fZ=0.011, FKerf=56000, FQ=8400), 1e-9),
    'P-SV4 M_A': (dict(MA=302000), 1e-2),
    'P-SV5': (dict(Aers=293.1, dS=2.64e-6, FMmax=31700, FMzul=29600, ok_montage=0.0), 1e-2),
    'P-SV5 Φ': (dict(dPHZ=0.29e-6, PhiN=0.05), 2e-2),
}
# Roloff TB 8-1 (A_s, A_3 in mm²), zweite Ablesung zu DIN 13-1 (P-SV0)
TB81 = {8: (36.6, 32.84), 10: (58.0, 52.30), 12: (84.3, 76.25), 16: (157, 144.1)}
# Roloff TB 8-14 F_sp in kN (ν 0,9, Schaftschraube), μ 0,08 bis 0,14 × 8.8, 10.9, 12.9 (P-SV8), aus sv/build/pruef_werte_fd13.py
TB814 = {8: [(19.5, 28.7, 33.6), (19.1, 28.0, 32.8), (18.6, 27.3, 32.0), (18.1, 26.6, 31.1)],
         10: [(31.0, 45.6, 53.3), (30.3, 44.5, 52.1), (29.6, 43.4, 50.8), (28.8, 42.3, 49.5)],
         12: [(45.2, 66.3, 77.6), (44.1, 64.9, 75.9), (43.1, 63.3, 74.1), (41.9, 61.6, 72.1)],
         14: [(62.0, 91.0, 106), (60.6, 88.9, 104), (59.1, 86.7, 101), (57.5, 84.4, 98.8)],
         16: [(84.7, 124, 145), (82.9, 122, 142), (80.9, 119, 139), (78.8, 116, 135)],
         20: [(136, 194, 227), (134, 190, 223), (130, 186, 217), (127, 181, 212)],
         24: [(196, 280, 327), (192, 274, 320), (188, 267, 313), (183, 260, 305)]}
# VDI Tab. A1 (über B1 S. 134, B2 S. 141): F_M,Tab in N (B-sv2, Toleranz 0,3 %)
VDI_A1 = {(12, '10.9', 0.10): 64800, (12, '12.9', 0.10): 75900, (16, '10.9', 0.12): 118800}
# Vergleich Kegel gegen Hohlzylinder (B-sv4, P-SV10), µm/kN gerundet
SV_B4 = {'P-SV3': (0.363, 0.271), 'P-SV4': (0.781, 0.563), 'P-SV1': (0.200, 0.254)}

def add_sv_cases(cases, ref):
    import copy
    F = json.load(open(os.path.join(HERE, 'sv_faelle.json'), encoding='utf8'))   # aus scripts/sv-faelle.ts (npx tsx scripts/sv-json.ts)
    for f in F['faelle']:
        cid, inp = f['id'], f['inp']; r = sv_run(inp)
        if inp['task'] == 'B':
            sel = [] if sv_abort(inp) else sv_select(inp); v = [s for s in sel if s[2]]
            r.update(nCand=len(sel), nValid=len(v), nOpen=sum(s[4] == 'nicht bewertbar' for s in sel), c0d=v[0][0] if v else None, sumFMzul=sum(s[3] for s in sel))
        cases.append(dict(id=f'{cid} SV', type='sv', inp=copy.deepcopy(inp), module='verbindungen'))
        ref[f'{cid} SV'] = ({k: v for k, v in r.items() if v is not None}, 1e-9)
        cases.append(dict(id=f'{cid} SV Schaubild', type='sv', inp=copy.deepcopy(inp), module='verbindungen'))
        ref[f'{cid} SV Schaubild'] = (dict(diagErr=0.0), 1e-9)   # P-SV9: Pfeile F_SA, F_PA, F_KR im Verspannungsschaubild
        for key, (vals, tol) in SV_LIT.items():
            if key.split(' ')[0] == cid:
                id_ = f'{key} SV Literatur'; cases.append(dict(id=id_, type='sv', inp=copy.deepcopy(inp), module='verbindungen')); ref[id_] = (vals, tol)
        if cid in SV_B4:
            k, h = SV_B4[cid]; id_ = f'{cid} SV Kegel gegen Hohlzylinder'
            cases.append(dict(id=id_, type='sv', inp=copy.deepcopy(inp), module='verbindungen')); ref[id_] = (dict(dPK=k * 1e-6, dPHZ=h * 1e-6), 5e-3)
    for f in F['fehler']:
        cases.append(dict(id=f'{f["id"]} SV Fehler', type='sv', inp=copy.deepcopy(f['inp']), module='verbindungen'))
        ref[f'{f["id"]} SV Fehler'] = (dict(errors=0.0 if f['id'] == 'P-SV11j' else 1.0), 0)
    for d, (As, A3) in TB81.items():
        id_ = f'P-SV0 SV Gewinde M{d} TB 8-1'; cases.append(dict(id=id_, type='svthread', d=d, module='verbindungen')); ref[id_] = (dict(As=As, Ad3=A3), 5e-3)
    for t in SVD['threads']:
        if t['series'] != 'regel': continue
        d = t['d_mm']; dS = (t['d2_mm'] + t['d3_mm']) / 2; id_ = f'P-SV0 SV Gewinde M{d}'
        cases.append(dict(id=id_, type='svthread', d=d, module='verbindungen'))
        ref[id_] = (dict(As=math.pi / 4 * dS ** 2, Ad3=math.pi / 4 * t['d3_mm'] ** 2, AN=math.pi / 4 * d * d, dS=dS, phiDeg=math.degrees(math.atan(t['p_mm'] / (math.pi * t['d2_mm'])))), 1e-12)
        id_ = f'P-SV0 SV Gewinde M{d} gegen Tabelle A_s'; cases.append(dict(id=id_, type='svthread', d=d, module='verbindungen')); ref[id_] = (dict(As=t['as_mm2']), 1e-2)
    for d, rows in TB814.items():
        for mu, vals in zip((0.08, 0.10, 0.12, 0.14), rows):
            for g, v in zip(('8.8', '10.9', '12.9'), vals):
                id_ = f'P-SV8 SV F_M,zul M{d} {g} μ {mu:.2f} TB 8-14'; cases.append(dict(id=id_, type='svfmzul', d=d, grade=g, mu=mu, nu=0.9, module='verbindungen')); ref[id_] = (dict(FMzul=v * 1e3), 1e-2)
                t = sv_thread(d); dS = (t['d2_mm'] + t['d3_mm']) / 2
                id_ = f'P-SV8 SV F_M,zul M{d} {g} μ {mu:.2f} brentq'; cases.append(dict(id=id_, type='svfmzul', d=d, grade=g, mu=mu, nu=0.9, module='verbindungen'))
                ref[id_] = (dict(FMzul=sv_fmzul(t['d2_mm'], dS, t['p_mm'], mu, 0.9, sv_grade(g, d)['yield_min_mpa'])), 1e-9)
    for (d, g, mu), v in VDI_A1.items():
        id_ = f'P-SV8 SV F_M,zul M{d} {g} μ {mu:.2f} VDI Tab. A1'; cases.append(dict(id=id_, type='svfmzul', d=d, grade=g, mu=mu, nu=0.9, module='verbindungen')); ref[id_] = (dict(FMzul=v), 3e-3)
    # P-SV7: M_A nach (R13/1) gegen exakt (8.24), M4 bis M39, μ 0,08 bis 0,16, D_Km aus d_w ISO 4014 und Loch mittel: |Abweichung| < 0,5 %
    worst = 0.0
    for t in SVD['threads']:
        if t['series'] != 'regel': continue
        d = t['d_mm']; p = sv_part('ISO 4014', d); DKm = (p['dw_min_mm'] + sv_hole(d, 'mittel')) / 2
        for mu in (0.08, 0.10, 0.12, 0.14, 0.16):
            phi, rho = math.atan(t['p_mm'] / (math.pi * t['d2_mm'])), math.atan(mu / math.cos(math.radians(30)))
            e = (0.16 * t['p_mm'] + 0.58 * t['d2_mm'] * mu + DKm / 2 * mu) / (t['d2_mm'] / 2 * math.tan(phi + rho) + DKm / 2 * mu) - 1
            worst = max(worst, abs(e)); id_ = f'P-SV7 SV M_A M{d} μ {mu:.2f}'
            cases.append(dict(id=id_, type='svma', d=d, mu=mu, DKm=DKm, module='verbindungen')); ref[id_] = (dict(maRel=e), 1e-9)
    assert worst < 5e-3, ('P-SV7', worst)
    # P-SV6: Teilkörper mit gleichem E (drei Platten) = ein Körper; Kegel und Hülse bei D_A = D_A,Gr = Kegel (Integral, 10⁻⁹)
    for w, D_A in ((1, 80.0), (2, 80.0), (1, 30.0), (2, 30.0), (1, 15.0)):
        t = 0.55; one = [dict(h=42.0, E=205000.0)]; three = [dict(h=12.0, E=205000.0), dict(h=20.0, E=205000.0), dict(h=10.0, E=205000.0)]
        for nm, L in (('ein Körper', one), ('drei Teilkörper', three)):
            id_ = f'P-SV6 SV Verformungskörper w {w} D_A {D_A:g} {nm}'
            cases.append(dict(id=id_, type='svcone', layers=L, dW=21.0, dh=13.5, DA=D_A, w=w, t=t, module='verbindungen'))
            ref[id_] = (dict(dP=sum(sv_plate_integral(one, 21.0, 13.5, D_A, w, t)), n=float(len(L))), 1e-9)
    cases.append(dict(id='P-SV18 SV nicht vorgespannt', type='svnv', F=20000, grade='8.8', underLoad=False, module='verbindungen'))
    ref['P-SV18 SV nicht vorgespannt'] = (dict(AsErf=20000 * 1.25 / 640, d=10.0), 1e-12)
    cases.append(dict(id='P-SV18 SV nicht vorgespannt unter Last', type='svnv', F=50000, grade='10.9', underLoad=True, module='verbindungen'))
    ref['P-SV18 SV nicht vorgespannt unter Last'] = (dict(AsErf=50000 * 1.5 / 940, d=12.0), 1e-12)
