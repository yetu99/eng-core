"""Unabhängige Gegenrechnung Modul chemie v1.1 bis v1.4 (eng-core 0.25.0, Werkzeug Chemiewerk):
Thermochemie (CH-T), Gleichgewicht (CH-G), Kinetik (CH-A), Elektrochemie (CH-Z), Wasserchemie (CH-W).

Andere Verfahren als der Kern:
  - Zuordnung der Bildungsgrößen über die Formelzeichenkette und die Standardphase (Kern: Hill-Formel), Hess als Skalarprodukt mit numpy.
  - Verbrennungsgleichung über den sympy-Nullraum der Elementmatrix (Kern: geschlossene Formel a + b/4 + e − c/2).
  - Gleichgewichtszusammensetzung mit scipy brentq in ξ (Kern: eigene Bisektion), Zellreaktion über sympy-Brüche.
  - Säure-Base und Kalk-Kohlensäure: scipy brentq auf der Ladungs- bzw. Alkalitätsbilanz in lg c_H, Davies mit Wasserdichte
    aus dem Paket iapws (IAPWS-IF97; Kern: Kell 1975, Abweichung < 10⁻⁵, daher Toleranz 2·10⁻⁵ für A, γ, pH mit Aktivitäten, Kalk-Kohlensäure), Calcitlösekapazität über verschachteltes brentq.
  - Kinetik: Regression mit numpy.polyfit (Kern: eigene Summenformeln).
Daten: test/fixtures/ch_v11.json (Abzug ch_thermo, ch_equilibria, ch_potentials) und ch_snapshot.json.
"""
import json, math, os, re
import numpy as np
import sympy as sp
from scipy.optimize import brentq, minimize_scalar
from iapws import IAPWS97

HERE = os.path.dirname(os.path.abspath(__file__))
V = json.load(open(os.path.join(HERE, '..', 'test', 'fixtures', 'ch_v11.json'), encoding='utf-8'))
SNAP = json.load(open(os.path.join(HERE, '..', 'test', 'fixtures', 'ch_snapshot.json'), encoding='utf-8'))
EL = {e['symbol']: e for e in SNAP['elements']}
TH = {r['id']: r for r in V['thermo']}
EQ = {r['id']: r for r in V['equilibria']}
PO = {r['id']: r for r in V['potentials']}
MOD = 'chemie'
R = 6.02214076e23 * 1.380649e-23
F = 6.02214076e23 * 1.602176634e-19
VMN = R * 273.15 / 101325
LN10 = math.log(10)


def tid(f):
    """Kennung in ch_thermo: Zustand angegeben → direkt; Ion → (aq); sonst Standardphase der gleichen Formelzeichenkette."""
    if re.search(r'\((s|l|g|aq)\)$', f): return f
    if re.search(r'\^\d*[+-]$', f): return f + '(aq)'
    return next(r['id'] for r in V['thermo'] if r['formula'] == f and r['default_phase'])


def comp(f):
    f = re.sub(r'\((s|l|g|aq)\)$', '', f); f = re.sub(r'\^\d*[+-]$', '', f)
    def grp(s, i):
        c = {}
        while i < len(s):
            if s[i] == '(':
                inner, i = grp(s, i + 1); i += 1
                m = re.match(r'\d*', s[i:]); n = int(m.group() or 1); i += len(m.group())
                for e, v in inner.items(): c[e] = c.get(e, 0) + v * n
            elif s[i] == ')':
                return c, i
            else:
                m = re.match(r'([A-Z][a-z]?)(\d*)', s[i:]); c[m.group(1)] = c.get(m.group(1), 0) + int(m.group(2) or 1); i += m.end()
        return c, i
    return grp(f, 0)[0]


def Mr(f): return sum(n * EL[e]['atomic_mass_u'] for e, n in comp(f).items()) * 1e-3


