"""Unabhängige Gegenrechnung Kinematik K1 Orientierung (Modul kinematik, eng-core 0.12.0).

Eigene Python-Umsetzung der Hinrichtung (numpy: Elementardrehungen und Produkte, Achse-Winkel über die Matrix-
exponentialfunktion scipy.linalg.expm statt Rodrigues, Quaternion über das Hamilton-Produkt q·v·q* statt Gl. B.12),
Rückrichtung unabhängig mit scipy.spatial.transform.Rotation (as_euler 'ZYX' und 'ZYZ' intrinsisch, as_rotvec, as_quat).
Nur die im Konzept festgelegten Konventionen werden hier nachgebildet (Kardansperre: erster Winkel 0; θ = 180° bzw.
w = 0: erste von 0 verschiedene Komponente x, y, z positiv). Prüfwerte:
  G-L1 bis G-L6  Literatur: Weber/Koch Bild 2.12 und 2.16 b, Lynch/Park Bsp. 3.12 und Abb. 3.7 (gedruckte Zahlen)
  G-P1           Sonderwerte: 0°, ±90° um jede Achse, (30°, 45°, 60°), Kardansperre ±90°, θ = 0 und 180°, w = 0
  G-P2           20 zufällige Orientierungen einzeln gegen numpy und scipy
  G-P3           1000 zufällige Orientierungen: Rundlauf R → Darstellung → R (< 10⁻¹²) und Quadratsummen gegen scipy
Toleranz absolut 10⁻¹² (Winkel in rad, Matrixelemente), Literaturwerte nach gedruckten Stellen.
Jeder Prüffall trägt module='kinematik' und abs=True (absolute Abweichung, in pruefung.py ausgewertet).
"""
import math
import numpy as np
from scipy.linalg import expm
from scipy.spatial.transform import Rotation

TOL = 1e-12
D = math.pi / 180


