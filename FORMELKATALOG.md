# Formelkatalog eng-core 0.11.0

Automatisch erzeugt mit `npx tsx scripts/formelkatalog.ts`. Nicht von Hand bearbeiten.
Freigaben laufen über die Excel-Datei: `python3 scripts/formelfreigabe.py export` → ausfüllen → `python3 scripts/formelfreigabe.py import <datei.xlsx>`.

Status: **Entwurf** = implementiert und gegengerechnet (verification/pruefung.py), **freigegeben** = vom Verantwortlichen geprüft, **abgelehnt** = Einwand offen (siehe unten), **geändert, neu prüfen** = Formel hat sich seit der Freigabe geändert.

Stand: 393 Formeln, davon 393 freigegeben, 0 abgelehnt, 0 neu zu prüfen, 0 Entwurf.

| Modul | Werkzeug | Präfixe | Formeln | freigegeben |
|---|---|---|---|---|
| gemeinsam | werkbank | Q, F, W | 96 | 96 |
| festigkeit | werkbank | B, Z, K, T, N, D, P, V, E | 165 | 165 |
| ashby | werkbank | A, C | 90 | 90 |
| fluid | fachtools | RH, PU, FS | 42 | 42 |
| verbindungen | fachtools | SV, PV | 0 | 0 |
| dichtungen | fachtools | OR | 0 | 0 |
| stabwerke | fachtools | FW | 0 | 0 |

