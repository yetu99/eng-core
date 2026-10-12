"""Unabhängige Gegenrechnung des Rechenkerns (Mockup D).
Eigene Python-Implementierung: Querschnittswerte zum Teil über numerische Integration und
Reihenlösungen, Biegelinien über Finite Differenzen, Knicken und Zugstab über numerische Integration.
Vergleich mit dem JS-Rechenkern, Toleranz 0,1 % (Näherungsformeln 1 %)."""
import json, math, os, subprocess, sys, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
from scipy.integrate import quad

E_AL = 70000.0; G_AL = 26400.0; RHO_AL = 2700.0
base = dict(mode='single', kind='biegung', sub='EQ', materialId='W038', secType='rund_hohl', dims={'D': 60, 't': 4}, L=1200, F=2, q=2, a=300, N=0, T=0,
            fDiv=300, SFreq=1.5, SBreq=2, SKreq=3, dvChoice={'RE': 'lower', 'RM': 'lower'}, dvManual={'RE': None, 'RM': None})

def area_I_polygon(pts):
    """Fläche und I_x um die Schwerachse für ein Polygon (Gauß, unabhängig von Formeln)."""
    x, y = np.array(pts).T; x1, y1 = np.roll(x, -1), np.roll(y, -1); cr = x * y1 - x1 * y
    A = cr.sum() / 2; cy = ((y + y1) * cr).sum() / (6 * A); Ix = ((y**2 + y * y1 + y1**2) * cr).sum() / 12
    return abs(A), abs(Ix) - abs(A) * cy**2, cy

def tri(a):
    h = math.sqrt(3) / 2 * a; return [(-a / 2, 0), (a / 2, 0), (0, h)]

def rect_torsion_series(b, h, n=199):
    """Saint-Venant, Reihenlösung (Timoshenko/Goodier), b ≤ h."""
    s = sum(math.tanh(k * math.pi * h / (2 * b)) / k**5 for k in range(1, n, 2))
    return h * b**3 / 3 * (1 - 192 / math.pi**5 * b / h * s)

ref, cases = {}, []
def sec(id_, s, dims, vals, tol=1e-3): cases.append(dict(id=id_, type='section', sec=s, dims=dims)); ref[id_] = (vals, tol)
# Querschnitte
D = 40; sec('S1 Rund voll D40', 'rund_voll', {'D': D}, dict(A=math.pi * D**2 / 4, I=quad(lambda y: y**2 * 2 * math.sqrt((D / 2)**2 - y**2), -D / 2, D / 2)[0], phiBe=1, phiTe=1, phiBf=1, phiTf=1))
Do, t = 60, 4; Ii = quad(lambda y: y**2 * 2 * math.sqrt(max((Do / 2)**2 - y**2, 0)), -Do / 2, Do / 2)[0] - quad(lambda y: y**2 * 2 * math.sqrt(max((Do / 2 - t)**2 - y**2, 0)), -(Do / 2 - t), Do / 2 - t)[0]
sec('S2 Rund hohl 60x4', 'rund_hohl', {'D': Do, 't': t}, dict(I=Ii, K=2 * Ii, W=Ii / 30))
sec('S3 Rechteck 30x60', 'rechteck_voll', {'b': 30, 'h': 60}, dict(A=1800, I=30 * 60**3 / 12, K=rect_torsion_series(30, 60)), tol=5e-3)
sec('S4 Quadrat 30', 'rechteck_voll', {'b': 30, 'h': 30}, dict(K=rect_torsion_series(30, 30), phiBe=math.pi / 3), tol=5e-3)
A_, I_, cy = area_I_polygon(tri(60)); sec('S5 Dreieck a60', 'dreieck_voll', {'a': 60}, dict(A=A_, I=I_, W=I_ / (math.sqrt(3) / 2 * 60 - cy), phiBe=2 * math.pi / (3 * math.sqrt(3))))
ao, ai = 90, 90 - 2 * math.sqrt(3) * 5; Ao, Io, co = area_I_polygon(tri(ao)); Ai, Ii2, ci = area_I_polygon(tri(ai))
sec('S6 Dreieck hohl 90x5', 'dreieck_hohl', {'a': 90, 't': 5}, dict(A=Ao - Ai, I=Io - Ii2))
sec('S7 Rechteckrohr 40x80x4', 'rechteck_hohl', {'b': 40, 'h': 80, 't': 4}, dict(A=40 * 80 - 32 * 72, I=(40 * 80**3 - 32 * 72**3) / 12))

