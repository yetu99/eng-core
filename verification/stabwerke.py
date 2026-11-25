"""Unabhängige Gegenrechnung Fachwerk (Modul stabwerke, eng-core 0.23.0), Konzept fachtools/konzept_fw.md Abschn. 5 und 8.

Eigene Python-Umsetzung ohne den Code des Kerns, Eingaben gleich (verification/fw_faelle.json aus scripts/fw-faelle.ts):
  Weggrößenverfahren (Steifigkeitsmatrix K = Σ E·A/l·e·eᵀ, Lager als Nebenbedingungen mit Lagrange-Multiplikatoren
  [[K, −Cᵀ], [C, 0]]·[u; R] = [F; 0], numpy.linalg.solve), Stabkräfte S = E·A/l·e·(u_j − u_i), Lagerkräfte R, Verschiebungen u
  für statisch bestimmte und unbestimmte Fachwerke; Rang der selbst aufgestellten Gleichgewichtsmatrix mit numpy.linalg.matrix_rank;
  Einflusslinie als Folge von Einzellastrechnungen; Grundsystem und Einheitslasten des Kraftgrößenverfahrens ebenfalls mit dem
  Weggrößenverfahren; Knicken Euler/Johnson als eigene Formeln.
Zufallsfachwerke mit fester Saat (numpy default_rng 20261125): statisch bestimmt nach dem ersten Bildungsgesetz und 1- bis 3-fach
unbestimmt (zusätzliche Stäbe oder Lager). Dualität: jede Stab- und Lagerkraft über PdvV im Kern gegen die Steifigkeitsrechnung.
Literatur: Gross TM 1 Bsp. 6.1, 6.3, 6.4, 8.6, Abb. 6.2b, c; Gross TM 2 Bsp. 1.6, 1.7a, 6.3, 6.4, 6.9; Dubbel Abb. 12.25.
Bezug: Kräfte / Fref [N], Verschiebungen / uref [mm] (Größen der Quelle), Vergleich absolut (abs=True). Jeder Fall trägt module='stabwerke'.
"""
import copy, json, math, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
M = 'stabwerke'
SEED = 20261125
R2, R5 = math.sqrt(2), math.sqrt(5)


def reactions_of(inp):
    out = []
    for sp in inp['supports']:
        if sp['type'] == 'fest':
            out += [(sp['node'], (1.0, 0.0)), (sp['node'], (0.0, 1.0))]
        else:
            t = math.radians(sp['angleDeg']); out.append((sp['node'], (math.cos(t), math.sin(t))))
    return out


def geom(inp):
    P = np.array([[n['x'], n['y']] for n in inp['nodes']], float)
    L, E = [], []
    for b in inp['bars']:
        d = P[b['j']] - P[b['i']]; l = float(np.hypot(*d)); L.append(l); E.append(d / l)
    return P, np.array(L), np.array(E)


def equilibrium(inp):
    """Eigene Gleichgewichtsmatrix, Knoten für Knoten: Σ Stabkräfte (Zug zieht zum Nachbarn) + Lagerkräfte + Lasten = 0."""
    P, L, E = geom(inp); k = len(P); rs = reactions_of(inp); s = len(inp['bars'])
    A = np.zeros((2 * k, s + len(rs)))
    for c, b in enumerate(inp['bars']):
        for node, other in ((b['i'], b['j']), (b['j'], b['i'])):
            d = P[other] - P[node]; d = d / np.hypot(*d); A[2 * node:2 * node + 2, c] += d
    for j, (node, n) in enumerate(rs): A[2 * node:2 * node + 2, s + j] += n
    return A


def classify(inp):
    A = equilibrium(inp); k = len(inp['nodes']); u = A.shape[1]
    rk = int(np.linalg.matrix_rank(A, tol=1e-10 * max(1.0, np.abs(A).max())))
    n, f, abz = u - rk, 2 * k - rk, 2 * k - u
    kind = (3 if abz == 0 else 2) if f > 0 else (1 if n > 0 else 0)
    return dict(rank=rk, n=n, f=f, abz=abz, kind=kind)


def loads_vec(inp, loads=None):
    k = len(inp['nodes']); F = np.zeros(2 * k)
    for ld in (inp['loads'] if loads is None else loads):
        F[2 * ld['node']] += ld['Fx'] * 1000; F[2 * ld['node'] + 1] += ld['Fy'] * 1000
    return F