def thermo(terms, T):
    ids = [tid(f) for f, _, _ in terms]
    nu = np.array([(1 if s == 'produkt' else -1) * n for _, s, n in terms], float)
    H = np.array([TH[i]['dfH_kJ_mol'] * 1e3 for i in ids]); dH = float(nu @ H)
    o = dict(dH=dH)
    if all(TH[i]['S_J_molK'] is not None for i in ids):
        S = np.array([TH[i]['S_J_molK'] for i in ids]); dS = float(nu @ S); o['dS'] = dS
        o['dGT'] = dH - T * dS
        if dH * dS > 0: o['Tinv'] = dH / dS
    if all(TH[i]['dfG_kJ_mol'] is not None for i in ids):
        G = np.array([TH[i]['dfG_kJ_mol'] * 1e3 for i in ids]); o['dG298'] = float(nu @ G)
        if abs(T - 298.15) < 1e-9: o['dGT'] = o['dG298']
    if 'dGT' in o: o['logK'] = -o['dGT'] / (R * T * LN10)
    return o


def fuel(f):
    sps = [f, 'O2', 'CO2', 'H2O', 'N2', 'SO2']; cs = [comp(s) for s in sps]
    fc = comp(f)
    keep = [0, 1] + [k for k in range(2, 6) if any(e in fc for e in cs[k] if e != 'O')]
    els = sorted({e for k in keep for e in cs[k]})
    A = sp.Matrix([[cs[k].get(e, 0) * (1 if k < 2 else -1) for k in keep] for e in els])
    v = A.nullspace()[0]; v = v / v[0]
    nu = {sps[k]: float(v[j]) for j, k in enumerate(keep)}
    Hf = lambda i: TH[i]['dfH_kJ_mol'] * 1e3
    base = nu.get('CO2', 0) * Hf('CO2(g)') + nu.get('SO2', 0) * Hf('SO2(g)') - Hf(tid(f))
    Hs = -(base + nu.get('H2O', 0) * Hf('H2O(l)')); Hi = -(base + nu.get('H2O', 0) * Hf('H2O(g)'))
    o = dict(o2=nu['O2'], Hs_m=Hs, Hi_m=Hi, Hs_w=Hs / Mr(f), Hi_w=Hi / Mr(f))
    if TH[tid(f)]['phase'] == 'g': o.update(Hs_v=Hs / VMN, Hi_v=Hi / VMN)
    return o


def eq_extent(spc, K, mode, val):
    lo = max(-n0 / nu for _, nu, n0, _ in spc if nu > 0); hi = min(-n0 / nu for _, nu, n0, _ in spc if nu < 0)
    def g(xi):
        n = [n0 + nu * xi for _, nu, n0, _ in spc]
        nt = sum(x for x, s in zip(n, spc) if s[3] == 'gas')
        return sum(s[1] * math.log((x / nt) * val / 1e5 if mode == 'gas' else x / (val * 1000)) for x, s in zip(n, spc) if s[3] != 'rein') - math.log(K)
    e = (hi - lo) * 1e-13
    xi = brentq(g, lo + e, hi - e, xtol=1e-16, rtol=1e-15, maxiter=500)
    return dict(xi=xi, **{f'n{k}': n0 + nu * xi for k, (_, nu, n0, _) in enumerate(spc)})


def half(pid):
    p = PO[pid]; l, r = p['half_reaction'].split(' = ')
    def tm(s):
        out = []
        for t in s.split(' + '):
            m = re.fullmatch(r'(\d+) (.+)', t)
            out.append((sp.Rational(m.group(1)), m.group(2)) if m else (sp.Integer(1), t))
        return out
    L, Rr = tm(l), tm(r)
    z = sum(n for n, f in L if f == 'e^-')
    return dict(E0=p['E0_V'], z=z, ox=[(n, f) for n, f in L if f != 'e^-'], red=Rr)


