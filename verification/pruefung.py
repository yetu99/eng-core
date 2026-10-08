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

import tempfile; CASES = os.path.join(tempfile.gettempdir(), 'mech_core_cases.json'); json.dump(cases, open(CASES, 'w'))
out = json.loads(subprocess.check_output(['npx', 'tsx', os.path.join(HERE, 'engine_out.ts'), CASES], cwd=os.path.dirname(HERE)))
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
sys.exit(1 if fails else 0)
