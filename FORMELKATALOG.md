# Formelkatalog eng-core 0.5.1

Automatisch erzeugt mit `npx tsx scripts/formelkatalog.ts`. Nicht von Hand bearbeiten.
Freigaben laufen über die Excel-Datei: `python3 scripts/formelfreigabe.py export` → ausfüllen → `python3 scripts/formelfreigabe.py import <datei.xlsx>`.

Status: **Entwurf** = implementiert und gegengerechnet (verification/pruefung.py), **freigegeben** = vom Verantwortlichen geprüft, **abgelehnt** = Einwand offen (siehe unten), **geändert, neu prüfen** = Formel hat sich seit der Freigabe geändert.

Stand: 154 Formeln, davon 148 freigegeben, 0 abgelehnt, 6 neu zu prüfen, 0 Entwurf.

## Werkstoffauswahl (Ashby Kap. 5 bis 7)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| A-IX-BA-F-K | Materialindex Balken, Festigkeit, Kosten minimieren | M = σ_f^⅔ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-F-M | Materialindex Balken, Festigkeit, Masse minimieren | M = σ_f^⅔ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-F-V | Materialindex Balken, Festigkeit, Bauraum minimieren | M = σ_f^⅔ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-S-K | Materialindex Balken, Steifigkeit, Kosten minimieren | M = E^½ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-S-M | Materialindex Balken, Steifigkeit, Masse minimieren | M = E^½ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-S-V | Materialindex Balken, Steifigkeit, Bauraum minimieren | M = E^½ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-FE-E-K | Materialindex Feder, Energie speichern, Kosten minimieren | M = σ_f² / (E·C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-FE-E-M | Materialindex Feder, Energie speichern, Masse minimieren | M = σ_f² / (E·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-FE-E-V | Materialindex Feder, Energie speichern, Bauraum minimieren | M = σ_f² / E | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-F-K | Materialindex Platte, Festigkeit, Kosten minimieren | M = σ_f^½ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-F-M | Materialindex Platte, Festigkeit, Masse minimieren | M = σ_f^½ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-F-V | Materialindex Platte, Festigkeit, Bauraum minimieren | M = σ_f^½ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-S-K | Materialindex Platte, Steifigkeit, Kosten minimieren | M = E^⅓ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-S-M | Materialindex Platte, Steifigkeit, Masse minimieren | M = E^⅓ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-S-V | Materialindex Platte, Steifigkeit, Bauraum minimieren | M = E^⅓ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ST-K-K | Materialindex Stütze, Knicken, Kosten minimieren | M = E^½ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ST-K-M | Materialindex Stütze, Knicken, Masse minimieren | M = E^½ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ST-K-V | Materialindex Stütze, Knicken, Bauraum minimieren | M = E^½ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-F-K | Materialindex Welle, Festigkeit, Kosten minimieren | M = σ_f^⅔ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-F-M | Materialindex Welle, Festigkeit, Masse minimieren | M = σ_f^⅔ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-F-V | Materialindex Welle, Festigkeit, Bauraum minimieren | M = σ_f^⅔ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-S-K | Materialindex Welle, Steifigkeit, Kosten minimieren | M = E^½ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-S-M | Materialindex Welle, Steifigkeit, Masse minimieren | M = E^½ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-S-V | Materialindex Welle, Steifigkeit, Bauraum minimieren | M = E^½ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-F-K | Materialindex Zugstab, Festigkeit, Kosten minimieren | M = σ_f / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-F-M | Materialindex Zugstab, Festigkeit, Masse minimieren | M = σ_f / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-F-V | Materialindex Zugstab, Festigkeit, Bauraum minimieren | M = σ_f | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-S-K | Materialindex Zugstab, Steifigkeit, Kosten minimieren | M = E / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-S-M | Materialindex Zugstab, Steifigkeit, Masse minimieren | M = E / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-S-V | Materialindex Zugstab, Steifigkeit, Bauraum minimieren | M = E | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-M | Indexwert | M = y^n / x^k | – | Indexwerte nur innerhalb einer Auswahl vergleichbar | freigegeben (2026-10-08, Seti) |
| A-PHI-MAX | Formfaktor, obere Grenze je Werkstoffklasse | φ = φ_max (Tab. 7.3, Zeile nach Werkstoffgruppe, Spalte nach Belastung und Versagensart) | – | Ashby (1999) Tab. 7.3; Mg, Ti, Cu, Zn wie Al-Legierungen; Keramik φ = 1 | freigegeben (2026-10-08, Seti) |
| A-PHI-USER | Formfaktor aus Blatt 1 (gleiches Profil für alle) | φ = Formfaktor des Profils aus Blatt 1 (Belastung und Versagensart wie Index) | – | siehe F-BE, F-BF, F-TE, F-TF | freigegeben (2026-10-08, Seti) |
| A-REL | Relative Güte (Masse, Kosten oder Bauraum bezogen auf Rang 1) | rel = M₁ / M | – |  | freigegeben (2026-10-08, Seti) |
| A-SHIFT-0 | Formwirkung bei Bauraum (k = 0), Ordinate | y* = φ·y | GPa | Ashby (1999) Kap. 7.7 | freigegeben (2026-10-08, Seti) |
| A-SHIFT-X | Strukturierter Werkstoff, Abszisse | x* = x / φ^a mit a = n/(k − n) | kg/m³ | Ashby (1999) Kap. 7.7 | freigegeben (2026-10-08, Seti) |
| A-SHIFT-Y | Strukturierter Werkstoff, Ordinate | y* = y / φ^a mit a = n/(k − n) | GPa | Ashby (1999) Kap. 7.7 | freigegeben (2026-10-08, Seti) |
| A-X-CRHO | Abszisse: Volumenkosten C_m·ρ | C_m·ρ = Preis je kg · Dichte | €/m³ |  | freigegeben (2026-10-08, Seti) |
| A-X-E | Abszisse: E-Modul E | E aus Datenbank | GPa |  | freigegeben (2026-10-08, Seti) |
| A-X-ECRHO | Abszisse: E·C_m·ρ | E·C_m·ρ = E · C_m · ρ | GPa·€/m³ |  | freigegeben (2026-10-08, Seti) |
| A-X-ERHO | Abszisse: E·ρ | E·ρ = E · ρ | GPa·kg/m³ |  | freigegeben (2026-10-08, Seti) |
| A-X-RHO | Abszisse: Dichte ρ | ρ aus Datenbank | kg/m³ |  | freigegeben (2026-10-08, Seti) |
| A-Y-E | E-Modul (Datenbank, repräsentativ) | E aus Datenbank | GPa |  | freigegeben (2026-10-08, Seti) |
| A-Y-SF | Festigkeit für Auswahldiagramme | σ_f = R_p, sonst R_m, sonst σ_bB (repräsentativ) | MPa | Ashby (1999) Kap. 3.3 | freigegeben (2026-10-08, Seti) |

