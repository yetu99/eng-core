"""Unabhängige Gegenrechnung Modul chemie (eng-core 0.24.0, Werkzeug Chemiewerk).

Eigene Python-Umsetzung mit anderen Verfahren als der Kern:
  - Parser: rekursiver Abstieg mit regulären Ausdrücken (Kern: zeichenweiser Stapel), Ladung nur in eindeutiger Form ^n±.
  - Bilanz: sympy.Matrix.nullspace (Kern: eigene Gauß-Jordan-Elimination mit BigInt-Brüchen), ganze Zahlen über sympy.ilcm/igcd.
  - Oxidationszahlen: lineares Gleichungssystem je Spezies mit sympy (feste Regeln als Gleichungen, Konflikt durch
    Weglassen der Gleichung niedrigsten Rangs), Kern: Zuweisung und Restbilanz.
  - Redox: je Halbreaktion Nullraum der Matrix aus Edukt, Produkt, H2O, H+, e- mit sympy (Kern: schrittweises
    Auffüllen O, H, Ladung), Kombination über kgV der Elektronen, basisch danach H+ in H2O und OH- umgerechnet.
  - Stöchiometrie, Kern, Zerfall: geschlossene Formeln neu getippt; Zerfall über exp(−λt) statt 2^(−t/T½).
Elementdaten aus test/fixtures/ch_snapshot.json (gleiche Daten, andere Rechnung). Exakte Größen absolut 0, Gleitkomma relativ 1e-12.
"""
import json, math, os, re
import sympy as sp

HERE = os.path.dirname(os.path.abspath(__file__))
SNAP = json.load(open(os.path.join(HERE, '..', 'test', 'fixtures', 'ch_snapshot.json'), encoding='utf-8'))
EL = {e['symbol']: e for e in SNAP['elements']}
MOD = 'chemie'
TOL = 1e-12
R = 6.02214076e23 * 1.380649e-23
MH1, MN, UC2 = 1.007825031898, 1.00866491606, 931.49410372


def parse(f):
    q = 0
    m = re.search(r'\^(\d*)([+-])$', f)
    if m:
        q = (int(m.group(1)) if m.group(1) else 1) * (1 if m.group(2) == '+' else -1); f = f[:m.start()]
    tot = {}
    for k, part in enumerate(re.split(r'[·*.]', f)):
        mm = re.match(r'^(\d+)(.*)$', part); mult = 1
        if mm and k > 0: mult, part = int(mm.group(1)), mm.group(2)
        c, i = group(part, 0)
        assert i == len(part), f
        for e, n in c.items(): tot[e] = tot.get(e, 0) + n * mult
    return tot, q


def group(s, i):
    c = {}
    while i < len(s):
        if s[i] in '([':
            inner, i = group(s, i + 1); i += 1
            m = re.match(r'\d*', s[i:]); n = int(m.group()) if m.group() else 1; i += len(m.group())
            for e, v in inner.items(): c[e] = c.get(e, 0) + v * n
        elif s[i] in ')]':
            return c, i
        else:
            m = re.match(r'([A-Z][a-z]?)(\d*)', s[i:]); assert m and m.group(1) in EL, s
            c[m.group(1)] = c.get(m.group(1), 0) + (int(m.group(2)) if m.group(2) else 1); i += m.end()
    return c, i


def Mr(f):
    c, _ = parse(f); return sum(n * EL[e]['atomic_mass_u'] for e, n in c.items())


