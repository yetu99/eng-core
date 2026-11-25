"""Unabhängige Gegenrechnung O-Ring (Modul dichtungen, eng-core 0.20.0), Konzept fachtools/konzept_or.md Abschn. 4 und 6.

Eigene Python-Umsetzung ohne den Code des Kerns, Eingaben gleich (verification/or_faelle.json aus scripts/or-faelle.ts):
  eigener Leser der Fachdaten (data/fd/oring_*.json, fit_it.json, fit_shaft_es.json), eigene Passungsrechnung ISO 286-1,
  Grenzmaße von Nuttiefe, Dehnung, Stauchung, Außendurchmesser und Spalt durch Aufzählen aller 2ⁿ Ecken der Toleranzbox
  (statt der Formeln mit min/max), Querschnittsverringerung als numpy-Polynom, Bild 8 mit numpy.interp, Querschnitts- und
  Nutfläche zweiter Weg über Polygon-Integration (Gaußsche Trapezformel, 20 000 Ecken), Einbauraumtiefe der Auslegung mit
  scipy brentq auf C(t) = C_Ziel, eigene Aufzählung der Normringe.
Literaturfälle (Toleranz nach Rundung der Quelle): Parker 8.24 (P-OR1), ISO 3601-2 Gl. (5) und Anhang B.2, B.3 (P-OR2 bis P-OR4),
ISO 3601-1 Bezeichnungsbeispiele und Gl. (A.1) (P-OR7, P-OR8), TB 19-3 (P-OR9, P-OR11), Bild 8 gegen Anhang B (P-OR12).
P-OR5, P-OR6, P-OR10 sind Literaturvergleiche ohne Kernformel (Vorprüfung vorpruefung_sollwerte.py, Prüfliste fd 1.4).
Jeder Prüffall trägt module='dichtungen'.
"""
import copy, itertools, json, math, os
import numpy as np
from scipy.optimize import brentq

HERE = os.path.dirname(os.path.abspath(__file__))
FD = os.path.join(os.path.dirname(HERE), 'data', 'fd')
_ld = lambda f: json.load(open(os.path.join(FD, f + '.json'), encoding='utf8'))
SIZES = _ld('oring_sizes'); CSTOL = _ld('oring_cs_tol'); IDTOL = _ld('oring_id_tol_a'); GROOVES = _ld('oring_grooves')
COMP = _ld('oring_compression'); GAP = _ld('oring_gap'); SURF = _ld('oring_surface'); MATS = {m['code']: m for m in _ld('oring_materials')}
MEDIA = _ld('oring_media'); CSSEL = _ld('oring_cs_select'); IT = _ld('fit_it'); ES = _ld('fit_shaft_es')
EPS = 1e-9
MED_CLASS = {k: 'oel' for k in ('HLP', 'MINOEL', 'DIESEL', 'BENZIN', 'SILIKONOEL', 'HFDR')}
MED_CLASS.update({k: 'wasser' for k in ('WASSER70', 'WASSER100', 'DAMPF150', 'DAMPF150P', 'HFC', 'WASSERGLYKOL', 'GLYKOL', 'ADBLUE')})
MED_CLASS.update({k: 'luft' for k in ('LUFT100', 'LUFT150', 'N2GAS', 'O2KALT', 'OZON', 'CO2TROCKEN')})
R_LO = np.array([-0.1, 1.06, 0.01]); R_HI = np.array([-0.0046, 0.59, 0.56])   # ISO 3601-2 Gl. (5), (6) als Polynome

def R(S): return 0.0 if S <= 0 else float(np.polyval(R_LO if S <= 3 else R_HI, S))
def jround2(x): return math.floor(x * 100 + 0.5) / 100

def lim(d):
    """Grenzmaße nach ISO 286-1 (eigene Umsetzung) bzw. von Hand; None = außerhalb."""
    n, fit = d['nom'], d.get('fit')
    if not fit:
        lo, hi = d.get('dev') or (0, 0); return (n + lo, n + hi)
    letter, grade = fit[0], int(fit[1:])
    row = next((r for r in IT if r['d_over_mm'] < n <= r['d_to_mm']), None)
    if row is None or not 1 <= grade <= 11: return None
    it = row['it%d' % grade] / 1000
    if letter == 'H': return (n, n + it)
    if letter == 'h': return (n - it, n)
    er = next(r for r in ES if r['d_over_mm'] < n <= r['d_to_mm'])
    es = (er['f_um'] if letter == 'f' else er['g_um']) / 1000
    return (n + es - it, n + es)

def size_of(code=None, d1=None, d2=None):
    if code: return next((s for s in SIZES if s['size_code'] == code or s['id'] == code), None)
    return next((s for s in SIZES if abs(s['d1_mm'] - d1) < 1e-6 and abs(s['d2_mm'] - d2) < 1e-6), None)

def ring_tol(d1, d2, cls, size, t1h, t2h):
    if cls == 'B': t1 = size['tol_b_mm'] if size else jround2(d1 ** 0.95 * 0.009 + 0.11)
    else:
        row = next((t for t in IDTOL if t['d1_from_mm'] - 0.005 <= d1 <= t['d1_to_mm'] + 0.005), None)
        t1 = size['tol_a_mm'] if size else (row['tol_mm'] if row else None)
    if t1h is not None: t1 = t1h
    if size: t2 = size['d2_tol_a_mm'] if cls == 'A' else size['d2_tol_b_mm']
    else:
        row = next((t for t in CSTOL if t['class_scope'] in (cls, 'AB') and (d2 >= t['d2_min_mm'] - EPS if t['d2_min_incl'] else d2 > t['d2_min_mm'] + EPS)
                    and d2 <= t['d2_max_mm'] + EPS and (t['d1_max_mm'] is None or d1 <= t['d1_max_mm'] + EPS)), None)
        t2 = row['tol_mm'] if row else None
    if t2h is not None: t2 = t2h
    return t1, t2

def ginst(inst, mot):
    if inst.startswith('flansch'): return 'axial'
    return {'hydraulik': 'hydr_dyn', 'pneumatik': 'pneu_dyn'}.get(mot, 'radial_statisch')
