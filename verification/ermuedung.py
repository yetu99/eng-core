"""Unabhängige Gegenrechnung des Zusatznachweises Dauerfestigkeit (eng-core 0.9.0).

Eigene Python-Umsetzung nach Roloff/Matek Maschinenelemente 27. Aufl. (Kap. 3.4 bis 3.7, TB 3-2, 3-6, 3-7, 3-10,
3-11, 3-15, 3-16) und FKM-Kennwerten (Steibler 2021 Anhang A6, A8, A11, A14; Haibach 2006 Tab. 3.1-2).
Eigener Leser des Datenabzugs (data/*.json), eigene Schnittgrößen, keine Übernahme von Zwischenwerten aus dem Kern.
Dazu zwei Literaturfälle mit den gedruckten Zahlen aus Roloff/Matek 27, Beispiel 3.3 c und 3.4 (Toleranz 0,5 %).
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), 'data')
_ld = lambda f: json.load(open(os.path.join(DATA, f), encoding='utf8'))
_mat = {m['id']: m for m in _ld('materials.json')}
_var = {v['material_id']: v['id'] for v in _ld('variants.json') if v['is_default']}
_first = {}
for _r in sorted(_ld('propertyValues.json'), key=lambda r: r['sort_key']):
    _first.setdefault((_r['variant_id'], _r['property_id']), _r)


def row(mid, pid):
    return _first.get((_var[mid], pid))


def lower(r):
    """Auslegungswert 'unterer Wert' wie Blatt 1: Bereich → min, ≥ → min, sonst Einzelwert; ≤ → kein Wert."""
    if r is None: return None
    op = r['operator'] or '='
    if op == 'Bereich': return r['value_min']
    if op == '≥': return r['value_min'] if r['value_min'] is not None else r['value']
    if op == '≤': return None
    if r['value'] is not None: return r['value']
    if r['value_min'] is not None and r['value_max'] is not None: return (r['value_min'] + r['value_max']) / 2
    return r['value_min'] if r['value_min'] is not None else r['value_max']


def low_any(r):
    if r is None: return None
    return r['value'] if r['value'] is not None else (r['value_min'] if r['value_min'] is not None else r['value_max'])


# Werkstoffgruppen (eigene Tabelle aus den Quellen): f_Wσ, f_τ, a_G, b_G, a_R, R_m,N,min, a_M, b_M, Wöhlertyp, Guss, Stahl
G = {
    'stahl':    (lambda R: 0.40, 0.58, 0.50, 2700, 0.22, 400, 0.35e-3, -0.10, 'I', False, True),
    'stahl_nr': (lambda R: 0.40, 0.58, 0.40, 2400, 0.22, 400, 0.35e-3, -0.10, 'I', False, True),
    'austenit': (lambda R: 0.40, 0.58, 0.40, 2400, 0.22, 400, 0.35e-3, -0.10, 'II', False, True),
    'gs':       (lambda R: 0.34, 0.58, 0.25, 2000, 0.20, 400, 0.35e-3, 0.05, 'I', True, False),
    'gjs':      (lambda R: 0.25 + 70.0 / R, 0.65, 0.05, 3200, 0.16, 400, 0.0, 0.4, 'I', True, False),
    'gjl':      (lambda R: 0.34, 1.00, -0.05, 3200, 0.06, 100, 0.0, 0.5, 'I', True, False),
    'al_knet':  (lambda R: 0.30, 0.58, 0.05, 850, 0.22, 133, 1.0e-3, -0.04, 'II', False, False),
    'al_guss':  (lambda R: 0.30, 0.75, -0.05, 3200, 0.20, 133, 1.0e-3, 0.2, 'II', True, False),
    'andere':   (None, 0.58, 0.05, 850, 0.22, 133, 1.0e-3, -0.04, 'II', False, False),
}


def group(mid):
    s = (_mat[mid]['subclass'] or '').lower()
    if s.startswith('stahlguss'): return 'gs', True, 'gs', ('nichtrostend' in s)
    if s.startswith('stahl'):
        if 'nichtrostend austenitisch' in s: return 'austenit', False, 'ohne', False
        if 'nichtrostend' in s: return 'stahl_nr', False, ('verg' if 'martensitisch' in s else 'ohne'), False
        if 'einsatz' in s: return 'stahl', False, 'eins', False
        for k in ('vergütung', 'feder', 'presshärtbar', 'wälzlager', 'formenstahl', 'arbeitsstahl', 'hochfester baustahl'):
            if k in s: return 'stahl', False, 'verg', False
        return 'stahl', False, 'bau', False
    if 'gusseisen, globular' in s: return 'gjs', True, 'gjs', False
    if 'gusseisen, lamellar' in s: return 'gjl', True, 'gjl', False
    if s.startswith('aluminium') and 'knet' in s: return 'al_knet', False, 'ohne', False
    if s.startswith('aluminium') and 'guss' in s: return 'al_guss', True, 'ohne', False
    return 'andere', ('guss' in s), 'ohne', False


def kt(fam, prop, d):
    L = math.log10
    def st(c, d0, dl, end):
        dd = min(d, 500.0)
        return 1.0 if dd <= d0 else (1 - c * L(dd / d0) if dd < dl else end)
    if fam == 'bau': return st(0.23, 100, 300, 0.89) if prop == 'm' else st(0.26, 32, 300, 0.75)
    if fam == 'verg': return st(0.26, 16, 300, 0.67) if prop == 'm' else st(0.34, 16, 300, 0.57)
    if fam == 'eins': return st(0.41, 16, 150, 0.60)
    def cast(a, dn): return 1.0 if d <= dn else (1 - 0.7686 * a * L(d / 7.5)) / (1 - 0.7686 * a * L(dn / 7.5))
    if fam == 'gs': return cast(0.15, 100) if prop == 'm' else cast(0.30, 100)
    if fam == 'gjs': return cast(0.15, 60)
    if fam == 'gjl': return 1.207 * (max(d, 7.5) / 7.5) ** -0.1922
    return 1.0


def fam2(fam): return fam in ('verg', 'eins', 'gjs', 'gjl')


def kg(d): return 1.0 if d < 7.5 else (0.8 if d >= 150 else 1 - 0.2 * math.log10(d / 7.5) / math.log10(20))


AK = {'absatz': {'zd': (0.62, 3.5, 0, 0), 'b': (0.62, 5.8, 0.2, 3), 't': (3.4, 19, 1, 2)},
      'nut': {'zd': (0.22, 1.37, 0, 0), 'b': (0.2, 2.75, 0, 0), 't': (0.7, 10.3, 0, 0)}}


def alpha_g(kind, c, d, D, t, r):
    if kind == 'bohrung':
        x = 2 * r / d
        a = {'zd': 3 - x, 'b': 3 + 1.4 * x - 2.8 * math.sqrt(x), 't': 2.023 - 1.125 * math.sqrt(x)}[c]
        g = {'zd': 2.3 / r, 'b': 2.3 / r + 2 / d, 't': 1.15 / r + 2 / d}[c]
        return a, g
    A, B, C, z = AK[kind][c]
    a = 1 + 1 / math.sqrt(A * r / t + 2 * B * r / d * (1 + 2 * r / d) ** 2 + (C * (r / t) ** z * d / D if C else 0))
    phi = 1 / (math.sqrt(8 * (D - d) / r) + 2) if (D - d) / d <= 0.5 else 0.0
    if kind == 'absatz': g = 1.15 / r if c == 't' else 2.3 * (1 + phi) / r
    else: g = 1 / r if c == 't' else 2 * (1 + phi) / r
    return a, g


def stuetz(G_, Rm, aG, bG):
    e = aG + Rm / bG
    if G_ <= 0.1: return 1 + G_ * 10 ** (-(e - 0.5))
    if G_ <= 1: return 1 + math.sqrt(G_) * 10 ** (-e)
    return 1 + G_ ** 0.25 * 10 ** (-e)


def pcond(cond):
    import re
    m = re.search(r'P = ([0-9]+(?:,[0-9]+)?) %', cond or '')
    return float(m.group(1).replace(',', '.')) if m else None


def fatigue_py(mid, sec, forces, f, RmN_man=None, RpN_man=None):
    """sec: ('rund', D, di) oder ('X', A, W, Wt, h, b, hh); forces: N, M, T an der Kerbstelle (N, N·mm). Ergebnis-Dict."""
    gid, cast, fam, nr_gs = group(mid)
    fws, ft, aG, bG, aR, Rmin, aM, bM, typ, _, steel = G[gid]
    if gid == 'gs' and nr_gs: typ = 'II'
    RmN = RmN_man if RmN_man is not None else lower(row(mid, 'P-RM'))
    brittle = (_mat[mid]['name'] or '').startswith('EN-GJL')
    RpN = RpN_man if RpN_man is not None else (None if brittle else lower(row(mid, 'P-RE')))
    nt = f['notch']; kind = nt['type']
    out = {}
    # Geometrie
    if sec[0] == 'rund':
        Ds, di = sec[1], sec[2]
        if kind == 'absatz': d, D, t, r = Ds, nt['D'], (nt['D'] - Ds) / 2, nt['r']
        elif kind == 'nut': d, D, t, r = Ds - 2 * nt['t'], Ds, nt['t'], nt['r']
        elif kind == 'bohrung': d, D, t, r = Ds, Ds, nt['dB'] / 2, nt['dB'] / 2
        else: d = Ds
    N_, M_, T_ = forces
    sn = {}
    for c, F in (('zd', N_), ('b', M_), ('t', T_)):
        if abs(F) <= 1e-12: continue
        if sec[0] != 'rund':
            sn[c] = F / {'zd': sec[1], 'b': sec[2], 't': sec[3]}[c]
        elif kind == 'bohrung':
            sn[c] = F / {'zd': math.pi * d * d / 4 - 2 * r * d, 'b': math.pi * d ** 3 / 32 - 2 * r * d * d / 6, 't': math.pi * d ** 3 / 16 - 2 * r * d * d / 6}[c]
        else:
            Ip = math.pi * (d ** 4 - di ** 4) / 64
            sn[c] = {'zd': F / (math.pi * (d * d - di * di) / 4), 'b': F * (d / 2) / Ip, 't': F * (d / 2) / (2 * Ip)}[c]
    sa, sm = {}, {}
    for c, v in sn.items():
        R = f['R'][c]; sa[c] = abs(v) * (1 - R) / 2; sm[c] = abs(v) * (1 + R) / 2
    act = [c for c in sn if sa[c] > 1e-12]
    smv = math.sqrt((sm.get('zd', 0) + sm.get('b', 0)) ** 2 + 3 * sm.get('t', 0) ** 2); tmv = ft * smv
    # d_eff
    if f['dEff'] is not None: dE = f['dEff']
    elif sec[0] == 'rund' and sec[2] == 0: dE = nt['D'] if kind == 'absatz' else sec[1]
    elif sec[0] == 'rund': dE = (2 if fam2(fam) else 1) * (sec[1] - sec[2]) / 2
    else:
        a_, b_ = min(sec[5], sec[4]), max(sec[5], sec[4])
        dE = 2 * a_ * b_ / (a_ + b_) if fam2(fam) else a_
    if f['Kt'] is not None: Ktm = Ktp = f['Kt']
    else: Ktm, Ktp = kt(fam, 'm', dE), kt(fam, 'p', dE)
    Rm = Ktm * RmN; Rp = Ktp * RpN if RpN is not None else None
    out.update(Kt=Ktm, Ktp=Ktp, Rm=Rm, dEff=dE, smv=smv)
    if Rp is not None: out['Rp'] = Rp
    # Wechselfestigkeit
    kg1 = {}
    WN = {}
    for c in act:
        if f['sigmaW'][c]:
            WN[c] = f['sigmaW'][c]; continue
        r_ = row(mid, {'zd': 'P-SZDW', 'b': 'P-SBW', 't': 'P-TTW'}[c]); vdb = low_any(r_)
        p = pcond(r_['condition']) if r_ else None
        if steel: est = {'zd': 0.4, 'b': 0.5, 't': 0.3}[c] * RmN
        elif fws: z = fws(RmN) * RmN; est = ft * z if c == 't' else z
        else: est = None
        if vdb is not None and est is not None and (p is None or p < 97.5):
            WN[c] = min(vdb, est)
            if WN[c] == est and not steel and c != 'zd': kg1[c] = True
        elif vdb is not None: WN[c] = vdb
        else:
            WN[c] = est
            if not steel and c != 'zd': kg1[c] = True
    KRs = min(1.0, 1 - aR * math.log10(f['Rz']) * math.log10(2 * Rm / Rmin)) if f['Rz'] > 1 else 1.0
    KRt = 1 - ft * (1 - KRs)
    dK = d if sec[0] == 'rund' else sec[4]
    sch, zdr = row(mid, 'P-SZSCH'), row(mid, 'P-SZDW')
    if sch and zdr and low_any(sch) and low_any(zdr) and sch['source_id'] == zdr['source_id']:
        psi = max(0.0, 2 * low_any(zdr) / low_any(sch) - 1)
    else: psi = max(0.0, aM * Rm + bM)
    lim0 = Rp if Rp is not None else Rm
    GA = {}
    for c in act:
        if kind in ('absatz', 'nut', 'bohrung'):
            a, g = alpha_g(kind, c, d, D, t, r); n = min(stuetz(g, Rm, aG, bG), a); beta = a / n
            out[f'alpha_{c}'] = a; out[f'G_{c}'] = g; out[f'n_{c}'] = n
        elif kind == 'alpha':
            a = nt['alpha'].get(c, 1.0); g = (nt.get('G') or {}).get(c)
            n = min(stuetz(g, Rm, aG, bG), a) if g else 1.0; beta = a / n
            out[f'alpha_{c}'] = a; out[f'n_{c}'] = n
        elif kind == 'beta': beta = nt['beta'].get(c, 1.0)
        else: beta = 1.0
        Kg_ = 1.0 if (c == 'zd' or kg1.get(c)) else kg(dK)
        KR_ = KRt if c == 't' else KRs
        KD = beta / Kg_ + 1 / KR_ - 1
        W = Ktm * WN[c]; GW = W / KD
        ps = ft * psi if c == 't' else psi; mv = tmv if c == 't' else smv
        if f['overload'] == 1: ga = GW - ps * mv
        elif f['overload'] == 2: ga = GW / (1 + ps * mv / sa[c])
        else: ga = (GW - ps * (mv - sa[c])) / (1 + ps)
        lim = ft * lim0 if c == 't' else lim0
        if ga + sm[c] > lim: ga = max(0.0, lim - sm[c])
        GA[c] = ga
        out.update({f'sa_{c}': sa[c], f'sm_{c}': sm[c], f'beta_{c}': beta, f'Kg_{c}': Kg_, f'KR_{c}': KR_, f'KD_{c}': KD, f'WN_{c}': WN[c], f'GW_{c}': GW, f'psi_{c}': ps, f'GA_{c}': ga, f'S_{c}': ga / sa[c]})

    def comb(amp):
        s1 = sum(sa[c] / amp[c] for c in act if c in ('zd', 'b')); s2 = sum(sa[c] / amp[c] for c in act if c == 't')
        return 1 / math.sqrt(s1 * s1 + s2 * s2)
    out['SD'] = comb(GA)
    out['SDreq'] = f['SDreq'] if f['SDreq'] is not None else ((1.9 if f['castTested'] else 2.1) if cast else 1.5)

    def akN(c, N):
        k1, k2 = (8, 25) if c == 't' else (5, 15)
        if N < 1e6: v = GA[c] * (1e6 / N) ** (1 / k1)
        elif typ == 'I': v = GA[c]
        else: v = GA[c] * (1e6 / min(N, 1e8)) ** (1 / k2)
        lim = ft * lim0 if c == 't' else lim0
        return max(0.0, lim - sm[c]) if v + sm[c] > lim else v
    if f['N'] is not None:
        out['SZ'] = comb({c: akN(c, f['N']) for c in act})
        for c in act: out[f'AK_{c}'] = akN(c, f['N'])
    # Lebensdauer: geschlossen je Bereich (eigene Lösung statt Bisektion), nur für eine Beanspruchung
    if len(act) == 1:
        c = act[0]; k1, k2 = (8, 25) if c == 't' else (5, 15)
        if out['SD'] >= 1 and typ == 'I': out['Nlife'] = -1
        else:
            N1 = 1e6 * (GA[c] / sa[c]) ** k1
            if N1 < 1e6: out['Nlife'] = max(N1, 1e3)
            elif typ == 'II':
                N2 = 1e6 * (GA[c] / sa[c]) ** k2
                out['Nlife'] = -1 if N2 >= 1e8 else N2
            else: out['Nlife'] = -1
    return out


def add_cases(cases, ref, base):
    """Prüffälle Ermüdung (E-P1 bis E-P16) an die Gegenrechnung anhängen."""
    F0 = dict(on=True, notch=dict(type='none'), xK=None, R=dict(zd=0, b=-1, t=0), overload=2, Rz=6.3, dEff=None, Kt=None, N=None, SDreq=None, castTested=False, sigmaW=dict(zd=None, b=None, t=None))
    def fat(**k):
        f = json.loads(json.dumps(F0)); f.update(k); return f
    B = {**base, 'sub': 'KE', 'secType': 'rund_voll', 'L': 1000, 'q': 0, 'F': 0.3, 'materialId': 'W008', 'dims': {'D': 32}}
    def case(id_, inp, vals, tol=1e-6):
        cases.append(dict(id=id_, type='fatigue', inp=inp)); ref[id_] = (vals, tol)
    def rnd(D, di=0.0): return ('rund', D, di)
    def pick(o, keys): return {k: o[k] for k in keys if k in o}
    KEYS = ['SD', 'SZ', 'Kt', 'Rm', 'dEff', 'smv', 'SDreq'] + [f'{p}_{c}' for c in ('zd', 'b', 't') for p in ('sa', 'sm', 'alpha', 'G', 'n', 'beta', 'Kg', 'KR', 'KD', 'WN', 'GW', 'psi', 'GA', 'S', 'AK')]

    # Literatur 1: Roloff/Matek 27 Beispiel 3.4 (Zapfen E335, D 70, d 60, r 2, M_b 1300 N·m wechselnd, T 1700 N·m ruhend)
    inp = {**B, 'mode': 'combined', 'materialId': 'W001', 'dims': {'D': 60}, 'F': 1.3, 'T': 1700, 'N': 0, 'dvChoice': {'RE': 'manual', 'RM': 'manual'}, 'dvManual': {'RE': 335, 'RM': 570},
           'fatigue': fat(notch=dict(type='absatz', D=70, r=2), xK=0, R=dict(zd=0, b=-1, t=1), dEff=80, sigmaW=dict(zd=None, b=290, t=None))}
    py = fatigue_py('W001', rnd(60), (0, -1.3e6, 1.7e6), inp['fatigue'], 570, 335)
    case('E-P2 Roloff Bsp. 3.4 (Python)', inp, pick(py, KEYS))
    # ψ_σ druckt das Buch gerundet (0,1), daher nicht im Buchwertvergleich
    case('E-P2 Roloff Bsp. 3.4 (Buchwerte)', inp, {'alpha_b': 2.196, 'G_b': 1.288, 'n_b': 1.207, 'beta_b': 1.82, 'Kg_b': 0.861, 'KR_b': 0.92, 'KD_b': 2.20, 'GW_b': 131.85, 'smv': 69.43, 'GA_b': 118.5, 'sa_b': 61.3, 'SD': 1.93}, 5e-3)
    # Literatur 2: Roloff/Matek 27 Beispiel 3.3 c (E295, d 25, Passfeder β_kt 1,36, R_z 12,5, T_eq 160 N·m schwellend)
    inp = {**B, 'kind': 'torsion', 'sub': 'T1', 'materialId': 'W001', 'dims': {'D': 25}, 'T': 160, 'dvChoice': {'RE': 'manual', 'RM': 'manual'}, 'dvManual': {'RE': 295, 'RM': 470},
           'fatigue': fat(notch=dict(type='beta', beta=dict(t=1.36)), R=dict(zd=0, b=-1, t=0), Rz=12.5, sigmaW=dict(zd=None, b=None, t=145))}
    py = fatigue_py('W001', rnd(25), (0, 0, 1.6e5), inp['fatigue'], 470, 295)
    case('E-P3 Roloff Bsp. 3.3c (Python)', inp, pick(py, KEYS))
    case('E-P3 Roloff Bsp. 3.3c (Buchwerte)', inp, {'KR_t': 0.95, 'Kg_t': 0.92, 'KD_t': 1.53, 'GW_t': 94.5, 'psi_t': 0.0374, 'GA_t': 91.1, 'sa_t': 26.1, 'SD': 3.49}, 5e-3)
    # E-P6 bis E-P9: 42CrMo4 Absatz 38/32/3 (Datenbank R_mN, R_pN)
    fa = dict(notch=dict(type='absatz', D=38, r=3), xK=0)
    for id_, extra, F_, Tm, R_, ol, Nn in [('E-P6 42CrMo4 Absatz wechselnd', {}, 0.3, 0, dict(zd=0, b=-1, t=0), 2, None),
                                         ('E-P7 42CrMo4 schwellend Fall 2', {}, 0.6, 0, dict(zd=0, b=0, t=0), 2, None),
                                         ('E-P8a 42CrMo4 T ruhend Fall 2', {'mode': 'combined', 'T': 400, 'N': 0}, 0.3, 4e5, dict(zd=0, b=-1, t=1), 2, None),
                                         ('E-P8b 42CrMo4 T ruhend Fall 1', {'mode': 'combined', 'T': 400, 'N': 0}, 0.3, 4e5, dict(zd=0, b=-1, t=1), 1, None),
                                         ('E-P8c 42CrMo4 T ruhend Fall 3', {'mode': 'combined', 'T': 400, 'N': 0}, 0.3, 4e5, dict(zd=0, b=0, t=1), 3, None),
                                         ('E-P9 42CrMo4 Biegung und Torsion wechselnd', {'mode': 'combined', 'T': 200, 'N': 0}, 0.3, 2e5, dict(zd=0, b=-1, t=-1), 2, None),
                                         ('E-P10 42CrMo4 Zeitfestigkeit N = 10⁵', {}, 0.9, 0, dict(zd=0, b=-1, t=0), 2, 1e5)]:
        f = fat(**fa, R=R_, overload=ol, N=Nn)
        inp = {**B, **extra, 'F': F_, 'fatigue': f}
        py = fatigue_py('W008', rnd(32), (0, -F_ * 1e6, Tm), f)
        case(id_, inp, pick(py, KEYS + ['Nlife']))
    # E-P11: EN AW-6082 Umlaufnut, Zug + Biegung + Torsion, N = 10⁷ (Typ II), Rund hohl
    f = fat(notch=dict(type='nut', t=2, r=1), xK=0, R=dict(zd=0, b=-1, t=-1), N=1e7)
    inp = {**B, 'mode': 'combined', 'materialId': 'W038', 'secType': 'rund_hohl', 'dims': {'D': 40, 't': 8}, 'F': 0.15, 'N': 5, 'T': 100, 'fatigue': f}
    py = fatigue_py('W038', rnd(40, 24), (5000, -0.15e6, 1e5), f)
    case('E-P11 EN AW-6082 Nut hohl, Typ II', inp, pick(py, KEYS))
    # E-P11b: Al einachsig, Lebensdauer Typ II
    f = fat(notch=dict(type='nut', t=2, r=1), xK=0)
    inp = {**B, 'materialId': 'W038', 'dims': {'D': 40}, 'F': 0.25, 'fatigue': f}
    py = fatigue_py('W038', rnd(40), (0, -0.25e6, 0), f)
    case('E-P11b EN AW-6082 Nut, Lebensdauer Typ II', inp, pick(py, KEYS + ['Nlife']), 1e-6)
    # E-P4: Querbohrung, S235JR, Zug + Biegung + Torsion, N = 2·10⁵
    f = fat(notch=dict(type='bohrung', dB=6), xK=0, R=dict(zd=-1, b=-1, t=0), N=2e5)
    inp = {**B, 'mode': 'combined', 'materialId': 'W001', 'dims': {'D': 30}, 'F': 0.1, 'N': 10, 'T': 150, 'fatigue': f}
    py = fatigue_py('W001', rnd(30), (10000, -0.1e6, 1.5e5), f)
    case('E-P4 S235JR Querbohrung', inp, pick(py, KEYS))
    # E-P12: GJS-400-15 glatt, Datenbank (P = 50 %) gegen Abschätzung, ψ aus Schwellfestigkeit
    f = fat(R=dict(zd=0, b=-1, t=0))
    inp = {**B, 'materialId': 'W030', 'dims': {'D': 20}, 'F': 0.1, 'fatigue': f}
    py = fatigue_py('W030', rnd(20), (0, -0.1e6, 0), f)
    case('E-P12 GJS-400-15 Biegung (Regel E10)', inp, pick(py, KEYS))
    f = fat(R=dict(zd=0.2, b=-1, t=0))
    inp = {**B, 'kind': 'zug', 'sub': 'Z1', 'materialId': 'W030', 'dims': {'D': 20}, 'F': 20, 'fatigue': f}
    py = fatigue_py('W030', rnd(20), (20000, 0, 0), f)
    case('E-P12b GJS-400-15 Zug (ψ aus σ_zSch)', inp, pick(py, KEYS))
    # E-P13: GJL-250 spröde (Grenze R_m), Absatz, d_eff groß
    f = fat(notch=dict(type='absatz', D=90, r=5), xK=0, castTested=True)
    inp = {**B, 'materialId': 'W029', 'dims': {'D': 60}, 'F': 1.0, 'fatigue': f}
    py = fatigue_py('W029', rnd(60), (0, -1.0e6, 0), f)
    case('E-P13 GJL-250 Absatz', inp, pick(py, KEYS))
    # E-P14: 16MnCr5 Einsatzstahl, Torsion, Absatz mit großem Radius (G′ ≤ 0,1), d_eff 120
    f = fat(notch=dict(type='absatz', D=90, r=15), R=dict(zd=0, b=-1, t=-1), dEff=120)
    inp = {**B, 'kind': 'torsion', 'sub': 'T1', 'materialId': 'W011', 'dims': {'D': 60}, 'T': 1500, 'fatigue': f}
    py = fatigue_py('W011', rnd(60), (0, 0, 1.5e6), f)
    case('E-P14 16MnCr5 Torsion, G′ ≤ 0,1', inp, pick(py, KEYS))
    # E-P15: Rechteck voll S235JR, Gleichstreckenlast, Formzahl manuell mit und ohne G′
    for id_, nt in [('E-P15a Rechteck α_k manuell mit G′', dict(type='alpha', alpha=dict(b=1.8), G=dict(b=0.5))), ('E-P15b Rechteck α_k manuell ohne G′', dict(type='alpha', alpha=dict(b=1.8)))]:
        f = fat(notch=nt, xK=600)
        inp = {**B, 'sub': 'EQ', 'q': 2, 'L': 1200, 'materialId': 'W001', 'secType': 'rechteck_voll', 'dims': {'b': 20, 'h': 40}, 'fatigue': f}
        M = 2 * 600 * 600 / 2
        py = fatigue_py('W001', ('X', 800.0, 20 * 40 ** 2 / 6, None, 40, 20), (0, M, 0), f)
        case(id_, inp, pick(py, KEYS))
    # E-P16: Stahlguss nichtrostend (Typ II), Zug mit hoher Mittelspannung (Begrenzung durch Fließen)
    f = fat(R=dict(zd=0.8, b=-1, t=0), N=1e7)
    inp = {**B, 'kind': 'zug', 'sub': 'Z1', 'materialId': 'W032', 'dims': {'D': 20}, 'F': 50, 'fatigue': f}
    py = fatigue_py('W032', rnd(20), (50000, 0, 0), f)
    case('E-P16 GX5CrNiMo19-11-2 Zug R = 0,8', inp, pick(py, KEYS))
    # E-P17: AZ91D nur Datenbankwert (Ersatzgruppe)
    f = fat()
    inp = {**B, 'materialId': 'W056', 'dims': {'D': 32}, 'F': 0.1, 'fatigue': f}
    py = fatigue_py('W056', rnd(32), (0, -0.1e6, 0), f)
    case('E-P17 AZ91D Datenbank', inp, pick(py, KEYS + ['Nlife']))