# Biegelinien per Finite Differenzen (EI w'''' = q bzw. EI w'' = -M), unabhängig von Tabellenformeln
EI = E_AL * math.pi * (60**4 - 52**4) / 64; L = 1200.0
def fd_beam(case, n=2400, F=2000.0, q=2.0, a=300.0):
    x = np.linspace(0, L, n + 1); h = x[1] - x[0]
    if case in ('KE', 'KQ', 'EE', 'EQ', 'E4'):
        if case == 'KE': M = -F * (L - x)
        if case == 'KQ': M = -q * (L - x)**2 / 2
        if case == 'EE': M = np.where(x <= L / 2, F * x / 2, F * (L - x) / 2)
        if case == 'EQ': M = q * x * (L - x) / 2
        if case == 'E4': M = np.where(x < a, F * x, np.where(x > L - a, F * (L - x), F * a))
        k = M / EI; th = np.concatenate([[0], np.cumsum((k[1:] + k[:-1]) / 2 * h)]); w = np.concatenate([[0], np.cumsum((th[1:] + th[:-1]) / 2 * h)])
        if case in ('KE', 'KQ'): w = -w   # w(0)=0, w'(0)=0
        else: w = -(w - w[-1] * x / L)   # w(0)=w(L)=0
        return np.abs(M).max(), np.abs(w).max()
    # BQ: beidseitig eingespannt, EI w'''' = q, Randbedingungen w = w' = 0 (Finite Differenzen)
    m = 400; hh = L / m; Am = np.zeros((m + 1, m + 1)); b = np.full(m + 1, q * hh**4 / EI)
    for i in range(2, m - 1): Am[i, i - 2:i + 3] = [1, -4, 6, -4, 1]
    Am[0, 0] = 1; b[0] = 0; Am[m, m] = 1; b[m] = 0
    Am[1, 0:4] = [-4, 7, -4, 1]; Am[m - 1, m - 3:m + 1] = [1, -4, 7, -4]  # Spiegelung w_-1 = w_1
    w = np.linalg.solve(Am, b); return q * L**2 / 12, w.max()
for c, F, q in [('KE', 2, 0), ('KQ', 0, 2), ('EE', 2, 0), ('EQ', 0, 2), ('E4', 2, 0), ('BQ', 0, 2)]:
    Mref, wref = fd_beam(c, F=F * 1000, q=q)
    id_ = f'B {c}'; cases.append(dict(id=id_, type='calc', inp={**base, 'sub': c, 'F': F, 'q': q})); ref[id_] = (dict(M=Mref, w=wref), 2e-3)

# Zugstab mit Eigengewicht: ΔL = ∫ N(x)/(E·A) dx
A2 = math.pi * (60**2 - 52**2) / 4; qg = RHO_AL * 9.81 * A2 * 1e-9; Fz = 50000.0
dL = quad(lambda x: (Fz + qg * (L - x)) / (E_AL * A2), 0, L)[0]
cases.append(dict(id='Z2 hängend', type='calc', inp={**base, 'kind': 'zug', 'sub': 'Z2', 'F': 50})); ref['Z2 hängend'] = (dict(dL=dL), 1e-4)
# Torsion beidseitig eingespannt, Moment mittig: Verträglichkeit φ_links = φ_rechts → T_A = T_B = T/2
T = 300e3; K = math.pi * (60**4 - 52**4) / 32; TA = T * (L / 2) / L  # aus φ_A(L/2)=φ_B(L/2)
cases.append(dict(id='T2 Welle', type='calc', inp={**base, 'kind': 'torsion', 'sub': 'T2', 'T': 300})); ref['T2 Welle'] = (dict(theta=math.degrees(TA * (L / 2) / (G_AL * K)), tau=TA / (K / 30)), 1e-4)
# Knicken: Johnson tangiert Euler bei λ_T, Eulerfall 2 und 1
Rp = 260.0; i_ = math.sqrt(Ii / A2)
for case, beta in [('K2', 1), ('K1', 2)]:
    lam = beta * L / i_; lamT = math.pi * math.sqrt(2 * E_AL / Rp)
    sk = math.pi**2 * E_AL / lam**2 if lam >= lamT else Rp - Rp**2 * lam**2 / (4 * math.pi**2 * E_AL)
    id_ = f'Knick {case}'; cases.append(dict(id=id_, type='calc', inp={**base, 'kind': 'druck', 'sub': case, 'F': 20})); ref[id_] = (dict(sk=sk, lamT=lamT), 1e-4)
# Stetigkeit und Tangente am Übergang
lT = math.pi * math.sqrt(2 * E_AL / Rp); j = Rp - Rp**2 * lT**2 / (4 * math.pi**2 * E_AL); e = math.pi**2 * E_AL / lT**2
dj = -2 * Rp**2 * lT / (4 * math.pi**2 * E_AL); de = -2 * math.pi**2 * E_AL / lT**3

# Schritt 6 (Ashby 9.5): Profil aus Blatt 1 formtreu skaliert, Masse aus Steifigkeit und Festigkeit.
# Unabhängig: Biegelinie per Finite Differenzen (fd_beam), I und A per numerischer Integration, σ_zul wie Nachweis Blatt 1.
_, wEQ = fd_beam('EQ', F=0, q=2.0); wk = wEQ * EI            # w_k = f·E·I in N·mm³
MEQ = 2.0 * L**2 / 8; A0, I0 = A2, Ii; W0 = I0 / 30; fzul = L / 300
basis = dict(secType='rund_hohl', dims={'D': 60, 't': 4}, caseId='EQ', L=1200, F=2, q=2, a=300, fDiv=300, SFreq=1.5, SBreq=2)
for mid, Emod, rho, Rp_, Rm_, price in [('W038', 70000.0, 2700.0, 260.0, 310.0, 4.5), ('W001', 210000.0, 7850.0, 235.0, 360.0, 1.0)]:
    szul = min(Rp_ / 1.5, Rm_ / 2.0)                          # duktil: min(R_p/S_F, R_m/S_B), unterer Auslegungswert
    sSt = (wk / (Emod * fzul * I0)) ** 0.25; sF = (MEQ / (szul * W0)) ** (1 / 3)
    mSt = rho * A0 * sSt**2 * L * 1e-9; mF = rho * A0 * sF**2 * L * 1e-9; m = max(mSt, mF)
    id_ = f'Konflikt {mid}'; cases.append(dict(id=id_, type='conflict', materialId=mid, basis=basis, alpha=5))
    ref[id_] = (dict(mStiff=mSt, mStrength=mF, mass=m, sigmaZul=szul, Z=5 * m + m * price), 2e-3)