def app_of(inst, mot):
    if inst.startswith('flansch'): return 'd_axial'
    return {'hydraulik': 'a_hydr_dyn', 'pneumatik': 'b_pneu_dyn'}.get(mot, 'c_statisch')
def groove_of(inst, mot, d2): return next((g for g in GROOVES if g['install'] == ginst(inst, mot) and abs(g['d2_mm'] - d2) < 1e-6), None)
def czul(app, d2):
    pts = sorted((c for c in COMP if c['application'] == app), key=lambda c: c['d2_mm'])
    x = [p['d2_mm'] for p in pts]
    return float(np.interp(d2, x, [p['c_min_pct'] for p in pts])), float(np.interp(d2, x, [p['c_max_pct'] for p in pts])), (d2 < x[0] - EPS or d2 > x[-1] + EPS)

def gap_zul(shore, pbar, d2, factor):
    tab = 90 if shore >= 90 - EPS else 70
    cols = [1.78, 2.62, 3.53, 5.33]; col = max([c for c in cols if c <= d2 + EPS], default=1.78)
    rows = sorted((g for g in GAP if g['shore_a'] == tab and abs(g['d2_col_mm'] - col) < 1e-6), key=lambda g: g['p_max_bar'])
    row = next((g for g in rows if max(pbar, 0) <= g['p_max_bar'] + EPS), None)
    notes = 0
    if tab == 70 and shore > 70 + EPS: notes += 1
    if d2 < 1.78 - EPS: notes += 1
    if d2 > 6.99 + EPS: notes += 1
    if row is None and not d2 < 1.78 - EPS: notes += 1
    if d2 < 1.78 - EPS: return None, col, tab, notes
    return (row['g_mm'] * factor if row else None), col, tab, notes

def corners(f, boxes):
    """Extremwerte von f über alle 2ⁿ Ecken der Toleranzbox (boxes: Liste (min, max))."""
    vals = [f(*c) for c in itertools.product(*boxes)]
    return min(vals), max(vals)

def poly_area_circle(d, n=20000):
    a = np.linspace(0, 2 * np.pi, n, endpoint=False); x, y = d / 2 * np.cos(a), d / 2 * np.sin(a)
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

def temp_limits(m, med):
    c = MED_CLASS.get(med) if med else None
    tmax = {'oel': m['t_max_oil_c'], 'wasser': m['t_max_water_c'], 'luft': m['t_max_air_c']}.get(c, m['t_max_static_c'])
    return m['t_min_c'], tmax

def rating_of(med, code):
    r = next((x for x in MEDIA if x['medium_key'] == med and x['material_code'] == code), None)
    return r['rating'] if r else None

def n_sugg(med, Tmin, Tmax, dyn):
    n = 0
    for m in MATS.values():
        if dyn and m['static_only']: continue
        lo, hi = temp_limits(m, med)
        if lo is None or hi is None or not (Tmin >= lo and Tmax <= hi): continue
        if med:
            rt = rating_of(med, m['code'])
            if rt is None or rt > 2: continue
        n += 1
    return n

def cs_sel(kind, d):
    return next((c for c in CSSEL if c['kind'] == kind and (d >= c['d_min_mm'] - EPS if c['d_min_incl'] else d > c['d_min_mm'] + EPS) and d <= c['d_max_mm'] + EPS), None)

ST = {'erfüllt': 0, 'nicht erfüllt': 1, 'nicht bewertbar': 2, 'Hinweis': 3}