def balance(left, right):
    sps = [parse(f) for f in left + right]; sg = [1] * len(left) + [-1] * len(right)
    els = sorted({e for c, _ in sps for e in c})
    rows = [[c.get(e, 0) * s for (c, _), s in zip(sps, sg)] for e in els]
    if any(q for _, q in sps): rows.append([q * s for (_, q), s in zip(sps, sg)])
    ns = sp.Matrix(rows).nullspace()
    if len(ns) != 1: return len(ns), None
    v = ns[0]; L = sp.ilcm(*[x.q for x in v]); v = [int(x * L) for x in v]; g = sp.igcd(*v); v = [x // g for x in v]
    if v[0] < 0: v = [-x for x in v]
    if any(x <= 0 for x in v): return -1, None
    return 1, v


def oxidation(f):
    c, q = parse(f); els = sorted(c)
    if len(els) == 1: return {els[0]: sp.Rational(q, c[els[0]])}
    en = {e: EL[e]['electronegativity'] for e in els}
    rules = []
    for e in els:
        if e == 'F': rules.append((1, e, -1))
        elif e in ('Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'): rules.append((2, e, 1))
        elif e in ('Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra'): rules.append((2, e, 2))
        elif e == 'Al': rules.append((2, e, 3))
        elif e == 'H': rules.append((3, e, 1))
        elif e == 'O': rules.append((4, e, -2))
        elif e in ('Cl', 'Br', 'I') and all(x == e or (en[x] or -9) < en[e] for x in els): rules.append((5, e, -1))
    xs = {e: sp.Symbol(e) for e in els}
    total = sp.Eq(sum(c[e] * xs[e] for e in els), q)
    rules.sort(key=lambda r: (r[0], -(en[r[1]] or 0)))
    while True:
        sol = sp.solve([total] + [sp.Eq(xs[e], v) for _, e, v in rules], list(xs.values()), dict=True)
        if sol and all(sp.sympify(sol[0].get(xs[e], xs[e])).is_number for e in els): return {e: sp.Rational(sol[0][xs[e]]) for e in els}
        if sol:
            fixed = {e for _, e, _ in rules}
            free = [e for e in els if e not in fixed]
            top = max(free, key=lambda e: en[e]); rules.append((8, top, min(EL[top]['oxidation_states_common']))); continue
        rules.pop()


def half(E, P):
    """Nullraum E + a H2O + b H+ + c e- → P. Besteht ein Partner nur aus H und O (O ist Zentralatom), entfällt H2O als Hilfsstoff."""
    ho = all(set(parse(x)[0]) <= {'H', 'O'} for x in (E, P))
    sps = [E, P, 'H^+', 'e^-'] if ho else [E, P, 'H2O', 'H^+', 'e^-']
    comps = [parse(s) if s != 'e^-' else ({}, -1) for s in sps]
    sg = [1, -1] + [1] * (len(sps) - 2)
    els = sorted({e for c, _ in comps for e in c})
    rows = [[c.get(e, 0) * s for (c, _), s in zip(comps, sg)] for e in els] + [[qq * s for (_, qq), s in zip(comps, sg)]]
    ns = sp.Matrix(rows).nullspace(); assert len(ns) == 1, (E, P)
    v = ns[0]; L = sp.ilcm(*[x.q for x in v]); v = [int(x * L) for x in v]
    if v[0] < 0: v = [-x for x in v]
    if ho: v = v[:2] + [0] + v[2:]
    return dict(E=v[0], P=v[1], H2O=v[2], Hp=v[3], e=v[4])


def redox(pairs, medium):
    hs = [half(E, P) for E, P in pairs]
    L = sp.ilcm(*[abs(h['e']) for h in hs])
    tot = {}
    for (E, P), h in zip(pairs, hs):
        f = L // abs(h['e'])
        tot[key(E)] = tot.get(key(E), 0) + h['E'] * f
        tot[key(P)] = tot.get(key(P), 0) - h['P'] * f
        tot['H2O'] = tot.get('H2O', 0) + h['H2O'] * f
        tot['H^+'] = tot.get('H^+', 0) + h['Hp'] * f
    if medium == 'basisch':
        hp = tot.pop('H^+', 0); tot['H2O'] = tot.get('H2O', 0) + hp; tot['HO^-'] = tot.get('HO^-', 0) - hp
    tot = {k: v for k, v in tot.items() if v}
    g = sp.igcd(*tot.values()); tot = {k: v // g for k, v in tot.items()}
    return tot, int(L // g)


def key(f):
    c, q = parse(f)
    els = sorted(c) if 'C' not in c else ['C'] + (['H'] if 'H' in c else []) + sorted(e for e in c if e not in ('C', 'H'))
    s = ''.join(e + (str(c[e]) if c[e] != 1 else '') for e in els)
    return s + ('' if q == 0 else '^' + (str(abs(q)) if abs(q) != 1 else '') + ('+' if q > 0 else '-'))


BAL = [(['C3H8', 'O2'], ['CO2', 'H2O']), (['KMnO4', 'HCl'], ['KCl', 'MnCl2', 'Cl2', 'H2O']), (['Fe', 'Cl2'], ['FeCl3']), (['NaOH', 'H2SO4'], ['Na2SO4', 'H2O']),
       (['Fe2O3', 'CO'], ['Fe', 'CO2']), (['N2', 'H2'], ['NH3']), (['CuSO4·5H2O'], ['CuSO4', 'H2O']), (['MnO4^-', 'Fe^2+', 'H^+'], ['Mn^2+', 'Fe^3+', 'H2O']),
       (['Ca(OH)2', 'CO2'], ['CaCO3', 'H2O']), (['K4Fe(CN)6', 'KMnO4', 'H2SO4'], ['KHSO4', 'Fe2(SO4)3', 'MnSO4', 'HNO3', 'CO2', 'H2O']),
       (['H2', 'O2'], ['H2O', 'H2O2']), (['Fe', 'O2'], ['FeCl3']), (['MnO4^-', 'H2O2', 'H^+'], ['Mn^2+', 'O2', 'H2O']), (['C8H18', 'O2'], ['CO2', 'H2O'])]
OX = ['Fe3O4', 'KMnO4', 'K2Cr2O7', 'H2O2', 'NaH', 'OF2', 'KO2', 'S2O3^2-', 'NH4^+', 'CH4', 'C6H12O6', 'HClO4', 'ICl', 'LiAlH4', 'CuFeS2', 'Hg2^2+', 'CaH2', 'Na2O2', 'HCN', 'Cr2O7^2-']
RX = [(['MnO4^-', 'Fe^2+'], ['Mn^2+', 'Fe^3+'], [('MnO4^-', 'Mn^2+'), ('Fe^2+', 'Fe^3+')], 'sauer'),
      (['Cu', 'NO3^-'], ['Cu^2+', 'NO'], [('Cu', 'Cu^2+'), ('NO3^-', 'NO')], 'sauer'),
      (['MnO4^-', 'H2O2'], ['Mn^2+', 'O2'], [('MnO4^-', 'Mn^2+'), ('H2O2', 'O2')], 'sauer'),
      (['Cr2O7^2-', 'SO3^2-'], ['Cr(OH)3', 'SO4^2-'], [('Cr2O7^2-', 'Cr(OH)3'), ('SO3^2-', 'SO4^2-')], 'basisch'),
      (['Cl2'], ['Cl^-', 'ClO^-'], [('Cl2', 'Cl^-'), ('Cl2', 'ClO^-')], 'basisch'),
      (['IO3^-', 'I^-'], ['I2'], [('IO3^-', 'I2'), ('I^-', 'I2')], 'sauer'),
      (['H2O2', 'Fe^2+'], ['Fe^3+'], [('H2O2', 'H2O'), ('Fe^2+', 'Fe^3+')], 'sauer'),
      (['MnO4^-', 'SO3^2-'], ['MnO2', 'SO4^2-'], [('MnO4^-', 'MnO2'), ('SO3^2-', 'SO4^2-')], 'basisch'),
      (['Zn', 'NO3^-'], ['Zn^2+', 'NH4^+'], [('Zn', 'Zn^2+'), ('NO3^-', 'NH4^+')], 'sauer'),
      (['Fe3O4', 'MnO4^-'], ['Fe^3+', 'Mn^2+'], [('Fe3O4', 'Fe^3+'), ('MnO4^-', 'Mn^2+')], 'sauer')]


def add_cases(cases, ref):
    def case(id_, typ, vals, tol=TOL, **kw):
        cases.append(dict(id=id_, type=typ, module=MOD, **kw)); ref[id_] = (vals, tol)
    for i, (l, r) in enumerate(BAL, 1):
        dim, v = balance(l, r)
        vals = dict(dim=dim); vals.update({f'c{j}': x for j, x in enumerate(v or [])})
        case(f'CH-B{i:02d} {" + ".join(l)} -> {" + ".join(r)}', 'chbal', vals, 0, l=l, r=r)
    for f in ['H2O', 'CO2', 'H2SO4', 'Fe3O4', 'C6H12O6', 'NaCl', 'CuSO4·5H2O', '[Cu(NH3)4]^2+', 'Ca3(PO4)2', 'K4Fe(CN)6']:
        case(f'CH-M {f}', 'chmass', dict(Mr=Mr(f)), f=f)
    for f in OX:
        case(f'CH-O {f}', 'chox', {f'ox_{e}': float(v) for e, v in oxidation(f).items()}, 0, f=f)
    for i, (l, r, pairs, m) in enumerate(RX, 1):
        tot, z = redox(pairs, m)
        vals = dict(z=z); vals.update({f'c_{k}': v for k, v in tot.items()})
        case(f'CH-R{i:02d} {" + ".join(l)} -> {" + ".join(r)} ({m})', 'chredox', vals, 0, l=l, r=r, m=m)
    Mk = lambda f: Mr(f) * 1e-3
    xi = min(0.004 / Mk('H2') / 2, 0.04 / Mk('O2'))
    stsp = [['H2', 'edukt', 2, True], ['O2', 'edukt', 1, True], ['H2O', 'produkt', 2, False]]
    case('CH-S1 4 g H2 + 40 g O2 Normzustand', 'chstoich', dict(xi=xi, n2=2 * xi, m2=2 * xi * Mk('H2O'), V0=2 * xi * R * 273.15 / 101325, rest1=0.04 / Mk('O2') - xi),
         sp=stsp, given=[[0, 'm', 0.004], [1, 'm', 0.04]], gas=dict(mode='norm', T=273.15, p=101325), eta=1)
    case('CH-S2 1 mol O2, 298,15 K, 1e5 Pa, eta 0,85', 'chstoich', dict(xi=1.0, n2=1.7, m2=1.7 * Mk('H2O'), V1=R * 298.15 / 1e5),
         sp=stsp, given=[[1, 'n', 1.0]], gas=dict(mode='frei', T=298.15, p=1e5), eta=0.85)
    iso = {(i['z'], i['a']): i for i in SNAP['isotopes']}
    for z, a in [(26, 56), (2, 4), (8, 16), (92, 235), (1, 2), (82, 208)]:
        m = iso[(z, a)]['mass_u']; dm = z * MH1 + (a - z) * MN - m
        case(f'CH-K {a}-{z}', 'chnuc', dict(dm=dm, EB=dm * UC2, EBA=dm * UC2 / a), 1e-11, z=z, a=a, m=m)
    for N0, T, t in [(1e20, 3600.0, 7200.0), (5e15, iso[(27, 60)]['half_life_s'], 3.15576e7), (1e10, iso[(6, 14)]['half_life_s'], 1e11)]:
        lam = math.log(2) / T; N = N0 * math.exp(-lam * t)
        case(f'CH-Z {N0:g} {T:g} {t:g}', 'chdecay', dict(N=N, A=lam * N), 1e-11, N0=N0, T=T, t=t)
    for z in (17, 29, 26):
        li = [dict(mass_u=i['mass_u'], abundance=i['abundance']) for i in SNAP['isotopes'] if i['z'] == z and i['abundance']]
        case(f'CH-A Z={z}', 'chmean', dict(mean=sum(x['mass_u'] * x['abundance'] for x in li) / sum(x['abundance'] for x in li)), iso=li)
    for a, b in [('Al', 'O'), ('Fe', 'O'), ('Mg', 'N'), ('Xe', 'F'), ('Ca', 'Cl'), ('Ti', 'O')]:
        ea, eb = EL[a], EL[b]; cat, an = (ea, eb) if ea['electronegativity'] < eb['electronegativity'] else (eb, ea)
        bo = -min(x for x in an['oxidation_states_common'] if x < 0)
        pos = sorted(x for x in set(cat['oxidation_states_common']) if x > 0)
        vals = dict(n=len(pos))
        for k, qq in enumerate(pos):
            L = sp.ilcm(qq, bo); vals[f'x{k}'] = int(L // qq); vals[f'y{k}'] = int(L // bo)
        case(f'CH-V {a}+{b}', 'chcomp', vals, 0, a=a, b=b)