# Ashby-Indizes (Kap. 5 bis 7): EN AW-6082, E 70 GPa, ρ 2700 kg/m³, σ_f = R_p 260 MPa (repräsentativ), C_m 4,5 €/kg
E6, r6, s6, c6 = 70.0, 2700.0, 260.0, 4.5
for fn, con, obj, mode, val in [
    ('Balken', 'Steifigkeit', 'Masse', 'none', E6**0.5 / r6),
    ('Balken', 'Festigkeit', 'Masse', 'none', s6**(2 / 3) / r6),
    ('Platte', 'Steifigkeit', 'Kosten', 'none', E6**(1 / 3) / (c6 * r6)),
    ('Feder', 'Energie speichern', 'Masse', 'none', s6**2 / (E6 * r6)),
    ('Balken', 'Steifigkeit', 'Masse', 'max', (44 * E6)**0.5 / r6),       # φ_B^e = 44 (Al, Tab. 7.3): M = (φE)^½/ρ
    ('Balken', 'Festigkeit', 'Masse', 'max', (10 * s6)**(2 / 3) / r6),    # φ_B^f = 10: M = (φσ)^⅔/ρ
    ('Welle', 'Steifigkeit', 'Bauraum', 'max', (31 * E6)**0.5),          # k = 0: M = (φ_T^e·E)^½
]:
    id_ = f'Index {fn} {con} {obj} {mode}'; cases.append(dict(id=id_, type='ashby', materialId='W038', fn=fn, con=con, obj=obj, shapeMode=mode, phiUser=None))
    ref[id_] = (dict(idx=val), 1e-9)


# ---------------- Lastliste (eng-core 0.5.0) ----------------
# Unabhängig vom Kern (Föppl-Klammern, 4×4-System): Kraftgrößenverfahren am links eingespannten Grundsystem
# (Arbeitssatz, numerische Integration mit scipy.quad), Momente aus dem Gleichgewicht am RECHTEN Teilsystem,
# Biegelinie mit Finiten Differenzen (w'' = −M/EI, h = 0,1 mm). Literaturwerte Roark Tab. 8.1 zusätzlich.
from scipy.linalg import solve_banded
def ll_si(loads):
    out = []
    for l in loads:
        if l['kind'] == 'F': out.append(('F', l['x'], l['F'] * 1000.0))
        elif l['kind'] == 'M': out.append(('M', l['x'], l['M'] * 1000.0))
        else: out.append(('q', l['x1'], l['x2'], float(l['q1']), float(l['q2'])))
    return out
def q_at(l, s): return l[3] + (l[4] - l[3]) * (s - l[1]) / (l[2] - l[1])
def m_right(x, loads, B, CB, Lb):
    """Schnittmoment bei x aus dem Gleichgewicht des rechten Teils [x, L] (Lasten bei x zählen nach links)."""
    m = B * (Lb - x) - CB
    for l in loads:
        if l[0] == 'F' and l[1] > x: m -= l[2] * (l[1] - x)
        elif l[0] == 'M' and l[1] > x: m -= l[2]
        elif l[0] == 'q' and l[2] > x:
            a = max(x, l[1]); m -= quad(lambda t: q_at(l, t) * (t - x), a, l[2], epsabs=1e-12, epsrel=1e-13)[0]
    return m
def ll_sums(loads):
    F = sum(l[2] for l in loads if l[0] == 'F') + sum(quad(lambda t: q_at(l, t), l[1], l[2])[0] for l in loads if l[0] == 'q')
    M0 = sum(l[2] * l[1] for l in loads if l[0] == 'F') + sum(l[2] for l in loads if l[0] == 'M') + sum(quad(lambda t: q_at(l, t) * t, l[1], l[2])[0] for l in loads if l[0] == 'q')
    return F, M0