def nernst_py(h, T, act):
    lnQ = sum(float(n) * math.log(act.get(f, 1)) for n, f in h['red']) - sum(float(n) * math.log(act.get(f, 1)) for n, f in h['ox'])
    return h['E0'] - R * T / (float(h['z']) * F) * lnQ


def cell_py(a, b, T, act):
    ha, hb = half(a), half(b); Ea, Eb = nernst_py(ha, T, act), nernst_py(hb, T, act)
    k, an = (ha, hb) if Ea >= Eb else (hb, ha)
    z = sp.ilcm(k['z'], an['z'])
    dE0 = k['E0'] - an['E0']; dE = max(Ea, Eb) - min(Ea, Eb)
    return dict(z=float(z), dE0=dE0, dE=dE, dG=-float(z) * F * dE, logK=float(z) * F * dE0 / (R * T * LN10))


def A_dh(T):
    th = T - 273.15; eps = 87.74 - 0.40008 * th + 9.398e-4 * th ** 2 - 1.41e-6 * th ** 3
    rho = IAPWS97(T=T, P=0.101325).rho
    return 1.82483e6 * math.sqrt(rho / 1000) / (eps * T) ** 1.5


def gam(z, I, A):
    s = math.sqrt(I); return 10 ** (-A * z * z * (s / (1 + s) - 0.3 * I))


def acid_base(systems, strong, pKw, T, activity):
    A = A_dh(T) if activity else None
    Kw = 10 ** -pKw
    def conc(lh, I):
        g = (lambda z: gam(z, I, A) if A and z else 1.0)
        aH = 10 ** lh * g(1)  # lh = lg(c_H / (mol/L))
        out = []
        for cT, pK, z0 in systems:
            # Aktivitäten a_i = a_{i-1} · K_i / a_H, Konzentration c_i = a_i / γ_i, rekursiv in Konzentrationsverhältnissen
            w = [1.0]
            for i, p in enumerate(pK): w.append(w[-1] * g(z0 - i) * 10 ** -p / aH / g(z0 - i - 1))
            s = sum(w); out.append([(x / s, z0 - i) for i, x in enumerate(w)])
        cH = 10 ** lh * 1000; cOH = Kw / aH / g(-1) * 1000
        return cH, cOH, out
    def bal(lh, I):
        cH, cOH, out = conc(lh, I)
        return cH - cOH + sum(c * z for c, z in strong) + sum(cT * sum(a * z for a, z in o) for (cT, _, _), o in zip(systems, out))
    I = 0.5 * sum(c * z * z for c, z in strong) / 1000 if activity else 0.0
    for _ in range(300):
        if not activity: break
        lh = brentq(lambda x: bal(x, I), -16, 1, xtol=1e-15, maxiter=500)
        cH, cOH, out = conc(lh, I)
        In = 0.5 * (cH + cOH + sum(c * z * z for c, z in strong) + sum(cT * sum(a * z * z for a, z in o) for (cT, _, _), o in zip(systems, out))) / 1000
        if abs(In - I) <= 1e-13: I = In; break
        I = In
    lh = brentq(lambda x: bal(x, I), -16, 1, xtol=1e-15, maxiter=500)
    g1 = gam(1, I, A) if activity else 1.0
    cH, cOH, out = conc(lh, I)
    beta = LN10 * (cH + cOH)
    for (cT, _, _), o in zip(systems, out):
        nb = sum(i * a for i, (a, _) in enumerate(o)); beta += LN10 * cT * sum((i - nb) ** 2 * a for i, (a, _) in enumerate(o))
    return dict(pH=-(lh + math.log10(g1)), I=I, beta=beta)