# ---------------------------------------------------------------- Hinrichtung, eigene Umsetzung
def rx(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def ry(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rz(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def hat(w): return np.array([[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]])

def r_axis(w, th):
    w = np.asarray(w, float); w = w / np.linalg.norm(w)
    return expm(hat(w) * th)

def qmul(a, b):
    w1, x1, y1, z1 = a; w2, x2, y2, z2 = b
    return np.array([w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2, w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
                     w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2])

def r_quat(q):
    q = np.asarray(q, float); q = q / np.linalg.norm(q); qc = q * np.array([1, -1, -1, -1])
    cols = [qmul(qmul(q, np.r_[0.0, e]), qc)[1:] for e in np.eye(3)]
    return np.column_stack(cols)

def r_of(inp):
    k = inp['rep']
    if k == 'zyx': e = inp['zyx']; return rz(e['A']) @ ry(e['B']) @ rx(e['C'])
    if k == 'zyz': e = inp['zyz']; return rz(e['phi']) @ ry(e['theta']) @ rz(e['psi'])
    if k == 'axis': return r_axis(inp['axis']['axis'], inp['axis']['theta'])
    if k == 'quat': q = inp['quat']; return r_quat([q['w'], q['x'], q['y'], q['z']])
    return np.array(inp['matrix'], float)


# ---------------------------------------------------------------- Rückrichtung, scipy (Konventionen des Konzepts)
def wrap(a): return a + 2 * math.pi if a <= -math.pi + TOL else a   # Wertebereich (−π, π] wie im Kern

def first_pos(v, tol=TOL):
    for c in v:
        if abs(c) > tol: return -v if c < 0 else v
    return v

def canon_quat(q):
    """q = (w, x, y, z): w ≥ 0; bei |w| ≤ 10⁻¹² erste von 0 verschiedene Komponente x, y, z positiv."""
    q = np.asarray(q, float)
    if abs(q[0]) <= TOL:
        v = q[1:].copy(); fp = first_pos(v)
        return np.r_[q[0] if fp is v else -q[0], fp]
    return q if q[0] >= 0 else -q

def lock_zyx(R): return math.hypot(R[0, 0], R[1, 0]) <= 1e-9
def lock_zyz(R): return math.hypot(R[2, 0], R[2, 1]) <= 1e-9

def inv_scipy(R):
    """Darstellungen aus scipy; Euler-Winkel nur außerhalb der Sonderfälle (dort setzt scipy einen anderen Winkel 0)."""
    import warnings
    rot = Rotation.from_matrix(R)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', UserWarning)   # Kardansperre: scipy warnt, Werte werden dann nicht verwendet
        A, B, C = rot.as_euler('ZYX')
        phi, th, psi = rot.as_euler('ZYZ')
    x, y, z, w = rot.as_quat()
    q = canon_quat([w, x, y, z])
    rv = rot.as_rotvec(); t = float(np.linalg.norm(rv))
    if t <= TOL: ax = np.array([0.0, 0.0, 1.0]); t = 0.0
    else:
        ax = rv / t
        if np.linalg.norm([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]]) <= TOL: ax = first_pos(ax)
    out = dict(wx=ax[0], wy=ax[1], wz=ax[2], th=t, qw=q[0], qx=q[1], qy=q[2], qz=q[3])
    if not lock_zyx(R): out.update(A=wrap(A), B=B, C=wrap(C))
    if not lock_zyz(R): out.update(phi=wrap(phi), theta=th, psi=wrap(psi))
    return {k: float(v) for k, v in out.items()}

def mkeys(p, M): return {f'{p}{i + 1}{j + 1}': float(M[i, j]) for i in range(3) for j in range(3)}


def add_cases(cases, ref):
    def case(id_, c, vals, tol=TOL):
        c = dict(c, id=id_, module='kinematik', abs=True); cases.append(c); ref[id_] = (vals, tol)

    def full(id_, inp, extra_vals=None, inverse=True):
        """R aus eigener Hinrichtung, Darstellungen aus scipy (ohne Sonderfälle), Rundläufe 0, Prüfung gültig."""
        R = r_of(inp)
        v = dict(mkeys('r', R), errors=0.0, valid=1.0, orth=0.0, det=1.0, rtZYX=0.0, rtZYZ=0.0, rtAX=0.0, rtQ=0.0, invErr=0.0)
        if inverse: v.update(inv_scipy(R))
        if 'pb' in inp: v.update({k: float(x) for k, x in zip(('pax', 'pay', 'paz'), R @ np.array(inp['pb'], float))})
        if 'extra' in inp:
            e = inp['extra']; Rot = {'x': rx, 'y': ry, 'z': rz}[e['axis']](e['angle'])
            v.update(mkeys('e', Rot @ R if e['frame'] == 'fest' else R @ Rot))
        v.update(extra_vals or {})
        case(id_, dict(type='kin', inp=inp), v)
        return R

    s3 = math.sqrt(3) / 2
    # ---------------- G-L1 bis G-L6: Literatur
    WK = [[0, 0.5, s3], [0, -s3, 0.5], [1, 0, 0]]
    # Weber/Koch S. 29, 34 f.: Z-Y-Z (30°, 90°, 180°); Z-Y-X Lösung (0°, −90°, −150°) aus der Liste der Lösungen; Quaternion und Drehvektor 3 Stellen
    case('G-L1 Weber/Koch Bild 2.12 Euler-Winkel', dict(type='kin', inp=dict(rep='matrix', matrix=WK)),
         dict(A=0.0, B=-90 * D, C=-150 * D, phi=30 * D, theta=90 * D, psi=180 * D, valid=1.0))
    case('G-L1 Weber/Koch Bild 2.12 Quaternion (3 Stellen)', dict(type='kin', inp=dict(rep='matrix', matrix=WK)),
         dict(qw=0.183, qx=-0.683, qy=-0.183, qz=-0.683), 5e-4)
    case('G-L1 Weber/Koch Bild 2.12 Drehwinkel 158,909°', dict(type='kin', inp=dict(rep='matrix', matrix=WK)), dict(th=158.909 * D), 1e-5)
    # Weber/Koch druckt e_R = (−0,694; −0,186; −0,694) abgeschnitten (genau −0,69475)
    case('G-L1 Weber/Koch Bild 2.12 Drehvektor (3 Stellen)', dict(type='kin', inp=dict(rep='matrix', matrix=WK)), dict(wx=-0.694, wy=-0.186, wz=-0.694), 1e-3)
    full('G-L1 Weber/Koch Bild 2.12 (Python)', dict(rep='matrix', matrix=WK), dict(A=0.0, B=-90 * D, C=-150 * D))
    case('G-L2 Weber/Koch Bild 2.12 Z-Y-X (−60°, −90°, −90°)', dict(type='kin', inp=dict(rep='zyx', zyx=dict(A=-60 * D, B=-90 * D, C=-90 * D))), mkeys('r', np.array(WK)))
    case('G-L3 Weber/Koch Bild 2.12 Z-Y-Z (30°, 90°, 180°)', dict(type='kin', inp=dict(rep='zyz', zyz=dict(phi=30 * D, theta=90 * D, psi=180 * D))), mkeys('r', np.array(WK)))
    LP312 = np.array([[0.866, -0.250, 0.433], [0.250, 0.967, 0.058], [-0.433, 0.058, 0.899]])
    inp4 = dict(rep='axis', axis=dict(axis=[0, s3, 0.5], theta=30 * D))
    # Lynch/Park druckt r_33 = 0,899 abgeschnitten (genau 0,89952), daher 10⁻³
    case('G-L4 Lynch/Park Bsp. 3.12 R (3 Stellen)', dict(type='kin', inp=inp4), mkeys('r', LP312), 1e-3)
    case('G-L4 Lynch/Park Bsp. 3.12 Exponentialkoordinaten (0; 0,453; 0,262)', dict(type='kin', inp=inp4), dict(ex=0.0, ey=0.453, ez=0.262), 5e-4)
    full('G-L4 Lynch/Park Bsp. 3.12 (Python)', inp4)
    Rb, Rc = np.array([[0, -1, 0], [1, 0, 0], [0, 0, 1]]), np.array([[0, -1, 0], [0, 0, -1], [1, 0, 0]])
    inp5 = dict(rep='zyx', zyx=dict(A=90 * D, B=0.0, C=0.0), pb=[1, -1, 0], extra=dict(frame='mitgedreht', axis='y', angle=-90 * D))
    case('G-L5 Lynch/Park Abb. 3.7 R_b, p_a, R_c', dict(type='kin', inp=inp5), dict(mkeys('r', Rb), pax=1.0, pay=1.0, paz=0.0, **mkeys('e', Rc)))
    full('G-L5 Lynch/Park Abb. 3.7 (Python)', inp5)
    case('G-L5 Lynch/Park Abb. 3.7 R_ac = R_ab·R_bc', dict(type='kincompose', Rab=Rb.tolist(), Rbc=(Rb.T @ Rc).tolist()), mkeys('c', Rc))
    case('G-L5 Lynch/Park S. 61 R_ca = R_acᵀ', dict(type='kin', inp=dict(rep='matrix', matrix=Rc.tolist())), mkeys('i', np.array([[0, 0, 1], [-1, 0, 0], [0, -1, 0]])))
    inp6 = dict(rep='quat', quat=dict(w=math.cos(15 * D), x=0.0, y=0.0, z=math.sin(15 * D)))
    case('G-L6 Weber/Koch Bild 2.16 b: φ_R = α, e_R = (0, 0, 1)', dict(type='kin', inp=inp6), dict(mkeys('r', rz(30 * D)), th=30 * D, wx=0.0, wy=0.0, wz=1.0))
    full('G-L6 Weber/Koch Bild 2.16 b (Python)', inp6)

    # ---------------- G-P1: Sonderwerte (Konzept Abschnitt 3)
    full('G-P1 keine Drehung', dict(rep='zyx', zyx=dict(A=0.0, B=0.0, C=0.0)), dict(A=0.0, B=0.0, C=0.0, phi=0.0, theta=0.0, psi=0.0, wx=0.0, wy=0.0, wz=1.0, th=0.0))
    for ax, i in (('x', 0), ('y', 1), ('z', 2)):
        for sgn in (1, -1):
            w = [0.0, 0.0, 0.0]; w[i] = 1.0
            full(f'G-P1 {sgn * 90:+d}° um {ax} (Achse-Winkel)', dict(rep='axis', axis=dict(axis=w, theta=sgn * 90 * D)))
    full('G-P1 Z-Y-X (30°, 45°, 60°)', dict(rep='zyx', zyx=dict(A=30 * D, B=45 * D, C=60 * D)), dict(A=30 * D, B=45 * D, C=60 * D))
    full('G-P1 Z-Y-Z (30°, 45°, 60°)', dict(rep='zyz', zyz=dict(phi=30 * D, theta=45 * D, psi=60 * D)), dict(phi=30 * D, theta=45 * D, psi=60 * D))
    # Kardansperre: A = 0, nur A − C (B = +90°) bzw. A + C (B = −90°) bestimmt (Lynch/Park B.1.1 b, c)
    full('G-P1 Kardansperre B = +90° (30°, 90°, 20°)', dict(rep='zyx', zyx=dict(A=30 * D, B=90 * D, C=20 * D)), dict(A=0.0, B=90 * D, C=-10 * D))
    full('G-P1 Kardansperre B = −90° (30°, −90°, 20°)', dict(rep='zyx', zyx=dict(A=30 * D, B=-90 * D, C=20 * D)), dict(A=0.0, B=-90 * D, C=50 * D))
    full('G-P1 Z-Y-Z θ = 0 (40°, 0°, 25°)', dict(rep='zyz', zyz=dict(phi=40 * D, theta=0.0, psi=25 * D)), dict(phi=0.0, theta=0.0, psi=65 * D))
    full('G-P1 Z-Y-Z θ = 180° (40°, 180°, 25°)', dict(rep='zyz', zyz=dict(phi=40 * D, theta=180 * D, psi=25 * D)), dict(phi=0.0, theta=math.pi, psi=-15 * D))
    # θ = 180°: Achse bis auf das Vorzeichen bestimmt, Regel x, y, z (Konzept)
    for w in ([1, 0, 0], [0, -1, 0], [0, 0, -1], [-1, 1, 0], [0.48, -0.6, -0.64]):
        full(f'G-P1 θ = 180° um {w}', dict(rep='axis', axis=dict(axis=w, theta=math.pi)))
    for q in ([0, 1, 0, 0], [0, 0, -1, 0], [0, 0.6, 0, -0.8], [0, -0.48, 0.6, 0.64]):
        full(f'G-P1 Quaternion w = 0 {q}', dict(rep='quat', quat=dict(w=q[0], x=q[1], y=q[2], z=q[3])))
    # nicht normierte Eingaben werden normiert (G-04-N, G-05-N)
    full('G-P1 Achse (2; 0; 0), 30°', dict(rep='axis', axis=dict(axis=[2, 0, 0], theta=30 * D)))
    full('G-P1 Quaternion (2; 0; 0; 2)', dict(rep='quat', quat=dict(w=2, x=0, y=0, z=2)))
    # ungültige Matrix: Spiegelung (det −1) und Skalierung
    case('G-P1 Spiegelung det = −1 ungültig', dict(type='kin', inp=dict(rep='matrix', matrix=[[1, 0, 0], [0, 1, 0], [0, 0, -1]])), dict(errors=1.0, valid=0.0))
    case('G-P1 Skalierung 1,001 ungültig', dict(type='kin', inp=dict(rep='matrix', matrix=[[1.001, 0, 0], [0, 1, 0], [0, 0, 1]])), dict(errors=1.0, valid=0.0))

    # ---------------- G-P2, G-P3: zufällige Orientierungen (numpy, fester Startwert)
    rng = np.random.default_rng(20261101)
    for k in range(20):
        q = rng.normal(size=4); q /= np.linalg.norm(q)
        full(f'G-P2 Zufall {k + 1:02d}', dict(rep='quat', quat=dict(w=float(q[0]), x=float(q[1]), y=float(q[2]), z=float(q[3]))))
    Q = rng.normal(size=(1000, 4)); Q /= np.linalg.norm(Q, axis=1)[:, None]
    vals = dict(n=1000.0, rtZYX=0.0, rtZYZ=0.0, rtAX=0.0, rtQ=0.0)
    acc = {}
    def ad(k, x): acc['s' + k] = acc.get('s' + k, 0.0) + x * x; acc['t' + k] = acc.get('t' + k, 0.0) + (x + 4) ** 2
    for q in Q:
        R = r_quat(q); s = inv_scipy(R)
        for x in R.ravel(): ad('R', float(x))
        for k, n in (('A', 'A'), ('B', 'B'), ('C', 'C'), ('Phi', 'phi'), ('Th', 'theta'), ('Psi', 'psi')): ad(k, s[n])
        for n in ('wx', 'wy', 'wz'): ad('E', s[n] * s['th'])
        for n in ('qw', 'qx', 'qy', 'qz'): ad('Q', s[n])
    vals.update(acc)
    # Rundlauf absolut 10⁻¹²; Quadratsummen relativ 10⁻¹² (eigener Fall ohne abs)
    c = dict(type='kinbatch', quats=Q.tolist(), id='G-P3 1000 zufällige Orientierungen', module='kinematik'); cases.append(c)
    ref[c['id']] = (vals, TOL)

    add_cases_k2(cases, ref)


# ======================================================================================================
# Kinematik K2 Homogene Transformation (eng-core 0.14.0): Rahmenbaum, Inverse, Verkettung, Punkt, Richtung,
# Verschieben, ISO-Kette. Eigene Umsetzung mit 4×4-Matrizen in numpy: R aus scipy Rotation.from_euler('ZYX')
# (intrinsisch, unabhängig von G-01/G-02 des Kerns), Inverse mit numpy.linalg.inv (der Kern rechnet geschlossen
# nach G-15), Ketten mit @, Drehoperator über expm. Prüfwerte:
#   G-K2-L1 bis L6  Literatur: Weber/Koch Bild 2.11 und Gl. (2.16), Lynch/Park Abb. 3.14, 3.15, Bsp. 3.19 (gedruckte Zahlen)
#   G-K2-P…         dieselben Fälle und die ISO-Zelle vollständig gegen die Python-Umsetzung
#   G-K2-S…         Grenz- und Fehlerfälle
#   G-K2-B          1000 Zufallsproben: Eigenschaften nach Lynch/Park Prop. 3.15 bis 3.18 und Quadratsummen
# ======================================================================================================
SQ = math.sqrt(0.5)
IJ4 = [(i, j) for i in range(3) for j in range(4)]


def tkeys(p, T): return {f'{p}{i + 1}{j + 1}': float(T[i, j]) for i, j in IJ4}


def h(R, p):
    T = np.eye(4); T[:3, :3] = np.asarray(R, float); T[:3, 3] = np.asarray(p, float); return T


def t_pose(ps):
    R = Rotation.from_euler('ZYX', [ps['A'], ps['B'], ps['C']]).as_matrix()
    return h(R, [ps['x'], ps['y'], ps['z']])


def frames_ref(inp):
    """Eigene Auswertung eines Rahmenbaums (Eingabe wie FrameInput des Kerns)."""
    fr = {f['id']: f for f in inp['frames']}
    root = next(f['id'] for f in inp['frames'] if f['parent'] is None)
    loc = {}
    for f in inp['frames']:
        if f['parent'] is None: loc[f['id']] = np.eye(4)
        elif 'matrix' in f: loc[f['id']] = np.array(f['matrix'], float)
        elif 'rp' in f: loc[f['id']] = h(f['rp']['R'], f['rp']['p'])
        else: loc[f['id']] = t_pose(f['pose'])
    absT = {}
    def ab(i):
        if i not in absT: absT[i] = loc[i] if fr[i]['parent'] is None else ab(fr[i]['parent']) @ loc[i]
        return absT[i]
    v = dict(errors=0.0, invErr=0.0)
    for i in fr: v.update(tkeys(f'W{i}_', ab(i)))
    if inp.get('rel'):
        T = np.linalg.inv(ab(inp['rel']['in'])) @ ab(inp['rel']['of']); v.update(tkeys('t', T))
        if math.hypot(T[0, 0], T[1, 0]) > 1e-9:
            A, B, C = Rotation.from_matrix(T[:3, :3]).as_euler('ZYX')
            v.update(X=T[0, 3], Y=T[1, 3], Z=T[2, 3], PA=wrap(A), PB=B, PC=wrap(C))
    roles = {f['role']: f['id'] for f in inp['frames']}
    if all(r in roles for r in ('welt', 'basis', 'flansch', 'werkzeug')):
        w, b, m, t = (roles[r] for r in ('welt', 'basis', 'flansch', 'werkzeug'))
        v.update(tkeys('o', ab(t)))
        if 'aufgabe' in roles: v.update(tkeys('a', np.linalg.inv(ab(roles['aufgabe'])) @ ab(t)))
        if inp.get('tcpTarget'):
            Ts = t_pose(inp['tcpTarget']); F = np.linalg.inv(loc[b]) @ Ts @ np.linalg.inv(loc[t]); v.update(tkeys('f', F))
            assert np.abs(loc[b] @ F @ loc[t] - Ts).max() < 1e-12   # Rückeinsetzen in G-20-K
    if inp.get('point'):
        pt = inp['point']; x = np.r_[np.asarray(pt['v'], float), 1.0 if pt['kind'] == 'punkt' else 0.0]
        x0 = ab(pt['frame']) @ x
        for i in fr:
            y = np.linalg.inv(ab(i)) @ x0
            v.update({f'P{i}_x': y[0], f'P{i}_y': y[1], f'P{i}_z': y[2]})
    if inp.get('displace'):
        d = inp['displace']; w_ = np.asarray(d['axis'], float); w_ = w_ / np.linalg.norm(w_)
        Top = h(np.eye(3), d['p']) @ h(expm(hat(w_) * d['theta']), [0, 0, 0])
        v.update(tkeys('d', Top @ ab(d['frame']) if d['mode'] == 'fest' else ab(d['frame']) @ Top))
    return {k: float(x) for k, x in v.items()}


def add_cases_k2(cases, ref):
    def case(id_, c, vals, tol=TOL):
        c = dict(c, id=id_, module='kinematik', abs=True); cases.append(c); ref[id_] = (vals, tol)

    def full(id_, inp):
        case(id_, dict(type='frames', inp=inp), frames_ref(inp))

    def M(R, p, u): return [list(map(float, R[0])) + [p[0] * u], list(map(float, R[1])) + [p[1] * u], list(map(float, R[2])) + [p[2] * u], [0.0, 0.0, 0.0, 1.0]]
    u2, u3 = 0.1, 1e-3

    # ---------------- Weber/Koch Bild 2.11 (S. 26 f.), 1 Einheit = 100 mm
    Tik = M([[0, 0, -1], [-1, 0, 0], [0, 1, 0]], [0, 4, 2], u2)
    wk = lambda **kw: dict(frames=[dict(id='i', name='K_i', role='frei', parent=None), dict(id='k', name='K_k', role='frei', parent='i', matrix=Tik)], **kw)
    inp = wk(rel=dict(of='i', **{'in': 'k'}), point=dict(frame='k', v=[-0.2, -0.1, 0.0], kind='punkt'))
    # Gl. (2.16): T_ki = [0 −1 0 4; 0 0 1 −2; −1 0 0 0]; Gl. (2.14): u_iP = (0, 6, 1)
    case('G-K2-L1 Weber/Koch Gl. (2.16) Inverse T_ki', dict(type='frames', inp=inp),
         tkeys('t', np.array([[0, -1, 0, 0.4], [0, 0, 1, -0.2], [-1, 0, 0, 0], [0, 0, 0, 1]])))
    case('G-K2-L1 Weber/Koch Gl. (2.14) Ortsvektor u_iP', dict(type='frames', inp=inp), dict(Pi_x=0.0, Pi_y=0.6, Pi_z=0.1))
    full('G-K2-P1 Weber/Koch Bild 2.11 Punkt (Python)', inp)
    inp6 = wk(point=dict(frame='k', v=[0.1, 0.2, 0.0], kind='richtung'))
    # Gl. (2.13): a_k = (1, 2, 0, 0) → a_i = (0, −1, 2, 0)
    case('G-K2-L6 Weber/Koch Gl. (2.13) freier Vektor a_i', dict(type='frames', inp=inp6), dict(Pi_x=0.0, Pi_y=-0.1, Pi_z=0.2))
    full('G-K2-P6 Weber/Koch Bild 2.11 freier Vektor (Python)', inp6)

    # ---------------- Lynch/Park Abb. 3.14 (S. 78), 1 Einheit = 100 mm
    Tsb = M([[0, 0, 1], [0, -1, 0], [1, 0, 0]], [0, -2, 0], u2)
    Tsc = M([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [-1, 1, 0], u2)
    inp2 = dict(frames=[dict(id='s', name='{s}', role='frei', parent=None), dict(id='b', name='{b}', role='frei', parent='s', matrix=Tsb),
                        dict(id='c', name='{c}', role='frei', parent='s', matrix=Tsc)], rel=dict(of='c', **{'in': 'b'}), point=dict(frame='b', v=[0.0, 0.0, 0.15], kind='punkt'))
    case('G-K2-L2 Lynch/Park Abb. 3.14 T_bc', dict(type='frames', inp=inp2), tkeys('t', np.array(M([[0, 1, 0], [0, 0, -1], [-1, 0, 0]], [0, -3, -1], u2))))
    full('G-K2-P2 Lynch/Park Abb. 3.14 (Python)', inp2)

    # ---------------- Lynch/Park Abb. 3.15 (S. 80): T = (Rot(ẑ, 90°), (0, 2, 0)), T_sb wie oben
    for mode, R_, p_ in (('fest', [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [2, 2, 0]), ('mitgedreht', [[0, 0, 1], [-1, 0, 0], [0, -1, 0]], [0, -4, 0])):
        inp3 = dict(frames=inp2['frames'][:2], displace=dict(frame='b', mode=mode, axis=[0, 0, 1], theta=90 * D, p=[0.0, 0.2, 0.0]))
        case(f'G-K2-L3 Lynch/Park Abb. 3.15 {mode}', dict(type='frames', inp=inp3), tkeys('d', np.array(M(R_, p_, u2))))
        full(f'G-K2-P3 Lynch/Park Abb. 3.15 {mode} (Python)', inp3)

    # ---------------- Lynch/Park Bsp. 3.19 (S. 80 f.), 1 Einheit = 1 mm
    E = [[0, 0, -1], [0, -1, 0], [-1, 0, 0]]
    inp5 = dict(frames=[dict(id='a', name='{a}', role='frei', parent=None),
                        dict(id='d', name='{d}', role='frei', parent='a', matrix=M(E, [400, 50, 300], u3)),
                        dict(id='b', name='{b}', role='frei', parent='d', matrix=M(E, [250, -150, 200], u3)),
                        dict(id='c', name='{c}', role='frei', parent='b', matrix=M([[0, -SQ, -SQ], [0, SQ, -SQ], [1, 0, 0]], [30, -40, 25], u3)),
                        dict(id='e', name='{e}', role='frei', parent='d', matrix=M(E, [300, 100, 120], u3))], rel=dict(of='e', **{'in': 'c'}))
    r2 = math.sqrt(2)
    case('G-K2-L5 Lynch/Park Bsp. 3.19 T_ce', dict(type='frames', inp=inp5),
         tkeys('t', np.array(M([[0, 0, 1], [-1 / r2, 1 / r2, 0], [-1 / r2, -1 / r2, 0]], [-75, -260 / r2, 160 / r2], u3))))
    # Zwischenwert S. 82: T_ad·T_de = (I, (280, −50, 0)) = Lage von {e} in {a}
    case('G-K2-L5 Lynch/Park Bsp. 3.19 T_ae = T_ad·T_de', dict(type='frames', inp=inp5), tkeys('We_', np.array(M([[1, 0, 0], [0, 1, 0], [0, 0, 1]], [280, -50, 0], u3))))
    full('G-K2-P5 Lynch/Park Bsp. 3.19 (Python)', inp5)

    # ---------------- ISO-Zelle (eigener Fall wie src/kinematics/templates.ts), vollständig gegen Python
    iso = [dict(id='0', name='Welt', role='welt', parent=None),
           dict(id='1', name='Basis', role='basis', parent='0', pose=dict(x=0.8, y=0.4, z=0.5, A=90 * D, B=0.0, C=0.0)),
           dict(id='m', name='Flansch', role='flansch', parent='1', pose=dict(x=1.2, y=0.1, z=0.9, A=30 * D, B=0.0, C=180 * D)),
           dict(id='t', name='Werkzeug', role='werkzeug', parent='m', pose=dict(x=0.03, y=0.0, z=0.2, A=0.0, B=15 * D, C=0.0)),
           dict(id='k', name='Aufgabe', role='aufgabe', parent='0', pose=dict(x=2.0, y=0.6, z=0.8, A=-90 * D, B=0.0, C=0.0))]
    tcp = dict(x=2.1, y=0.7, z=0.85, A=0.0, B=0.0, C=180 * D)
    full('G-K2-P7 ISO-Zelle T_0t, T_kt, Flansch-Soll, Punkt im Werkzeug', dict(frames=iso, rel=dict(of='t', **{'in': 'k'}), point=dict(frame='t', v=[0.0, 0.0, 0.05], kind='punkt'), tcpTarget=tcp))
    full('G-K2-P7 ISO-Zelle Richtung im Werkzeug, Werkzeug in Basis', dict(frames=iso, rel=dict(of='t', **{'in': '1'}), point=dict(frame='t', v=[0.0, 0.0, 1.0], kind='richtung')))
    full('G-K2-P7 ISO-Zelle Welt in Werkzeug (Inverse über den Baum)', dict(frames=iso, rel=dict(of='0', **{'in': 't'})))
    # Werkzeug mitgedreht verschieben (Werkzeugkorrektur in {t}) und Aufgabe fest verschieben
    full('G-K2-P7 ISO-Zelle Werkzeug mitgedreht verschoben', dict(frames=iso, displace=dict(frame='t', mode='mitgedreht', axis=[1, 1, 0], theta=20 * D, p=[0.01, -0.02, 0.03])))
    full('G-K2-P7 ISO-Zelle Aufgabe fest verschoben', dict(frames=iso, displace=dict(frame='k', mode='fest', axis=[0, 0, 1], theta=-45 * D, p=[0.1, 0.0, 0.0])))
    # Rahmen aus R (Blatt K1, Weber/Koch Bild 2.12) und p (G-13)
    WK212 = [[0, 0.5, math.sqrt(3) / 2], [0, -math.sqrt(3) / 2, 0.5], [1, 0, 0]]
    full('G-K2-P8 Rahmen aus R (Weber/Koch Bild 2.12) und p', dict(frames=[dict(id='0', name='K_0', role='welt', parent=None),
         dict(id='W', name='K_W', role='frei', parent='0', rp=dict(R=WK212, p=[0.1, 0.2, 0.3]))], rel=dict(of='0', **{'in': 'W'}), point=dict(frame='W', v=[0.0, 0.0, 0.1], kind='punkt')))

    # ---------------- Grenz- und Fehlerfälle
    full('G-K2-S1 Identität', dict(frames=[dict(id='a', name='a', role='frei', parent=None), dict(id='b', name='b', role='frei', parent='a', pose=dict(x=0.0, y=0.0, z=0.0, A=0.0, B=0.0, C=0.0))], rel=dict(of='a', **{'in': 'b'})))
    full('G-K2-S2 reine Translation, Richtung bleibt', dict(frames=[dict(id='a', name='a', role='frei', parent=None), dict(id='b', name='b', role='frei', parent='a', pose=dict(x=0.3, y=-0.2, z=0.1, A=0.0, B=0.0, C=0.0))],
                                                          rel=dict(of='a', **{'in': 'b'}), point=dict(frame='b', v=[0.6, 0.0, 0.8], kind='richtung')))
    full('G-K2-S3 Drehung 180° um z', dict(frames=[dict(id='a', name='a', role='frei', parent=None), dict(id='b', name='b', role='frei', parent='a', pose=dict(x=0.1, y=0.0, z=0.0, A=180 * D, B=0.0, C=0.0))], rel=dict(of='a', **{'in': 'b'})))
    # Kardansperre in der relativen Pose: A = 0 (G-06-KP), Winkel nur im Kern geprüft (Python ohne Euler-Winkel)
    case('G-K2-S4 Kardansperre B = +90° in G-13-X', dict(type='frames', inp=dict(frames=[dict(id='a', name='a', role='frei', parent=None),
         dict(id='b', name='b', role='frei', parent='a', pose=dict(x=0.0, y=0.0, z=0.0, A=30 * D, B=90 * D, C=20 * D))], rel=dict(of='b', **{'in': 'a'}))), dict(PA=0.0, PB=90 * D, PC=-10 * D))
    bad = lambda **f: dict(frames=[dict(id='a', name='a', role='frei', parent=None), dict(id='b', name='b', role='frei', parent='a', **f)])
    case('G-K2-S5 letzte Zeile (0; 0; 0,1; 1) ungültig', dict(type='frames', inp=bad(matrix=[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0.1, 1]])), dict(errors=1.0))
    case('G-K2-S5 det R = −1 ungültig', dict(type='frames', inp=bad(matrix=[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, -1, 0], [0, 0, 0, 1]])), dict(errors=1.0))
    case('G-K2-S5 Zyklus im Baum', dict(type='frames', inp=dict(frames=[dict(id='a', name='a', role='frei', parent=None), dict(id='b', name='b', role='frei', parent='c', pose=dict(x=0, y=0, z=0, A=0, B=0, C=0)),
         dict(id='c', name='c', role='frei', parent='b', pose=dict(x=0, y=0, z=0, A=0, B=0, C=0))])), dict(errors=1.0))
    case('G-K2-S5 unbekannter Bezugsrahmen', dict(type='frames', inp=dict(frames=[dict(id='a', name='a', role='frei', parent=None), dict(id='b', name='b', role='frei', parent='x', pose=dict(x=0, y=0, z=0, A=0, B=0, C=0))])), dict(errors=1.0))

    # ---------------- G-K2-B: 1000 Zufallsproben (fester Startwert)
    rng = np.random.default_rng(20261107)
    samples, vals = [], dict(n=1000.0, eInv=0.0, eInvInv=0.0, eAssoc=0.0, eDist=0.0, eAng=0.0)
    acc = {}
    def ad(k, x): acc['s' + k] = acc.get('s' + k, 0.0) + x * x; acc['t' + k] = acc.get('t' + k, 0.0) + (x + 4) ** 2
    for _ in range(1000):
        row, Ts = [], []
        for _k in range(3):
            q = rng.normal(size=4); q /= np.linalg.norm(q); p = rng.uniform(-2, 2, size=3)
            row += list(q) + list(p); Ts.append(h(r_quat(q), p))
        x, y = rng.uniform(-2, 2, size=3), rng.uniform(-2, 2, size=3); row += list(x) + list(y)
        samples.append([float(c) for c in row])
        Ti = np.linalg.inv(Ts[0]); C12 = Ts[0] @ Ts[1]
        for i, j in IJ4: ad('I', float(Ti[i, j])); ad('C', float(C12[i, j]))
        for c in (Ts[0] @ np.r_[x, 1.0])[:3]: ad('X', float(c))
    vals.update(acc)
    # Fehler absolut 10⁻¹² (Abstand und Skalarprodukt bei Koordinaten bis 2 m: 10⁻¹¹); Quadratsummen relativ 10⁻¹²
    c = dict(type='framesbatch', samples=samples, id='G-K2-B 1000 Zufallsproben Eigenschaften', module='kinematik', abs=True); cases.append(c)
    ref[c['id']] = (dict(n=1000.0, eInv=0.0, eInvInv=0.0, eAssoc=0.0), TOL)
    c2 = dict(type='framesbatch', samples=samples, id='G-K2-B 1000 Zufallsproben Abstand und Winkel', module='kinematik', abs=True); cases.append(c2)
    ref[c2['id']] = (dict(eDist=0.0, eAng=0.0), 1e-11)
    c3 = dict(type='framesbatch', samples=samples, id='G-K2-B 1000 Zufallsproben Quadratsummen', module='kinematik'); cases.append(c3)
    ref[c3['id']] = ({k: v for k, v in vals.items() if k[0] in 'st'}, TOL)