def or_check(inp):
    """Aufgabe A, eigene Umsetzung. Rückgabe Kennwerte wie verification/eval.ts evalOr; None = Fehlerfall."""
    inst, mot = inp['install'], inp['motion']; fl = inst.startswith('flansch'); dyn = mot != 'statisch'
    if fl and dyn: return None
    if not inp['p'] >= 0 or not inp['e'] >= 0: return None
    if inp['Tmin'] is not None and inp['Tmax'] is not None and inp['Tmin'] > inp['Tmax']: return None
    mat = MATS.get(inp['material']) if inp['material'] else None
    if inp['material'] and not mat: return None
    if inp['medium'] and not any(m['medium_key'] == inp['medium'] for m in MEDIA): return None
    rg = inp['ring']
    if rg['size']:
        size = size_of(rg['size'])
        if not size: return None
        d1, d2 = size['d1_mm'], size['d2_mm']
    else:
        d1, d2 = rg['d1'], rg['d2']
        if not (d1 and d1 > 0 and d2 and d2 > 0): return None
        size = size_of(d1=d1, d2=d2)
    t1, t2 = ring_tol(d1, d2, rg['cls'], size, rg['tolD1'], rg['tolD2'])
    if t1 is None or t2 is None: return None
    o = dict(d1=d1, d2=d2, tol1=t1, tol2=t2, d1min=d1 - t1, d1max=d1 + t1, d2min=d2 - t2, d2max=d2 + t2)
    o['Dmin'], o['Dmax'] = corners(lambda a, b: a + 2 * b, [(d1 - t1, d1 + t1), (d2 - t2, d2 + t2)])
    gr = groove_of(inst, mot, d2)
    L = {}
    need = {'kolben': ['d4', 'd3'], 'stange': ['d5', 'd6'], 'flansch_innen': ['d7'], 'flansch_aussen': ['d8']}[inst]
    opt = {'kolben': ['d9'], 'stange': ['d10']}.get(inst, [])
    for k in need + opt:
        if inp[k] is None:
            if k in need: return None
            continue
        v = lim(inp[k])
        if v is None: return None
        L[k] = (inp[k]['nom'],) + v
    if fl:
        hd = inp['h'] or (dict(nom=gr['t_mm'], fit=None, dev=[0, gr['t_tol_mm'] or 0]) if gr else None)
        if not hd: return None
        L['h'] = (hd['nom'],) + lim(hd)
    bd = inp['b']
    if not bd:
        if not gr: return None
        bb = {1: (gr['b1_min_mm'], gr['b1_max_mm']), 2: (gr['b2_min_mm'], gr['b2_max_mm'])}.get(inp['backup'], (gr['b_mm'], gr['b_mm'] + (gr['b_tol_mm'] or 0)))
        if bb[0] is None: return None
        bd = dict(nom=bb[0], fit=None, dev=[0, bb[1] - bb[0]])
    L['b'] = (bd['nom'],) + lim(bd)
    for k, (n, a, b) in L.items(): o[k + 'min'], o[k + 'max'] = a, b
    box = lambda k: (L[k][1], L[k][2])
    e = inp['e']
    if inst == 'kolben':
        o['tnom'] = (L['d4'][0] - L['d3'][0]) / 2
        tmin, tmax = corners(lambda a, b: (a - b) / 2, [box('d4'), box('d3')])
        if inp['depth'] == 'radialspiel':
            if 'd9' not in L: return None
            tmax = corners(lambda a, c, b: a - (c + b) / 2, [box('d4'), box('d9'), box('d3')])[1] + e
            tmin = corners(lambda c, b: (c - b) / 2, [box('d9'), box('d3')])[0] - e
    elif inst == 'stange':
        o['tnom'] = (L['d6'][0] - L['d5'][0]) / 2
        tmin, tmax = corners(lambda a, b: (a - b) / 2, [box('d6'), box('d5')])
        if inp['depth'] == 'radialspiel':
            if 'd10' not in L: return None
            tmax = corners(lambda a, c, b: (a + c) / 2 - b, [box('d6'), box('d10'), box('d5')])[1] + e
            tmin = corners(lambda a, c: (a - c) / 2, [box('d6'), box('d10')])[0] - e
    else:
        o['tnom'] = L['h'][0]; tmin, tmax = L['h'][1], L['h'][2]
    if not tmin > 0 or o['tnom'] >= d2 - EPS: return None
    o['tmin'], o['tmax'], o['bmin'], o['bmax'] = tmin, tmax, L['b'][1], L['b'][2]
    warnings = int(o['bmin'] <= o['d2max'] + EPS)
    # Spalt (Ecken)
    g = None
    if inst == 'kolben' and 'd9' in L:
        full = corners(lambda a, c: a - c, [box('d4'), box('d9')])[1]; g = full if inp['gap'] == 'worst' else full / 2 + e
    elif inst == 'stange' and 'd10' in L:
        full = corners(lambda a, c: a - c, [box('d10'), box('d5')])[1]; g = full if inp['gap'] == 'worst' else full / 2 + e
    elif fl: g = inp['gFlange'] if inp['gFlange'] is not None else 0.0
    if g is not None and g < 0: return None
    o['g'] = g
    o['ANmin'], o['ANmax'] = corners(lambda t, b: t * b, [(tmin, tmax), box('b')])
    # Dehnung, Stauchung (Ecken)
    Sx = Ux = None
    if inst in ('kolben', 'stange', 'flansch_aussen'):
        k = {'kolben': 'd3', 'stange': 'd5', 'flansch_aussen': 'd8'}[inst]
        f = lambda Lx, a: (Lx - a) / a * 100
        o['Snom'] = f(L[k][0], d1); o['Smin'], o['Smax'] = corners(f, [box(k), (d1 - t1, d1 + t1)]); Sx = True
    if inst in ('stange', 'flansch_innen'):
        k = 'd6' if inst == 'stange' else 'd7'
        f = lambda a, b, Lx: (a + 2 * b - Lx) / (a + 2 * b) * 100
        o['Unom'] = f(d1, d2, L[k][0]); o['Umin'], o['Umax'] = corners(f, [(d1 - t1, d1 + t1), (d2 - t2, d2 + t2), box(k)]); Ux = True
    if Sx and o['Smax'] >= 25 - EPS: return None
    dM = inp['dM'] if inp['dM'] is not None else (L['d9'][2] if inst == 'kolben' and 'd9' in L else None)
    o['SM'] = (dM - (d1 - t1)) / (d1 - t1) * 100 if dM is not None else None
    sLo, sHi = (o['Smin'], o['Smax']) if Sx else (0.0, 0.0)
    o['Rmin'], o['Rmax'] = R(sLo), R(sHi)
    o['d2smin'] = (d2 - t2) * (1 - o['Rmax'] / 100); o['d2smax'] = (d2 + t2) * (1 - o['Rmin'] / 100)
    o['Cmin'] = (o['d2smin'] - tmax) / o['d2smin'] * 100; o['Cmax'] = (o['d2smax'] - tmin) / o['d2smax'] * 100
    o['dmin'], o['dmax'] = o['d2smin'] - tmax, o['d2smax'] - tmin
    o['Cnom'] = (d2 - o['tnom']) / d2 * 100
    app = app_of(inst, mot); czmin, czmax, outside = czul(app, d2); o['Czmin'], o['Czmax'] = czmin, czmax
    o['AORmin'], o['AORmax'] = math.pi * o['d2smin'] ** 2 / 4, math.pi * o['d2smax'] ** 2 / 4
    o['Fmax'], o['Fmin'] = o['AORmax'] / o['ANmin'] * 100, o['AORmin'] / o['ANmax'] * 100
    o['FQ'] = o['Fmax'] * (1 + inp['swell']['dV'] / 100) if inp['swell'] else None
    aE = mat['alpha_1e6'] if mat else None
    o.update(FTmax=None, FTmin=None, CTminLow=None, CTmaxLow=None, CTminHigh=None, CTmaxHigh=None)
    if inp['temp']:
        if aE is None or inp['Tmin'] is None or inp['Tmax'] is None: warnings += 1
        else:
            aB = inp['temp']['alphaB']
            for T, key in ((inp['Tmin'], 'Low'), (inp['Tmax'], 'High')):
                dT = T - 24; kE, kB = 1 + aE * 1e-6 * dT, 1 + aB * 1e-6 * dT
                cmn = (o['d2smin'] * kE - tmax * kB) / (o['d2smin'] * kE) * 100; cmx = (o['d2smax'] * kE - tmin * kB) / (o['d2smax'] * kE) * 100
                o['CTmin' + key], o['CTmax' + key] = cmn, cmx
                o['FTmin' if key == 'Low' else 'FTmax'] = o['Fmax'] * kE ** 2 / kB ** 2
    # Werkstoff
    tc_ok, margin = None, None
    if mat:
        lo, hi = temp_limits(mat, inp['medium']); o['TminW'], o['TmaxW'] = lo, hi
        if inp['Tmin'] is not None and inp['Tmax'] is not None and lo is not None and hi is not None:
            margin = min(inp['Tmin'] - lo, hi - inp['Tmax']); tc_ok = margin >= 0
    else: o['TminW'] = o['TmaxW'] = None
    rating = rating_of(inp['medium'], mat['code']) if (mat and inp['medium']) else None
    o['rating'] = rating
    o['nSugg'] = n_sugg(inp['medium'], inp['Tmin'], inp['Tmax'], dyn) if inp['Tmin'] is not None and inp['Tmax'] is not None else 0
    # Spalt
    pbar = inp['p'] * 10; o['pBar'] = pbar
    shore = inp['shore'] if inp['shore'] is not None else (mat['shore_a'] if mat and mat['shore_a'] is not None else 70); o['shore'] = shore
    factor = mat['gap_factor'] if mat else 1
    gz, col, tab, gnotes = gap_zul(shore, pbar, d2, factor); o['gZul'] = gz
    o['etaG'] = g / gz if g is not None and gz is not None else None
    below = d2 < 1.78 - EPS
    need = pbar > 0 and not below and (gz is None or (g is not None and g > gz + EPS))
    o['backupNeeded'] = 0 if not need else (2 if inp['pressureBoth'] else 1)
    # Nachweise
    ok, st = {}, {}
    ok['verpressung'] = o['Cmin'] >= czmin - EPS and o['Cmax'] <= czmax + EPS
    if inst == 'kolben': lim_ = 5 if dyn else 8; ok['dehnung'] = o['Smin'] >= -EPS and o['Smax'] <= lim_ + EPS
    elif inst == 'stange': ok['dehnung'] = o['Smax'] <= (5 if dyn else 8) + EPS
    elif inst == 'flansch_aussen': ok['dehnung'] = o['Smin'] >= -EPS and o['Smax'] <= 6 + EPS
    else: ok['dehnung'] = True
    ok['stauchung'] = (o['Umin'] >= -EPS and o['Umax'] <= (5 if d1 < 250 else 3) + EPS) if Ux else True
    worst = max(x for x in (o['Fmax'], o['FQ'], o['FTmax'], o['FTmin']) if x is not None)
    ok['fuellung'] = worst <= 85 + EPS
    if g is None: ok['spalt'] = None
    elif pbar <= 0: ok['spalt'] = True
    elif below: ok['spalt'] = None
    elif gz is None or g > gz + EPS: ok['spalt'] = None if inp['backup'] > 0 else False
    else: ok['spalt'] = True
    ok['montage'] = True if o['SM'] is None else o['SM'] <= 50 + EPS
    tok = tc_ok
    if o['CTminLow'] is not None:
        okL = o['CTminLow'] >= czmin - EPS; tok = okL if tok is None else (tok and okL)
    ok['temperatur'] = tok
    ok['medium'] = None if rating is None else rating <= 3
    if inp['swell']: ok['quellung'] = inp['swell']['dV'] <= (10 if dyn else 25) + EPS
    notes = int(outside) + int(dyn and d1 > 250) + int(pbar > 350) + gnotes - 0
    if inst in ('kolben', 'stange'):
        ref = L['d4'][0] if inst == 'kolben' else L['d5'][0]; cs = cs_sel(inst, ref)
        if cs and abs(cs['d2_mm'] - d2) > 1e-6: notes += 1
    notes += int(o['bmin'] <= o['d2max'] + EPS) + int(bool(mat and mat['static_only'] and dyn))
    ok['gueltig'] = None if notes else True
    for k, v in ok.items(): st[k] = 2 if v is None else (0 if v else 1)
    if o['SM'] is None: st['montage'] = 3
    if rating is not None: st['medium'] = 0 if rating <= 2 else (3 if rating == 3 else 1)
    if notes: st['gueltig'] = 3
    st['oberflaeche'] = 3
    req = [ok[k] for k in ('verpressung', 'dehnung', 'stauchung', 'fuellung', 'spalt', 'montage')]
    o['ok'] = 0 if False in req else (2 if None in req else 1)
    for k, v in ok.items():
        if v is not None: o['ok_' + k] = 1 if v else 0
    for k, v in st.items(): o['st_' + k] = v
    o['errors'] = 0; o['warnings'] = warnings
    o['_ringok'] = all(ok[k] is True for k in ('verpressung', 'dehnung', 'stauchung', 'fuellung', 'montage'))
    o['_score_c'] = abs((o['Cmin'] + o['Cmax']) / 2 - (czmin + czmax) / 2)
    return o