def stiffness_solve(inp, F=None, bars=None, rs=None):
    """Weggrößenverfahren mit Lager-Nebenbedingungen. bars: Liste der beteiligten Stäbe (Grundsystem), rs: Lagerliste."""
    P, L, E = geom(inp); k = len(P)
    bars = list(range(len(inp['bars']))) if bars is None else bars
    rs = reactions_of(inp) if rs is None else rs
    F = loads_vec(inp) if F is None else F
    K = np.zeros((2 * k, 2 * k))
    for c in bars:
        b = inp['bars'][c]; e = E[c]; kk = b['E'] * b['A'] / L[c] * np.outer(e, e)
        for a_, sa in ((b['i'], 1), (b['j'], -1)):
            for b_, sb in ((b['i'], 1), (b['j'], -1)):
                K[2 * a_:2 * a_ + 2, 2 * b_:2 * b_ + 2] += sa * sb * kk
    C = np.zeros((len(rs), 2 * k))
    for j, (node, n) in enumerate(rs): C[j, 2 * node:2 * node + 2] = n
    KKT = np.block([[K, -C.T], [C, np.zeros((len(rs), len(rs)))]])
    x = np.linalg.solve(KKT, np.concatenate([F, np.zeros(len(rs))]))
    u, R = x[:2 * k], x[2 * k:]
    S = np.zeros(len(inp['bars']))
    for c in bars:
        b = inp['bars'][c]; S[c] = b['E'] * b['A'] / L[c] * E[c] @ (u[2 * b['j']:2 * b['j'] + 2] - u[2 * b['i']:2 * b['i'] + 2])
    return S, R, u


def buckling(b, S, l):
    E, Rp, A, i = b['E'], b.get('Rp'), b['A'], b['iGyr']
    lam = l / i; lamT = math.pi * math.sqrt(2 * E / Rp) if Rp else None
    sk = Rp - Rp ** 2 * lam ** 2 / (4 * math.pi ** 2 * E) if lamT and lam < lamT else math.pi ** 2 * E / lam ** 2
    return sk * A, sk * A / abs(S)


def reference(inp, Fref, uref):
    """Sollwerte aus dem Weggrößenverfahren in der Ausgabeform des Kerns (eval.ts evalFw)."""
    cl = classify(inp)
    o = dict(errors=0.0, **{k: float(v) for k, v in cl.items()}); nw = {}
    S, R, u = stiffness_solve(inp)
    P, L, E = geom(inp); Fv = loads_vec(inp)
    Fmax = max((math.hypot(Fv[2 * i], Fv[2 * i + 1]) for i in range(len(P))), default=0.0); thr = 1e-9 * Fmax
    zero = np.abs(S) <= thr; S = np.where(zero, 0.0, S)
    for c, b in enumerate(inp['bars']):
        o[f'S{c}'] = S[c] / Fref
        if not zero[c]: nw[f'sig{c}'] = S[c] / b['A']
        if not zero[c] and b.get('Rp'): nw[f'SF{c}'] = b['Rp'] / abs(S[c] / b['A'])
        if not zero[c] and S[c] < 0 and b.get('iGyr'):
            Fk, SK = buckling(b, S[c], L[c]); nw[f'Fk{c}'] = Fk / Fref; nw[f'SK{c}'] = SK
    o['nZero'] = float(zero.sum())
    for j, r in enumerate(R): o[f'R{j}'] = r / Fref
    for i in range(len(P)): o[f'ux{i}'] = u[2 * i] / uref; o[f'uy{i}'] = u[2 * i + 1] / uref
    o['prb'] = 0.0; o['res'] = 0.0
    d = inp.get('deflection')
    if d: o['dux'] = u[2 * d['node']] / uref; o['duy'] = u[2 * d['node'] + 1] / uref
    s = len(inp['bars'])
    def bond_value(bd, S_, R_): return S_[bd['index']] if bd['kind'] == 'bar' else R_[bd['index']]
    if inp.get('pdvv') and cl['kind'] == 0:
        o['pv'] = bond_value(inp['pdvv'], S, R) / Fref; o['pvres'] = 0.0
    inf = inp.get('influence')
    if inf and cl['kind'] == 0:
        dx, dy = inf.get('dir') or [0, -1]; dn = math.hypot(dx, dy)
        for kk, node in enumerate(sorted(inf['nodes'], key=lambda nd: (inp['nodes'][nd]['x'], nd))):
            F1 = np.zeros(2 * len(P)); F1[2 * node] = dx / dn; F1[2 * node + 1] = dy / dn
            S1, R1, _ = stiffness_solve(inp, F1); o[f'eta{kk}'] = bond_value(inf['bond'], S1, R1)
    return o, S, R, u, nw