## Werkstoffauswahl (Ashby Kap. 5 bis 7)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| A-GR-X | Achsgruppe Abszisse | Achsgruppe = Π p_i^e_i (Kennwerte der Achse, Exponent meist 1) | €/kg·kg/m³ |  | freigegeben (2026-10-21, Seti) |
| A-GR-Y | Achsgruppe Ordinate | Achsgruppe = Π p_i^e_i (Kennwerte der Achse, Exponent meist 1) | W/(m·K)·MPa² |  | freigegeben (2026-10-21, Seti) |
| A-IX-BA-F-K | Materialindex Balken, Festigkeit, Kosten minimieren | M = σ_f^⅔ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-F-M | Materialindex Balken, Festigkeit, Masse minimieren | M = σ_f^⅔ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-F-V | Materialindex Balken, Festigkeit, Bauraum minimieren | M = σ_f^⅔ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-S-K | Materialindex Balken, Steifigkeit, Kosten minimieren | M = E^½ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-S-M | Materialindex Balken, Steifigkeit, Masse minimieren | M = E^½ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BA-S-V | Materialindex Balken, Steifigkeit, Bauraum minimieren | M = E^½ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-BAB-F-K | Materialindex Balken nur Breite frei, Festigkeit, Kosten minimieren | M = σ_f / (C_m·ρ) | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAB-F-M | Materialindex Balken nur Breite frei, Festigkeit, Masse minimieren | M = σ_f / ρ | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAB-F-V | Materialindex Balken nur Breite frei, Festigkeit, Bauraum minimieren | M = σ_f | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAB-S-K | Materialindex Balken nur Breite frei, Steifigkeit, Kosten minimieren | M = E / (C_m·ρ) | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAB-S-M | Materialindex Balken nur Breite frei, Steifigkeit, Masse minimieren | M = E / ρ | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAB-S-V | Materialindex Balken nur Breite frei, Steifigkeit, Bauraum minimieren | M = E | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAH-F-K | Materialindex Balken nur Höhe frei, Festigkeit, Kosten minimieren | M = σ_f^½ / (C_m·ρ) | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAH-F-M | Materialindex Balken nur Höhe frei, Festigkeit, Masse minimieren | M = σ_f^½ / ρ | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAH-F-V | Materialindex Balken nur Höhe frei, Festigkeit, Bauraum minimieren | M = σ_f^½ | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAH-S-K | Materialindex Balken nur Höhe frei, Steifigkeit, Kosten minimieren | M = E^⅓ / (C_m·ρ) | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAH-S-M | Materialindex Balken nur Höhe frei, Steifigkeit, Masse minimieren | M = E^⅓ / ρ | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-BAH-S-V | Materialindex Balken nur Höhe frei, Steifigkeit, Bauraum minimieren | M = E^⅓ | Steigung | Ashby (1999) Gl. 5.12, 5.13; Anhang B, Tab. B1 und B2 | freigegeben (2026-10-21, Seti) |
| A-IX-DB-L-L | Materialindex Druckbehälter, Leck vor Bruch | M = K_IC² / σ_f | Steigung | Ashby (1999) Fallstudie 6.15, S. 134 (M₂); Anhang B, Tab. B5, S. 411 | freigegeben (2026-10-21, Seti) |
| A-IX-DB-Y-L | Materialindex Druckbehälter, Fließen vor Bruch | M = K_IC / σ_f | Steigung | Ashby (1999) Fallstudie 6.15, S. 134; Anhang B, Tab. B5, S. 411 | freigegeben (2026-10-21, Seti) |
| A-IX-FE-E-K | Materialindex Feder, Energie speichern, Kosten minimieren | M = σ_f² / (E·C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-FE-E-M | Materialindex Feder, Energie speichern, Masse minimieren | M = σ_f² / (E·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-FE-E-V | Materialindex Feder, Energie speichern, Bauraum minimieren | M = σ_f² / E | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-GE-F-L | Materialindex Gelenk, Biegung ohne Versagen, Biegeradius minimieren | M = σ_f / E | Steigung | Ashby (1999) Fallstudie 6.10, S. 117; Anhang B, Tab. B3 | freigegeben (2026-10-21, Seti) |
| A-IX-PL-F-K | Materialindex Platte, Festigkeit, Kosten minimieren | M = σ_f^½ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-F-M | Materialindex Platte, Festigkeit, Masse minimieren | M = σ_f^½ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-F-V | Materialindex Platte, Festigkeit, Bauraum minimieren | M = σ_f^½ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-S-K | Materialindex Platte, Steifigkeit, Kosten minimieren | M = E^⅓ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-S-M | Materialindex Platte, Steifigkeit, Masse minimieren | M = E^⅓ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PL-S-V | Materialindex Platte, Steifigkeit, Bauraum minimieren | M = E^⅓ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-PT-V-L | Materialindex Präzisionsteil, thermische Verzerrung minimal | M = λ / α | Steigung | Ashby (1999) Anhang B, Tab. B6, S. 411; Fallstudie 6.20, S. 152 | freigegeben (2026-10-21, Seti) |
| A-IX-ST-K-K | Materialindex Stütze, Knicken, Kosten minimieren | M = E^½ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ST-K-M | Materialindex Stütze, Knicken, Masse minimieren | M = E^½ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ST-K-V | Materialindex Stütze, Knicken, Bauraum minimieren | M = E^½ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-TS-T-L | Materialindex Thermoschock, größter Temperatursprung ohne Bruch | M = σ_f / (E·α) | Steigung | Ashby (1999) Anhang B, Tab. B6, S. 411 | freigegeben (2026-10-21, Seti) |
| A-IX-WD-Q-D | Materialindex Wärmedämmung, Wärmestrom minimal, Dicke fest | M = 1 / λ | Steigung | Ashby (1999) Anhang B, Tab. B6, S. 411 | freigegeben (2026-10-21, Seti) |
| A-IX-WD-Q-K | Materialindex Wärmedämmung, billig, Wärmestrom vorgegeben | M = 1 / (λ·C_m·ρ) | Steigung | Ashby (1999) Tab. 5.7, S. 78 | freigegeben (2026-10-21, Seti) |
| A-IX-WD-Z-E | Materialindex Wärmedämmung, Ofenwand: Energie im Zyklus minimal | M = 1 / (λ·ρ·c_p)^½ | Steigung | Ashby (1999) Anhang B, Tab. B6, S. 411; Fallstudie 6.18 | freigegeben (2026-10-21, Seti) |
| A-IX-WE-F-K | Materialindex Welle, Festigkeit, Kosten minimieren | M = σ_f^⅔ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-F-M | Materialindex Welle, Festigkeit, Masse minimieren | M = σ_f^⅔ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-F-V | Materialindex Welle, Festigkeit, Bauraum minimieren | M = σ_f^⅔ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-S-K | Materialindex Welle, Steifigkeit, Kosten minimieren | M = E^½ / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-S-M | Materialindex Welle, Steifigkeit, Masse minimieren | M = E^½ / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WE-S-V | Materialindex Welle, Steifigkeit, Bauraum minimieren | M = E^½ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-WS-E-K | Materialindex Wärmespeicher, Energie je Werkstoffkosten | M = c_p / C_m | Steigung | Ashby (1999) Anhang B, Tab. B6, S. 411 | freigegeben (2026-10-21, Seti) |
| A-IX-WT-P-A | Materialindex Wärmetauscherwand, Wärmestrom je Fläche, Druck Δp | M = λ·σ_f | Steigung | Ashby (1999) Anhang B, Tab. B6, S. 411 | freigegeben (2026-10-21, Seti) |
| A-IX-WT-P-M | Materialindex Wärmetauscherwand, Wärmestrom je Masse, Druck Δp | M = λ·σ_f² / ρ | Steigung | Eigene Herleitung wie Tab. B6 Zeile 1 (Ashby nennt λ·σ_f / ρ ohne Herleitung; mit t ∝ 1/σ_f folgt σ_f²) | freigegeben (2026-10-21, Seti) |
| A-IX-ZS-F-K | Materialindex Zugstab, Festigkeit, Kosten minimieren | M = σ_f / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-F-M | Materialindex Zugstab, Festigkeit, Masse minimieren | M = σ_f / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-F-V | Materialindex Zugstab, Festigkeit, Bauraum minimieren | M = σ_f | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-S-K | Materialindex Zugstab, Steifigkeit, Kosten minimieren | M = E / (C_m·ρ) | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-S-M | Materialindex Zugstab, Steifigkeit, Masse minimieren | M = E / ρ | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-IX-ZS-S-V | Materialindex Zugstab, Steifigkeit, Bauraum minimieren | M = E | Steigung | Ashby (1999) Kap. 5 bis 6, Herleitung über Zielfunktion und Randbedingung | freigegeben (2026-10-08, Seti) |
| A-K-ALPHA | Wärmeausdehnungskoeffizient (Datenbank, repräsentativ) | α aus Datenbank | 10⁻⁶/K |  | freigegeben (2026-10-21, Seti) |
| A-K-CM | Preis je kg (Datenbank, Richtwert) | C_m aus Datenbank | €/kg |  | freigegeben (2026-10-21, Seti) |
| A-K-CP | Spezifische Wärmekapazität (Datenbank, repräsentativ) | c_p aus Datenbank | J/(kg·K) |  | freigegeben (2026-10-21, Seti) |
| A-K-KIC | Bruchzähigkeit (Datenbank, repräsentativ) | K_IC aus Datenbank | MPa·m^0,5 |  | freigegeben (2026-10-21, Seti) |
| A-K-LAM | Wärmeleitfähigkeit (Datenbank, repräsentativ) | λ aus Datenbank | W/(m·K) |  | freigegeben (2026-10-21, Seti) |
| A-K-RHO | Dichte (Datenbank, repräsentativ) | ρ aus Datenbank | kg/m³ |  | freigegeben (2026-10-21, Seti) |
| A-M | Indexwert | M = y^n / x^k | – | Indexwerte nur innerhalb einer Auswahl vergleichbar | freigegeben (2026-10-08, Seti) |
| A-MP | Indexwert (Produkt von Potenzen) | M = Y^a · X^b (Y, X Achsgruppen) | – | Indexwerte nur innerhalb einer Auswahl vergleichbar | freigegeben (2026-10-21, Seti) |
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
| B-LL-CA | Einspannmoment links (Schnittmoment an der Einspannung) | M_A = M(0⁻), Vorzeichen wie Momentenlinie (Zugseite unten positiv) | N·mm | Roark Tab. 8.1, gleiche Vorzeichenregel | freigegeben (2026-10-12, Seti) |
| B-LL-CB | Einspannmoment rechts (Schnittmoment an der Einspannung) | M_B = M(L⁺), Vorzeichen wie Momentenlinie (Zugseite unten positiv) | N·mm | Roark Tab. 8.1, gleiche Vorzeichenregel | freigegeben (2026-10-12, Seti) |
| B-LL-FX | Größte Durchbiegung | f = max \|w(x)\| über alle Lastangriffspunkte, Balkenenden und Nullstellen von φ(x) | mm | Extremwertsuche, Bisektion 80 Schritte | freigegeben (2026-10-12, Seti) |
| B-LL-GG | Gleichgewichtskontrolle | r = max(\|A + B − ΣF\| / F_ref, \|ΣM_0 + M_A − M_B − B·L\| / (F_ref·L)),  ΣM_0 = Moment der Lasten um x = 0 im Uhrzeigersinn | – | Kontrolle, Sollwert 0 | freigegeben (2026-10-12, Seti) |
| B-LL-M | Biegemoment an der Stelle x_M | M(x) = M_A + A·x − Σ F_i·⟨x − a_i⟩ + Σ M_j·⟨x − b_j⟩⁰ − Σ [q₁·⟨x − x₁⟩²/2 + k·⟨x − x₁⟩³/6 − q₂·⟨x − x₂⟩²/2 − k·⟨x − x₂⟩³/6],  k = (q₂ − q₁)/(x₂ − x₁) | N·mm | Gross/Hauger TM 2, Kap. 4.5 | freigegeben (2026-10-12, Seti) |
| B-LL-MX | Größtes Biegemoment | \|M\|_max über alle Lastangriffspunkte (links und rechts davon), Balkenenden und Nullstellen von Q(x) | N·mm | Extremwertsuche, Bisektion 80 Schritte | freigegeben (2026-10-12, Seti) |
| B-LL-QX | Größte Querkraft | \|Q\|_max über alle Lastangriffspunkte (links und rechts davon), Balkenenden und Nullstellen von q(x) | N | Extremwertsuche | freigegeben (2026-10-12, Seti) |
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

## Kerbwirkung und Ermüdung (Roloff/Matek Kap. 3, FKM)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| E-AK-AB | Formzahl, Biegung | α_k = 1 + 1/√(0,62·r/t + 2·5,8·(r/d)·(1 + 2r/d)² + 0,2·(r/t)^3·d/D)  (Absatz, Biegung) | – | Roloff/Matek 27 TB 3-6d, f | freigegeben (2026-10-26, Seti) |
| E-AK-AT | Formzahl, Torsion | α_k = 1 + 1/√(3,4·r/t + 2·19·(r/d)·(1 + 2r/d)² + 1·(r/t)^2·d/D)  (Absatz, Torsion) | – | Roloff/Matek 27 TB 3-6d, f | freigegeben (2026-10-26, Seti) |
| E-AK-AZ | Formzahl, Zug/Druck | α_k = 1 + 1/√(0,62·r/t + 2·3,5·(r/d)·(1 + 2r/d)²)  (Absatz, Zug/Druck) | – | Roloff/Matek 27 TB 3-6d, f | freigegeben (2026-10-26, Seti) |
| E-AK-M | Formzahl (manuell), Biegung | α_k manuell (Quelle angeben) | – | Eingabe | freigegeben (2026-10-26, Seti) |
| E-AK-NB | Formzahl, Biegung | α_k = 1 + 1/√(0,2·r/t + 2·2,75·(r/d)·(1 + 2r/d)²)  (Umlaufnut, Biegung) | – | Roloff/Matek 27 TB 3-6c | freigegeben (2026-10-26, Seti) |
| E-AK-NT | Formzahl, Torsion | α_k = 1 + 1/√(0,7·r/t + 2·10,3·(r/d)·(1 + 2r/d)²)  (Umlaufnut, Torsion) | – | Roloff/Matek 27 TB 3-6c | freigegeben (2026-10-26, Seti) |
| E-AK-NZ | Formzahl, Zug/Druck | α_k = 1 + 1/√(0,22·r/t + 2·1,37·(r/d)·(1 + 2r/d)²)  (Umlaufnut, Zug/Druck) | – | Roloff/Matek 27 TB 3-6c | freigegeben (2026-10-26, Seti) |
| E-AK-QB | Formzahl, Biegung | α_k = 3 + 1,4·(d_B/d) − 2,8·√(d_B/d)  (Querbohrung, Biegung) | – | Roloff/Matek 27 TB 3-6e | freigegeben (2026-10-26, Seti) |
| E-AK-QT | Formzahl, Torsion | α_k = 2,023 − 1,125·√(d_B/d)  (Querbohrung, Torsion) | – | Roloff/Matek 27 TB 3-6e | freigegeben (2026-10-26, Seti) |
| E-AK-QZ | Formzahl, Zug/Druck | α_k = 3 − d_B/d  (Querbohrung, Zug/Druck) | – | Roloff/Matek 27 TB 3-6e | freigegeben (2026-10-26, Seti) |
| E-AM | Ausschlag und Mittelspannung, Biegung | σ_a = \|σ_n\|·(1 − R)/2,  σ_m = \|σ_n\|·(1 + R)/2  (Oberlast aus Blatt 1, Mittelspannung als Betrag) | MPa | Roloff/Matek 27 Abschn. 3.2 | freigegeben (2026-10-26, Seti) |
| E-BETA | Kerbwirkungszahl, Biegung | β_k = α_k / n | – | Roloff/Matek 27 Gl. 3.30 | freigegeben (2026-10-26, Seti) |
| E-BETA-M | Kerbwirkungszahl (manuell), Torsion | β_k manuell (z. B. Passfeder Roloff TB 3-9) | – | Eingabe | freigegeben (2026-10-26, Seti) |
| E-DEFF | Maßgebender Durchmesser für den technologischen Größeneinfluss | d_eff nach Querschnittsform und Werkstoffart (Roloff TB 3-10c) | mm | Roloff/Matek 27 TB 3-10c | freigegeben (2026-10-26, Seti) |
| E-GA-F | Begrenzung durch Fließen, Zug/Druck | σ_GA ≤ R_p − σ_m (Schub: f_τ·R_p − τ_m; spröde: R_m) | MPa | Roloff/Matek 27 Hinweis zu Gl. 3.65 | freigegeben (2026-10-26, Seti) |
| E-GA1 | Gestaltausschlagfestigkeit, Biegung | σ_GA = σ_GW − ψ·σ_mv  (Überlastungsfall 1, σ_m konstant) | MPa | Roloff/Matek 27 Gl. 3.61 bis 3.66 | freigegeben (2026-10-26, Seti) |
| E-GA2 | Gestaltausschlagfestigkeit, Biegung | σ_GA = σ_GW / (1 + ψ·σ_mv/σ_a)  (Überlastungsfall 2, κ konstant) | MPa | Roloff/Matek 27 Gl. 3.61 bis 3.66 | freigegeben (2026-10-26, Seti) |
| E-GA3 | Gestaltausschlagfestigkeit, Biegung | σ_GA = (σ_GW − ψ·σ_u) / (1 + ψ)  mit  σ_u = σ_mv − σ_a  (Überlastungsfall 3, Unterspannung σ_u konstant) | MPa | Roloff/Matek 27 Gl. 3.61 bis 3.66 | freigegeben (2026-10-26, Seti) |
| E-GS-AT | Bezogenes Spannungsgefälle, Torsion | G′ = 1,15/r  (Absatz, Torsion) | 1/mm | Roloff/Matek 27 TB 3-7a | freigegeben (2026-10-26, Seti) |
| E-GS-AZB | Bezogenes Spannungsgefälle, Biegung | G′ = 2,3·(1 + φ)/r  (Absatz, Zug/Druck und Biegung) | 1/mm | Roloff/Matek 27 TB 3-7a | freigegeben (2026-10-26, Seti) |
| E-GS-M | Bezogenes Spannungsgefälle (manuell), Biegung | G′ manuell | 1/mm | Eingabe | freigegeben (2026-10-26, Seti) |
| E-GS-NT | Bezogenes Spannungsgefälle, Torsion | G′ = 1/r  (Umlaufnut, Torsion) | 1/mm | Roloff/Matek 27 TB 3-7a | freigegeben (2026-10-26, Seti) |
| E-GS-NZB | Bezogenes Spannungsgefälle, Zug/Druck | G′ = 2·(1 + φ)/r  (Umlaufnut, Zug/Druck und Biegung) | 1/mm | Roloff/Matek 27 TB 3-7a | freigegeben (2026-10-26, Seti) |
| E-GS-QB | Bezogenes Spannungsgefälle, Biegung | G′ = 2,3/r + 2/d  (Querbohrung) | 1/mm | Roloff/Matek 27 TB 3-7a | freigegeben (2026-10-26, Seti) |
| E-GS-QT | Bezogenes Spannungsgefälle, Torsion | G′ = 1,15/r + 2/d  (Querbohrung) | 1/mm | Roloff/Matek 27 TB 3-7a | freigegeben (2026-10-26, Seti) |
| E-GS-QZ | Bezogenes Spannungsgefälle, Zug/Druck | G′ = 2,3/r  (Querbohrung) | 1/mm | Roloff/Matek 27 TB 3-7a | freigegeben (2026-10-26, Seti) |
| E-GW | Gestaltwechselfestigkeit, Biegung | σ_GW = σ_W / K_D | MPa | Roloff/Matek 27 Gl. 3.53, 3.54 | freigegeben (2026-10-26, Seti) |
| E-KD | Konstruktionsfaktor, Biegung | K_D = (β_k/K_g + 1/K_R − 1)/K_V,  K_V = 1 | – | Roloff/Matek 27 Gl. 3.45 bis 3.48 | freigegeben (2026-10-26, Seti) |
| E-KG | Geometrischer Größeneinfluss (Biegung, Torsion) | K_g = 1 − 0,2·lg(d/7,5 mm)/lg 20 für 7,5 ≤ d < 150 mm; 0,8 ab 150 mm; 1 unter 7,5 mm; Zug/Druck K_g = 1 | – | Roloff/Matek 27 TB 3-10d | freigegeben (2026-10-26, Seti) |
| E-KR | Einfluss der Oberflächenrauheit (Normalspannung) | K_R,σ = 1 − a_R·lg(R_z/µm)·lg(2·R_m/R_m,N,min), höchstens 1 | – | Steibler 2021 Anh. A11; für Stahl gleich Roloff/Matek 27 TB 3-11 | freigegeben (2026-10-26, Seti) |
| E-KRT | Einfluss der Oberflächenrauheit (Schub) | K_R,τ = 1 − f_τ·(1 − K_R,σ) | – | FKM-Form; Stahl wie 0,575·K_Oσ + 0,425 | freigegeben (2026-10-26, Seti) |
| E-KSP | Kerbspannung unter Oberlast (Information), Biegung | σ_max,K = α_k·\|σ_n\| | MPa | Roloff/Matek 27 Gl. 3.26 | freigegeben (2026-10-26, Seti) |
| E-KT-1 | Technologischer Größeneinfluss (Zugfestigkeit) | K_t = 1 (keine Kurve in TB 3-10 für diesen Werkstoff, Annahme) | – | Roloff/Matek 27 TB 3-10a, b | freigegeben (2026-10-26, Seti) |
| E-KT-B1 | Technologischer Größeneinfluss (Zugfestigkeit) | K_t = 1 für d ≤ 100 mm; 1 − 0,23·lg(d/100 mm) für d < 300 mm; 0,89 bis 500 mm (Baustahl, Zugfestigkeit) | – | Roloff/Matek 27 TB 3-10a, b | freigegeben (2026-10-26, Seti) |
| E-KT-B2 | Technologischer Größeneinfluss (Streckgrenze) | K_t = 1 für d ≤ 32 mm; 1 − 0,26·lg(d/32 mm) für d < 300 mm; 0,75 bis 500 mm (Baustahl, Streckgrenze) | – | Roloff/Matek 27 TB 3-10a, b | freigegeben (2026-10-26, Seti) |
| E-KT-B3 | Technologischer Größeneinfluss (Zugfestigkeit) | K_t = 1 für d ≤ 16 mm; 1 − 0,26·lg(d/16 mm) für d < 300 mm; 0,67 bis 500 mm (Vergütungsstahl, Zugfestigkeit) | – | Roloff/Matek 27 TB 3-10a, b | freigegeben (2026-10-26, Seti) |
| E-KT-B4 | Technologischer Größeneinfluss (Streckgrenze) | K_t = 1 für d ≤ 16 mm; 1 − 0,34·lg(d/16 mm) für d < 300 mm; 0,57 bis 500 mm (Vergütungsstahl, Streckgrenze) | – | Roloff/Matek 27 TB 3-10a, b | freigegeben (2026-10-26, Seti) |
| E-KT-B5 | Technologischer Größeneinfluss (Zugfestigkeit) | K_t = 1 für d ≤ 16 mm; 1 − 0,41·lg(d/16 mm) für d < 150 mm; 0,6 bis 500 mm (Einsatzstahl, Zugfestigkeit und Streckgrenze) | – | Roloff/Matek 27 TB 3-10a, b | freigegeben (2026-10-26, Seti) |
| E-KT-G | Technologischer Größeneinfluss (Zugfestigkeit) | K_t = (1 − 0,7686·a_d·lg(d/7,5 mm)) / (1 − 0,7686·a_d·lg(d_eff,N/7,5 mm)) für d > d_eff,N, sonst 1 (Gusswerkstoffe) | – | Roloff/Matek 27 TB 3-10a, b | freigegeben (2026-10-26, Seti) |
| E-KT-GJL | Technologischer Größeneinfluss (Zugfestigkeit) | K_t = 1,207·(d/7,5 mm)^−0,1922 (GJL, Zugfestigkeit) | – | Roloff/Matek 27 TB 3-10a, b | freigegeben (2026-10-26, Seti) |
| E-KT-M | Technologischer Größeneinfluss (manuell) | K_t manuell (gilt für R_m und R_p) | – | Eingabe | freigegeben (2026-10-26, Seti) |
| E-MV | Vergleichsmittelspannung (GEH) | σ_mv = √((σ_zdm + σ_bm)² + 3·τ_tm²) | MPa | Roloff/Matek 27 Gl. 3.55 | freigegeben (2026-10-26, Seti) |
| E-MVT | Vergleichsmittelspannung Schub | τ_mv = f_τ·σ_mv | MPa | Roloff/Matek 27 Gl. 3.56, TB 3-2 | freigegeben (2026-10-26, Seti) |
| E-N-0 | Stützzahl ohne Spannungsgefälle, Biegung | n = 1 (kein Spannungsgefälle bekannt, konservativ) | – |  | freigegeben (2026-10-26, Seti) |
| E-N-1 | Stützzahl, Torsion | n = 1 + G′·mm·10^−(a_G − 0,5 + R_m/b_G)  (G′ ≤ 0,1 mm⁻¹) | – | Roloff/Matek 27 TB 3-7b; Steibler 2021 Anh. A8 | freigegeben (2026-10-26, Seti) |
| E-N-2 | Stützzahl, Zug/Druck | n = 1 + √(G′·mm)·10^−(a_G + R_m/b_G)  (0,1 < G′ ≤ 1 mm⁻¹) | – | Roloff/Matek 27 TB 3-7b; Steibler 2021 Anh. A8 | freigegeben (2026-10-26, Seti) |
| E-N-3 | Stützzahl, Biegung | n = 1 + ⁴√(G′·mm)·10^−(a_G + R_m/b_G)  (G′ > 1 mm⁻¹) | – | Roloff/Matek 27 TB 3-7b; Steibler 2021 Anh. A8 | freigegeben (2026-10-26, Seti) |
| E-NS-B | Nennspannung im Kerbquerschnitt, Biegung | σ_n = 32·M_b·d / (π·(d⁴ − d_i⁴)) | MPa | Roloff/Matek 27 TB 3-6c, d | freigegeben (2026-10-26, Seti) |
| E-NS-QB | Nennspannung Querbohrung, Biegung | σ_n = M_b / W_b,n  mit  W_b,n = π·d³/32 − d_B·d²/6 | MPa | Roloff/Matek 27 TB 3-6e | freigegeben (2026-10-26, Seti) |
| E-NS-QT | Nennspannung Querbohrung, Torsion | τ_n = T / W_t,n  mit  W_t,n = π·d³/16 − d_B·d²/6 | MPa | Roloff/Matek 27 TB 3-6e | freigegeben (2026-10-26, Seti) |
| E-NS-QZ | Nennspannung Querbohrung, Zug/Druck | σ_n = F_N / A_n  mit  A_n = π·d²/4 − d_B·d | MPa | Roloff/Matek 27 TB 3-6e | freigegeben (2026-10-26, Seti) |
| E-NS-T | Nennspannung im Kerbquerschnitt, Torsion | τ_n = 16·T·d / (π·(d⁴ − d_i⁴)) | MPa | Roloff/Matek 27 TB 3-6c, d | freigegeben (2026-10-26, Seti) |
| E-NS-X | Nennspannung (Querschnitt Blatt 1), Biegung | σ_n = F_N/A, M_b/W bzw. T/Wₜ (Querschnittswerte Blatt 1) | MPa |  | freigegeben (2026-10-26, Seti) |
| E-NS-Z | Nennspannung im Kerbquerschnitt, Zug/Druck | σ_n = 4·F_N / (π·(d² − d_i²)) | MPa | Roloff/Matek 27 TB 3-6c, d | freigegeben (2026-10-26, Seti) |
| E-NZ | Rechnerische Lebensdauer (Sicherheit 1) | N mit S_Z(N) = 1, Bisektion auf lg N zwischen 10³ und 10⁶ (Typ I) bzw. 10⁸ (Typ II) | – |  | freigegeben (2026-10-26, Seti) |
| E-PHI | Hilfsgröße für das Spannungsgefälle | φ = 1/(√(8·(D − d)/r) + 2) für (D − d)/d ≤ 0,5, sonst φ = 0 | – | Roloff/Matek 27 TB 3-7a | freigegeben (2026-10-26, Seti) |
| E-PSI | Mittelspannungsempfindlichkeit | ψ_σ = a_M·R_m + b_M | – | Roloff/Matek 27 Gl. 3.59, TB 3-15; Steibler 2021 Anh. A14 | freigegeben (2026-10-26, Seti) |
| E-PSI-DB | Mittelspannungsempfindlichkeit aus der Schwellfestigkeit | ψ_σ = 2·σ_zdW/σ_zSch − 1 | – | EN 1563 | freigegeben (2026-10-26, Seti) |
| E-PSIT | Mittelspannungsempfindlichkeit Schub | ψ_τ = f_τ·ψ_σ | – | Roloff/Matek 27 Gl. 3.60 | freigegeben (2026-10-26, Seti) |
| E-RM | Zugfestigkeit im Bauteil | R_m = K_t·R_mN | MPa | Roloff/Matek 27 Gl. 3.39 | freigegeben (2026-10-26, Seti) |
| E-RP | Streckgrenze im Bauteil | R_p = K_t·R_pN | MPa | Roloff/Matek 27 Gl. 3.40 | freigegeben (2026-10-26, Seti) |
| E-SD | Sicherheit gegen Dauerbruch, Biegung | S = σ_GA / σ_a | – | Roloff/Matek 27 Abschn. 3.7 | freigegeben (2026-10-26, Seti) |
| E-SDERF | Erforderliche Sicherheit gegen Dauerbruch | S_D,erf = 1,5 (Walz- und Schmiedewerkstoff), 2,1 (Guss), 1,9 (Guss zerstörungsfrei geprüft) oder Eingabe | – | Roloff/Matek 27 TB 3-16a | freigegeben (2026-10-26, Seti) |
| E-SDV | Sicherheit gegen Dauerbruch, zusammengesetzt | S_D = 1/√((1/S_zd + 1/S_b)² + (1/S_t)²)  mit  S_i = σ_iGA/σ_ia  (= 1/√((σ_zda/σ_zdGA + σ_ba/σ_bGA)² + (τ_ta/τ_tGA)²); Normalspannungen phasengleich, Maximum an derselben Stelle) | – | Roloff/Matek 27 Gl. 3.90 | freigegeben (2026-10-26, Seti) |
| E-SZ | Sicherheit bei der geforderten Lastspielzahl | S_Z = 1/√((1/S_Z,zd + 1/S_Z,b)² + (1/S_Z,t)²)  mit  S_Z,i = σ_iAK/σ_ia  (= 1/√((σ_zda/σ_zdAK + σ_ba/σ_bAK)² + (τ_ta/τ_tAK)²)) | – | Roloff/Matek 27 Gl. 3.90 mit σ_AK | freigegeben (2026-10-26, Seti) |
| E-W-DB | Wechselfestigkeit aus der Werkstoffdatenbank, Zug/Druck | σ_WN = Kennwert der Standardvariante (P-SZDW, P-SBW, P-TTW; Bereich: unterer Wert) | MPa | EN 1563 | freigegeben (2026-10-26, Seti) |
| E-W-EST-B | Wechselfestigkeit Normprobe, Abschätzung Stahl, Biegung | σ_bWN ≈ 0,5·R_mN | MPa | Roloff/Matek 27 Fußnote 13 (DIN 743) | freigegeben (2026-10-26, Seti) |
| E-W-EST-T | Wechselfestigkeit Normprobe, Abschätzung Stahl, Torsion | τ_tWN ≈ 0,3·R_mN | MPa | Roloff/Matek 27 Fußnote 13 (DIN 743) | freigegeben (2026-10-26, Seti) |
| E-W-EST-Z | Wechselfestigkeit Normprobe, Abschätzung Stahl, Zug/Druck | σ_zdWN ≈ 0,4·R_mN | MPa | Roloff/Matek 27 Fußnote 13 (DIN 743) | freigegeben (2026-10-26, Seti) |
| E-W-ESTG-B | Wechselfestigkeit Normprobe, Abschätzung Aluminium-Knetlegierung, Biegung | σ_bWN = σ_zdWN = f_Wσ·R_mN (ohne Biegeanteil, dann K_g = 1) | MPa | Roloff/Matek 27 TB 3-2, Gl. 3.34, 3.35 | freigegeben (2026-10-26, Seti) |
| E-W-ESTG-T | Wechselfestigkeit Normprobe, Abschätzung Aluminium-Knetlegierung, Torsion | τ_tWN = f_Wτ·f_Wσ·R_mN (dann K_g = 1) | MPa | Roloff/Matek 27 TB 3-2, Gl. 3.34, 3.35 | freigegeben (2026-10-26, Seti) |
| E-W-ESTG-Z | Wechselfestigkeit Normprobe, Abschätzung Aluminium-Knetlegierung, Zug/Druck | σ_zdWN = f_Wσ·R_mN (f_Wσ nach Werkstoffgruppe) | MPa | Roloff/Matek 27 TB 3-2, Gl. 3.34, 3.35 | freigegeben (2026-10-26, Seti) |
| E-W-KT | Wechselfestigkeit im Bauteil, Biegung | σ_W = K_t·σ_WN | MPa | Roloff/Matek 27 Gl. 3.41 bis 3.44 | freigegeben (2026-10-26, Seti) |
| E-W-M | Wechselfestigkeit Normprobe (manuell), Biegung | σ_WN manuell | MPa | Eingabe | freigegeben (2026-10-26, Seti) |
| E-W-P50 | Wechselfestigkeit, Vergleich Mittelwert und Abschätzung, Zug/Druck | σ_WN = min(Datenbankwert mit P < 97,5 % oder ohne Angabe, Abschätzung mit P_ü = 97,5 %) | MPa | Konzept 0.9.0 E10 | freigegeben (2026-10-26, Seti) |
| E-WL1 | Bauteil-Wöhlerlinie, Biegung | σ_AK = σ_GA·(N_D/N)^(1/k) für N < N_D, sonst σ_GA;  N_D = 10⁶, k_σ = 5, k_τ = 8 (Typ I) | MPa | Steibler 2021 Anh. A6 (FKM Tab. 4.4.3); Roloff Bsp. 3.5 | freigegeben (2026-10-26, Seti) |
| E-WL2 | Bauteil-Wöhlerlinie, Zug/Druck | σ_AK = σ_GA·(N_D/N)^(1/k) für N < N_D; σ_GA·(N_D/N)^(1/k_II) bis 10⁸, danach konstant;  N_D = 10⁶, k_σ = 5, k_τ = 8, k_II,σ = 15, k_II,τ = 25 (Typ II) | MPa | Steibler 2021 Anh. A6 (FKM Tab. 4.4.3); Roloff Bsp. 3.5 | freigegeben (2026-10-26, Seti) |
| E-X-SG | Schnittgrößen an der Kerbstelle (Oberlast) | N(x_K), M_b(x_K), T(x_K) aus dem Blatt-1-Lastfall | mm | Eingabe | freigegeben (2026-10-26, Seti) |

## Formfaktoren (Ashby Kap. 7.2)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| F-BE | Formfaktor Biegung, elastisch | φ_B^e = 4π·I / A² | – | Ashby Gl. 7.4 | freigegeben (2026-10-08, Seti) |
| F-BF | Formfaktor Biegung, Versagen | φ_B^f = 4√π·W / A^1,5 | – | Ashby Gl. 7.11 | freigegeben (2026-10-08, Seti) |
| F-TE | Formfaktor Torsion, elastisch | φ_T^e = 2π·Iₜ / A² | – | Ashby Gl. 7.8 | freigegeben (2026-10-08, Seti) |
| F-TF | Formfaktor Torsion, Versagen | φ_T^f = 2√π·Wₜ / A^1,5 | – | Ashby Gl. 7.14 | freigegeben (2026-10-08, Seti) |

## Fluid-Stoffwerte

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| FS-IF-GP | Ableitung der Gibbs-Funktion | γ_π = Σ −n_i·I_i·(7,1 − π)^(I_i−1)·(τ − 1,222)^J_i | 1 | IAPWS-IF97 (R7-97, 2012), Tab. 2 und 4 | freigegeben (2026-10-29, Seti) |
| FS-IF-PI | Reduzierter Druck (IF97 Region 1) | π = p/16,53 MPa; τ = 1 386 K/T | 1 | IAPWS-IF97 (R7-97, 2012), Gl. (7) | freigegeben (2026-10-29, Seti) |
| FS-IF-PS | Sättigungsdruck | p_s = 1 MPa·[2C/(−B + √(B² − 4AC))]⁴ | Pa | IAPWS-IF97 (R7-97, 2012), Gl. (30), Tab. 34 | freigegeben (2026-10-29, Seti) |
| FS-IF-RHO | Dichte Wasser | ρ = p/(R·T·π·γ_π) | kg/m³ | IAPWS-IF97 (R7-97, 2012), Tab. 3, Gl. (1) | freigegeben (2026-10-29, Seti) |
| FS-MAN-NU | Kinematische Viskosität (Eingabe) | ν = Eingabe | m²/s | Eingabe | freigegeben (2026-10-29, Seti) |
| FS-MAN-RHO | Dichte (Eingabe) | ρ = Eingabe | kg/m³ | Eingabe | freigegeben (2026-10-29, Seti) |
| FS-MU | Dynamische Viskosität Wasser | η = 1 µPa·s·μ̄_0·μ̄_1 (μ̄_2 = 1) | Pa·s | IAPWS R12-08, Gl. (10), Abschn. 3 | freigegeben (2026-10-29, Seti) |
| FS-MU-0 | Viskosität Gasgrenze | μ̄_0 = 100·√T̄ / Σ H_i/T̄^i | 1 | IAPWS R12-08, Gl. (11), Tab. 1 | freigegeben (2026-10-29, Seti) |
| FS-MU-1 | Viskosität Dichteeinfluss | μ̄_1 = exp[ρ̄·Σ_i (1/T̄ − 1)^i·Σ_j H_ij·(ρ̄ − 1)^j] | 1 | IAPWS R12-08, Gl. (12), Tab. 2 | freigegeben (2026-10-29, Seti) |
| FS-NU | Kinematische Viskosität | ν = η/ρ | m²/s | Definition | freigegeben (2026-10-29, Seti) |
| FS-TAB-NU | Kinematische Viskosität (Tabellenwert) | ν aus fd_fluid_values (mm²/s · 10⁻⁶) | m²/s | TB 18-9 (bei ca. 1 bar) (Q219) | freigegeben (2026-10-29, Seti) |
| FS-TAB-RHO | Dichte (Tabellenwert) | ρ aus fd_fluid_values | kg/m³ | TB 18-9 (bei ca. 1 bar) (Q219) | freigegeben (2026-10-29, Seti) |

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

## Druckbehälter

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| P-BIS | Erforderliche Wandstärke (numerisch) | σ_v,max(t) = σ_zul, Bisektion im log-Raum über t | mm | deterministisch, feste Schrittzahl | freigegeben (2026-10-12, Seti) |
| P-GEO | Innen- und Außenradius | a = d_i / 2,  b = a + t | mm | Eingabe | freigegeben (2026-10-12, Seti) |
| P-KU-B | Erforderliche Wandstärke, Außenradius b fest | t = b·(1 − (1 − 3p/(2σ_zul))^(1/3)) | mm | aus σ_v(a) = 1,5·p·b³/(b³ − a³) = σ_zul | freigegeben (2026-10-12, Seti) |
| P-KU-BI | Erforderliche Wandstärke, Innenradius a fest | t = a·((1 − 3p/(2σ_zul))^(−1/3) − 1) | mm | aus σ_v(a) = 1,5·p·b³/(b³ − a³) = σ_zul | freigegeben (2026-10-12, Seti) |
| P-KU-KS | Kesselformel (Vergleich, dünnwandig) | σ_t = p·D_m/(4t),  D_m = a + b,  p = p_i − p_a, nur wenn D_m/t ≥ 20 | MPa | Gross/Hauger TM 2, Kap. 6 (dünnwandig) | freigegeben (2026-10-12, Seti) |
| P-KU-SR | Radialspannung | σ_r(r) = (p_i·a³ − p_a·b³)/(b³ − a³) − (p_i − p_a)·a³·b³/((b³ − a³)·r³) | MPa | Roark Tab. 13.5; Gross/Hauger TM 2, Kap. 6 | freigegeben (2026-10-12, Seti) |
| P-KU-ST | Tangentialspannung (beide Richtungen) | σ_t(r) = (p_i·a³ − p_a·b³)/(b³ − a³) + (p_i − p_a)·a³·b³/(2·(b³ − a³)·r³) | MPa | Roark Tab. 13.5; Gross/Hauger TM 2, Kap. 6 | freigegeben (2026-10-12, Seti) |
| P-KU-SV | Vergleichsspannung (GEH) | σ_v = \|σ_t − σ_r\| (GEH mit σ_θ = σ_φ), bei r = a und r = b, größerer Wert maßgebend | MPa | Gestaltänderungsenergiehypothese | freigegeben (2026-10-12, Seti) |
| P-KU-U | Radiale Verschiebung (Aufweitung) | u(r) = r/E·[(1 − ν)·σ_t − ν·σ_r] | mm | Hooke; ν = 0,3 aus EN 1999-1-1 | freigegeben (2026-10-12, Seti) |
| P-NA | Ausnutzung | u = σ_v,max / σ_zul | – |  | freigegeben (2026-10-12, Seti) |
| P-NZ | Zulässige Spannung | σ_zul = min(R_p / S_F, R_m / S_B) | MPa | wie C-SZUL; spröde: nur R_m / S_B | freigegeben (2026-10-12, Seti) |
| P-TR | Vergleichsspannung nach Tresca (nur Kennwert) | σ_T = σ_max − σ_min der Hauptspannungen σ_r, σ_θ, σ_z an der maßgebenden Stelle | MPa | Schubspannungshypothese, Konzept V2-A P3 | freigegeben (2026-10-12, Seti) |
| P-ZY-B | Erforderliche Wandstärke, Außenradius b fest | t = b·(1 − √(1 − √3·p/σ_zul)) | mm | aus σ_v(a) = √3·p·b²/(b² − a²) = σ_zul | freigegeben (2026-10-12, Seti) |
| P-ZY-BI | Erforderliche Wandstärke, Innenradius a fest | t = a·(1/√(1 − √3·p/σ_zul) − 1) | mm | aus σ_v(a) = √3·p·b²/(b² − a²) = σ_zul | freigegeben (2026-10-12, Seti) |
| P-ZY-KS | Kesselformel (Vergleich, dünnwandig) | σ_θ = p·D_m/(2t),  σ_z = p·D_m/(4t) (geschlossen),  σ_r ≈ −p/2,  D_m = a + b,  p = p_i − p_a, nur wenn D_m/t ≥ 20 | MPa | Gross/Hauger TM 2, Kap. 6 (dünnwandig) | freigegeben (2026-10-12, Seti) |
| P-ZY-SR | Radialspannung | σ_r(r) = (p_i·a² − p_a·b²)/(b² − a²) − (p_i − p_a)·a²·b²/((b² − a²)·r²) | MPa | Gross/Hauger TM 2, Kap. 6 (Lamé 1852); Roark Tab. 13.5 | freigegeben (2026-10-12, Seti) |
| P-ZY-ST | Umfangsspannung | σ_θ(r) = (p_i·a² − p_a·b²)/(b² − a²) + (p_i − p_a)·a²·b²/((b² − a²)·r²) | MPa | Gross/Hauger TM 2, Kap. 6 (Lamé 1852); Roark Tab. 13.5 | freigegeben (2026-10-12, Seti) |
| P-ZY-SV | Vergleichsspannung (GEH) | σ_v = √(½·[(σ_θ − σ_r)² + (σ_r − σ_z)² + (σ_z − σ_θ)²]), bei r = a und r = b, größerer Wert maßgebend | MPa | Gestaltänderungsenergiehypothese | freigegeben (2026-10-12, Seti) |
| P-ZY-SZ | Axialspannung | geschlossen: σ_z = (p_i·a² − p_a·b²)/(b² − a²), konstant über r;  offen: σ_z = 0 | MPa | Gleichgewicht am Schnitt, Gross/Hauger TM 2, Kap. 6 | freigegeben (2026-10-12, Seti) |
| P-ZY-U | Radiale Verschiebung (Aufweitung) | u(r) = r/E·[σ_θ − ν·(σ_r + σ_z)] | mm | Hooke; ν = 0,3 aus EN 1999-1-1 | freigegeben (2026-10-12, Seti) |

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
| Q-IP-A | Fläche | A = 2·b·t_f + (h − 2t_f)·t_w | mm² | scharfkantig, ohne Ausrundungen | freigegeben (2026-10-15, seti) |
| Q-IP-IY | Flächenträgheitsmoment um y (stark) | I_y = [b·h³ − (b − t_w)·(h − 2t_f)³] / 12 | mm⁴ | Gross/Hauger TM 2, Kap. 4.2 | freigegeben (2026-10-15, seti) |
| Q-IP-IZ | Flächenträgheitsmoment um z (schwach) | I_z = [2·t_f·b³ + (h − 2t_f)·t_w³] / 12 | mm⁴ | Gross/Hauger TM 2, Kap. 4.2 | freigegeben (2026-10-15, seti) |
| Q-IP-K | Torsionsträgheitsmoment (dünnwandig offen) | Iₜ = [2·(b − t_w)·t_f³ + h·t_w³] / 3 für t_w ≤ t_f, sonst [2·b·t_f³ + (h − 2t_f)·t_w³] / 3 | mm⁴ | Gross/Hauger TM 2, Kap. 5.4; überlappungsfreie Zerlegung, Knotenfläche dem dünneren Teil (Gegenrechnung Prandtl) | freigegeben (2026-10-18, Seti) |
| Q-IP-KA | Faktor Querkraftschub (Jourawski) | κ = A·S / (I_y·b),  τ_Q = κ·Q / A | – | Jourawski, exakt für die Rechteckzerlegung | freigegeben (2026-10-15, seti) |
| Q-IP-KAZ | Faktor Querkraftschub (Jourawski) | κ = A·S / (I_z·b),  τ_Q = κ·Q / A | – | Jourawski, exakt für die Rechteckzerlegung | freigegeben (2026-10-15, seti) |
| Q-IP-S | Statisches Moment an der Stelle größter Schubspannung | S = ∫ (z − z_s) dA über die Fläche oberhalb der Schnittlinie (Schwerachse oder Querschnittssprung) | mm³ | Gross/Hauger TM 2, Kap. 4.6 | freigegeben (2026-10-15, seti) |
| Q-IP-SZ | Statisches Moment an der Stelle größter Schubspannung | S = ∫ (z − z_s) dA über die Fläche oberhalb der Schnittlinie (Schwerachse oder Querschnittssprung) | mm³ | Gross/Hauger TM 2, Kap. 4.6 | freigegeben (2026-10-15, seti) |
| Q-IP-W | Widerstandsmoment Biegung (maßgebender Rand) | W = I_y / (h/2) | mm³ |  | freigegeben (2026-10-15, seti) |
| Q-IP-WT | Widerstandsmoment Torsion | Wₜ = Iₜ / t_max | mm³ | Gross/Hauger TM 2, Kap. 5.4 | freigegeben (2026-10-15, seti) |
| Q-IP-WZ | Widerstandsmoment Biegung um z (Lage schwach) | W = I_z / (b/2) | mm³ |  | freigegeben (2026-10-15, seti) |
| Q-LP-A | Fläche | A = t·(h + b − t) | mm² | scharfkantig, ohne Ausrundungen | freigegeben (2026-10-15, seti) |
| Q-LP-AL | Winkel der Hauptachse 1 gegen y | α = ½·atan2(−2·I_yz, I_y − I_z), gegen den Uhrzeigersinn positiv | ° | Mohrscher Trägheitskreis | freigegeben (2026-10-15, seti) |
| Q-LP-I1 | Größtes Hauptträgheitsmoment | I₁ = (I_y + I_z)/2 + √[((I_y − I_z)/2)² + I_yz²] | mm⁴ | Mohrscher Trägheitskreis | freigegeben (2026-10-15, seti) |
| Q-LP-I2 | Kleinstes Hauptträgheitsmoment | I₂ = (I_y + I_z)/2 − √[((I_y − I_z)/2)² + I_yz²] | mm⁴ | Mohrscher Trägheitskreis | freigegeben (2026-10-15, seti) |
| Q-LP-IY | Flächenträgheitsmoment um y (waagerechte Schwerachse, Biegeachse; ∫(z − z_s)² dA, senkrechter Schenkel h liefert h³) | I_y = [t·h³ + (b − t)·t³] / 3 − A·z_s² | mm⁴ | Steinerscher Satz | freigegeben (2026-10-18, Seti) |
| Q-LP-IYZ | Deviationsmoment | I_yz = [t²·h² + t²·(b² − t²)] / 4 − A·y_s·z_s | mm⁴ | Steinerscher Satz, I_yz = ∫(y − y_s)(z − z_s) dA | freigegeben (2026-10-15, seti) |
| Q-LP-IZ | Flächenträgheitsmoment um z (senkrechte Schwerachse; ∫(y − y_s)² dA, waagerechter Schenkel b liefert b³) | I_z = [h·t³ + t·(b³ − t³)] / 3 − A·y_s² | mm⁴ | Steinerscher Satz | freigegeben (2026-10-15, seti) |
| Q-LP-K | Torsionsträgheitsmoment (dünnwandig offen) | Iₜ = [(h − t/2) + (b − t/2)]·t³ / 3 | mm⁴ | Gross/Hauger TM 2, Kap. 5.4 | freigegeben (2026-10-15, seti) |
| Q-LP-KA | Faktor Querkraftschub (Jourawski) | κ = A·S / (I_y·b),  τ_Q = κ·Q / A | – | Jourawski, exakt für die Rechteckzerlegung | freigegeben (2026-10-15, seti) |
| Q-LP-S | Statisches Moment an der Stelle größter Schubspannung | S = ∫ (z − z_s) dA über die Fläche oberhalb der Schnittlinie (Schwerachse oder Querschnittssprung) | mm³ | Gross/Hauger TM 2, Kap. 4.6 | freigegeben (2026-10-15, seti) |
| Q-LP-W | Widerstandsmoment Biegung (maßgebender Rand) | W = I_y / max(e_o, e_u) | mm³ |  | freigegeben (2026-10-15, seti) |
| Q-LP-WT | Widerstandsmoment Torsion | Wₜ = Iₜ / t_max | mm³ | Gross/Hauger TM 2, Kap. 5.4 | freigegeben (2026-10-15, seti) |
| Q-LP-YS | Schwerpunktabstand von der Außenkante des senkrechten Schenkels | y_s = [h·t² + (b² − t²)·t] / (2A) | mm | Gross/Hauger TM 2, Kap. 4.2 | freigegeben (2026-10-15, seti) |
| Q-LP-ZS | Schwerpunktabstand von der Unterkante | z_s = [b·t² + (h² − t²)·t] / (2A) | mm | Gross/Hauger TM 2, Kap. 4.2 | freigegeben (2026-10-15, seti) |
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
| Q-SIGO | Randspannung oben (Betrag) | \|σ_o\| = \|M_max\|·e_o / I | MPa |  | freigegeben (2026-10-18, Seti) |
| Q-SIGU | Randspannung unten (Betrag) | \|σ_u\| = \|M_max\|·e_u / I | MPa |  | freigegeben (2026-10-18, Seti) |
| Q-TP-A | Fläche | A = b·t_f + (h − t_f)·t_w | mm² | scharfkantig, ohne Ausrundungen | freigegeben (2026-10-15, seti) |
| Q-TP-IY | Flächenträgheitsmoment um y (waagerechte Schwerachse) | I_y = [t_w·(h − t_f)³ + b·(h³ − (h − t_f)³)] / 3 − A·z_s² | mm⁴ | Steinerscher Satz | freigegeben (2026-10-15, seti) |
| Q-TP-IZ | Flächenträgheitsmoment um z (Symmetrieachse) | I_z = [t_f·b³ + (h − t_f)·t_w³] / 12 | mm⁴ | Gross/Hauger TM 2, Kap. 4.2 | freigegeben (2026-10-15, seti) |
| Q-TP-K | Torsionsträgheitsmoment (dünnwandig offen) | Iₜ = [(b − t_w)·t_f³ + h·t_w³] / 3 für t_w ≤ t_f, sonst [b·t_f³ + (h − t_f)·t_w³] / 3 | mm⁴ | Gross/Hauger TM 2, Kap. 5.4; überlappungsfreie Zerlegung, Knotenfläche dem dünneren Teil (Gegenrechnung Prandtl) | freigegeben (2026-10-18, Seti) |
| Q-TP-KA | Faktor Querkraftschub (Jourawski) | κ = A·S / (I_y·b),  τ_Q = κ·Q / A | – | Jourawski, exakt für die Rechteckzerlegung | freigegeben (2026-10-15, seti) |
| Q-TP-S | Statisches Moment an der Stelle größter Schubspannung | S = ∫ (z − z_s) dA über die Fläche oberhalb der Schnittlinie (Schwerachse oder Querschnittssprung) | mm³ | Gross/Hauger TM 2, Kap. 4.6 | freigegeben (2026-10-15, seti) |
| Q-TP-W | Widerstandsmoment Biegung (maßgebender Rand) | W = I_y / max(e_o, e_u) | mm³ |  | freigegeben (2026-10-15, seti) |
| Q-TP-WT | Widerstandsmoment Torsion | Wₜ = Iₜ / t_max | mm³ | Gross/Hauger TM 2, Kap. 5.4 | freigegeben (2026-10-15, seti) |
| Q-TP-ZS | Schwerpunktabstand von der Unterkante | z_s = [t_w·(h − t_f)²/2 + b·t_f·(h − t_f/2)] / A | mm | Gross/Hauger TM 2, Kap. 4.2 | freigegeben (2026-10-15, seti) |
| Q-UP-A | Fläche | A = 2·b·t_f + (h − 2t_f)·t_w | mm² | scharfkantig, ohne Ausrundungen | freigegeben (2026-10-15, seti) |
| Q-UP-EM | Schubmittelpunkt (Abstand von der Stegmitte, nach außen) | e_M = b'²·h'²·t_f / (4·I_y),  b' = b − t_w/2, h' = h − t_f | mm | Gross/Hauger TM 2, Kap. 4.6 (dünnwandig) | freigegeben (2026-10-15, seti) |
| Q-UP-IY | Flächenträgheitsmoment um y (stark) | I_y = [b·h³ − (b − t_w)·(h − 2t_f)³] / 12 | mm⁴ | Gross/Hauger TM 2, Kap. 4.2 | freigegeben (2026-10-15, seti) |
| Q-UP-IZ | Flächenträgheitsmoment um z (senkrechte Schwerachse parallel zum Steg, schwach; Symmetrieachse ist y) | I_z = [h·t_w³ + 2·t_f·(b³ − t_w³)] / 3 − A·y_s² | mm⁴ | Steinerscher Satz | freigegeben (2026-10-18, Seti) |
| Q-UP-K | Torsionsträgheitsmoment (dünnwandig offen) | Iₜ = [2·(b − t_w)·t_f³ + h·t_w³] / 3 für t_w ≤ t_f, sonst [2·b·t_f³ + (h − 2t_f)·t_w³] / 3 | mm⁴ | Gross/Hauger TM 2, Kap. 5.4; überlappungsfreie Zerlegung, Knotenfläche dem dünneren Teil (Gegenrechnung Prandtl) | freigegeben (2026-10-18, Seti) |
| Q-UP-KA | Faktor Querkraftschub (Jourawski) | κ = A·S / (I_y·b),  τ_Q = κ·Q / A | – | Jourawski, exakt für die Rechteckzerlegung | freigegeben (2026-10-15, seti) |
| Q-UP-KAZ | Faktor Querkraftschub (Jourawski) | κ = A·S / (I_z·b),  τ_Q = κ·Q / A | – | Jourawski, exakt für die Rechteckzerlegung | freigegeben (2026-10-15, seti) |
| Q-UP-S | Statisches Moment an der Stelle größter Schubspannung | S = ∫ (z − z_s) dA über die Fläche oberhalb der Schnittlinie (Schwerachse oder Querschnittssprung) | mm³ | Gross/Hauger TM 2, Kap. 4.6 | freigegeben (2026-10-15, seti) |
| Q-UP-SZ | Statisches Moment an der Stelle größter Schubspannung | S = ∫ (z − z_s) dA über die Fläche oberhalb der Schnittlinie (Schwerachse oder Querschnittssprung) | mm³ | Gross/Hauger TM 2, Kap. 4.6 | freigegeben (2026-10-15, seti) |
| Q-UP-W | Widerstandsmoment Biegung (maßgebender Rand) | W = I_y / (h/2) | mm³ |  | freigegeben (2026-10-15, seti) |
| Q-UP-WT | Widerstandsmoment Torsion | Wₜ = Iₜ / t_max | mm³ | Gross/Hauger TM 2, Kap. 5.4 | freigegeben (2026-10-15, seti) |
| Q-UP-WZ | Widerstandsmoment Biegung um z (Lage schwach) | W = I_z / max(e_o, e_u) | mm³ |  | freigegeben (2026-10-15, seti) |
| Q-UP-YS | Schwerpunktabstand von der Stegaußenkante | y_s = [t_w²·h + 2·t_f·(b² − t_w²)] / (2A) | mm | Gross/Hauger TM 2, Kap. 4.2 | freigegeben (2026-10-15, seti) |

## Rohrhydraulik

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| RH-A | Querschnitt | A = π·d²/4 | m² | Roloff 27 Gl. 18.3 | freigegeben (2026-10-29, Seti) |
| RH-BE | Druck nach dem Element | p_2 = p_1 + ρ/2·(v_1² − v_2²) + ρ·g·(z_1 − z_2) − Δp_v | Pa | Dubbel 26 Bd. 1 Gl. (17.10) | freigegeben (2026-10-29, Seti) |
| RH-D-BIS | Kleinster Innendurchmesser | d mit Δp_erf(d) = Δp_zul (Bisektion im log-Raum, 100 Schritte) | m | Verfahren (R7) | freigegeben (2026-10-29, Seti) |
| RH-D-DN | Gewähltes Rohr | kleinstes Rohr mit d_i = d_a − 2·s ≥ d_min | m | Anhang A, Tab. A.2, S. 17 (Q224) | freigegeben (2026-10-29, Seti) |
| RH-DI | Innendurchmesser | d_i = d_a − 2·s | m | DIN EN 10220 Reihe 1, Tab. 1, S. 6 f. (Wanddicken mit Massenangabe, T ≤ 20 mm) | freigegeben (2026-10-29, Seti) |
| RH-DP-ERF | Erforderliche Druckerhöhung | Δp_erf = (p_E − p_A) + Δp_geo + ρ/2·(v_E² − v_A²) + Δp_v | Pa | Dubbel 26 Bd. 1 Gl. (17.10) | freigegeben (2026-10-29, Seti) |
| RH-DP-GEO | Höhendruck | Δp_geo = ρ·g·(z_E − z_A) | Pa | Roloff 27 Gl. 18.7 | freigegeben (2026-10-29, Seti) |
| RH-DP-R | Reibungsdruckverlust | Δp_R = λ·(L/d)·ρ·v²/2 | Pa | Roloff 27 Gl. 18.5; VDI-WA L1.2 Gl. (1) | freigegeben (2026-10-29, Seti) |
| RH-DP-V | Summe der Verluste | Δp_v = Σ Δp_R + Σ Δp_ζ | Pa | Roloff 27 Gl. 18.7 | freigegeben (2026-10-29, Seti) |
| RH-DP-Z | Druckverlust | Δp_ζ = n·ζ·ρ·v_B²/2 | Pa | Roloff 27 Gl. 18.6 | freigegeben (2026-10-29, Seti) |
| RH-EPS | relative Rauheit | ε = k/d | 1 | VDI-WA L1.2 Gl. (8) | freigegeben (2026-10-29, Seti) |
| RH-H-E | Energiehöhe | H = p/(ρ·g) + v²/(2g) + z | m | Dubbel 26 Bd. 1 Gl. (17.10) | freigegeben (2026-10-29, Seti) |
| RH-H-P | Druckhöhe | h_p = p/(ρ·g) | m | Dubbel 26 Bd. 1 S. 325 | freigegeben (2026-10-29, Seti) |
| RH-HV | Verlusthöhe | h_v = Δp_v/(ρ·g) | m | Dubbel 26 Bd. 1 Gl. (17.11b) | freigegeben (2026-10-29, Seti) |
| RH-K | Rauheit | k = k_min bzw. k_max aus fd_roughness | m | TB 18-6 (Q219) | freigegeben (2026-10-29, Seti) |
| RH-L-CB | Rohrreibungszahl turbulent (Colebrook) | 1/√λ = −2·lg(2,51/(Re·√λ) + ε/3,71) | 1 | Roloff 27 Gl. 18.11; VDI-WA L1.2 Gl. (10) | freigegeben (2026-10-29, Seti) |
| RH-L-EX | Rohrreibungszahl Näherung (Startwert) | λ_0 = 0,11·(ε + 68/Re)^0,25 | 1 | Roloff 27 S. 742 | freigegeben (2026-10-29, Seti) |
| RH-L-LAM | Rohrreibungszahl laminar | λ = 64/Re | 1 | Roloff 27 Gl. 18.9; VDI-WA L1.2 Gl. (4) | freigegeben (2026-10-29, Seti) |
| RH-N-KAV | Kavitationsgefahr (Abstand zum Dampfdruck) | p_abs,min/p_s ≥ 1 | 1 | IAPWS-IF97 Gl. (30) | freigegeben (2026-10-29, Seti) |
| RH-N-RE | Strömungsbereich (größte Reynolds-Zahl im Strang) | Re_max = max Re_i; Re < 2 320 laminar; 2 320 ≤ Re < 4 000 Übergang; Re ≥ 4 000 turbulent | 1 | Roloff 27 S. 741; VDI-WA L1.2 | freigegeben (2026-10-29, Seti) |
| RH-N-V | Geschwindigkeit gegen Richtwert | v_min ≤ v_max,Strang ≤ v_max | m/s | TB 18-5 (Q219) | freigegeben (2026-10-29, Seti) |
| RH-P-HYD | Hydraulische Leistung | P_h = Δp_erf·V̇ | W | Roloff 27 S. 742 | freigegeben (2026-10-29, Seti) |
| RH-P-W | Antriebsleistung | P = P_h/η | W | Roloff 27 S. 742 | freigegeben (2026-10-29, Seti) |
| RH-Q-BIS | Volumenstrom bei verfügbarer Druckerhöhung | V̇ mit Δp_erf(V̇) = Δp_verf (Bisektion, 100 Schritte) | m³/s | Verfahren (R7) | freigegeben (2026-10-29, Seti) |
| RH-RE | Reynolds-Zahl | Re = v·d/ν | 1 | Roloff 27 Gl. 18.8; VDI-WA L1.2 Gl. (2) | freigegeben (2026-10-29, Seti) |
| RH-V | mittlere Geschwindigkeit | v = V̇/A | m/s | Roloff 27 Gl. 18.3 | freigegeben (2026-10-29, Seti) |
| RH-Z-BC | plötzliche Erweiterung (Borda-Carnot) | ζ_1 = (1 − A_1/A_2)² | 1 | VDI-WA L1.3 Gl. (7); TB 18-7; Dubbel 26 Bd. 1 S. 324 | freigegeben (2026-10-29, Seti) |
| RH-Z-IP | Widerstandszahl Bogen 90° (Interpolation über r/d) | ζ = ζ_a + (ζ_b − ζ_a)·(r/d − x_a)/(x_b − x_a) | 1 | TB 18-7 (Q219), linear zwischen Zeilen | freigegeben (2026-10-29, Seti) |
| RH-Z-MAN | Widerstandszahl (Eingabe) | ζ = Eingabe | 1 | Eingabe | freigegeben (2026-10-29, Seti) |
| RH-Z-TAB | Widerstandszahl | ζ aus fd_loss_coeff | 1 | TB 18-7 (Q219) | freigegeben (2026-10-29, Seti) |

## Torsion

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| T-PHI1 | Verdrehwinkel am freien Ende | φ_Ende = M_t·L / (G·Iₜ) | ° | Ashby App. A.6 | freigegeben (2026-10-10, S. Frotscher) |
| T-PHI2 | Verdrehwinkel in Feldmitte | φ_Mitte = M_t,A·(L/2) / (G·Iₜ) = M_t·L / (4·G·Iₜ) | ° | Ashby App. A.6 | freigegeben (2026-10-10, S. Frotscher) |
| T-TA | Einspannmoment je Seite | M_t,A = M_t,B = M_t / 2 | N·mm | Verträglichkeit, gleiche Steifigkeit beider Hälften | freigegeben (2026-10-10, S. Frotscher) |
| T-TAU | Torsionsspannung | τ_t = M_t,max / Wₜ  (einseitig M_t, beidseitig M_t,A) | MPa | Ashby App. A.6 | freigegeben (2026-10-10, S. Frotscher) |

## Eigenfrequenz

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| V-B | Formtreuer Faktor für f₁ = f_min | s = f_min / f₁ (formtreu, m_z = 0: E·I ∝ s⁴, m′ ∝ s², f₁ ∝ s);  mit m_z > 0: f₁(s) = f_min, Bisektion im log-Raum, 60 Schritte | – | Konzept V2-A U9, wie D-BIS | freigegeben (2026-10-13, Seti) |
| V-BL | Wurzeln der Frequenzgleichung | β_nL = n-te positive Wurzel der Frequenzgleichung, n = 1, 2, 3;  Einklammerung aus den Vorzeichen an k·π (KR: ((n − 1)π; nπ), GG: ((n − ½)π; (n + ½)π), EG und EE: (nπ; (n + 1)π)), Bisektion 80 Schritte, ohne Startwert | – | deterministisch wie Nullstellensuche Lastliste; Literatur Blevins Tab. 8.1 | freigegeben (2026-10-13, Seti) |
| V-CK-EE | Frequenzgleichung (beidseitig eingespannt) | cos(βL)·cosh(βL) − 1 = 0 | – | Blevins Tab. 8.1; Gross/Hauger TM 4, Kap. 4 (Kontrolle, Sollwert 0) | freigegeben (2026-10-13, Seti) |
| V-CK-EG | Frequenzgleichung (links eingespannt, rechts gelenkig) | tan(βL) = tanh(βL) | – | Blevins Tab. 8.1; Gross/Hauger TM 4, Kap. 4 (Kontrolle, Sollwert 0) | freigegeben (2026-10-13, Seti) |
| V-CK-GG | Frequenzgleichung (gelenkig gelagert) | sin(βL) = 0 | – | Blevins Tab. 8.1; Gross/Hauger TM 4, Kap. 4 (Kontrolle, Sollwert 0) | freigegeben (2026-10-13, Seti) |
| V-CK-KR | Frequenzgleichung (Kragträger, links eingespannt) | cos(βL)·cosh(βL) + 1 = 0 | – | Blevins Tab. 8.1; Gross/Hauger TM 4, Kap. 4 (Kontrolle, Sollwert 0) | freigegeben (2026-10-13, Seti) |
| V-EI | Biegesteifigkeit | E·I | N·mm² |  | freigegeben (2026-10-13, Seti) |
| V-EW | Eigenwertgleichung (Ansatz) | E·I·w′′′′ + m′·ẅ = 0,  w(x, t) = φ(x)·cos(ωt),  φ(x) = C₁·sin βx + C₂·cos βx + C₃·sinh βx + C₄·cosh βx,  β⁴ = m′·ω²/(E·I) | 1/mm | Gross/Hauger TM 4, Kap. 4; Blevins Tab. 8.1 | freigegeben (2026-10-13, Seti) |
| V-FN | Eigenfrequenz | f_n = ω_n / (2π) | Hz |  | freigegeben (2026-10-13, Seti) |
| V-MB | Massenbelegung | m′ = ρ·A + m_z;  Rechnung in t/mm: ρ[kg/m³]·10⁻¹²·A[mm²] + m_z[kg/m]·10⁻⁶ (1 kg/m³ = 10⁻¹² t/mm³, 1 kg/m = 10⁻⁶ t/mm);  Anzeige in kg/m: ρ[kg/m³]·A[mm²]·10⁻⁶ + m_z[kg/m] (1 mm² = 10⁻⁶ m²) | t/mm | Einheitensystem N, mm, t, s (Konzept V2-A P7) | freigegeben (2026-10-13, Seti) |
| V-NR | Resonanzabstand | Δ = \|f_err − f₁\| / f₁ ≥ Δ_min | % | Konstruktionsregel | freigegeben (2026-10-13, Seti) |
| V-NZ | Nachweis Mindestfrequenz | u = f_min / f₁ | – | Nachweis f₁ ≥ f_min | freigegeben (2026-10-13, Seti) |
| V-OM | Kreisfrequenz | ω_n = (β_nL)² / L²·√(E·I / m′) | 1/s | Blevins Tab. 8.1 | freigegeben (2026-10-13, Seti) |
| V-PH-EE | Eigenform (beidseitig eingespannt), Ort des größten Ausschlags | φ(x) = cosh βx − cos βx − σ·(sinh βx − sin βx),  σ = (cosh βL − cos βL)/(sinh βL − sin βL);  normiert auf max \|φ\| = 1, erste Halbwelle positiv (nach unten) | mm | Blevins Tab. 8.1 | freigegeben (2026-10-13, Seti) |
| V-PH-EG | Eigenform (links eingespannt, rechts gelenkig), Ort des größten Ausschlags | φ(x) = cosh βx − cos βx − σ·(sinh βx − sin βx) (erfüllt φ(0) = φ′(0) = 0),  σ = (cosh βL − cos βL)/(sinh βL − sin βL) aus φ(L) = 0, gleichwertig σ = (cosh βL + cos βL)/(sinh βL + sin βL) aus φ″(L) = 0 wegen tan βL = tanh βL;  normiert auf max \|φ\| = 1, erste Halbwelle positiv (nach unten) | mm | Blevins Tab. 8.1 | freigegeben (2026-10-13, Seti) |
| V-PH-GG | Eigenform (gelenkig gelagert), Ort des größten Ausschlags | φ_n(x) = sin(nπ·x/L);  normiert auf max \|φ\| = 1, erste Halbwelle positiv (nach unten) | mm | Blevins Tab. 8.1 | freigegeben (2026-10-13, Seti) |
| V-PH-KR | Eigenform (Kragträger, links eingespannt), Ort des größten Ausschlags | φ(x) = cosh βx − cos βx − σ·(sinh βx − sin βx),  σ = (sinh βL − sin βL)/(cosh βL + cos βL);  normiert auf max \|φ\| = 1, erste Halbwelle positiv (nach unten) | mm | Blevins Tab. 8.1 | freigegeben (2026-10-13, Seti) |
| V-RQ | Rayleigh-Kontrolle (Plausibilität) | f_R = 1/(2π)·√(g·∫m′·w dx / ∫m′·w² dx),  w = Biegelinie unter Eigengewicht q = m′·g (Lastliste), m′ konstant;  obere Schranke: f_R ≥ f₁ | Hz | Rayleigh 1877; Sollwert 1 ≤ f_R / f₁ ≤ 1,02 | freigegeben (2026-10-13, Seti) |

## Werkstoff und Auslegungswerte

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| W-BB | Biegefestigkeit (Auslegungswert) | σ_bB = Auslegungswert aus der Datenbankzeile des Werkstoffs (Standard: unterer Wert) | MPa | dataholz Bauholz | freigegeben (2026-10-10, S. Frotscher) |
| W-E | E-Modul | E (Werkstoffdatenbank, Standardvariante) | MPa | WDB 1.1.1 | freigegeben (2026-10-08, Seti) |
| W-G | Schubmodul | G = E / (2·(1 + ν)) | MPa | ν Klassen-Richtwert (Annahme) | freigegeben (2026-10-08, Seti) |
| W-G-DB | Schubmodul | G (Werkstoffdatenbank) | MPa | BIKAR EN AW-6082 | freigegeben (2026-10-08, Seti) |
| W-RHO | Dichte | ρ (Werkstoffdatenbank) | kg/m³ | WDB 1.1.1 | freigegeben (2026-10-08, Seti) |
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

## Gültigkeit und Annahmen

- Linear-elastisch, kleine Verformungen, Bernoulli-Balken, statische Last, isotroper Werkstoff.
- Torsion Hohlprofile nach Bredt (t ≪ Abmessung); Rechteck voll nach Roark Tab. 10.1 (Näherung, < 0,2 % gegen Saint-Venant-Reihe).
- Vergleichsspannung GEH an der Randfaser; τ_Q separat (Maximum an der Nulllinie).
- Knicken: Euler für λ ≥ λ_T = π·√(2E/R_p), darunter Johnson-Parabel; keine Imperfektionen, keine Normknickkurven.
- Auslegungswert standardmäßig unterer Wert der Datenbankzeile; Normhöchstwerte liefern keinen Auslegungswert.
- Bemessen: Bisektion im log-Raum, 60 Schritte, Raster 1 mm (Wandstärke 0,5 mm).
- Druckbehälter: Lamé (Zylinder, Kugel), rotationssymmetrisch, ungestörte Wand weit vom Boden, isotherm; keine Böden, Stutzen, Beulen, Wärmespannungen, plastischen Reserven, kein Normnachweis (EN 13445, AD 2000). Bemessen geschlossen bei p_a = 0, sonst Bisektion, Raster 0,5 mm.
- Eigenfrequenz: Euler-Bernoulli-Balken, E·I und m′ = ρ·A + m_z konstant, Lagerungen KR, GG, EG, EE, starre Lager, keine Axialkraft, keine Dämpfung, Schwingung in der Lastebene; Hinweis bei L/h < 10 (Timoshenko). Wurzeln deterministisch (Einklammerung, Bisektion 80 Schritte), Einheiten N, mm, t, s. Bemessen nur formtreu.
- Rohrhydraulik (Modul fluid, ab 0.11.0): inkompressibel, stationär, voll ausgebildet, Newton'sches Fluid, Reihenschaltung; SI-Einheiten (m, kg, s, Pa absolut, m³/s, K). Wasser nach IAPWS-IF97 Region 1 und 4 und R12-08 (μ̄₂ = 1, 0 bis 350 °C, p ≥ p_s); andere Fluide nur an Tabellentemperaturen (fd_fluid_values) oder von Hand. λ laminar 64/Re (Re < 2 320), sonst Colebrook (Newton ab Roloff-Näherung, |Δx| < 10⁻¹², Übergang 2 320 bis 4 000 mit Warnung, Re ≤ 10⁸, k/d ≤ 0,05). ζ aus TB 18-7 mit Bezugsquerschnitt, Bogen linear über r/d, plötzliche Erweiterung nach Borda-Carnot. Energiebilanz nach Dubbel Gl. (17.10); Aufgaben B und C mit Bisektion (100 Schritte). Nicht im Umfang: Gase, vermaschte Netze, Zweiphasen, Druckstoß, Pumpenkennlinie (RH b).