def or_design(inp):
    """Aufgabe B, eigene Umsetzung: d₂, t_x per brentq, Nutgrund, Aufzählung der Normringe."""
    inst, mot = inp['install'], inp['motion']; fl = inst.startswith('flansch')
    refk = {'kolben': 'd4', 'stange': 'd5', 'flansch_innen': 'd7', 'flansch_aussen': 'd8'}[inst]
    L = lim(inp[refk]); n = inp[refk]['nom']
    dsg = inp['design'] or {}
    d2 = dsg.get('d2') or cs_sel(inst, n)['d2_mm']
    czmin, czmax, _ = czul(app_of(inst, mot), d2)
    C = dsg.get('C') if dsg.get('C') is not None else (czmin + czmax) / 2
    tx = brentq(lambda t: (d2 - t) / d2 * 100 - C, 0, d2, xtol=1e-14, rtol=1e-15)
    base = copy.deepcopy(inp); base['task'] = 'A'; base['design'] = None
    if inst == 'kolben': gk, gdim = 'd3', dict(nom=n - 2 * tx, fit='h9'); d1ref = 0.98 * (n - 2 * tx)
    elif inst == 'stange': gk, gdim = 'd6', dict(nom=L[1] + 2 * tx, fit='H9'); d1ref = 0.98 * L[1]
    else:
        gr = groove_of(inst, mot, d2); ht = (gr['t_tol_mm'] if gr and gr['t_tol_mm'] is not None else 0.1)
        gk, gdim = 'h', dict(nom=tx, fit=None, dev=[-ht / 2, ht / 2]); d1ref = n / 0.98 - 2 * d2 if inst == 'flansch_innen' else n / 1.03
    base[gk] = gdim
    cands = []
    for s in sorted((s for s in SIZES if abs(s['d2_mm'] - d2) < 1e-6), key=lambda s: (s['d1_mm'], s['size_code'])):
        c = copy.deepcopy(base); c['ring'] = dict(inp['ring'], size=s['size_code'], d1=None, d2=None, tolD1=None, tolD2=None)
        r = or_check(c)
        if r is None or not r['_ringok']: continue
        score = abs(s['d1_mm'] - d1ref) if fl else r['_score_c']
        cands.append((score, s['d1_mm'] if fl else r['Smax'], s['size_code'], s, r, c))
    cands.sort(key=lambda x: (x[0], x[1], x[2]))
    o = dict(dsD2=d2, dsC=C, dsTx=tx, dsGroove=gdim['nom'], dsD1Ref=d1ref, nCand=sum(1 for s in SIZES if abs(s['d2_mm'] - d2) < 1e-6), nValid=len(cands))
    if not cands:
        o.update(errors=0, warnings=1, ok=2, nSugg=0, bestD1=None, sumCminValid=0.0); return o, None
    best = cands[0]
    o.update(best[4]); o['bestD1'] = best[3]['d1_mm']; o['sumCminValid'] = sum(c[4]['Cmin'] for c in cands)
    o.update(dsD2=d2, dsC=C, dsTx=tx, dsGroove=gdim['nom'], dsD1Ref=d1ref, nCand=o['nCand'], nValid=len(cands))
    return o, best[5]