def ll_reference(support, loads_in, Lb=L, EIb=EI):
    loads = ll_si(loads_in); F, M0 = ll_sums(loads)
    pts = sorted({0.0, Lb, *[l[1] for l in loads], *[l[2] for l in loads if l[0] == 'q']})
    integ = lambda f: sum(quad(f, a, b, epsabs=1e-9, epsrel=1e-12, limit=200)[0] for a, b in zip(pts[:-1], pts[1:]) if b > a)
    if support == 'KR': B, CB = 0.0, 0.0
    elif support == 'GG': B, CB = M0 / Lb, 0.0                       # ΣM um A = 0
    elif support == 'EG':                                              # Unbekannte B, Verträglichkeit w(L) = 0
        m1 = lambda x: Lb - x; M0f = lambda x: m_right(x, loads, 0.0, 0.0, Lb)
        B = -integ(lambda x: M0f(x) * m1(x)) / integ(lambda x: m1(x)**2); CB = 0.0
    else:                                                              # EE: B, C_B aus w(L) = 0, φ(L) = 0
        m1 = lambda x: Lb - x; m2 = lambda x: -1.0; M0f = lambda x: m_right(x, loads, 0.0, 0.0, Lb)
        K = np.array([[integ(lambda x: m1(x) * m1(x)), integ(lambda x: m1(x) * m2(x))], [integ(lambda x: m2(x) * m1(x)), integ(lambda x: m2(x) * m2(x))]])
        r = -np.array([integ(lambda x: M0f(x) * m1(x)), integ(lambda x: M0f(x) * m2(x))]); B, CB = np.linalg.solve(K, r)
    A = F - B; CA = 0.0 if support == 'GG' else B * Lb - M0 - CB
    # Momentenlinie auf feinem Gitter (beide Seiten der Lastorte), Biegelinie mit Finiten Differenzen
    n = 12000; xs = np.linspace(0, Lb, n + 1); h = xs[1] - xs[0]
    Mg = np.array([m_right(x, loads, B, CB, Lb) for x in xs])
    jumps = [l[1] for l in loads if l[0] in ('F', 'M')]
    for l in loads:                                                    # Momentensprung: Mittelwert beider Seiten am Knoten (2. Ordnung)
        if l[0] == 'M' and 0 < l[1] < Lb: i = int(round(l[1] / h)); Mg[i] = (m_right(l[1] - 1e-9, loads, B, CB, Lb) + Mg[i]) / 2
    cand = [(x, m_right(x, loads, B, CB, Lb)) for x in xs] + [(x, m_right(x - 1e-9, loads, B, CB, Lb)) for x in jumps if x > 0]
    xM, Mm = max(cand, key=lambda t: abs(t[1]))
    if support == 'GG':                                                # w0 = wn = 0, tridiagonal
        ab = np.zeros((3, n - 1)); ab[0, 1:] = 1; ab[1, :] = -2; ab[2, :-1] = 1
        wi = solve_banded((1, 1), ab, -h * h * Mg[1:-1] / EIb); w = np.concatenate([[0], wi, [0]])
    else:                                                              # eingespannt links: w0 = 0, w'(0) = 0 (Geisterknoten), vorwärts
        w = np.zeros(n + 1); w[1] = -h * h * Mg[0] / (2 * EIb)
        for i in range(1, n): w[i + 1] = 2 * w[i] - w[i - 1] - h * h * Mg[i] / EIb
    k = int(np.argmax(np.abs(w)))
    # Einspannmomente als Schnittmomente (Vorzeichen der Momentenlinie): M_A = M(0⁻) = C_A, M_B = M(L⁺) = −C_B
    return dict(A=A, B=B, MA=CA, MB=-CB, M=abs(Mm), xM=xM, w=abs(w[k]), xf=xs[k], wL=w[-1], phiL=(3 * w[-1] - 4 * w[-2] + w[-3]) / (2 * h), sumF=F)
def ll_case(id_, support, loads, vals, tol, selfWeight=False):
    cases.append(dict(id=id_, type='calc', inp={**base, 'sub': 'LL', 'loadList': dict(support=support, loads=loads, selfWeight=selfWeight)})); ref[id_] = (vals, tol)
LLC = {
  'T7': ('GG', [dict(kind='F', x=400, F=3)]),
  'T8': ('KR', [dict(kind='M', x=1200, M=200)]),
  'T9': ('EG', [dict(kind='q', x1=0, x2=1200, q1=2, q2=2)]),
  'T10': ('EE', [dict(kind='F', x=400, F=3)]),
  'T11': ('GG', [dict(kind='q', x1=0, x2=1200, q1=0, q2=2)]),
  'T12': ('GG', [dict(kind='F', x=300, F=2), dict(kind='F', x=900, F=1.5), dict(kind='q', x1=600, x2=1200, q1=1, q2=1), dict(kind='M', x=1000, M=150)]),
  'T13': ('KR', [dict(kind='F', x=600, F=2), dict(kind='F', x=1200, F=-1)]),
  'T14': ('GG', [dict(kind='M', x=300, M=200)]),
  'T16': ('EE', [dict(kind='q', x1=200, x2=900, q1=3, q2=0.5), dict(kind='M', x=700, M=-120)]),
  'T17': ('EG', [dict(kind='F', x=0, F=5), dict(kind='F', x=1200, F=4), dict(kind='q', x1=100, x2=500, q1=-1, q2=1)]),
}
LL_REF = {}
for k, (sup, lo) in LLC.items():
    r = ll_reference(sup, lo); LL_REF[k] = r
    vals = dict(A=r['A'], M=r['M'], w=r['w'])
    if sup != 'KR': vals['B'] = r['B']
    if sup != 'GG': vals['MA'] = r['MA']
    if sup == 'EE': vals['MB'] = r['MB']
    ll_case(f'LL {k} FD', sup, lo, vals, 2e-3)
    ll_case(f'LL {k} Gleichgewicht', sup, lo, dict(res=0.0), 1e-9)
    if sup in ('EG', 'EE') and abs(r['wL']) > 1e-4 * r['w']: print(f'WARNUNG Verträglichkeit {k}: w(L) = {r["wL"]:.3g}')