def force_method_ref(inp, red, Fref, uref):
    """Grundsystem ohne die Überzähligen mit dem Weggrößenverfahren: S₀, S̄_i, δ_i0, δ_ij."""
    rs_all = reactions_of(inp); s = len(inp['bars']); P, L, E = geom(inp)
    rb = [b['index'] for b in red if b['kind'] == 'bar']; rr = [b['index'] for b in red if b['kind'] == 'support']
    bars = [c for c in range(s) if c not in rb]; rs = [r for j, r in enumerate(rs_all) if j not in rr]
    S0, _, _ = stiffness_solve(inp, None, bars, rs)
    Sb = []
    for b in red:
        F1 = np.zeros(2 * len(P))
        if b['kind'] == 'bar':
            bb = inp['bars'][b['index']]; e = E[b['index']]
            F1[2 * bb['i']:2 * bb['i'] + 2] += e; F1[2 * bb['j']:2 * bb['j'] + 2] -= e   # Zugkraft 1 zieht die Knoten zusammen
            S1, _, _ = stiffness_solve(inp, F1, bars, rs); S1[b['index']] = 1.0
        else:
            node, n = rs_all[b['index']]; F1[2 * node:2 * node + 2] += n
            S1, _, _ = stiffness_solve(inp, F1, bars, rs)
        Sb.append(S1)
    fl = np.array([L[c] / (inp['bars'][c]['E'] * inp['bars'][c]['A']) for c in range(s)])
    o = {}
    for i, sb in enumerate(Sb):
        o[f'd10_{i}'] = float(np.sum(S0 * sb * fl)) / uref
        for j, sj in enumerate(Sb): o[f'd11_{i}{j}'] = float(np.sum(sb * sj * fl)) * Fref / uref
        for c in range(s): o[f'Sb{i}_{c}'] = sb[c]
    for c in range(s): o[f'S0_{c}'] = S0[c] / Fref
    return o


def proposed_redundants(inp):
    """Eigene Vorschlagsregel wie Konzept (spätere abhängige Spalten): Spalte für Spalte über den Rang."""
    A = equilibrium(inp); keep, out = [], []
    tol = 1e-10 * max(1.0, np.abs(A).max())
    for c in range(A.shape[1]):
        if np.linalg.matrix_rank(A[:, keep + [c]], tol=tol) > len(keep): keep.append(c)
        else: out.append(c)
    s = len(inp['bars'])
    return [dict(kind='bar', index=c) if c < s else dict(kind='support', index=c - s) for c in out]


# ---------------------------------------------------------------- Literatur (Sollwerte der Quelle, bezogen auf F bzw. F·a/(E·A))
def g86(beta, a=1000.0, b=2000.0):
    t = math.radians(beta); return 0.5 * math.tan(t) * (1 - a * math.cos(t) / math.sqrt(b * b - a * a * math.sin(t) ** 2))