def clean(o): return {k: v for k, v in o.items() if v is not None and not k.startswith('_')}

def area_case(o):
    """P-OR13: Querschnitts- und Nutfläche über Polygon-Integration (Kreis mit 20 000 Ecken, Rechteck exakt)."""
    a0, a1 = poly_area_circle(o['d2smin']), poly_area_circle(o['d2smax'])
    return dict(AORmin=a0, AORmax=a1, Fmax=a1 / o['ANmin'] * 100, Fmin=a0 / o['ANmax'] * 100)

# ---------------------------------------------------------------- Literatur
# P-OR1 Parker 8.24 (S. 115 f.): Tab. 8.9 Grenzmaße (mm, letzte Stelle), Fall A konzentrisch t_max 1,435, C_min 13 % (Buch mit d₂′ 1,65),
# B Kern-Worst-Case t_max 1,4655 (B-or3, Buch 1,457), C mit e 0,05 t_max 1,5155 (Kern; Buch 1,507 mit d₉max)
LIT = {
    'P-OR1A': [((dict(d3min=12.157, d4max=15.027, d9min=14.966, d9max=14.984, tmax=1.435, g=0.061), 6e-4), 'Parker 8.24 Tab. 8.9, A'),
               ((dict(Cmin=13.0), 0.5), 'Parker 8.24 A Verpressung (Buch d₂′ = 1,65 gerundet)')],
    'P-OR1B': [((dict(tmax=1.4655), 1e-9), 'Kern-Worst-Case d₉min (B-or3), Buch 1,457 mit d₉max'),
               ((dict(tmax=1.457), 0.0086), 'Parker 8.24 B Buchwert (B-or3: +0,0085 mm durch d₉min)')],
    'P-OR1C': [((dict(tmax=1.5155), 1e-9), 'Kern mit e 0,05, Buch 1,507 (B-or3, B-or4)')],
    'P-OR3': [((dict(dsTx=4.27, dsGroove=114.46, dsD1Ref=112.17), 0.015), 'ISO 3601-2 B.2.4 bis B.2.6 (Anhang rundet t_x auf 4,27, B-or5)'),
              ((dict(dsD2=5.33), 0), 'Tab. B.1: d₄ 123 → d₂ 5,33')],
    'P-OR4': [((dict(dsTx=2.75, dsGroove=39.48, dsD1Ref=33.30), 0.006), 'ISO 3601-2 B.3.4 bis B.3.6'), ((dict(dsD2=3.53), 0), 'Tab. B.2: d₅ 34 → d₂ 3,53')],
    'P-OR4N': [((dict(d5max=33.975, d5min=33.95, d10max=34.039), 0.006), 'ISO 3601-2 B.3.2 Grenzmaße (gerundet)'),
               ((dict(Smin=2.0, Smax=4.0, Cmin=16.0, Cmax=22.0, Fmax=73.0, Fmin=59.0), 1.0), 'ISO 3601-2 B.3.8 (ganze %, B-or7)'),
               ((dict(Umin=0.05, Umax=2.66), 0.005), 'ISO 3601-2 B.3.8 Stauchung')],
    'P-OR9A': [((dict(g=0.089, gZul=0.05, backupNeeded=1, ok_spalt=0), 1e-9), 'TB 19-3: 70 Shore A, 100 bar, 3,53: g_zul 0,05; Ø50 H8/f7 g 0,089 → Stützring')],
    'P-OR9B': [((dict(g=0.0445, ok_spalt=1), 1e-9), 'geführt: 0,089/2 + 0 = 0,0445 ≤ 0,05')],
    'P-OR9C': [((dict(gZul=0.10, ok_spalt=1), 1e-9), '90 Shore A: g_zul 0,10')],
    'P-OR21': [((dict(backupNeeded=0, st_spalt=2), 0), 'd₂ 1,5 unter TB 19-3: kein Wert, nicht bewertbar, kein Stützring gefordert')],
    'P-OR3N': [((dict(Smin=2.0, Smax=3.0, Cmin=15.0, Cmax=20.0, Fmax=74.0), 1.0), 'ISO 3601-2 B.2.8 Eignungsprüfung (ganze %, B-or7)'),
               ((dict(Fmin=64.0), 2.0), 'B.2.8 F_min (Kern mit b_max 62,3 %, Anhang passt zu b_min 64,5 %, B-or13)'),
               ((dict(backupNeeded=0, ok_spalt=1), 0), 'drucklos: kein Stützring, keine Extrusion')],
    'P-OR9D': [((dict(gZul=0.025, backupNeeded=2), 1e-9), 'VMQ: g_zul 0,05·0,5 = 0,025, wechselnde Druckrichtung zwei Stützringe')],
}