## Biegung

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| B-F-BQ | Größte Durchbiegung | f = q·L⁴ / (384·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2d | freigegeben (2026-10-08, Seti) |
| B-F-E4 | Größte Durchbiegung | f = F·a·(3L² − 4a²) / (24·E·I) | mm | Roark Tab. 8.1 Fall 1e, Superposition | freigegeben (2026-10-08, Seti) |
| B-F-EE | Größte Durchbiegung | f = F·L³ / (48·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 1e | freigegeben (2026-10-08, Seti) |
| B-F-EQ | Größte Durchbiegung | f = 5·q·L⁴ / (384·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2e | freigegeben (2026-10-08, Seti) |
| B-F-KE | Größte Durchbiegung | f = F·L³ / (3·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 1a | freigegeben (2026-10-08, Seti) |
| B-F-KQ | Größte Durchbiegung | f = q·L⁴ / (8·E·I) | mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2a | freigegeben (2026-10-08, Seti) |
| B-LL-B | Lagerkraft rechts | B = Σ F_i + Σ R_q − A | N | Gleichgewicht ΣF_z = 0 | freigegeben (2026-10-12, Seti) |
| B-LL-CA | Einspannmoment links (Schnittmoment an der Einspannung) | M_A = M(0⁻), Vorzeichen wie Momentenlinie (Zugseite unten positiv) | N·mm | Roark Tab. 8.1, gleiche Vorzeichenregel | geändert, neu prüfen |
| B-LL-CB | Einspannmoment rechts (Schnittmoment an der Einspannung) | M_B = M(L⁺), Vorzeichen wie Momentenlinie (Zugseite unten positiv) | N·mm | Roark Tab. 8.1, gleiche Vorzeichenregel | geändert, neu prüfen |
| B-LL-FX | Größte Durchbiegung | f = max \|w(x)\| über alle Lastangriffspunkte, Balkenenden und Nullstellen von φ(x) | mm | Extremwertsuche, Bisektion 80 Schritte | geändert, neu prüfen |
| B-LL-GG | Gleichgewichtskontrolle | r = max(\|A + B − ΣF\| / F_ref, \|ΣM_0 + M_A − M_B − B·L\| / (F_ref·L)),  ΣM_0 = Moment der Lasten um x = 0 im Uhrzeigersinn | – | Kontrolle, Sollwert 0 | geändert, neu prüfen |
| B-LL-M | Biegemoment an der Stelle x_M | M(x) = M_A + A·x − Σ F_i·⟨x − a_i⟩ + Σ M_j·⟨x − b_j⟩⁰ − Σ [q₁·⟨x − x₁⟩²/2 + k·⟨x − x₁⟩³/6 − q₂·⟨x − x₂⟩²/2 − k·⟨x − x₂⟩³/6],  k = (q₂ − q₁)/(x₂ − x₁) | N·mm | Gross/Hauger TM 2, Kap. 4.5 | freigegeben (2026-10-12, Seti) |
| B-LL-MX | Größtes Biegemoment | \|M\|_max über alle Lastangriffspunkte (links und rechts davon), Balkenenden und Nullstellen von Q(x) | N·mm | Extremwertsuche, Bisektion 80 Schritte | geändert, neu prüfen |
| B-LL-QX | Größte Querkraft | \|Q\|_max über alle Lastangriffspunkte (links und rechts davon), Balkenenden und Nullstellen von q(x) | N | Extremwertsuche | geändert, neu prüfen |
| B-LL-R | Lagerkraft links (Randwertproblem) | A, M_A, C₁, C₂ aus 4 Randbedingungen der Lagerung, lineares 4×4-System | N | Gross/Hauger TM 2, Kap. 4.5 und 4.6 | freigegeben (2026-10-12, Seti) |
| B-LL-W | Biegelinie an der Stelle x_f | E·I·w(x) = −∬M dx dx + C₁·x + C₂ | mm | Gross/Hauger TM 2, Kap. 4.5 | freigegeben (2026-10-12, Seti) |
| B-M-BQ | Größtes Biegemoment | M_max = q·L²/12 (Einspannung) | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2d | freigegeben (2026-10-08, Seti) |
| B-M-E4 | Größtes Biegemoment | M_max = F·a | N·mm | Roark Tab. 8.1 Fall 1e, Superposition | freigegeben (2026-10-08, Seti) |
| B-M-EE | Größtes Biegemoment | M_max = F·L/4 | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 1e | freigegeben (2026-10-08, Seti) |
| B-M-EQ | Größtes Biegemoment | M_max = q·L²/8 | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2e | freigegeben (2026-10-08, Seti) |
| B-M-KE | Größtes Biegemoment | M_max = F·L | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 1a | freigegeben (2026-10-08, Seti) |
| B-M-KQ | Größtes Biegemoment | M_max = q·L²/2 | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2a | freigegeben (2026-10-08, Seti) |
| B-SIG | Biegespannung | σ_b = M_max / W | MPa |  | freigegeben (2026-10-08, Seti) |
| B-TAUQ | Schubspannung aus Querkraft (Näherung) | τ_Q = κ·Q_max / A | MPa | κ je Querschnitt | freigegeben (2026-10-08, Seti) |

## Zielkonflikte (Ashby Kap. 9)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| C-A0 | Ausgangsprofil Blatt 1: Fläche | A₀ (siehe Q-…) | mm² |  | freigegeben (2026-10-08, Seti) |
| C-C | Werkstoffkosten | C = m·C_m | € |  | freigegeben (2026-10-08, Seti) |
| C-FZUL | Zulässige Durchbiegung | f_zul = L / n | mm |  | freigegeben (2026-10-08, Seti) |
| C-I0 | Ausgangsprofil Blatt 1: Flächenträgheitsmoment | I₀ (siehe Q-…) | mm⁴ |  | freigegeben (2026-10-08, Seti) |
| C-M | Maßgebende Masse (aktive Randbedingung) | m = max(m_St, m_F) | kg | Ashby (1999) Kap. 9.5, aktive Randbedingung | freigegeben (2026-10-08, Seti) |
| C-MF | Masse aus Festigkeit | m_F = ρ·A₀·s_F²·L | kg |  | freigegeben (2026-10-08, Seti) |
| C-MMAX | Größtes Biegemoment (Lastfall Blatt 1) | M_max nach Lastfall, siehe B-M-… | N·mm | Ashby App. A.3; Roark Tab. 8.1 Fall 2e | freigegeben (2026-10-08, Seti) |
| C-MST | Masse aus Steifigkeit | m_St = ρ·A₀·s_St²·L | kg |  | freigegeben (2026-10-08, Seti) |
| C-SF | Skalierung aus Festigkeit (W ∝ s³) | s_F = (M_max / (σ_zul·W₀))^(1/3) | – | Ashby (1999) Kap. 9.5, aktive Randbedingung | freigegeben (2026-10-08, Seti) |
| C-SST | Skalierung aus Steifigkeit (I ∝ s⁴) | s_St = (w_k / (E·f_zul·I₀))^(1/4) | – | Ashby (1999) Kap. 9.5, aktive Randbedingung | freigegeben (2026-10-08, Seti) |
| C-SZUL | Zulässige Biegespannung (wie Nachweis Blatt 1) | σ_zul = min(R_p / S_F, R_m / S_B) | MPa | unterer Auslegungswert; spröde: σ_bB bzw. R_m | freigegeben (2026-10-08, Seti) |
| C-W0 | Ausgangsprofil Blatt 1: Widerstandsmoment | W₀ (siehe Q-…) | mm³ |  | freigegeben (2026-10-08, Seti) |
| C-WK | Durchbiegungsbeiwert (Durchbiegung mal E·I) | w_k = f·E·I nach Lastfall, siehe B-F-… | N·mm³ | Ashby App. A.3; Roark Tab. 8.1 Fall 2e | freigegeben (2026-10-08, Seti) |
| C-Z | Gesamtwertung | Z = α·m + C | € | Ashby (1999) Kap. 9.6, Austauschkonstante | freigegeben (2026-10-08, Seti) |

## Bemessen

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| D-BIS | Lösungsverfahren | max. Ausnutzung u(s) = 1, Bisektion im log-Raum | – | deterministisch, feste Schrittzahl | freigegeben (2026-10-08, Seti) |
| D-ERF | Erforderliches Maß D | D_erf = D₀·s | mm |  | freigegeben (2026-10-08, Seti) |
| D-GEW | Gewähltes Maß D | D aufgerundet auf 1 mm | mm | Fertigungsraster | freigegeben (2026-10-08, Seti) |
| D-U | Ausnutzung mit gewählten Maßen | u = max(S_erf / S) | % |  | freigegeben (2026-10-08, Seti) |

## Formfaktoren (Ashby Kap. 7.2)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| F-BE | Formfaktor Biegung, elastisch | φ_B^e = 4π·I / A² | – | Ashby Gl. 7.4 | freigegeben (2026-10-08, Seti) |
| F-BF | Formfaktor Biegung, Versagen | φ_B^f = 4√π·W / A^1,5 | – | Ashby Gl. 7.11 | freigegeben (2026-10-08, Seti) |
| F-TE | Formfaktor Torsion, elastisch | φ_T^e = 2π·Iₜ / A² | – | Ashby Gl. 7.8 | freigegeben (2026-10-08, Seti) |
| F-TF | Formfaktor Torsion, Versagen | φ_T^f = 2√π·Wₜ / A^1,5 | – | Ashby Gl. 7.14 | freigegeben (2026-10-08, Seti) |

## Knicken

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| K-FK | Knicklast | F_k = σ_k·A | N |  | freigegeben (2026-10-08, Seti) |
| K-LAM | Schlankheitsgrad | λ = L_k / i | – |  | freigegeben (2026-10-08, Seti) |
| K-LAMT | Übergangsschlankheit Johnson/Euler | λ_T = π·√(2E / R_p) | – | Johnson-Parabel tangiert Euler bei σ = R_p/2 | freigegeben (2026-10-08, Seti) |
| K-LK | Knicklänge | L_k = β·L | mm | Eulerfall gewählt | freigegeben (2026-10-10, S. Frotscher) |
| K-SKE | Knickspannung (Euler) | σ_k = π²·E / λ² | MPa | Ashby App. A.5 | freigegeben (2026-10-08, Seti) |
| K-SKJ | Knickspannung (unelastisch, Johnson) | σ_k = R_p − R_p²·λ² / (4π²E) | MPa | Johnson-Parabel | freigegeben (2026-10-08, Seti) |

## Nachweise

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| N-FZUL | Zulässige Durchbiegung | f_zul = L / 300 | mm | Vorgabe | freigegeben (2026-10-08, Seti) |
| N-SB | Sicherheit gegen Bruch | S_B = R_m / σ_v | – |  | freigegeben (2026-10-08, Seti) |
| N-SF | Sicherheit gegen Fließen | S_F = R_p / σ_v | – |  | freigegeben (2026-10-08, Seti) |
| N-SK | Sicherheit gegen Knicken | S_K = F_k / \|F_N\| | – |  | freigegeben (2026-10-08, Seti) |
| N-SV | Vergleichsspannung (GEH, Randfaser) | σ_v = √(σ² + 3τ_t²),  σ = \|σ_b\| + \|σ_N\| | MPa | Gestaltänderungsenergiehypothese | freigegeben (2026-10-08, Seti) |

## Querschnitte

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| Q-DH-A | Fläche | A = √3/4·(a² − aᵢ²) | mm² |  | freigegeben (2026-10-08, Seti) |
| Q-DH-ai | Innere Seitenlänge | aᵢ = a − 2√3·t | mm |  | freigegeben (2026-10-08, Seti) |
| Q-DH-I | Flächenträgheitsmoment | I = √3·(a⁴ − aᵢ⁴)/96 | mm⁴ |  | freigegeben (2026-10-08, Seti) |
| Q-DH-K | Torsionsträgheitsmoment (Bredt) | Iₜ = 4·Aₘ²·t / Uₘ,  aₘ = a − √3·t | mm⁴ | 1. Bredtsche Formel | freigegeben (2026-10-08, Seti) |
| Q-DH-W | Widerstandsmoment Biegung (Spitze) | W = I / (a/√3) | mm³ |  | freigegeben (2026-10-08, Seti) |
| Q-DH-WT | Widerstandsmoment Torsion | Wₜ = 2·Aₘ·t | mm³ | 1. Bredtsche Formel | freigegeben (2026-10-08, Seti) |
| Q-DV-A | Fläche | A = √3/4·a² | mm² |  | freigegeben (2026-10-08, Seti) |
| Q-DV-e | Randabstand zur Spitze | e = a/√3 | mm |  | freigegeben (2026-10-08, Seti) |
| Q-DV-I | Flächenträgheitsmoment (Schwerachse) | I = √3·a⁴/96 | mm⁴ | Roark Tab. A.1 | freigegeben (2026-10-08, Seti) |
| Q-DV-K | Torsionsträgheitsmoment | Iₜ = √3·a⁴/80 | mm⁴ | Roark Tab. 10.1 Fall 7 | freigegeben (2026-10-08, Seti) |
| Q-DV-W | Widerstandsmoment Biegung (Spitze) | W = I/e = a³/32 | mm³ |  | freigegeben (2026-10-08, Seti) |
| Q-DV-WT | Widerstandsmoment Torsion | Wₜ = a³/20 | mm³ | Roark Tab. 10.1 Fall 7 | freigegeben (2026-10-08, Seti) |
| Q-i | Trägheitsradius (min.) | i = √(I_min / A) | mm |  | freigegeben (2026-10-08, Seti) |
| Q-m | Masse | m = ρ·A·L | kg |  | freigegeben (2026-10-08, Seti) |
| Q-RE-A | Fläche | A = b·h | mm² |  | freigegeben (2026-10-08, Seti) |
| Q-RE-I | Flächenträgheitsmoment (Biegeachse horizontal) | I = b·h³/12 | mm⁴ | Ashby App. A.2 | freigegeben (2026-10-08, Seti) |
| Q-RE-K | Torsionsträgheitsmoment | Iₜ = a·c³·[16/3 − 3,36·(c/a)·(1 − c⁴/(12a⁴))],  a = max/2, c = min/2 | mm⁴ | Roark Tab. 10.1 Fall 4 | freigegeben (2026-10-08, Seti) |
| Q-RE-W | Widerstandsmoment Biegung | W = b·h²/6 | mm³ |  | freigegeben (2026-10-08, Seti) |
| Q-RE-WT | Widerstandsmoment Torsion | Wₜ = 8·a·c² / (3·[1 + 0,6095r + 0,8865r² − 1,8023r³ + 0,91r⁴]),  r = c/a | mm³ | Roark Tab. 10.1 Fall 4 | freigegeben (2026-10-08, Seti) |
| Q-RH-A | Fläche | A = π·(D² − d²)/4 | mm² | Ashby App. A.2 | freigegeben (2026-10-08, Seti) |
| Q-RH-d | Innendurchmesser | d = D − 2t | mm |  | freigegeben (2026-10-08, Seti) |
| Q-RH-I | Flächenträgheitsmoment | I = π·(D⁴ − d⁴)/64 | mm⁴ | Ashby App. A.2 | freigegeben (2026-10-08, Seti) |
| Q-RH-K | Torsionsträgheitsmoment | Iₜ = π·(D⁴ − d⁴)/32 | mm⁴ | Ashby App. A.6 | freigegeben (2026-10-08, Seti) |
| Q-RH-W | Widerstandsmoment Biegung | W = I / (D/2) | mm³ |  | freigegeben (2026-10-08, Seti) |
| Q-RH-WT | Widerstandsmoment Torsion | Wₜ = Iₜ / (D/2) | mm³ |  | freigegeben (2026-10-08, Seti) |
| Q-RR-A | Fläche | A = b·h − (b − 2t)·(h − 2t) | mm² |  | freigegeben (2026-10-08, Seti) |
| Q-RR-AM | Von der Wandmittellinie umschlossene Fläche | Aₘ = (b − t)·(h − t) | mm² | Bredt | freigegeben (2026-10-08, Seti) |
| Q-RR-I | Flächenträgheitsmoment | I = [b·h³ − (b − 2t)·(h − 2t)³]/12 | mm⁴ |  | freigegeben (2026-10-08, Seti) |
| Q-RR-K | Torsionsträgheitsmoment (dünnwandig) | Iₜ = 4·Aₘ²·t / Uₘ | mm⁴ | 1. Bredtsche Formel | freigegeben (2026-10-08, Seti) |
| Q-RR-W | Widerstandsmoment Biegung | W = I / (h/2) | mm³ |  | freigegeben (2026-10-08, Seti) |
| Q-RR-WT | Widerstandsmoment Torsion | Wₜ = 2·Aₘ·t | mm³ | 1. Bredtsche Formel | freigegeben (2026-10-08, Seti) |
| Q-RV-A | Fläche | A = π·D²/4 | mm² | Ashby App. A.2 | freigegeben (2026-10-08, Seti) |
| Q-RV-I | Flächenträgheitsmoment | I = π·D⁴/64 | mm⁴ | Ashby App. A.2 | freigegeben (2026-10-08, Seti) |
| Q-RV-K | Torsionsträgheitsmoment | Iₜ = Iₚ = π·D⁴/32 | mm⁴ | Ashby App. A.6 | freigegeben (2026-10-08, Seti) |
| Q-RV-W | Widerstandsmoment Biegung | W = I / (D/2) | mm³ |  | freigegeben (2026-10-08, Seti) |
| Q-RV-WT | Widerstandsmoment Torsion | Wₜ = Iₚ / (D/2) | mm³ |  | freigegeben (2026-10-08, Seti) |

## Torsion

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| T-PHI1 | Verdrehwinkel am freien Ende | φ_Ende = M_t·L / (G·Iₜ) | ° | Ashby App. A.6 | freigegeben (2026-10-10, S. Frotscher) |
| T-PHI2 | Verdrehwinkel in Feldmitte | φ_Mitte = M_t,A·(L/2) / (G·Iₜ) = M_t·L / (4·G·Iₜ) | ° | Ashby App. A.6 | freigegeben (2026-10-10, S. Frotscher) |
| T-TA | Einspannmoment je Seite | M_t,A = M_t,B = M_t / 2 | N·mm | Verträglichkeit, gleiche Steifigkeit beider Hälften | freigegeben (2026-10-10, S. Frotscher) |
| T-TAU | Torsionsspannung | τ_t = M_t,max / Wₜ  (einseitig M_t, beidseitig M_t,A) | MPa | Ashby App. A.6 | freigegeben (2026-10-10, S. Frotscher) |

## Werkstoff und Auslegungswerte

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| W-BB | Biegefestigkeit (Auslegungswert) | σ_bB = Auslegungswert aus der Datenbankzeile des Werkstoffs (Standard: unterer Wert) | MPa | dataholz Bauholz | freigegeben (2026-10-10, S. Frotscher) |
| W-E | E-Modul | E (Werkstoffdatenbank, Standardvariante) | MPa | WDB 1.0.1 | freigegeben (2026-10-08, Seti) |
| W-G | Schubmodul | G = E / (2·(1 + ν)) | MPa | ν Klassen-Richtwert (Annahme) | freigegeben (2026-10-08, Seti) |
| W-G-DB | Schubmodul | G (Werkstoffdatenbank) | MPa | BIKAR EN AW-6082 | freigegeben (2026-10-08, Seti) |
| W-RHO | Dichte | ρ (Werkstoffdatenbank) | kg/m³ | WDB 1.0.1 | freigegeben (2026-10-08, Seti) |
| W-RM | Zugfestigkeit (Auslegungswert) | R_m = Auslegungswert aus der Datenbankzeile des Werkstoffs (Standard: unterer Wert) | MPa | EN 755-2 | freigegeben (2026-10-10, S. Frotscher) |
| W-RP | Streckgrenze (Auslegungswert) | R_p = Auslegungswert aus der Datenbankzeile des Werkstoffs (Standard: unterer Wert) | MPa | EN 755-2 | freigegeben (2026-10-10, S. Frotscher) |

## Zug und Druck

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| Z-DL | Längenänderung | ΔL = F_N·L / (E·A) | mm |  | freigegeben (2026-10-08, Seti) |
| Z-DL2 | Längenänderung mit Eigengewicht | ΔL = ΔL_F + ΔL_G = F·L/(E·A) + q_G·L²/(2·E·A) | mm | Integration σ(x)/E | freigegeben (2026-10-10, S. Frotscher) |
| Z-NMAX | Größte Normalkraft (Einspannung) | N_max = F + q_G·L | N |  | freigegeben (2026-10-08, Seti) |
| Z-QG | Eigengewicht je Länge | q_G = ρ·g·A | N/mm |  | freigegeben (2026-10-08, Seti) |
| Z-SIG | Zugspannung | σ_N = F_N / A | MPa |  | freigegeben (2026-10-08, Seti) |
| Z-SIG2 | Größte Zugspannung mit Eigengewicht (Einspannung) | σ_N,max = N_max / A | MPa |  | freigegeben (2026-10-10, S. Frotscher) |

## Einwände und Verbesserungen

| ID | Status | Datum | Prüfer | Kommentar | Antwort |
|---|---|---|---|---|---|
| B-LL-CA | geändert, neu prüfen | 2026-10-12 | Seti | Die Plausibilität hängt hier vollständig von der im Programm verwendeten Schnittgrößen- und Vorzeichenkonvention ab. Das negative Vorzeichen bei MB​=−M(L+) deutet darauf hin, dass das äußere Einspannmoment dem inneren Schnittmoment am Rand entgegengesetzt definiert ist. Solange dies intern im Algorithmus konsequent so durchgezogen wird, ist es in Ordnung. | Umgesetzt (nach Freigabe 12.10.2026): Einspannmomente einheitlich als Schnittmomente an der Einspannstelle mit dem Vorzeichen der Momentenlinie (Zugseite unten positiv), M_A = M(0⁻), M_B = M(L⁺). Beispiel F 3 kN bei 400 mm, beidseitig eingespannt: M_A = −533,3 N·m, M_B = −266,7 N·m, beide negativ wie Roark Tab. 8.1 Fall 1d. Der frühere Ausweis von M_B als Reaktionsmoment im Uhrzeigersinn (+266,7 N·m) ist entfallen, Skizze und Kennwerte zeigen dieselben Werte. Test „Vorzeichen“ in test/loadlist.test.ts. Formeltext geändert, bitte neu prüfen. |
| B-LL-CB | geändert, neu prüfen | 2026-10-12 | Seti | Die Plausibilität hängt hier vollständig von der im Programm verwendeten Schnittgrößen- und Vorzeichenkonvention ab. Das negative Vorzeichen bei MB​=−M(L+) deutet darauf hin, dass das äußere Einspannmoment dem inneren Schnittmoment am Rand entgegengesetzt definiert ist. Solange dies intern im Algorithmus konsequent so durchgezogen wird, ist es in Ordnung. | Wie B-LL-CA: M_B = M(L⁺) jetzt mit dem Vorzeichen der Momentenlinie, kein Minuszeichen mehr in der Definition. Bitte neu prüfen. |
| B-LL-QX | geändert, neu prüfen | 2026-10-12 | Seti | Ergänzen Sie die Bedingung für \|Q\|_max unbedingt um die Angriffspunkte von Einzellasten bzw. definieren Sie die Segmentgrenzen so feingranular, dass jede Einzellast auf einer Segmentgrenze liegt | Umgesetzt: jede Einzellast, jedes Einzelmoment sowie Anfang und Ende jeder Streckenlast ist eine Segmentgrenze, Q wird an jeder Grenze links und rechts ausgewertet. Formeltext präzisiert (ebenso B-LL-MX, B-LL-FX), neuer Test „Querkraft-Extremwert am Angriffspunkt einer Einzellast“. Bitte neu prüfen. |

## Gültigkeit und Annahmen

- Linear-elastisch, kleine Verformungen, Bernoulli-Balken, statische Last, isotroper Werkstoff.
- Torsion Hohlprofile nach Bredt (t ≪ Abmessung); Rechteck voll nach Roark Tab. 10.1 (Näherung, < 0,2 % gegen Saint-Venant-Reihe).
- Vergleichsspannung GEH an der Randfaser; τ_Q separat (Maximum an der Nulllinie).
- Knicken: Euler für λ ≥ λ_T = π·√(2E/R_p), darunter Johnson-Parabel; keine Imperfektionen, keine Normknickkurven.
- Auslegungswert standardmäßig unterer Wert der Datenbankzeile; Normhöchstwerte liefern keinen Auslegungswert.
- Bemessen: Bisektion im log-Raum, 60 Schritte, Raster 1 mm (Wandstärke 0,5 mm).