X69 = (3 + 2 * R2) / (2 * (2 + R2))
LIT = {
    'P-FW1': [(dict(S0=0.5, S1=-R2 / 2, S2=-R2 / 2, pv=-R2 / 2), 1e-12, 'Konzept Abschn. 1: 5,000; −7,071; −7,071 N')],
    'P-FW2': [(dict(S0=-1 / 3, S1=-2 / 3, S2=R5 / 3, S3=0, S4=0, S5=-2 / 3, S6=-R5 / 3, S7=4 / 3, S8=0, S9=0, S10=-2 * R5 / 3, S11=4 / 3, S12=0, R0=1 / 3, R1=0, R2=2 / 3, nZero=5, pv=1 / 3), 1e-12, 'Gross TM 1 Bsp. 6.1 Stabkrafttabelle, A = F/3, B_V = 2F/3, B_H = 0')],
    'P-FW3': [(dict(S0=-2.4, S1=1.7, S2=2.4, S3=-1.3, S4=-0.9, S5=4.0, S6=0.9, S7=-2.7, S8=1.9, S9=1.3, S10=-1.9, S11=0, S12=0), 0.05, 'Gross TM 1 Bsp. 6.3 Cremona-Plan (eine Nachkommastelle)'),
              (dict(R0=-5 / 3, R1=2 * R2, R2=-4 / 3), 1e-12, 'Gross TM 1 Bsp. 6.3: A = −5F/3, B = 2√2 F, C = −4F/3')],
    'P-FW4': [(dict(S3=0.75, R0=1.0, R1=7 / 6, R2=5 / 6, pv=0.75), 1e-12, 'Gross TM 1 Bsp. 6.4: S₄ = 3F/4, A_H = F, A_V = 7F/6, B = 5F/6')],
    'P-FW5a': [(dict(S4=g86(30), pv=g86(30), R2=0.0), 1e-12, 'Gross TM 1 Bsp. 8.6: S₅ = K/2·tan β·(1 − a cos β/√(b² − a² sin² β)), β = 30°')],
    'P-FW5b': [(dict(S4=g86(60), pv=g86(60), R2=0.0), 1e-12, 'Gross TM 1 Bsp. 8.6, β = 60°')],
    'P-FW5c': [(dict(S4=g86(120), pv=g86(120), R2=0.0), 1e-12, 'Gross TM 1 Bsp. 8.6, β = 120° (S₅ < 0)')],
    'P-FW6': [(dict(S0=15.0, S1=-14.14, S2=-20.0, S3=15.0, S4=54.08, S5=-55.0, S6=0.0, R0=60.0, R1=30.0, R2=-55.0, pv=-55.0), 0.005, 'Dubbel Abb. 12.25 (kN, zwei Nachkommastellen)'),
              (dict(eta0=-2.5, eta1=-1.5, eta2=0.0), 1e-12, 'Dubbel Abb. 12.25e: η(x) = −5/2 + x/(2 m)')],
    'P-FW7': [(dict(S0=-R2 / 2, S1=-R2 / 2, S2=0.5, sig0=-150.0, sig1=-150.0, sig2=100.0, SF0=1.0, SF1=1.0, ux1=1.0), 1e-9, 'Gross TM 2 Bsp. 1.6: A₁ = A₂ = 94,3 mm², A₃ = 100 mm², Δl₃ = 0,5 ‰ von 2l')],
    'P-FW8': [(dict(S0=7 / 12, S1=1 / 3, S2=1 / 12), 1e-6, 'Gross TM 2 Bsp. 1.7a: S₁ = 7F/12, S₂ = F/3, S₃ = F/12 (starrer Balken mit E·A·10⁹)')],
    'P-FW9': [(dict(S0=0, S1=0, S2=-R2, S3=1, S4=1, S5=-1, S6=0, S7=1, S8=0, S9=-1, S10=0, S11=1, S12=1, S13=0, S14=-R2, S15=1, S16=0, uy2=-(4 + 2 * R2), duy=-(4 + 2 * R2)), 1e-12, 'Gross TM 2 Bsp. 6.3: Tabelle S_i, f_V = (4 + 2√2)·F·a/(EA)')],
    'P-FW10': [(dict(S0=1 / R2, S1=-0.5, S2=1 / R2, S3=0.5, dux=-0.25, duy=-0.75, ux3=-0.25, uy3=-0.75), 1e-12, 'Gross TM 2 Bsp. 6.4: f_H = −Fl/(4EA), f_V = 3Fl/(4EA) nach unten')],
    'P-FW11a': [(dict(X0=X69, S0_0=1, S0_1=1, S0_2=1, S0_3=0, S0_4=0, S0_5=-R2, Sb0_0=-1 / R2, Sb0_1=-1 / R2, Sb0_2=-1 / R2, Sb0_3=-1 / R2, Sb0_4=1, Sb0_5=1, d10_0=-2 - 3 / R2, d11_00=2 * (1 + R2),
                      S0=1 - X69 / R2, S1=1 - X69 / R2, S2=1 - X69 / R2, S3=-X69 / R2, S4=X69, S5=-R2 + X69), 1e-12, 'Gross TM 2 Bsp. 6.9: Tabelle S_i⁽⁰⁾, S̄_i, X = (3 + 2√2)/(2(2 + √2))·F'),
                (dict(S0=0.40, S1=0.40, S2=0.40, S3=-0.60, S4=0.85, S5=-0.56), 0.005, 'Gross TM 2 Bsp. 6.9 letzte Spalte (zwei Nachkommastellen)')],
    'P-FW11b': [(dict(S0=1 - X69 / R2, S1=1 - X69 / R2, S2=1 - X69 / R2, S3=-X69 / R2, S4=X69, S5=-R2 + X69), 1e-12, 'Gross TM 2 Bsp. 6.9 mit anderer Überzähliger, gleiche Stabkräfte')],
    'P-FW12': [(dict(S0=1 / 1.2, S1=1 / 1.2, duy=-1 / (2 * 0.36), dux=0.0), 1e-12, 'Zweischlag: S = F/(2 sin α), v = F·l/(2EA sin² α)')],
}
FEHLER_KIND = {'ausnahme': 3, 'beweglich': 2, 'unbestimmt': 1, 'eingabe': -1}