def add_cases(cases, ref):
    F = json.load(open(os.path.join(HERE, 'or_faelle.json'), encoding='utf8'))   # aus scripts/or-faelle.ts (npx tsx scripts/or-json.ts)
    M = 'dichtungen'
    for f in F['faelle']:
        cid, inp = f['id'], f['inp']
        if inp['task'] == 'B': o, binp = or_design(inp)
        else: o, binp = or_check(inp), None
        assert o is not None, cid
        cases.append(dict(id=f'{cid} OR', type='or', inp=copy.deepcopy(inp), module=M)); ref[f'{cid} OR'] = (clean(o), 1e-9)
        if 'Cmin' in o:
            cases.append(dict(id=f'{cid} OR Grafik', type='or', inp=copy.deepcopy(inp), module=M, abs=True)); ref[f'{cid} OR Grafik'] = (dict(prErr=0.0, gcErr=0.0), 1e-12)
            cases.append(dict(id=f'{cid} OR Fläche Polygon', type='or', inp=copy.deepcopy(inp), module=M)); ref[f'{cid} OR Fläche Polygon'] = (area_case(o), 1e-6)
        if binp is not None:   # P-OR13: Auslegung vorwärts nachgerechnet ergibt C_nom = C_Ziel (Kolben, Stange; Flansch mit h = t_x mittig)
            cases.append(dict(id=f'{cid} OR Auslegung vorwärts', type='or', inp=copy.deepcopy(binp), module=M))
            fw = or_check(binp); assert abs(fw['Cnom'] - o['dsC']) < 1e-9 or inp['install'].startswith('flansch'), cid
            ref[f'{cid} OR Auslegung vorwärts'] = (dict(Cnom=o['dsC'] if not inp['install'].startswith('flansch') else fw['Cnom'], Cmin=o['Cmin'], Cmax=o['Cmax']), 1e-9)
        for i, ((vals, tol), _txt) in enumerate(LIT.get(cid, [])):
            id_ = f'{cid} OR Literatur {i + 1}'; cases.append(dict(id=id_, type='or', inp=copy.deepcopy(inp), module=M, abs=True)); ref[id_] = (vals, tol)
    for f in F['fehler']:
        id_ = f'{f["id"]} OR Fehler'; cases.append(dict(id=id_, type='or', inp=copy.deepcopy(f['inp']), module=M))
        assert (or_check(f['inp']) is None) == (f['id'] != 'P-OR14k'), f['id']
        ref[id_] = (dict(errors=0.0, warnings=1.0) if f['id'] == 'P-OR14k' else dict(errors=1.0), 0)
    # P-OR2 ISO 3601-2 Gl. (5): S = 2 % → R = 1,73 %; Stetigkeit bei 3 %; Parker Bild 8.13 S 6 % → 4 %, Text S 4 % → 3 %
    for S, R_, tol, nm in ((2, 1.73, 0.005, 'Gl. (5) Beispiel'), (6, 4.0, 0.15, 'Parker Bild 8.13'), (4, 3.0, 0.5, 'Parker 8.24 Text')):
        id_ = f'P-OR2 OR R(S={S}) {nm}'; cases.append(dict(id=id_, type='orr', S=S, module=M, abs=True)); ref[id_] = (dict(R=R_), tol)
    for S in (0, -1, 0.5, 1, 2, 2.999, 3, 3.001, 6, 12, 24.9):
        id_ = f'P-OR2 OR R(S={S}) Polynom'; cases.append(dict(id=id_, type='orr', S=S, module=M, abs=True)); ref[id_] = (dict(R=R(S)), 1e-12)
    id_ = 'P-OR2 OR Stetigkeit bei 3 %'; cases.append(dict(id=id_, type='orr', S=3 + 1e-9, module=M, abs=True)); ref[id_] = (dict(R=R(3)), 0.002)
    # P-OR7 Bezeichnungsbeispiele: Größe → d₁, d₂ (Text in test/oring.test.ts)
    for code, d1, d2 in (('211', 20.22, 3.53), ('011', 7.65, 1.78), ('125', 32.99, 2.62)):
        id_ = f'P-OR7 OR Größe {code}'; cases.append(dict(id=id_, type='orsize', code=code, module=M, abs=True)); ref[id_] = (dict(d1=d1, d2=d2), 0)
    # P-OR8 Gl. (A.1) gegen Klasse B aller 349 Normzeilen (0,005 mm) und eigene Formel (exakt)
    for s in SIZES:
        id_ = f'P-OR8 OR Gl. (A.1) {s["size_code"]}'; cases.append(dict(id=id_, type='ortolb', d1=s['d1_mm'], module=M, abs=True)); ref[id_] = (dict(tol=s['tol_b_mm']), 0.005)
    for d1 in (5.0, 50.0, 123.4, 500.0, 1000.0):
        id_ = f'P-OR8 OR Gl. (A.1) frei d₁ {d1:g}'; cases.append(dict(id=id_, type='ortolb', d1=d1, module=M, abs=True)); ref[id_] = (dict(tol=jround2(d1 ** 0.95 * 0.009 + 0.11)), 1e-12)
    # P-OR11 TB 19-3: Kern-Tabellenwert = eigene Ablesung je Härte, Druckstufe, Spalte; Monotonie (60 Vergleiche wie Vorprüfung)
    nmono = 0
    for tab in (70, 90):
        ps = sorted({g['p_max_bar'] for g in GAP if g['shore_a'] == tab})
        for col in (1.78, 2.62, 3.53, 5.33):
            vals = []
            for p in ps:
                gz = gap_zul(tab, p, col, 1)[0]; vals.append(gz)
                id_ = f'P-OR11 OR TB 19-3 {tab} ShA {p:g} bar Spalte {col}'; cases.append(dict(id=id_, type='orgap', shore=tab, pBar=p, d2=col, factor=1, module=M, abs=True)); ref[id_] = (dict(gZul=gz, column=col, shoreTable=tab), 1e-12)
            nmono += sum(b <= a for a, b in zip(vals, vals[1:]))
    for tab in (70, 90):
        for p in sorted({g['p_max_bar'] for g in GAP if g['shore_a'] == tab}):
            v = [gap_zul(tab, p, c, 1)[0] for c in (1.78, 2.62, 3.53, 5.33)]; nmono += sum(b >= a for a, b in zip(v, v[1:]))
    for p in (35, 70, 100):
        nmono += sum(gap_zul(90, p, c, 1)[0] >= gap_zul(70, p, c, 1)[0] for c in (1.78, 2.62, 3.53, 5.33))
    assert nmono == 60, nmono
    for shore, p, d2 in ((80, 50, 3.0), (94, 200, 6.99), (70, 120, 3.53), (75, 0, 1.5), (90, 351, 8.0)):
        gz, col, tab, _ = gap_zul(shore, p, d2, 1)
        id_ = f'P-OR11 OR TB 19-3 Zwischenwert {shore} ShA {p} bar d₂ {d2}'; cases.append(dict(id=id_, type='orgap', shore=shore, pBar=p, d2=d2, factor=1, module=M, abs=True))
        ref[id_] = (dict(gZul=-1 if gz is None else gz, column=col, shoreTable=tab), 1e-12)
    # P-OR12 Bild 8: Kern-Interpolation = numpy.interp; Anhang B.2.3 (statisch 5,33: 28 %) und B.3.3 (Hydraulik 3,53: 22 %)
    for app in ('a_hydr_dyn', 'b_pneu_dyn', 'c_statisch', 'd_axial'):
        for d2 in (1.5, 1.78, 2.0, 2.62, 3.0, 3.53, 4.0, 5.33, 6.0, 6.99, 8.0):
            mn, mx, _ = czul(app, d2); id_ = f'P-OR12 OR Bild 8 {app} d₂ {d2}'
            cases.append(dict(id=id_, type='orcz', app=app, d2=d2, module=M, abs=True)); ref[id_] = (dict(min=mn, max=mx), 1e-12)
    for app, d2, mx in (('c_statisch', 5.33, 28), ('a_hydr_dyn', 3.53, 22)):
        id_ = f'P-OR12 OR Anhang B gegen Bild 8 {app}'; cases.append(dict(id=id_, type='orcz', app=app, d2=d2, module=M, abs=True)); ref[id_] = (dict(max=mx), 0)
    # Passungen ISO 286-1 (OR-GM): eigene Rechnung, dazu Einzelwerte Parker Tab. 8.9 und ISO 286-2 (f7 50: −0,025/−0,050; H8 123: +0,063)
    for nom, fit in ((15, 'H8'), (15, 'f7'), (12.2, 'h9'), (34, 'f7'), (34, 'H8'), (39.48, 'H9'), (123, 'H8'), (123, 'f7'), (114.46, 'h9'), (50, 'g6'), (3, 'H11'), (500, 'h11')):
        L = lim(dict(nom=nom, fit=fit)); id_ = f'OR-GM OR Passung {nom:g} {fit}'
        cases.append(dict(id=id_, type='orlim', dim=dict(nom=nom, fit=fit), module=M, abs=True)); ref[id_] = (dict(min=L[0], max=L[1]), 1e-12)
    for nom, fit, lo, hi in ((50, 'f7', 49.95, 49.975), (123, 'H8', 123.0, 123.063), (15, 'f7', 14.966, 14.984)):
        id_ = f'OR-GM OR Passung {nom:g} {fit} ISO 286-2'; cases.append(dict(id=id_, type='orlim', dim=dict(nom=nom, fit=fit), module=M, abs=True)); ref[id_] = (dict(min=lo, max=hi), 1e-12)
    id_ = 'OR-GM OR Passung außerhalb 500 mm'; cases.append(dict(id=id_, type='orlim', dim=dict(nom=605, fit='H8'), module=M)); ref[id_] = (dict(errors=1.0), 0)
    # P-OR22: Nut zum Ring (OR-KAT, OR-KATN, OR-KATW) gegen den zweiten Weg (Nullstellen der Reserven); Grenzen auf 0,001 mm
    # Anzahl, Empfehlung und Nennmaß exakt; Grenzen auf 2·10⁻⁴ mm je Ring (Bisektion des Kerns auf 10⁻⁴ mm, brentq 10⁻⁹ mm)
    for f in F.get('katalog', []):
        o = or_kat(f['inp'], f.get('d2max'))
        exact = {k: v for k, v in o.items() if k not in ('sumLo', 'sumHi', 'recLo', 'recHi')}
        bounds = {k: o[k] for k in ('sumLo', 'sumHi', 'recLo', 'recHi') if k in o}
        for nm, vals, tol in (('Auswahl', exact, 1e-9), ('Grenzen', bounds, 2e-4 * max(1, o['nValid']))):
            id_ = f'{f["id"]} OR Katalog {nm}'
            cases.append(dict(id=id_, type='orkat', inp=copy.deepcopy(f['inp']), d2max=f.get('d2max'), module=M, abs=True)); ref[id_] = (vals, tol)