# Literatur Roark Tab. 8.1 (geschlossene Formeln, unabhängig vom Kern)
Fp, a7, b7 = 3000.0, 400.0, 800.0
ll_case('LL T7 Roark 1e', *LLC['T7'], dict(A=Fp * b7 / L, M=Fp * a7 * b7 / L, w=Fp * a7 * (L**2 - a7**2)**1.5 / (9 * math.sqrt(3) * EI * L), xf=L - math.sqrt((L**2 - a7**2) / 3)), 1e-6)
ll_case('LL T8 Roark 3a', *LLC['T8'], dict(M=200e3, w=200e3 * L**2 / (2 * EI)), 1e-9)
ll_case('LL T9 Roark 2c', *LLC['T9'], dict(A=5 * 2.0 * L / 8, MA=-2.0 * L**2 / 8, w=0.0054165 * 2.0 * L**4 / EI), 1e-4)
ll_case('LL T10 Roark 1d', *LLC['T10'], dict(A=Fp * b7**2 * (3 * a7 + b7) / L**3, MA=-Fp * a7 * b7**2 / L**2, MB=-Fp * a7**2 * b7 / L**2), 1e-9)   # Roark: beide Einspannmomente negativ
ll_case('LL T11 Roark 2e', *LLC['T11'], dict(A=2.0 * L / 6, M=2.0 * L**2 / (9 * math.sqrt(3)), xM=L / math.sqrt(3), w=0.0065222 * 2.0 * L**4 / EI), 1e-4)
# heutige Fälle als Lastliste: gleiche Referenz wie oben (Finite Differenzen fd_beam)
for c, sup, lo, F_, q_ in [('KE', 'KR', [dict(kind='F', x=1200, F=2)], 2, 0), ('KQ', 'KR', [dict(kind='q', x1=0, x2=1200, q1=2, q2=2)], 0, 2),
                           ('EE', 'GG', [dict(kind='F', x=600, F=2)], 2, 0), ('EQ', 'GG', [dict(kind='q', x1=0, x2=1200, q1=2, q2=2)], 0, 2),
                           ('E4', 'GG', [dict(kind='F', x=300, F=2), dict(kind='F', x=900, F=2)], 2, 0), ('BQ', 'EE', [dict(kind='q', x1=0, x2=1200, q1=2, q2=2)], 0, 2)]:
    Mref, wref = fd_beam(c, F=F_ * 1000, q=q_); ll_case(f'LL wie {c}', sup, lo, dict(M=Mref, w=wref), 2e-3)
# Eigengewicht: EQ mit q + q_G (q_G = ρ·g·A, A per Integration oben)
qG = RHO_AL * 9.81 * A2 * 1e-9; Mref, wref = fd_beam('EQ', F=0, q=2.0 + qG)
ll_case('LL T15 Eigengewicht', 'GG', [dict(kind='q', x1=0, x2=1200, q1=2, q2=2)], dict(M=Mref, w=wref), 2e-3, selfWeight=True)
# Schritt 6 mit Lastliste T12: Masse aus Steifigkeit und Festigkeit mit M_max und w_k aus der Referenz
r12 = LL_REF['T12']; wk12 = r12['w'] * EI; M12 = r12['M']
for mid, Emod, rho, Rp_, Rm_, price in [('W038', 70000.0, 2700.0, 260.0, 310.0, 4.5)]:
    szul = min(Rp_ / 1.5, Rm_ / 2.0); sSt = (wk12 / (Emod * fzul * I0)) ** 0.25; sF = (M12 / (szul * W0)) ** (1 / 3)
    mSt = rho * A0 * sSt**2 * L * 1e-9; mF = rho * A0 * sF**2 * L * 1e-9
    b12 = {**basis, 'caseId': 'LL', 'loadList': dict(support='GG', loads=LLC['T12'][1], selfWeight=False)}
    id_ = f'Konflikt LL T12 {mid}'; cases.append(dict(id=id_, type='conflict', materialId=mid, basis=b12, alpha=5)); ref[id_] = (dict(mStiff=mSt, mStrength=mF), 2e-3)