def carbonate_py(T, pH, Ca, alk, I, lk1, lk2, lkw, lksp, lkh):
    A = A_dh(T); g1, g2 = gam(1, I, A), gam(2, I, A)
    K1, K2, Kw, Ksp, KH = 10 ** lk1, 10 ** lk2, 10 ** lkw, 10 ** lksp, 10 ** lkh
    def sp_(ph, CT):
        aH = 10 ** -ph
        k1 = K1 / (aH * g1); k2 = K2 * g1 / (aH * g2)  # bedingte Konstanten c_HCO3/c_CO2, c_CO3/c_HCO3
        cCO2 = CT / (1 + k1 + k1 * k2); cHCO3 = k1 * cCO2; cCO3 = k2 * cHCO3
        return cCO2, cHCO3, cCO3, aH / g1 * 1000, Kw / aH / g1 * 1000
    def alk_(ph, CT):
        _, b, c, h, oh = sp_(ph, CT); return b + 2 * c + oh - h
    CT = brentq(lambda ct: alk_(pH, ct) - alk, 1e-9, 1e4, xtol=1e-15, rtol=1e-15)
    si = lambda Ca_, c3: math.log10(g2 * Ca_ / 1000 * g2 * c3 / 1000 / Ksp)
    cCO2, _, cCO3, _, _ = sp_(pH, CT); SI = si(Ca, cCO3)
    def si_ph(ph):
        ct = brentq(lambda c: alk_(ph, c) - alk, 1e-14, 1e5, xtol=1e-18, rtol=1e-15)
        return si(Ca, sp_(ph, ct)[2])
    ph_max = brentq(lambda p: alk_(p, 1e-14) - alk, 4, 14, xtol=1e-14)  # dort C_T → 0
    top = minimize_scalar(lambda p: -si_ph(p), bounds=(4, ph_max - 1e-6), method='bounded', options=dict(xatol=1e-10))
    pHC = brentq(si_ph, 4, top.x, xtol=1e-14)
    def si_x(x):
        ct, al = CT + x, alk + 2 * x
        ph = brentq(lambda p: alk_(p, ct) - al, 0, 14, xtol=1e-15)
        return si(Ca + x, sp_(ph, ct)[2])
    xa = -min(Ca, CT, alk / 2) * (1 - 1e-9)
    D = brentq(si_x, xa, 100, xtol=1e-15, rtol=1e-15)
    return dict(CT=CT, SI=SI, pHC=pHC, D=D, pCO2=cCO2 / 1000 / KH * 1e5)


def logk_at(e, T):
    if abs(T - 298.15) < 1e-9: return e['log_k_25']
    a = e['analytic']
    if a: return a[0] + a[1] * T + a[2] / T + a[3] * math.log10(T) + a[4] / T ** 2 + a[5] * T ** 2
    return e['log_k_25'] + e['delta_h_kJ_mol'] * 1000 / (R * LN10) * (1 / 298.15 - 1 / T)