# ---------------------------------------------------------------- Nut zum Ring (OR-KAT, OR-KATN, OR-KATW, eng-core 0.22.0)
# Zweiter Weg ohne den Kern: statt Ja/Nein-Raster mit Bisektion (Kern) werden die Reserven der einzelnen Pflichtnachweise als stetige
# Funktionen des Nutmaßes x betrachtet (C_min − C_zul,min, C_zul,max − C_max, S_min, S_lim − S_max, U_min, U_lim − U_max, 85 − F, 50 − S_M)
# und ihre Nullstellen mit scipy brentq bestimmt; der zulässige Bereich ist der längste Abschnitt, in dem alle Reserven ≥ 0 sind.
# Eigenes, weiteres Suchfeld (t von 0,02·d₂ bis 0,99·d₂) und eigene Vorauswahl (d₁ bzw. D ± 15 % um das Bezugsmaß).
MAIN_D2 = sorted({c['d2_mm'] for c in COMP})

def _kat_setup(inp, d2):
    inst, mot = inp['install'], inp['motion']
    refk = {'kolben': 'd4', 'stange': 'd5', 'flansch_innen': 'd7', 'flansch_aussen': 'd8'}[inst]
    L = lim(inp[refk]); n = inp[refk]['nom']
    gr = groove_of(inst, mot, d2); ht = gr['t_tol_mm'] if gr and gr['t_tol_mm'] is not None else 0.1
    if inst == 'kolben': gk, mkd, xa, xb = 'd3', (lambda x: dict(nom=x, fit='h9')), n - 2 * 0.99 * d2, n - 2 * 0.02 * d2
    elif inst == 'stange': gk, mkd, xa, xb = 'd6', (lambda x: dict(nom=x, fit='H9')), L[1] + 2 * 0.02 * d2, L[1] + 2 * 0.99 * d2
    else: gk, mkd, xa, xb = 'h', (lambda x: dict(nom=x, fit=None, dev=[-ht / 2, ht / 2])), 0.02 * d2, 0.99 * d2
    return inst, mot, L, n, gk, mkd, xa, xb