# ---------------- Druckbehälter (eng-core 0.6.0) ----------------
# Unabhängig vom Kern (Lamé in geschlossener Form): Verschiebungsmethode mit Finiten Differenzen.
# Zylinder im verallgemeinerten ebenen Verzerrungszustand (ε_z = c konstant, Unbekannte), Gleichgewicht
# d(r·σ_r)/dr = σ_θ in Verschiebungen u'' + u'/r − u/r² = 0, Randbedingungen σ_r(a) = −p_i, σ_r(b) = −p_a,
# Axialkraftbilanz ∫σ_z·2πr dr = p_i·πa² − p_a·πb² (geschlossen) bzw. 0 (offen) bestimmt c.
# Kugel: u'' + 2u'/r − 2u/r² = 0. 4000 Intervalle, Ableitungen 2. Ordnung, dünn besetztes Gleichungssystem.
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve
from scipy.optimize import brentq
NU_AL = 0.3   # ν EN AW-6082 aus der Werkstoffdatenbank (Bemessungswert), wie im Kern
def pv_fd(shape, closed, a, b, pi, pa, E=E_AL, nu=NU_AL, n=4000):
    lam = E * nu / ((1 + nu) * (1 - 2 * nu)); mu = E / (2 * (1 + nu)); h = (b - a) / n
    r = np.linspace(a, b, n + 1); k = 1 if shape == 'ZY' else 2; m = n + 1 + (1 if shape == 'ZY' else 0)
    Am = lil_matrix((m, m)); rhs = np.zeros(m)
    for i in range(1, n):   # u'' + k·u'/r − k·u/r² = 0
        Am[i, i - 1] = 1 / h**2 - k / (2 * h * r[i]); Am[i, i] = -2 / h**2 - k / r[i]**2; Am[i, i + 1] = 1 / h**2 + k / (2 * h * r[i])
    def sr_row(row, i, d, p):   # σ_r = (λ+2μ)u' + kλ·u/r (+ λ·c beim Zylinder) = −p, u' einseitig 2. Ordnung
        c3 = [-3, 4, -1] if d > 0 else [3, -4, 1]
        for j, cc in enumerate(c3): Am[row, i + d * j] += (lam + 2 * mu) * cc / (2 * h)
        Am[row, i] += k * lam / r[i]
        if shape == 'ZY': Am[row, n + 1] = lam
        rhs[row] = -p
    sr_row(0, 0, 1, pi); sr_row(n, n, -1, pa)
    if shape == 'ZY':   # Axialkraft: ∫(λ(u' + u/r) + (λ+2μ)c)·2πr dr, Trapezregel, u' zentral bzw. einseitig
        w = np.full(n + 1, h); w[0] = w[-1] = h / 2
        for i in range(n + 1):
            f = w[i] * 2 * math.pi * r[i] * lam
            if i == 0: st = [(0, -3), (1, 4), (2, -1)]
            elif i == n: st = [(n, 3), (n - 1, -4), (n - 2, 1)]
            else: st = [(i - 1, -1), (i + 1, 1)]
            for j, cc in st: Am[n + 1, j] += f * cc / (2 * h) if i in (0, n) else f * cc / (2 * h)
            Am[n + 1, i] += f / r[i]; Am[n + 1, n + 1] += w[i] * 2 * math.pi * r[i] * (lam + 2 * mu)
        rhs[n + 1] = (pi * math.pi * a * a - pa * math.pi * b * b) if closed else 0.0
    x = spsolve(Am.tocsr(), rhs); u = x[:n + 1]; c = x[n + 1] if shape == 'ZY' else 0.0
    du = np.gradient(u, h, edge_order=2)
    if shape == 'ZY':
        sr = (lam + 2 * mu) * du + lam * u / r + lam * c; st = lam * du + (lam + 2 * mu) * u / r + lam * c; sz = lam * (du + u / r) + (lam + 2 * mu) * c
    else:
        sr = (lam + 2 * mu) * du + 2 * lam * u / r; st = lam * du + 2 * (lam + mu) * u / r; sz = st
    sv = np.sqrt(0.5 * ((st - sr)**2 + (sr - sz)**2 + (sz - st)**2))
    eq = np.gradient(r * sr, h, edge_order=2) - st if shape == 'ZY' else np.gradient(r**2 * sr, h, edge_order=2) - 2 * r * st   # Gleichgewicht, Rest
    im = n // 2
    return dict(srA=sr[0], stA=st[0], sz=sz[0], svA=sv[0], uA=u[0], srB=sr[-1], stB=st[-1], svB=sv[-1], uB=u[-1], srM=sr[im], stM=st[im], eqRes=np.abs(eq[1:-1]).max())
def lame_py(shape, closed, a, b, pi, pa, r, E=E_AL, nu=NU_AL):
    """Eigene Umsetzung der Lamé-Formeln aus Konzept V2-A Abschnitt 4 (Literaturwerte)."""
    if shape == 'ZY':
        D = b * b - a * a; sr = (pi * a * a - pa * b * b) / D - (pi - pa) * a * a * b * b / (D * r * r); st = (pi * a * a - pa * b * b) / D + (pi - pa) * a * a * b * b / (D * r * r)
        sz = (pi * a * a - pa * b * b) / D if closed else 0.0; sv = math.sqrt(0.5 * ((st - sr)**2 + (sr - sz)**2 + (sz - st)**2)); u = r / E * (st - nu * (sr + sz))
    else:
        D = b**3 - a**3; sr = (pi * a**3 - pa * b**3) / D - (pi - pa) * a**3 * b**3 / (D * r**3); st = (pi * a**3 - pa * b**3) / D + (pi - pa) * a**3 * b**3 / (2 * D * r**3)
        sz = st; sv = abs(st - sr); u = r / E * ((1 - nu) * st - nu * sr)
    return dict(sr=sr, st=st, sz=sz, sv=sv, u=u)
PB_SUB = {('ZY', True): 'ZG', ('ZY', False): 'ZO', ('KU', False): 'KU'}
def pb_inp(sub, d, t, pi, pa, dim='inner', SF=1.5, SB=2.0):
    return {**base, 'kind': 'PB', 'sub': sub, 'SFreq': SF, 'SBreq': SB, 'pressure': dict(dim=dim, d=d, t=t, pi=pi, pa=pa)}
def pb_case(id_, shape, closed, a, b, pi, pa, vals, tol):
    cases.append(dict(id=id_, type='pressure', inp=pb_inp(PB_SUB[(shape, closed)], 2 * a, b - a, pi, pa))); ref[id_] = (vals, tol)
def pb_fd(id_, shape, closed, a, b, pi, pa):
    r = pv_fd(shape, closed, a, b, pi, pa); res_eq = r.pop('eqRes')
    if res_eq > 1e-3 * max(pi, pa) * b: print(f'WARNUNG Gleichgewicht FD {id_}: {res_eq:.3g}')
    if shape == 'KU': r.pop('sz')
    if not closed and shape == 'ZY': r['sz'] = 0.0
    for k in [k for k, v in r.items() if abs(v) < 1e-9 * max(pi, pa)]: r[k] = 0.0   # exakt null (Randbedingung), Vergleich absolut
    pb_case(id_ + ' FD', shape, closed, a, b, pi, pa, r, 1e-4)