THERMO = [
    ('CH-T1 Methan', [('CH4', 'edukt', 1), ('O2', 'edukt', 2), ('CO2', 'produkt', 1), ('H2O(l)', 'produkt', 2)], 298.15),
    ('CH-T2 Kalkbrennen 1200 K', [('CaCO3', 'edukt', 1), ('CaO', 'produkt', 1), ('CO2', 'produkt', 1)], 1200.0),
    ('CH-T3 Haber-Bosch 700 K', [('N2', 'edukt', 1), ('H2', 'edukt', 3), ('NH3', 'produkt', 2)], 700.0),
    ('CH-T4 Wassergas 1000 K', [('C', 'edukt', 1), ('H2O(g)', 'edukt', 1), ('CO', 'produkt', 1), ('H2', 'produkt', 1)], 1000.0),
    ('CH-T5 Thermit', [('Fe2O3', 'edukt', 1), ('Al', 'edukt', 2), ('Al2O3', 'produkt', 1), ('Fe', 'produkt', 2)], 298.15),
    ('CH-T6 Knallgas Wasser(g) 2000 K', [('H2', 'edukt', 2), ('O2', 'edukt', 1), ('H2O(g)', 'produkt', 2)], 2000.0),
    ('CH-T7 Neutralisation', [('H^+', 'edukt', 1), ('OH^-', 'edukt', 1), ('H2O', 'produkt', 1)], 298.15),
    ('CH-T8 Calcit Lösung', [('CaCO3', 'edukt', 1), ('Ca^2+', 'produkt', 1), ('CO3^2-', 'produkt', 1)], 298.15),
    ('CH-T9 SO2 Oxidation 800 K', [('SO2', 'edukt', 2), ('O2', 'edukt', 1), ('SO3(g)', 'produkt', 2)], 800.0),
    ('CH-T10 Methanol Synthese 500 K', [('CO', 'edukt', 1), ('H2', 'edukt', 2), ('CH3OH(g)', 'produkt', 1)], 500.0),
]
FUELS = ['H2', 'CH4', 'C2H6', 'C3H8', 'C4H10', 'C8H18', 'CH3OH', 'C2H5OH', 'C', 'CO', 'NH3', 'H2S', 'C2H2', 'N2H4']
EQX = [
    ('CH-G1 Ammoniak 200 bar', [('N2', -1, 1.0, 'gas'), ('H2', -3, 3.0, 'gas'), ('NH3', 2, 0.0, 'gas')], 10 ** -4.5, 'gas', 200e5),
    ('CH-G2 N2O4 Zerfall', [('N2O4', -1, 1.0, 'gas'), ('NO2', 2, 0.0, 'gas')], 0.148, 'gas', 1e5),
    ('CH-G3 Essigsäure Ester', [('CH3COOH', -1, 1.0, 'geloest'), ('C2H5OH', -1, 1.0, 'geloest'), ('Ester', 1, 0.0, 'geloest'), ('H2O', 1, 0.0, 'geloest')], 4.0, 'loesung', 1e-3),
    ('CH-G4 Wassergas-Shift', [('CO', -1, 1.0, 'gas'), ('H2O', -1, 2.0, 'gas'), ('CO2', 1, 0.0, 'gas'), ('H2', 1, 0.5, 'gas')], 1.44, 'gas', 3e5),
    ('CH-G5 Boudouard 1000 K', [('C', -1, 2.0, 'rein'), ('CO2', -1, 1.0, 'gas'), ('CO', 2, 0.0, 'gas')], 1.9, 'gas', 1e5),
]