# ---------------------------------------------------------------- Zufallsfachwerke (feste Saat)
def rand_truss(rng, extra_bars=0, extra_sup=0):
    """Erstes Bildungsgesetz: Dreieck, dann je neuer Knoten an zwei vorhandene; Festlager und Loslager mit beliebiger Richtung."""
    while True:
        k = int(rng.integers(4, 10))
        P = [np.array([0.0, 0.0]), np.array([float(rng.uniform(1500, 3000)), 0.0])]
        P.append(np.array([float(rng.uniform(300, 1200)), float(rng.uniform(800, 2000))]))
        bars = [(0, 1), (0, 2), (1, 2)]
        ok = True
        for nidx in range(3, k):
            a_, b_ = sorted(rng.choice(nidx, 2, replace=False).tolist())
            for _ in range(50):
                p = P[a_] + rng.uniform(-2500, 2500, 2)
                d1, d2 = p - P[a_], p - P[b_]
                if min(np.hypot(*d1), np.hypot(*d2)) > 400 and abs(np.cross(d1, d2)) / (np.hypot(*d1) * np.hypot(*d2)) > 0.25 and min(np.hypot(*(p - q)) for q in P) > 300: break
            else: ok = False; break
            P.append(p); bars += [(a_, nidx), (b_, nidx)]
        if not ok: continue
        nodes = [dict(x=round(float(p[0]), 1), y=round(float(p[1]), 1)) for p in P]
        fest, los = rng.choice(k, 2, replace=False).tolist()
        sups = [dict(node=int(fest), type='fest'), dict(node=int(los), type='los', angleDeg=float(round(rng.uniform(0, 360), 1)))]
        have = set(bars)
        cand = [(i, j) for i in range(k) for j in range(i + 1, k) if (i, j) not in have]
        rng.shuffle(cand)
        bars += [tuple(c) for c in cand[:extra_bars]]
        free = [i for i in range(k) if i not in (fest, los)]   # zusätzliche Lager nur an freien Knoten (sonst Lagerkraftaufteilung unbestimmt)
        for _ in range(extra_sup): sups.append(dict(node=int(free.pop(int(rng.integers(0, len(free))))), type='los', angleDeg=float(round(rng.uniform(0, 360), 1))))
        mats = [(210000.0, 235.0), (70000.0, 160.0)]
        bl = []
        for (i, j) in bars:
            E_, Rp = mats[int(rng.integers(0, 2))]
            bl.append(dict(i=int(i), j=int(j), A=float(round(rng.uniform(50, 800), 1)), E=E_, Rp=Rp, iGyr=float(round(rng.uniform(5, 40), 2))))
        nl = int(rng.integers(1, 4))
        loads = [dict(node=int(rng.integers(0, k)), Fx=float(round(rng.uniform(-20, 20), 2)), Fy=float(round(rng.uniform(-30, 10), 2))) for _ in range(nl)]
        inp = dict(nodes=nodes, bars=bl, supports=sups, loads=loads)
        # Kondition der Gleichgewichtsmatrix begrenzen (sonst schlecht gestellt), Unbestimmtheit wie verlangt
        A = equilibrium(inp); cl = classify(inp)
        if cl['f'] != 0 or cl['n'] != extra_bars + extra_sup: continue
        sv = np.linalg.svd(A, compute_uv=False)
        if sv[-1] / sv[0] < 1e-4: continue
        S, R, u = stiffness_solve(inp)
        if np.abs(S).max() < 1e-3 * max(math.hypot(l['Fx'], l['Fy']) for l in loads) * 1000: continue   # Lasten nur auf Festlagern: keine Stabkräfte
        return inp