a1, b1, p1 = 50.0, 55.0, 10.0
L1a, L1b = lame_py('ZY', True, a1, b1, p1, 0, a1), lame_py('ZY', True, a1, b1, p1, 0, b1)
pb_case('D1 Zylinder geschlossen Lamé', 'ZY', True, a1, b1, p1, 0, dict(stA=L1a['st'], srA=-10.0, sz=L1a['sz'], stB=L1b['st'], svA=math.sqrt(3) * p1 * b1**2 / (b1**2 - a1**2), uA=L1a['u'], uB=L1b['u']), 1e-9)
pb_fd('D1 Zylinder geschlossen', 'ZY', True, a1, b1, p1, 0)
pb_case('D1 Axialkraftbilanz', 'ZY', True, a1, b1, p1, 0, dict(Fax=p1 * math.pi * a1**2), 1e-9)
Dm1, t1 = a1 + b1, b1 - a1
pb_case('D2 Kesselformel', 'ZY', True, a1, b1, p1, 0, dict(kSt=p1 * Dm1 / (2 * t1), kSz=p1 * Dm1 / (4 * t1), kDev=(p1 * Dm1 / (2 * t1) - L1a['st']) / L1a['st']), 1e-9)
L3 = lame_py('ZY', False, a1, b1, p1, 0, a1)
pb_case('D3 Zylinder offen Lamé', 'ZY', False, a1, b1, p1, 0, dict(sz=0.0, stA=L3['st'], srA=-10.0, svA=L3['sv']), 1e-9)
pb_fd('D3 Zylinder offen', 'ZY', False, a1, b1, p1, 0)
L4 = lame_py('KU', False, a1, b1, p1, 0, a1)
pb_case('D4 Kugel Lamé', 'KU', False, a1, b1, p1, 0, dict(stA=L4['st'], svA=1.5 * p1 * b1**3 / (b1**3 - a1**3), uA=L4['u']), 1e-9)
pb_fd('D4 Kugel', 'KU', False, a1, b1, p1, 0)
pb_case('D5 Außendruck Lamé', 'ZY', True, a1, b1, 0, 5.0, dict(stA=-2 * 5.0 * b1**2 / (b1**2 - a1**2), srA=0.0, srB=-5.0), 1e-9)
pb_fd('D5 Außendruck', 'ZY', True, a1, b1, 0, 5.0)
pb_fd('D5 Außendruck Kugel', 'KU', False, a1, b1, 0, 5.0)
# offen: σ_r = σ_θ = −p, σ_z = 0, also σ_v = √(½·(0 + p² + p²)) = p (nicht 0, Korrektur zu Konzept V2-A D6); geschlossen und Kugel: hydrostatisch, σ_v = 0
pb_case('D6 Gleichdruck offen', 'ZY', False, a1, b1, 8.0, 8.0, dict(srA=-8.0, stA=-8.0, srM=-8.0, stM=-8.0, srB=-8.0, stB=-8.0, svA=8.0, svB=8.0), 1e-9)
pb_case('D6 Gleichdruck geschlossen', 'ZY', True, a1, b1, 8.0, 8.0, dict(sz=-8.0, svA=0.0, svB=0.0), 1e-9)
pb_case('D6 Gleichdruck Kugel', 'KU', False, a1, b1, 8.0, 8.0, dict(srA=-8.0, stA=-8.0, svA=0.0), 1e-9)
pb_fd('D6b gemischt geschlossen', 'ZY', True, a1, b1 + 15, 20.0, 4.0)
pb_fd('D6b gemischt Kugel', 'KU', False, a1, b1 + 15, 20.0, 4.0)
# D9: Grenzfall dünne Wand D_m/t = 200, σ_θ → p·D_m/(2t)
a9, b9 = 99.5, 100.5
pb_case('D9 dünne Wand', 'ZY', True, a9, b9, p1, 0, dict(stA=p1 * (a9 + b9) / 2 / (b9 - a9)), 5e-3)
# Bemessen (D7, D8 und Varianten): σ_zul = min(260/1,3; 310/1,5) = 200 MPa; Referenz geschlossen bzw. eigene Nullstellensuche (brentq)
SZ = min(260.0 / 1.3, 310.0 / 1.5)
def util_py(shape, closed, dim, r0, t, pi, pa):
    a, b = (r0, r0 + t) if dim == 'inner' else (r0 - t, r0)
    return max(lame_py(shape, closed, a, b, pi, pa, a)['sv'], lame_py(shape, closed, a, b, pi, pa, b)['sv']) / SZ
DES = []
def pb_design(id_, sub, shape, closed, dim, r0, pi, pa, tref, tol, closedForm):
    cases.append(dict(id=id_, type='pressure', design=True, inp=pb_inp(sub, 2 * r0, 1.0, pi, pa, dim=dim, SF=1.3, SB=1.5)))
    vals = dict(designOk=1.0, closedForm=float(closedForm))
    if tref is not None: vals.update(tErf=tref, tGew=math.ceil(tref / 0.5 - 1e-9) * 0.5)
    ref[id_] = (vals, tol); DES.append((id_, shape, closed, dim, r0, pi, pa, 1e-9 if closedForm else 1e-6))