def _margins(o, inst, dyn):
    m = [o['Cmin'] - o['Czmin'], o['Czmax'] - o['Cmax']]
    if inst == 'kolben': m += [o['Smin'], (5 if dyn else 8) - o['Smax']]
    elif inst == 'stange': m += [(5 if dyn else 8) - o['Smax']]
    elif inst == 'flansch_aussen': m += [o['Smin'], 6 - o['Smax']]
    if inst in ('stange', 'flansch_innen'): m += [o['Umin'], (5 if o['d1'] < 250 else 3) - o['Umax']]
    m.append(85 - max(x for x in (o['Fmax'], o['FQ'], o['FTmax'], o['FTmin']) if x is not None))
    if o['SM'] is not None: m.append(50 - o['SM'])
    return m

def or_kat_ring(inp, s, d2):
    inst, mot, L, n, gk, mkd, xa, xb = _kat_setup(inp, d2); dyn = mot != 'statisch'
    base = copy.deepcopy(inp); base.update(task='A', design=None); base['ring'] = dict(inp['ring'], size=s['size_code'], d1=None, d2=None, tolD1=None, tolD2=None)
    def at(x):
        c = copy.deepcopy(base); c[gk] = mkd(x); return or_check(c)
    def mmin(x):
        o = at(x); return -1e9 if o is None else min(_margins(o, inst, dyn))
    N = 600
    xs = [xa + i * (xb - xa) / N for i in range(N + 1)]; vs = [mmin(x) for x in xs]
    runs, i = [], 0
    while i <= N:
        if vs[i] < 0: i += 1; continue
        j = i
        while j + 1 <= N and vs[j + 1] >= 0: j += 1
        runs.append((i, j)); i = j + 1
    if not runs: return None
    i, j = max(runs, key=lambda r: (r[1] - r[0], -r[0]))
    lo = brentq(mmin, xs[i - 1], xs[i], xtol=1e-9) if i > 0 else xs[0]
    hi = brentq(mmin, xs[j], xs[j + 1], xtol=1e-9) if j < N else xs[N]
    mid = (lo + hi) / 2
    def pick(q):
        k0 = round(mid / q)
        cand = sorted({round((k0 + k) * q, 2) for k in (-2, -1, 0, 1, 2)}, key=lambda v: abs(v - mid))
        return next((v for v in cand if lo - 1e-12 <= v <= hi + 1e-12 and mmin(v) >= 0), None)
    x = pick(0.05); x = pick(0.01) if x is None else x; x = mid if x is None else x
    o = at(x)
    return dict(lo=lo, hi=hi, span=hi - lo, nom=x, Cmin=o['Cmin'], Cmax=o['Cmax'], size=s['size_code'], d1=s['d1_mm'])

def or_kat(inp, d2max=None):
    inst = inp['install']
    refk = {'kolben': 'd4', 'stange': 'd5', 'flansch_innen': 'd7', 'flansch_aussen': 'd8'}[inst]
    L = lim(inp[refk]); groups = []
    for d2 in MAIN_D2:
        def near(s):
            D = s['d1_mm'] + 2 * s['d2_mm']
            if inst == 'kolben': return L[0] / 1.15 - 2 * d2 <= s['d1_mm'] <= L[1]
            if inst == 'stange': return L[0] / 1.15 <= s['d1_mm'] and D <= L[1] * 1.15 + 2 * d2
            if inst == 'flansch_innen': return L[0] / 1.15 <= D <= L[1] * 1.15
            return L[0] / 1.15 <= s['d1_mm'] <= L[1] * 1.15
        rows = [r for r in (or_kat_ring(inp, s, d2) for s in SIZES if abs(s['d2_mm'] - d2) < 1e-6 and near(s)) if r]
        rows.sort(key=lambda r: (-r['span'], r['size']))
        groups.append(dict(d2=d2, rows=rows, allowed=d2max is None or d2 <= d2max + 1e-9))
    rec = next((g['rows'][0] for g in reversed(groups) if g['allowed'] and g['rows']), None)
    o = dict(nValid=sum(len(g['rows']) for g in groups), sumLo=sum(r['lo'] for g in groups for r in g['rows']), sumHi=sum(r['hi'] for g in groups for r in g['rows']))
    for g in groups: o['nValid_%g' % g['d2']] = len(g['rows'])
    if rec: o.update(recD1=rec['d1'], recD2=next(g['d2'] for g in groups if rec in g['rows']), recLo=rec['lo'], recHi=rec['hi'], recNom=rec['nom'], recCmin=rec['Cmin'], recCmax=rec['Cmax'])
    else: o.update(recD1=-1)
    return o