def add_cases(cases, ref):
    F = json.load(open(os.path.join(HERE, 'fw_faelle.json'), encoding='utf8'))   # aus scripts/fw-faelle.ts (npx tsx scripts/fw-json.ts)
    for f in F['faelle']:
        cid, inp, Fref, uref = f['id'], f['inp'], f['Fref'], f['uref']
        o, S, R, u, nw = reference(inp, Fref, uref)
        tol = 1e-6 if cid == 'P-FW8' else 1e-9
        id_ = f'{cid} FW Nachweis'; cases.append(dict(id=id_, type='fw', inp=copy.deepcopy(inp), Fref=Fref, uref=uref, module=M)); ref[id_] = (nw, 1e-5 if cid == 'P-FW8' else tol)   # P-FW8: starre Stäbe E·A·10⁹, Spannungen dort Rundungsrauschen
        if inp.get('redundants') or classify(inp)['kind'] == 1:
            red = inp.get('redundants') or proposed_redundants(inp)
            o.update(force_method_ref(inp, red, Fref, uref))
            for i, b in enumerate(red): o[f'X{i}'] = (S[b['index']] if b['kind'] == 'bar' else R[b['index']]) / Fref
        id_ = f'{cid} FW Weggrößen'; cases.append(dict(id=id_, type='fw', inp=copy.deepcopy(inp), Fref=Fref, uref=uref, module=M, abs=True)); ref[id_] = (o, tol)
        if f['dual']:
            d = {f'V{c}': S[c] / Fref for c in range(len(S))}; d.update({f'VR{j}': R[j] / Fref for j in range(len(R))}); d['dualMax'] = 0.0; d['errors'] = 0.0
            id_ = f'{cid} FW Dualität PdvV'; cases.append(dict(id=id_, type='fwdual', inp=copy.deepcopy(inp), Fref=Fref, module=M, abs=True)); ref[id_] = (d, 1e-9)
        for i, (vals, tl, _txt) in enumerate(LIT.get(cid, [])):
            id_ = f'{cid} FW Literatur {i + 1}'; cases.append(dict(id=id_, type='fw', inp=copy.deepcopy(inp), Fref=Fref, uref=uref, module=M, abs=True)); ref[id_] = ({k: float(v) for k, v in vals.items()}, tl)
    for f in F['fehler']:
        o = dict(errors=1.0, kind=float(FEHLER_KIND[f['kind']]))
        if f['kind'] != 'eingabe': o.update({k: float(v) for k, v in classify(f['inp']).items() if k != 'kind'})
        id_ = f'{f["id"]} FW Fehler'; cases.append(dict(id=id_, type='fw', inp=copy.deepcopy(f['inp']), Fref=1000.0, uref=1.0, module=M, abs=True)); ref[id_] = (o, 0)
    rng = np.random.default_rng(SEED)
    plan = [(0, 0)] * 30 + [(1, 0)] * 5 + [(0, 1)] * 5 + [(2, 0)] * 4 + [(1, 1)] * 3 + [(3, 0)] * 3
    for z, (eb, es) in enumerate(plan):
        inp = rand_truss(rng, eb, es)
        S, R, u = stiffness_solve(inp)
        Fref = float(max(math.hypot(l['Fx'], l['Fy']) for l in inp['loads']) * 1000) or 1.0
        uref = float(max(np.abs(u).max(), 1e-12))
        o, S, R, u, nw = reference(inp, Fref, uref)
        id_ = f'P-FW30 Zufall {z + 1:02d} FW Nachweis'; cases.append(dict(id=id_, type='fw', inp=copy.deepcopy(inp), Fref=Fref, uref=uref, module=M)); ref[id_] = (nw, 1e-8)
        id_ = f'P-FW30 Zufall {z + 1:02d} (n = {eb + es}) FW Weggrößen'; cases.append(dict(id=id_, type='fw', inp=copy.deepcopy(inp), Fref=Fref, uref=uref, module=M, abs=True)); ref[id_] = (o, 1e-8)
        if eb + es == 0:
            d = {f'V{c}': S[c] / Fref for c in range(len(S))}; d.update({f'VR{j}': R[j] / Fref for j in range(len(R))}); d['dualMax'] = 0.0; d['errors'] = 0.0
            id_ = f'P-FW30 Zufall {z + 1:02d} FW Dualität PdvV'; cases.append(dict(id=id_, type='fwdual', inp=copy.deepcopy(inp), Fref=Fref, module=M, abs=True)); ref[id_] = (d, 1e-8)