k7 = math.sqrt(1 - math.sqrt(3) * p1 / SZ)
pb_design('D7 Bemessen Zylinder b fest', 'ZG', 'ZY', True, 'outer', 55.0, p1, 0, 55.0 * (1 - k7), 1e-9, True)
pb_design('D7b Bemessen Zylinder a fest', 'ZG', 'ZY', True, 'inner', 50.0, p1, 0, 50.0 * (1 / k7 - 1), 1e-9, True)
kk = (1 - 3 * p1 / (2 * SZ)) ** (1 / 3)
pb_design('D7c Bemessen Kugel b fest', 'KU', 'KU', False, 'outer', 55.0, p1, 0, 55.0 * (1 - kk), 1e-9, True)
pb_design('D7d Bemessen Kugel a fest', 'KU', 'KU', False, 'inner', 50.0, p1, 0, 50.0 * (1 / kk - 1), 1e-9, True)
pb_design('D7e Bemessen Zylinder offen (Bisektion)', 'ZO', 'ZY', False, 'outer', 55.0, p1, 0, brentq(lambda t: util_py('ZY', False, 'outer', 55.0, t, p1, 0) - 1, 1e-3, 54.9, xtol=1e-14), 1e-6, False)
pb_design('D7f Bemessen mit Außendruck (Bisektion)', 'ZG', 'ZY', True, 'inner', 50.0, 30.0, 5.0, brentq(lambda t: util_py('ZY', True, 'inner', 50.0, t, 30.0, 5.0) - 1, 1e-3, 500, xtol=1e-14), 1e-6, False)
cases.append(dict(id='D8 Bemessen ohne Lösung', type='pressure', design=True, inp=pb_inp('ZG', 110.0, 1.0, 120.0, 0, dim='outer', SF=1.3, SB=1.5))); ref['D8 Bemessen ohne Lösung'] = (dict(designOk=0.0), 0)
cases.append(dict(id='D8b Bemessen ohne Lösung Kugel', type='pressure', design=True, inp=pb_inp('KU', 100.0, 1.0, 140.0, 0, dim='inner', SF=1.3, SB=1.5))); ref['D8b Bemessen ohne Lösung Kugel'] = (dict(designOk=0.0), 0)

import tempfile; CASES = os.path.join(tempfile.gettempdir(), 'mech_core_cases.json'); json.dump(cases, open(CASES, 'w'))
out = json.loads(subprocess.check_output(['npx', 'tsx', os.path.join(HERE, 'engine_out.ts'), CASES], cwd=os.path.dirname(HERE)))
# Rückeinsetzen der Bemessung des Kerns in die eigene Lamé-Umsetzung: Ausnutzung 1 (geschlossen 10⁻⁹, Bisektion 10⁻⁶)
for id_, shape, closed, dim, r0, pi, pa, tl in DES:
    rid = id_ + ' Rückeinsetzen'; out[rid] = dict(u=util_py(shape, closed, dim, r0, out[id_]['tErf'], pi, pa)); ref[rid] = (dict(u=1.0), tl)
rows, fails = [], 0
for id_, (vals, tol) in ref.items():
    for k, v in vals.items():
        got = out[id_][k]; dev = abs(got - v) / abs(v) if v else abs(got)
        ok = dev <= tol; fails += not ok
        rows.append(f"| {id_} | {k} | {v:.6g} | {got:.6g} | {dev*100:.4f} % | {tol*100:g} % | {'OK' if ok else 'ABWEICHUNG'} |")
print('| Fall | Größe | Referenz (Python) | Rechenkern (JS) | Abweichung | Toleranz | Status |\n|---|---|---|---|---|---|---|')
print('\n'.join(rows))
print(f"\nJohnson/Euler am Übergang λ_T = {lT:.2f}: σ_J = {j:.3f}, σ_E = {e:.3f} MPa, Steigung J = {dj:.4f}, E = {de:.4f}")
print(f"\nErgebnis: {len(rows) - fails} von {len(rows)} Prüfwerten innerhalb der Toleranz")
if '--write-golden' in sys.argv:
    golden = [dict(id=c['id'], case=c, expect={k: v for k, v in ref[c['id']][0].items()}, tol=ref[c['id']][1]) for c in cases]
    json.dump(golden, open(os.path.join(os.path.dirname(HERE), 'test', 'golden.json'), 'w'), indent=1, ensure_ascii=False)
    print('golden.json geschrieben')
# Ergebnis für den Prüfstatus (src/pruefstatus.json, PDF-Fußzeile): --write-ergebnis schreibt, --check-ergebnis vergleicht
ERG = os.path.join(HERE, 'ergebnis.json'); erg = dict(passed=len(rows) - fails, total=len(rows))
if '--write-ergebnis' in sys.argv:
    open(ERG, 'w').write(json.dumps(erg, indent=1) + '\n'); print('verification/ergebnis.json geschrieben')
if '--check-ergebnis' in sys.argv:
    old = json.load(open(ERG)) if os.path.exists(ERG) else None
    if old != erg:
        print(f'verification/ergebnis.json veraltet: {old} ≠ {erg}. python3 verification/pruefung.py --write-ergebnis ausführen'); sys.exit(1)
sys.exit(1 if fails else 0)