def add_cases(cases, ref):
    def case(id_, typ, vals, tol=1e-11, **kw):
        cases.append(dict(id=id_, type=typ, module=MOD, **kw)); ref[id_] = (vals, tol)
    for id_, terms, T in THERMO:
        case(id_, 'chthermo', thermo(terms, T), 1e-11, terms=[list(t) for t in terms], T=T)
    for f in FUELS:
        case(f'CH-T Brennstoff {f}', 'chfuel', fuel(f), 1e-11, f=f)
    parts = [('CH4', 0.6), ('H2', 0.02)]
    fv = {f: fuel(f) for f, _ in parts}
    case('CH-T Biogas 60 % CH4, 2 % H2', 'chmix', dict(Hs_v=sum(x * fv[f]['Hs_v'] for f, x in parts), Hi_v=sum(x * fv[f]['Hi_v'] for f, x in parts)), 1e-12, parts=[[f, x] for f, x in parts])
    dHm = thermo(THERMO[0][1], 298.15)['dH']
    case('CH-T Reaktionswärme 2 mol Methan', 'chheat', dict(Q=2 * dHm), 1e-12, xi=2.0, dH=dHm)
    # Gleichgewicht
    for dG, T in [(-32900.0, 298.15), (130400.0, 1200.0), (0.0, 500.0)]:
        case(f'CH-G K {dG:g} {T:g}', 'chk', dict(logK=-dG / (R * T * LN10)), 1e-12, dG=dG, T=T)
    for eid in ['Kw', 'H2CO3', 'HCO3', 'Calcit', 'CO2g', 'NH4', 'HSO4', 'H3PO4', 'HClO']:
        for T in [278.15, 283.15, 313.15, 333.15]:
            e = EQ[eid]
            if e['analytic'] is None and e['delta_h_kJ_mol'] is None: continue
            case(f'CH-G lgK {eid} {T:g} K', 'chlogk', dict(logK=logk_at(e, T)), 1e-12, e=eid, T=T)
    for id_, spc, K, mode, val in EQX:
        case(id_, 'cheqx', eq_extent(spc, K, mode, val), 1e-9, sp=[list(s) for s in spc], K=K, mode=mode, val=val)
    act = [0.5, 0.2, 2.0]
    lnQ = 2 * math.log(act[2]) - math.log(act[0]) - 3 * math.log(act[1])
    case('CH-G Q N2+3H2=2NH3', 'chq', dict(lnQ=lnQ, dG=R * 700 * (lnQ - math.log(1e-4))), 1e-12, nu=[-1, -3, 2], a=act, K=1e-4, T=700.0)
    # Kinetik
    for A, Ea, T in [(1e13, 100e3, 300.0), (2.5e10, 75e3, 350.0), (4e6, 50e3, 273.15)]:
        case(f'CH-A Arrhenius {A:g} {Ea:g} {T:g}', 'charr', dict(k=A * math.exp(-Ea / (R * T))), 1e-12, A=A, Ea=Ea, T=T)
    for k1, T1, k2, T2 in [(1e-3, 300.0, 4e-3, 320.0), (2.1e-5, 293.15, 8.7e-5, 313.15)]:
        Ea = R * math.log(k2 / k1) / (1 / T1 - 1 / T2)
        case(f'CH-A Ea {k1:g} {T1:g} {k2:g} {T2:g}', 'chea', dict(Ea=Ea, A=k1 * math.exp(Ea / (R * T1)), f=math.exp(Ea / R * (1 / T1 - 1 / T2))), 1e-11, k1=k1, T1=T1, k2=k2, T2=T2)
    for n, k, c0, t, X in [(0, 0.05, 1000.0, 3600.0, 0.5), (1, 1e-3, 1000.0, 600.0, 0.9), (2, 2e-6, 500.0, 1200.0, 0.75), (0, 1.0, 10.0, 100.0, 0.3)]:
        c = max(0.0, c0 - k * t) if n == 0 else c0 * math.exp(-k * t) if n == 1 else c0 / (1 + k * c0 * t)
        th = c0 / (2 * k) if n == 0 else math.log(2) / k if n == 1 else 1 / (k * c0)
        tx = X * c0 / k if n == 0 else -math.log(1 - X) / k if n == 1 else X / (k * c0 * (1 - X))
        case(f'CH-A Zeitgesetz n={n} k={k:g}', 'chrate', dict(c=c, tHalf=th, tX=tx), 1e-12, n=n, k=k, c0=c0, t=t, X=X)
    tt = [0.0, 300.0, 600.0, 900.0, 1200.0, 1800.0]
    cc = [1000 * math.exp(-1.2e-3 * x) * (1 + 0.004 * ((-1) ** i)) for i, x in enumerate(tt)]
    ys = {0: np.array(cc), 1: np.log(cc), 2: 1 / np.array(cc)}
    fit = {n: np.polyfit(tt, y, 1) for n, y in ys.items()}
    r2 = {n: float(np.corrcoef(tt, y)[0, 1] ** 2) for n, y in ys.items()}
    case('CH-A Ordnung aus Messreihe', 'chorder', dict(k0=-fit[0][0], k1=-fit[1][0], k2=fit[2][0], r0=r2[0], r1=r2[1], r2=r2[2], best=float(max(r2, key=r2.get))), 1e-9, t=tt, c=cc)
    # Elektrochemie
    for a, b, T, act in [('Zn', 'Cu2', 298.15, {'Zn^2+(aq)': 0.1, 'Cu^2+(aq)': 1.0}), ('Fe32', 'MnO4', 298.15, {'H^+(aq)': 0.1}), ('H', 'O2_H2O', 353.15, {'H2(g)': 1.0, 'O2(g)': 0.21}),
                         ('PbSO4', 'PbO2', 298.15, {}), ('Ag', 'AgCl', 298.15, {'Ag^+(aq)': 1e-3, 'Cl^-(aq)': 0.1}), ('Li', 'F2', 298.15, {}), ('Ni', 'Cd', 310.0, {'Ni^2+(aq)': 0.5, 'Cd^2+(aq)': 0.01})]:
        case(f'CH-Z Zelle {a}|{b} {T:g} K', 'chcell', cell_py(a, b, T, act), 1e-12, a=a, b=b, T=T, act=act)
    for pid, T, act in [('Cu2', 298.15, {'Cu^2+(aq)': 1e-4}), ('MnO4', 298.15, {'MnO4^-(aq)': 0.01, 'H^+(aq)': 1e-3, 'Mn^2+(aq)': 0.1}), ('O2_OH', 283.15, {'O2(g)': 0.21, 'OH^-(aq)': 1e-6})]:
        case(f'CH-Z Nernst {pid}', 'chnernst', dict(E=nernst_py(half(pid), T, act)), 1e-12, p=pid, T=T, act=act)
    for dG, z in [(-212310.0, 2), (474260.0, 4), (-131200.0, 1)]:
        case(f'CH-Z E0 aus dG {dG:g}', 'che0', dict(E0=-dG / (z * F)), 1e-12, dG=dG, z=z)
    for z1, E1, z2, E2 in [(2, -0.447, 1, 0.771), (1, 0.153, 1, 0.521), (2, 0.695, 2, 1.776)]:
        case(f'CH-Z Luther {E1} {E2}', 'chluther', dict(E3=(z1 * E1 + z2 * E2) / (z1 + z2)), 1e-12, z1=z1, E1=E1, z2=z2, E2=E2)
    for I, t, n, z, M, eF in [(10.0, 3600.0, None, 2, Mr('Cu'), 1.0), (500.0, 86400.0, None, 2, Mr('H2'), 0.98), (2.0, None, 0.01, 1, Mr('Ag'), 0.95)]:
        tt_ = t if t is not None else n * z * F / (eF * I); nn = eF * I * tt_ / (z * F)
        kw = dict(I=I, z=z, M=M, etaF=eF); kw.update(dict(t=t) if t is not None else dict(n=n))
        case(f'CH-Z Faraday I={I:g}', 'chfar', dict(n=nn, t=tt_, m=nn * M, Q=I * tt_), 1e-12, **kw)
    w = thermo([('H2O(l)', 'edukt', 1), ('H2', 'produkt', 1), ('O2', 'produkt', 0.5)], 298.15)
    for U, eF in [(1.8, 0.98), (2.1, 1.0), (1.48, 0.95)]:
        ww = 2 * F * U / (eF * Mr('H2'))
        case(f'CH-Z Elektrolyse Wasser U={U}', 'chely', dict(Urev=w['dG298'] / (2 * F), Uth=w['dH'] / (2 * F), etaU=w['dH'] / (2 * F) / U, w=ww, eta=w['dH'] / (ww * Mr('H2'))), 1e-12,
             dG=w['dG298'], dH=w['dH'], z=2, U=U, M=Mr('H2'), etaF=eF)
    # Wasserchemie (Dichte: iapws IF97 gegen Kell im Kern)
    for T in [273.15, 283.15, 298.15, 313.15, 333.15]:
        A = A_dh(T)
        case(f'CH-W A {T:g} K', 'chdh', dict(A=A, g1=gam(1, 0.01, A), g2=gam(2, 0.01, A)), 2e-5, T=T)
    pk = lambda e: -EQ[e]['log_k_25']
    AB = [
        ('CH-W Essigsäure 0,1 mol/L', [(100.0, [pk('CH3COOH')], 0)], [], 14.0, 298.15, False),
        ('CH-W Essigsäure 1 mmol/L', [(1.0, [pk('CH3COOH')], 0)], [], 14.0, 298.15, False),
        ('CH-W Salzsäure 1e-7 mol/L', [], [(1e-4, -1)], 14.0, 298.15, False),
        ('CH-W Ammoniak 10 mmol/L', [(10.0, [pk('NH4')], 1)], [(10.0, -1)], 14.0, 298.15, False),
        ('CH-W Acetatpuffer 0,1/0,1 Davies', [(200.0, [pk('CH3COOH')], 0)], [(100.0, 1)], 14.0, 298.15, True),
        ('CH-W Phosphatpuffer Davies', [(10.0, [pk('H3PO4'), pk('H2PO4'), pk('HPO4')], 0)], [(15.0, 1)], 14.0, 298.15, True),
        ('CH-W Kohlensäure 2 mmol/L', [(2.0, [pk('H2CO3'), pk('HCO3')], 0)], [], 14.0, 298.15, False),
        ('CH-W Natriumcarbonat 5 mmol/L Davies', [(5.0, [pk('H2CO3'), pk('HCO3')], 0)], [(10.0, 1)], 14.0, 298.15, True),
        ('CH-W Schwefelsäure 10 mmol/L', [(10.0, [-3.0, pk('HSO4')], 0)], [], 14.0, 298.15, False),
        ('CH-W Natronlauge 1 mmol/L 10 °C', [], [(1.0, 1)], -logk_at(EQ['Kw'], 283.15), 283.15, False),
    ]
    for id_, sy, st, pKw, T, act in AB:
        case(id_, 'chab', acid_base(sy, st, pKw, T, act), 1e-9 if not act else 2e-5, sy=[[c, p, z] for c, p, z in sy], st=[[c, z] for c, z in st], pKw=pKw, T=T, act=act)
    for bCa, bMg, ks in [(0.08, 0.012, 4.0), (0.02, 0.004, 0.8), (0.15, 0.03, 2.5), (0.05, 0.01, None)]:
        c = bCa / Mr('Ca') + bMg / Mr('Mg'); u = 0.01 / Mr('CaO')
        v = dict(c=c, dH=c / u)
        if ks is not None: v['KH'] = min(ks / 2, c)
        case(f'CH-W Härte Ca {bCa * 1000:g} mg/L Mg {bMg * 1000:g} mg/L', 'chhard', v, 1e-12, bCa=bCa, bMg=bMg, ks=ks)
    ions = [[2.0, 2], [0.5, 2], [1.0, 1], [0.1, 1], [4.0, -1], [1.0, -1], [0.5, -2], [0.2, -1]]
    cat = sum(c * z for c, z in ions if z > 0); an = -sum(c * z for c, z in ions if z < 0)
    case('CH-W Ionenstärke und Ionenbilanz', 'chion', dict(I=0.5 * sum(c * z * z for c, z in ions) / 1000, err=(cat - an) / (cat + an)), 1e-12, ions=ions)
    lk = lambda e, T: logk_at(EQ[e], T)
    for T, pH, Ca, alk, I in [(283.15, 7.5, 2.0, 4.0, 0.008), (298.15, 8.2, 1.0, 2.0, 0.004), (288.15, 7.0, 3.0, 5.5, 0.012), (278.15, 8.0, 0.5, 1.0, 0.002), (303.15, 7.8, 2.5, 3.0, 0.01)]:
        L = [lk('H2CO3', T), lk('HCO3', T), lk('Kw', T), lk('Calcit', T), lk('CO2g', T)]
        case(f'CH-W Kalk-Kohlensäure {T - 273.15:g} °C pH {pH}', 'chcarb', carbonate_py(T, pH, Ca, alk, I, *L), 2e-5, T=T, pH=pH, Ca=Ca, alk=alk, I=I, lk=L)
