# Formelkatalog eng-core 0.3.0

Automatisch erzeugt mit `npx tsx scripts/formelkatalog.ts`. Nicht von Hand bearbeiten. Freigaben in `formelstatus.json` eintragen.

Status: **Entwurf** = implementiert und gegengerechnet (verification/pruefung.py), **freigegeben** = vom Verantwortlichen geprüft.

## Biegung

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| B-F-BQ | Größte Durchbiegung | f = q·L⁴ / (384·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2d | Entwurf |
| B-F-E4 | Größte Durchbiegung | f = F·a·(3L² − 4a²) / (24·E·I) | mm | Roark Tab. 8.1 Fall 1e, Superposition | Entwurf |
| B-F-EE | Größte Durchbiegung | f = F·L³ / (48·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 1e | Entwurf |
| B-F-EQ | Größte Durchbiegung | f = 5·q·L⁴ / (384·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2e | Entwurf |
| B-F-KE | Größte Durchbiegung | f = F·L³ / (3·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 1a | Entwurf |
| B-F-KQ | Größte Durchbiegung | f = q·L⁴ / (8·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2a | Entwurf |
| B-M-BQ | Größtes Biegemoment | M_max = q·L²/12 (Einspannung) | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2d | Entwurf |
| B-M-E4 | Größtes Biegemoment | M_max = F·a | N·mm | Roark Tab. 8.1 Fall 1e, Superposition | Entwurf |
| B-M-EE | Größtes Biegemoment | M_max = F·L/4 | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 1e | Entwurf |
| B-M-EQ | Größtes Biegemoment | M_max = q·L²/8 | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2e | Entwurf |
| B-M-KE | Größtes Biegemoment | M_max = F·L | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 1a | Entwurf |
| B-M-KQ | Größtes Biegemoment | M_max = q·L²/2 | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2a | Entwurf |
| B-SIG | Biegespannung | σ_b = M_max / W | MPa |  | Entwurf |
| B-TAUQ | Schubspannung aus Querkraft (Näherung) | τ_Q = κ·Q_max / A | MPa | κ je Querschnitt | Entwurf |

## Bemessen

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| D-BIS | Lösungsverfahren | max. Ausnutzung u(s) = 1, Bisektion im log-Raum | – | deterministisch, feste Schrittzahl | Entwurf |
| D-ERF | Erforderliches Maß D | D_erf = D₀·s | mm |  | Entwurf |
| D-GEW | Gewähltes Maß D | D aufgerundet auf 1 mm | mm | Fertigungsraster | Entwurf |
| D-U | Ausnutzung mit gewählten Maßen | u = max(S_erf / S) | % |  | Entwurf |

## Formfaktoren (Ashby Kap. 7.2)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| F-BE | Formfaktor Biegung, elastisch | φ_B^e = 4π·I / A² | – | Ashby Gl. 7.4 | Entwurf |
| F-BF | Formfaktor Biegung, Versagen | φ_B^f = 4√π·W / A^1,5 | – | Ashby Gl. 7.11 | Entwurf |
| F-TE | Formfaktor Torsion, elastisch | φ_T^e = 2π·Iₜ / A² | – | Ashby Gl. 7.8 | Entwurf |
| F-TF | Formfaktor Torsion, Versagen | φ_T^f = 2√π·Wₜ / A^1,5 | – | Ashby Gl. 7.14 | Entwurf |

## Knicken

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| K-FK | Knicklast | F_k = σ_k·A | N |  | Entwurf |
| K-LAM | Schlankheitsgrad | λ = L_k / i | – |  | Entwurf |
| K-LAMT | Übergangsschlankheit Johnson/Euler | λ_T = π·√(2E / R_p) | – | Johnson-Parabel tangiert Euler bei σ = R_p/2 | Entwurf |
| K-LK | Knicklänge (Eulerfall 1) | L_k = β·L | mm | Eulerfall gewählt | Entwurf |
| K-SKE | Knickspannung (Euler) | σ_k = π²·E / λ² | MPa | Ashby App. A.5 | Entwurf |
| K-SKJ | Knickspannung (unelastisch, Johnson) | σ_k = R_p − R_p²·λ² / (4π²E) | MPa | Johnson-Parabel | Entwurf |

## Nachweise

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| N-FZUL | Zulässige Durchbiegung | f_zul = L / 300 | mm | Vorgabe | Entwurf |
| N-SB | Sicherheit gegen Bruch | S_B = R_m / σ_v | – |  | Entwurf |
| N-SF | Sicherheit gegen Fließen | S_F = R_p / σ_v | – |  | Entwurf |
| N-SK | Sicherheit gegen Knicken | S_K = F_k / \|F_N\| | – |  | Entwurf |
| N-SV | Vergleichsspannung (GEH, Randfaser) | σ_v = √(σ² + 3τ_t²),  σ = \|σ_b\| + \|σ_N\| | MPa | Gestaltänderungsenergiehypothese | Entwurf |

## Querschnitte

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| Q-DH-A | Fläche | A = √3/4·(a² − aᵢ²) | mm² |  | Entwurf |
| Q-DH-ai | Innere Seitenlänge | aᵢ = a − 2√3·t | mm |  | Entwurf |
| Q-DH-I | Flächenträgheitsmoment | I = √3·(a⁴ − aᵢ⁴)/96 | mm⁴ |  | Entwurf |
| Q-DH-K | Torsionsträgheitsmoment (Bredt) | Iₜ = 4·Aₘ²·t / Uₘ,  aₘ = a − √3·t | mm⁴ | 1. Bredtsche Formel | Entwurf |
| Q-DH-W | Widerstandsmoment Biegung (Spitze) | W = I / (a/√3) | mm³ |  | Entwurf |
| Q-DH-WT | Widerstandsmoment Torsion | Wₜ = 2·Aₘ·t | mm³ | 1. Bredtsche Formel | Entwurf |
| Q-DV-A | Fläche | A = √3/4·a² | mm² |  | Entwurf |
| Q-DV-e | Randabstand zur Spitze | e = a/√3 | mm |  | Entwurf |
| Q-DV-I | Flächenträgheitsmoment (Schwerachse) | I = √3·a⁴/96 | mm⁴ | Roark Tab. A.1 | Entwurf |
| Q-DV-K | Torsionsträgheitsmoment | Iₜ = √3·a⁴/80 | mm⁴ | Roark Tab. 10.1 Fall 7 | Entwurf |
| Q-DV-W | Widerstandsmoment Biegung (Spitze) | W = I/e = a³/32 | mm³ |  | Entwurf |
| Q-DV-WT | Widerstandsmoment Torsion | Wₜ = a³/20 | mm³ | Roark Tab. 10.1 Fall 7 | Entwurf |
| Q-i | Trägheitsradius (min.) | i = √(I_min / A) | mm |  | Entwurf |
| Q-m | Masse | m = ρ·A·L | kg |  | Entwurf |
| Q-RE-A | Fläche | A = b·h | mm² |  | Entwurf |
| Q-RE-I | Flächenträgheitsmoment (Biegeachse horizontal) | I = b·h³/12 | mm⁴ | Ashby App. A.2 | Entwurf |
| Q-RE-K | Torsionsträgheitsmoment | Iₜ = a·c³·[16/3 − 3,36·(c/a)·(1 − c⁴/(12a⁴))],  a = max/2, c = min/2 | mm⁴ | Roark Tab. 10.1 Fall 4 | Entwurf |
| Q-RE-W | Widerstandsmoment Biegung | W = b·h²/6 | mm³ |  | Entwurf |
| Q-RE-WT | Widerstandsmoment Torsion | Wₜ = 8·a·c² / (3·[1 + 0,6095r + 0,8865r² − 1,8023r³ + 0,91r⁴]),  r = c/a | mm³ | Roark Tab. 10.1 Fall 4 | Entwurf |
| Q-RH-A | Fläche | A = π·(D² − d²)/4 | mm² | Ashby App. A.2 | Entwurf |
| Q-RH-d | Innendurchmesser | d = D − 2t | mm |  | Entwurf |
| Q-RH-I | Flächenträgheitsmoment | I = π·(D⁴ − d⁴)/64 | mm⁴ | Ashby App. A.2 | Entwurf |
| Q-RH-K | Torsionsträgheitsmoment | Iₜ = π·(D⁴ − d⁴)/32 | mm⁴ | Ashby App. A.6 | Entwurf |
| Q-RH-W | Widerstandsmoment Biegung | W = I / (D/2) | mm³ |  | Entwurf |
| Q-RH-WT | Widerstandsmoment Torsion | Wₜ = Iₜ / (D/2) | mm³ |  | Entwurf |
| Q-RR-A | Fläche | A = b·h − (b − 2t)·(h − 2t) | mm² |  | Entwurf |
| Q-RR-AM | Von der Wandmittellinie umschlossene Fläche | Aₘ = (b − t)·(h − t) | mm² | Bredt | Entwurf |
| Q-RR-I | Flächenträgheitsmoment | I = [b·h³ − (b − 2t)·(h − 2t)³]/12 | mm⁴ |  | Entwurf |
| Q-RR-K | Torsionsträgheitsmoment (dünnwandig) | Iₜ = 4·Aₘ²·t / Uₘ | mm⁴ | 1. Bredtsche Formel | Entwurf |
| Q-RR-W | Widerstandsmoment Biegung | W = I / (h/2) | mm³ |  | Entwurf |
| Q-RR-WT | Widerstandsmoment Torsion | Wₜ = 2·Aₘ·t | mm³ | 1. Bredtsche Formel | Entwurf |
| Q-RV-A | Fläche | A = π·D²/4 | mm² | Ashby App. A.2 | Entwurf |
| Q-RV-I | Flächenträgheitsmoment | I = π·D⁴/64 | mm⁴ | Ashby App. A.2 | Entwurf |
| Q-RV-K | Torsionsträgheitsmoment | Iₜ = Iₚ = π·D⁴/32 | mm⁴ | Ashby App. A.6 | Entwurf |
| Q-RV-W | Widerstandsmoment Biegung | W = I / (D/2) | mm³ |  | Entwurf |
| Q-RV-WT | Widerstandsmoment Torsion | Wₜ = Iₚ / (D/2) | mm³ |  | Entwurf |

## Torsion

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| T-PHI1 | Verdrehwinkel am Ende | φ = T·L / (G·Iₜ) | ° | Ashby App. A.6 | Entwurf |
| T-PHI2 | Verdrehwinkel in Feldmitte | φ = T·L / (4·G·Iₜ) | ° | Ashby App. A.6 | Entwurf |
| T-TA | Einspannmoment je Seite | T_A = T_B = T / 2 | N·mm | Verträglichkeit, gleiche Steifigkeit beider Hälften | Entwurf |
| T-TAU | Torsionsspannung | τ_t = T / Wₜ | MPa | Ashby App. A.6 | Entwurf |

## Werkstoff und Auslegungswerte

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| W-E | E-Modul | E (Werkstoffdatenbank, Standardvariante) | MPa | WDB v0.3 | Entwurf |
| W-G | Schubmodul | G = E / (2·(1 + ν)) | MPa | ν Klassen-Richtwert (Annahme) | Entwurf |
| W-G-DB | Schubmodul | G (Werkstoffdatenbank) | MPa | BIKAR EN AW-6082 | Entwurf |
| W-RHO | Dichte | ρ (Werkstoffdatenbank) | kg/m³ | WDB v0.3 | Entwurf |
| W-RM | Zugfestigkeit (Auslegungswert) | R_m = unterer Wert aus ≥ 310 MPa | MPa | EN 755-2 | Entwurf |
| W-RP | Streckgrenze (Auslegungswert) | R_p = unterer Wert aus ≥ 260 MPa | MPa | EN 755-2 | Entwurf |

## Zug und Druck

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| Z-DL | Längenänderung | ΔL = F_N·L / (E·A) | mm |  | Entwurf |
| Z-DL2 | Längenänderung | ΔL = F·L/(E·A) + q_G·L²/(2·E·A) | mm | Integration σ(x)/E | Entwurf |
| Z-NMAX | Größte Normalkraft (Einspannung) | N_max = F + q_G·L | N |  | Entwurf |
| Z-QG | Eigengewicht je Länge | q_G = ρ·g·A | N/mm |  | Entwurf |
| Z-SIG | Zugspannung | σ_N = F_N / A | MPa |  | Entwurf |
| Z-SIG2 | Zugspannung | σ_N = N_max / A | MPa |  | Entwurf |

## Gültigkeit und Annahmen

- Linear-elastisch, kleine Verformungen, Bernoulli-Balken, statische Last, isotroper Werkstoff.
- Torsion Hohlprofile nach Bredt (t ≪ Abmessung); Rechteck voll nach Roark Tab. 10.1 (Näherung, < 0,2 % gegen Saint-Venant-Reihe).
- Vergleichsspannung GEH an der Randfaser; τ_Q separat (Maximum an der Nulllinie).
- Knicken: Euler für λ ≥ λ_T = π·√(2E/R_p), darunter Johnson-Parabel; keine Imperfektionen, keine Normknickkurven.
- Auslegungswert standardmäßig unterer Wert der Datenbankzeile; Normhöchstwerte liefern keinen Auslegungswert.
- Bemessen: Bisektion im log-Raum, 60 Schritte, Raster 1 mm (Wandstärke 0,5 mm).
