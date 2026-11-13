# Formelkatalog eng-core 0.19.0

Automatisch erzeugt mit `npx tsx scripts/formelkatalog.ts`. Nicht von Hand bearbeiten.
Freigaben laufen über die Excel-Datei: `python3 scripts/formelfreigabe.py export` → ausfüllen → `python3 scripts/formelfreigabe.py import <datei.xlsx>`.

Status: **Entwurf** = implementiert und gegengerechnet (verification/pruefung.py), **freigegeben** = vom Verantwortlichen geprüft, **abgelehnt** = Einwand offen (siehe unten), **geändert, neu prüfen** = Formel hat sich seit der Freigabe geändert.

Stand: 814 Formeln, davon 814 freigegeben, 0 abgelehnt, 0 neu zu prüfen, 0 Entwurf.

| Modul | Werkzeug | Präfixe | Formeln | freigegeben |
|---|---|---|---|---|
| gemeinsam | werkbank | Q, F, W | 96 | 96 |
| festigkeit | werkbank | B, Z, K, T, N, D, P, V, E | 165 | 165 |
| ashby | werkbank | A, C | 90 | 90 |
| fluid | fachtools | RH, PU, FS | 100 | 100 |
| verbindungen | fachtools | SV, PV | 152 | 152 |
| dichtungen | fachtools | OR | 0 | 0 |
| stabwerke | fachtools | FW | 0 | 0 |
| kinematik | greifwerk | G | 71 | 71 |
| elektrik | stromwerk | EL | 140 | 140 |

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

## Elektrotechnik: Grundlagen, Knotenpunktanalyse, Wechselstrom, Ersatzwiderstand, Vorlagen, Rechner (Hagmann, Weißgerber, IEC 60062, IEC 60063)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| EL-E01 | Ersatzwiderstand durch Reihen-/Parallelreduktion | R_ab = Ergebnis der Reduktion | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-E01-P | Parallelschaltung (R2 ∥ (R3 + R4)) | R_p = R_1 · R_2 / (R_1 + R_2) | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-E01-S | Reihenschaltung (R3 + R4) | R_s = R_1 + R_2 | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-E02 | Ersatzwiderstand über Testquelle (Knotenpunktanalyse) | R_ab = (u_a − u_b) / I_T | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-E03 | Gegenprüfung Reduktion gegen Testquelle | \|R_red − R_MNA\| / R_red ≤ 10⁻⁹ | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-G01-I | Strom | I = U / R | A |  | freigegeben (2026-11-12, Seti) |
| EL-G01-R | Widerstand | R = U / I | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-G01-U | Spannung | U = R · I | V |  | freigegeben (2026-11-12, Seti) |
| EL-G02-IPR | Strom | I = √(P / R) | A |  | freigegeben (2026-11-12, Seti) |
| EL-G02-IPU | Strom | I = P / U | A |  | freigegeben (2026-11-12, Seti) |
| EL-G02-IR | Leistung | P = I² · R | W |  | freigegeben (2026-11-12, Seti) |
| EL-G02-RPI | Widerstand | R = P / I² | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-G02-RPU | Widerstand | R = U² / P | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-G02-UI | Leistung | P = U · I | W |  | freigegeben (2026-11-12, Seti) |
| EL-G02-UPI | Spannung | U = P / I | V |  | freigegeben (2026-11-12, Seti) |
| EL-G02-UPR | Spannung | U = √(P · R) | V |  | freigegeben (2026-11-12, Seti) |
| EL-G02-UR | Leistung | P = U² / R | W |  | freigegeben (2026-11-12, Seti) |
| EL-G03 | Leitwert | G = 1 / R | S |  | freigegeben (2026-11-12, Seti) |
| EL-G04-C | Reihenschaltung Kapazitäten | 1 / C_ges = Σ 1 / C_i | F |  | freigegeben (2026-11-12, Seti) |
| EL-G04-L | Reihenschaltung Induktivitäten | L_ges = Σ L_i | H |  | freigegeben (2026-11-12, Seti) |
| EL-G04-R | Reihenschaltung Widerstände | R_ges = Σ R_i | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-G05-C | Parallelschaltung Kapazitäten | C_ges = Σ C_i | F |  | freigegeben (2026-11-12, Seti) |
| EL-G05-L | Parallelschaltung Induktivitäten | 1 / L_ges = Σ 1 / L_i | H |  | freigegeben (2026-11-12, Seti) |
| EL-G05-R | Parallelschaltung Widerstände | 1 / R_ges = Σ 1 / R_i | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-G06 | Unbelasteter Spannungsteiler | U_2 = U · R_2 / (R_1 + R_2) | V |  | freigegeben (2026-11-12, Seti) |
| EL-G07 | Stromteiler Zweig 1 | I_k = I · G_k / Σ G_i | A |  | freigegeben (2026-11-12, Seti) |
| EL-N01-LA | Widerstand Glühlampe H1 (warm, EL-E4) | R = U_N² / P_N | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-N01-PA | Teilwiderstand a–s P1 | R_as = x · R | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-N01-PB | Teilwiderstand s–b P1 | R_sb = (1 − x) · R | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-N01-R | Leitwert R1 | G = 1 / R | S |  | freigegeben (2026-11-12, Seti) |
| EL-N02 | Spannungsquelle U1 | u_+ − u_− = U | V |  | freigegeben (2026-11-12, Seti) |
| EL-N03 | Klemmenspannung B1 (Verbraucherzählpfeil, I < 0 bei Stromabgabe) | U_Kl = U_0 + R_i · I (Verbraucherzählpfeil) | V |  | freigegeben (2026-11-13, SETI) |
| EL-N04 | Stromquelle I1 | Einspeisung I_q am Pluspol | A |  | freigegeben (2026-11-12, Seti) |
| EL-N05 | Kondensator C1 bei Gleichstrom (offen) | I_C = 0 | A |  | freigegeben (2026-11-12, Seti) |
| EL-N06 | Spule L1 bei Gleichstrom | U_L = r · I | V |  | freigegeben (2026-11-12, Seti) |
| EL-N07 | Strom durch A1 (Kurzschlussbrücke) | u_a − u_b = 0, I = x_k (Zweigstrom) | A |  | freigegeben (2026-11-13, SETI) |
| EL-N08 | Anzeige V1 | U_V = u_a − u_b | V |  | freigegeben (2026-11-12, Seti) |
| EL-N09-I | Primärstrom T1 | i_p = −(n_2 / n_1) · i_s | A |  | freigegeben (2026-11-12, Seti) |
| EL-N09-U | Sekundärspannung T1 | u_s = (n_2 / n_1) · u_p | V |  | freigegeben (2026-11-12, Seti) |
| EL-N10 | Lineares Gleichungssystem der Knotenpunktanalyse | A · x = z | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-N11-I | Strom R1 | I = G · U | A |  | freigegeben (2026-11-12, Seti) |
| EL-N11-IQ | Strom I1 (Verbraucherzählpfeil) | I = −I_q | A |  | freigegeben (2026-11-12, Seti) |
| EL-N11-IV | Strom U1 | I = x_k (Zweigstrom) | A |  | freigegeben (2026-11-12, Seti) |
| EL-N11-P | Leistung U1 | P = U · I | W |  | freigegeben (2026-11-12, Seti) |
| EL-N11-U | Spannung U1 | U = u_a − u_b | V |  | freigegeben (2026-11-12, Seti) |
| EL-N12 | Leistungsbilanz | Σ P = 0 | W |  | freigegeben (2026-11-12, Seti) |
| EL-N13-C | Auslastung C1 | a = \|U\| / U_max | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-N13-CA | Auslastung C1 (Scheitelwert) | a = √2 · \|U\| / U_max | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-N13-R | Auslastung R1 | a = \|P\| / P_max | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-R1 | Widerstand aus 4 Ringen | R = (10 · z_1 + z_2) · 10^m | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-R1-5 | Widerstand aus 5 Ringen | R = (100 · z_1 + 10 · z_2 + z_3) · 10^m | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-R1-TO | Obere Grenze | R_max = R · (1 + t) | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-R1-TU | Untere Grenze | R_min = R · (1 − t) | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-R2-A | Relative Abweichung | Δ = (X_N − X) / X | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-R2-N | Nächster Normwert E12 | X_N = nächster Normwert (logarithmischer Abstand) | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-R4-C | Kapazität des Pakets | C_ges = m · C | A·s |  | freigegeben (2026-11-12, Seti) |
| EL-R4-CR | C-Rate | C-Rate = I / C_ges | 1/h |  | freigegeben (2026-11-12, Seti) |
| EL-R4-E | Energieinhalt | E = U_ges · C_ges | J |  | freigegeben (2026-11-12, Seti) |
| EL-R4-T | Laufzeit | t = η_n · C_ges / I | s |  | freigegeben (2026-11-12, Seti) |
| EL-R4-U | Spannung des Pakets | U_ges = n · U | V |  | freigegeben (2026-11-12, Seti) |
| EL-R5-IS | Strangstrom (Stern) | I_Str = I_L | A |  | freigegeben (2026-11-12, Seti) |
| EL-R5-ISD | Strangstrom (Dreieck) | I_Str = I_L / √3 | A |  | freigegeben (2026-11-12, Seti) |
| EL-R5-P | Wirkleistung | P = √3 · U_L · I_L · cos φ | W |  | freigegeben (2026-11-12, Seti) |
| EL-R5-Q | Blindleistung | Q = S · sin φ | var |  | freigegeben (2026-11-12, Seti) |
| EL-R5-S | Scheinleistung | S = √3 · U_L · I_L | VA |  | freigegeben (2026-11-12, Seti) |
| EL-R5-US | Strangspannung (Stern) | U_Str = U_L / √3 | V |  | freigegeben (2026-11-12, Seti) |
| EL-R5-USD | Strangspannung (Dreieck) | U_Str = U_L | V |  | freigegeben (2026-11-12, Seti) |
| EL-R6-I | Stromaufnahme (Drehstrom) | I = P_zu / (√3 · U · cos φ) | A |  | freigegeben (2026-11-12, Seti) |
| EL-R6-M | Drehmoment | M = P / (2π · n) | N·m |  | freigegeben (2026-11-12, Seti) |
| EL-R6-NS | Synchrone Drehzahl | n_s = f / p | 1/s |  | freigegeben (2026-11-12, Seti) |
| EL-R6-PZ | Aufgenommene Leistung | P_zu = P / η | W |  | freigegeben (2026-11-12, Seti) |
| EL-R6-S | Schlupf | s = (n_s − n) / n_s | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S0-GP | Gegenprüfung U_2L: analytisch gegen Netzwerk | δ = \|X_analytisch − X_Netz\| / \|X_analytisch\| | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S0-N | R2: Normwert E24 | X_N = nächster Normwert (logarithmischer Abstand) | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-S0-NH | R: Normwert E24 (nächsthöher) | X_N = kleinster Normwert ≥ X | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-S0-UA | Ausgangsspannung | U_a = \|H\| · U_e | V |  | freigegeben (2026-11-12, Seti) |
| EL-S1-DU | Spannungseinbruch durch die Last | ΔU = (U_2 − U_2L) / U_2 | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S1-IL | Laststrom | I_L = U_2L / R_L | A |  | freigegeben (2026-11-12, Seti) |
| EL-S1-IQ | Querstrom durch R2 | I_q = U_2L / R_2 | A |  | freigegeben (2026-11-12, Seti) |
| EL-S1-Q | Querstromverhältnis | q = I_q / I_L | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S1-R2 | R2 für die Zielspannung (unbelastet) | R_2 = R_1 · U_2 / (U − U_2) | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-S1-RP | R2 parallel zur Last | R_2L = R_2 · R_L / (R_2 + R_L) | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-S1-U2L | Belastete Ausgangsspannung | U_2L = U · R_2L / (R_1 + R_2L) | V |  | freigegeben (2026-11-12, Seti) |
| EL-S2-C | C für die Grenzfrequenz | C = 1 / (2π · f_g · R) | F |  | freigegeben (2026-11-12, Seti) |
| EL-S2-FG | Grenzfrequenz | f_g = 1 / (2π · R · C) | Hz |  | freigegeben (2026-11-12, Seti) |
| EL-S2-H | Betrag der Übertragungsfunktion (Tiefpass) | \|H\| = 1 / √(1 + (f / f_g)²) | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S2-PHI | Phase (Tiefpass) | φ = −arctan(f / f_g) | ° |  | freigegeben (2026-11-12, Seti) |
| EL-S2-TAU | Zeitkonstante | τ = R · C | s |  | freigegeben (2026-11-12, Seti) |
| EL-S3-H | Betrag der Übertragungsfunktion (Hochpass) | \|H\| = (f / f_g) / √(1 + (f / f_g)²) | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S3-PHI | Phase (Hochpass) | φ = 90° − arctan(f / f_g) | ° |  | freigegeben (2026-11-12, Seti) |
| EL-S3-R | R für die Grenzfrequenz | R = 1 / (2π · f_g · C) | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-S4-B | Bandbreite | B = f_0 / Q | Hz |  | freigegeben (2026-11-12, Seti) |
| EL-S4-C | C für die Resonanzfrequenz | C = 1 / ((2π · f_0)² · L) | F |  | freigegeben (2026-11-12, Seti) |
| EL-S4-F0 | Resonanzfrequenz | f_0 = 1 / (2π · √(L · C)) | Hz |  | freigegeben (2026-11-12, Seti) |
| EL-S4-FO | Obere Grenzfrequenz | f_o = f_0 · (√(1 + 1 / (4Q²)) + 1 / (2Q)) | Hz |  | freigegeben (2026-11-12, Seti) |
| EL-S4-FU | Untere Grenzfrequenz | f_u = f_0 · (√(1 + 1 / (4Q²)) − 1 / (2Q)) | Hz |  | freigegeben (2026-11-12, Seti) |
| EL-S4-H | Bandpass bei f_u (Kontrolle 1/√2) | \|H_R\| = 1 / √(1 + Q² · (f / f_0 − f_0 / f)²) | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S4-HC | Kondensatorspannung bei f_0 | U_C / U = \|H_R\| / (ω · R · C) | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S4-I0 | Strom bei Resonanz | I_0 = U / R | A |  | freigegeben (2026-11-12, Seti) |
| EL-S4-Q | Güte | Q = (1 / R) · √(L / C) | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-S4-UC | Kondensatorspannung bei Resonanz | U_C0 = Q · U | V |  | freigegeben (2026-11-12, Seti) |
| EL-S5-I | LED-Strom | I = (U − U_F) / R | A |  | freigegeben (2026-11-12, Seti) |
| EL-S5-PL | Leistung in der LED | P_LED = U_F · I | W |  | freigegeben (2026-11-12, Seti) |
| EL-S5-PR | Leistung im Vorwiderstand | P_R = I² · R | W |  | freigegeben (2026-11-12, Seti) |
| EL-S5-R | Vorwiderstand für den LED-Strom | R = (U − U_F) / I_F | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-S6-I | Lade- bzw. Entladestrom (Betrag) | i(t) = (U / R) · e^(−t/τ) | A |  | freigegeben (2026-11-12, Seti) |
| EL-S6-R | R für die Zeitkonstante | R = τ / C | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-S6-TAU | Zeitkonstante | τ = R · C | s |  | freigegeben (2026-11-12, Seti) |
| EL-S6-TE | Entladezeit bis 1 % | t = −τ · ln(u / U) | s |  | freigegeben (2026-11-12, Seti) |
| EL-S6-TZ | Ladezeit bis 99 % | t = −τ · ln(1 − u / U) | s |  | freigegeben (2026-11-12, Seti) |
| EL-S6-UE | Kondensatorspannung beim Entladen | u_C(t) = U · e^(−t/τ) | V |  | freigegeben (2026-11-12, Seti) |
| EL-S6-UL | Kondensatorspannung beim Laden | u_C(t) = U · (1 − e^(−t/τ)) | V |  | freigegeben (2026-11-12, Seti) |
| EL-S6-W | Gespeicherte Energie (voll geladen) | W = ½ · C · U² | J |  | freigegeben (2026-11-12, Seti) |
| EL-S7-R4 | R4 für den Abgleich (U_d = 0) | R_4 = R_3 · R_2 / R_1 | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-S7-UD | Brückenspannung | U_d = U · (R_2 / (R_1 + R_2) − R_4 / (R_3 + R_4)) | V |  | freigegeben (2026-11-12, Seti) |
| EL-S8-I | Strom beim Einschalten | i(t) = (U / R) · (1 − e^(−t/τ)) | A |  | freigegeben (2026-11-12, Seti) |
| EL-S8-IE | Endstrom | I_∞ = U / R | A |  | freigegeben (2026-11-12, Seti) |
| EL-S8-L | L für die Zeitkonstante | L = τ · R | H |  | freigegeben (2026-11-12, Seti) |
| EL-S8-TAU | Zeitkonstante | τ = L / R | s |  | freigegeben (2026-11-12, Seti) |
| EL-S8-UL | Spulenspannung beim Einschalten | u_L(t) = U · e^(−t/τ) | V |  | freigegeben (2026-11-12, Seti) |
| EL-S8-W | Gespeicherte Energie (Endstrom) | W = ½ · L · I_∞² | J |  | freigegeben (2026-11-12, Seti) |
| EL-W01 | Kreisfrequenz | ω = 2π · f | 1/s |  | freigegeben (2026-11-12, Seti) |
| EL-W02-C | Impedanz C1 | Z_C = 1 / (jωC) | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-W02-L | Impedanz L1 | Z_L = r + jωL | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-W02-R | Impedanz R1 | Z_R = R | Ω |  | freigegeben (2026-11-12, Seti) |
| EL-W03 | Zeiger der Quelle AC1 (Effektivwert) | U = U_eff · e^(jφ) | V |  | freigegeben (2026-11-12, Seti) |
| EL-W04 | Komplexes Gleichungssystem der Knotenpunktanalyse | Y · u = i | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-W04-I | Strom R1 | I = Y · U | A |  | freigegeben (2026-11-12, Seti) |
| EL-W04-IV | Strom AC1 | I = x_k (Zweigstrom) | A |  | freigegeben (2026-11-12, Seti) |
| EL-W04-U | Spannung AC1 | U = u_a − u_b | V |  | freigegeben (2026-11-12, Seti) |
| EL-W05-B | Leistungsbilanz Wechselstrom | Σ S = 0 | VA |  | freigegeben (2026-11-12, Seti) |
| EL-W05-CP | Leistungsfaktor λ AC1 (Abgabe von Wirkleistung) | λ = \|P\| / \|S\| | 1 |  | freigegeben (2026-11-13, SETI) |
| EL-W05-P | Wirkleistung AC1 | P = Re S | W |  | freigegeben (2026-11-12, Seti) |
| EL-W05-Q | Blindleistung AC1 | Q = Im S | var |  | freigegeben (2026-11-12, Seti) |
| EL-W05-S | Scheinleistung AC1 | S = U · I* | VA |  | freigegeben (2026-11-12, Seti) |
| EL-W06-DB | Verstärkung im Maximum | G = 20 · lg \|H\| | dB |  | freigegeben (2026-11-12, Seti) |
| EL-W06-H | Übertragungsfunktion im Maximum | H = U_aus / U_ein | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-W06-PHI | Phase im Maximum | φ = arg H | ° |  | freigegeben (2026-11-12, Seti) |
| EL-W07 | Frequenzpunkte logarithmisch | f_k = f_min · (f_max / f_min)^(k / (N − 1)) | 1 |  | freigegeben (2026-11-12, Seti) |
| EL-W08 | −3-dB-Punkt 1 | G(f) = G_max − 20 · lg √2 | Hz |  | freigegeben (2026-11-12, Seti) |

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
| FS-IF-G2 | Weitere Ableitungen der Gibbs-Funktion | γ_ππ, γ_τ, γ_ττ, γ_πτ aus den 34 Gliedern | 1 | IAPWS-IF97 (R7-97, 2012), Tab. 2 und 4 | freigegeben (2026-11-06, Seti) |
| FS-IF-GP | Ableitung der Gibbs-Funktion | γ_π = Σ −n_i·I_i·(7,1 − π)^(I_i−1)·(τ − 1,222)^J_i | 1 | IAPWS-IF97 (R7-97, 2012), Tab. 2 und 4 | freigegeben (2026-10-29, Seti) |
| FS-IF-PI | Reduzierter Druck (IF97 Region 1) | π = p/16,53 MPa; τ = 1 386 K/T | 1 | IAPWS-IF97 (R7-97, 2012), Gl. (7) | freigegeben (2026-10-29, Seti) |
| FS-IF-PS | Sättigungsdruck | p_s = 1 MPa·[2C/(−B + √(B² − 4AC))]⁴ | Pa | IAPWS-IF97 (R7-97, 2012), Gl. (30), Tab. 34 | freigegeben (2026-10-29, Seti) |
| FS-IF-RHO | Dichte Wasser | ρ = p/(R·T·π·γ_π) | kg/m³ | IAPWS-IF97 (R7-97, 2012), Tab. 3, Gl. (1) | freigegeben (2026-10-29, Seti) |
| FS-IF-W | Schallgeschwindigkeit Wasser | w = √(R·T·γ_π²/[(γ_π − τ·γ_πτ)²/(τ²·γ_ττ) − γ_ππ]) | m/s | IAPWS-IF97 (R7-97, 2012), Tab. 3 | freigegeben (2026-11-06, Seti) |
| FS-K | Kompressionsmodul (isentrop) | K = ρ·w² | Pa | Definition; IAPWS-IF97 (R7-97, 2012), Tab. 3 | freigegeben (2026-11-06, Seti) |
| FS-K-MAN | Kompressionsmodul (Eingabe) | K = Eingabe | Pa | Eingabe | freigegeben (2026-11-06, Seti) |
| FS-K-TAB | Dichte und Kompressionsmodul (Tabellenwert) | ρ, K aus fd_bulk_modulus | Pa | Tab. 2-2 (S. 54) (Q234) | freigegeben (2026-11-06, Seti) |
| FS-MAN-NU | Kinematische Viskosität (Eingabe) | ν = Eingabe | m²/s | Eingabe | freigegeben (2026-10-29, Seti) |
| FS-MAN-RHO | Dichte (Eingabe) | ρ = Eingabe | kg/m³ | Eingabe | freigegeben (2026-10-29, Seti) |
| FS-MU | Dynamische Viskosität Wasser | η = 1 µPa·s·μ̄_0·μ̄_1 (μ̄_2 = 1) | Pa·s | IAPWS R12-08, Gl. (10), Abschn. 3 | freigegeben (2026-10-29, Seti) |
| FS-MU-0 | Viskosität Gasgrenze | μ̄_0 = 100·√T̄ / Σ H_i/T̄^i | 1 | IAPWS R12-08, Gl. (11), Tab. 1 | freigegeben (2026-10-29, Seti) |
| FS-MU-1 | Viskosität Dichteeinfluss | μ̄_1 = exp[ρ̄·Σ_i (1/T̄ − 1)^i·Σ_j H_ij·(ρ̄ − 1)^j] | 1 | IAPWS R12-08, Gl. (12), Tab. 2 | freigegeben (2026-10-29, Seti) |
| FS-NU | Kinematische Viskosität | ν = η/ρ | m²/s | Definition | freigegeben (2026-10-29, Seti) |
| FS-TAB-NU | Kinematische Viskosität (Tabellenwert) | ν aus fd_fluid_values (mm²/s · 10⁻⁶) | m²/s | TB 18-9 (bei ca. 1 bar) (Q219) | freigegeben (2026-10-29, Seti) |
| FS-TAB-RHO | Dichte (Tabellenwert) | ρ aus fd_fluid_values | kg/m³ | TB 18-9 (bei ca. 1 bar) (Q219) | freigegeben (2026-10-29, Seti) |
| FS-WA-KM | Walther-Konstanten aus zwei Stützpunkten | m = [W(ν₁) − W(ν₂)]/(lg T₂ − lg T₁); K = W(ν₁) + m·lg T₁; W(ν) = lg lg(ν + C) | 1 | Dubbel 26 Bd. 1 Kap. 33 (S. 681) | freigegeben (2026-11-06, Seti) |
| FS-WA-N | Gültigkeitsbereich Walther | T₁ − 20 K ≤ T ≤ T₂ + 20 K | K | Verfahren (R21) | freigegeben (2026-11-06, Seti) |
| FS-WA-NU | Kinematische Viskosität Öl (Walther) | ν = 10^(10^(K − m·lg T)) − C (ν in mm²/s, T in K) | m²/s | Dubbel 26 Bd. 1 Kap. 33 (S. 681) | freigegeben (2026-11-06, Seti) |

## Kinematik: Orientierung, Lage, DH und Vorwärtskinematik (Lynch/Park Kap. 3, 4 und Anhang B, C, Weber/Koch Kap. 2, 3, ISO 9787)

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| G-01-X | Elementardrehung um x | R_x(θ) = [1 0 0; 0 cos θ −sin θ; 0 sin θ cos θ] | 1 | Lynch/Park S. 62, Rot(x̂, θ); Weber/Koch Gl. (2.18), (2.21) | freigegeben (2026-11-01, Seti) |
| G-01-Y | Elementardrehung um y | R_y(θ) = [cos θ 0 sin θ; 0 1 0; −sin θ 0 cos θ] | 1 | Lynch/Park S. 62, Rot(ŷ, θ); Weber/Koch Gl. (2.18), (2.21) | freigegeben (2026-11-01, Seti) |
| G-01-Z | Elementardrehung um z | R_z(θ) = [cos θ −sin θ 0; sin θ cos θ 0; 0 0 1] | 1 | Lynch/Park S. 62, Rot(ẑ, θ); Weber/Koch Gl. (2.18), (2.21) | freigegeben (2026-11-01, Seti) |
| G-02 | Rotationsmatrix aus Z-Y-X-Winkeln (A, B, C) | R = R_z(A)·R_y(B)·R_x(C); mitgedreht um z, y′, x″, gleichwertig fest um x, y, z | 1 | Lynch/Park Gl. (B.1), (B.8) mit (α, β, γ) = (A, B, C); Weber/Koch Gl. (2.21) | freigegeben (2026-11-01, Seti) |
| G-03 | Rotationsmatrix aus Z-Y-Z-Winkeln (φ, θ, ψ) | R = R_z(φ)·R_y(θ)·R_z(ψ); mitgedreht um z, y′, z″ | 1 | Lynch/Park Gl. (B.6) mit (α, β, γ) = (φ, θ, ψ); Weber/Koch Gl. (2.18) mit (α, β, χ) = (φ, θ, ψ) | freigegeben (2026-11-01, Seti) |
| G-04 | Rotationsmatrix aus Achse und Winkel (Rodrigues) | R = I + sin θ·[ω̂] + (1 − cos θ)·[ω̂]² | 1 | Lynch/Park Gl. (3.51), (3.52); Weber/Koch Kap. 2.1.10 | freigegeben (2026-11-01, Seti) |
| G-04-N | Einheitsachse | ω̂ = ω/‖ω‖ | 1 | Lynch/Park Gl. (3.51), ‖ω̂‖ = 1 | freigegeben (2026-11-01, Seti) |
| G-05 | Rotationsmatrix aus Quaternion | R = [w² + x² − y² − z²  2(xy − wz)  2(xz + wy); 2(xy + wz)  w² − x² + y² − z²  2(yz − wx); 2(xz − wy)  2(yz + wx)  w² − x² − y² + z²] | 1 | Lynch/Park Gl. (B.12) mit (q₀, q₁, q₂, q₃) = (w, x, y, z) | freigegeben (2026-11-01, Seti) |
| G-05-N | Einheitsquaternion | q̂ = q/‖q‖, q = (w, x, y, z) | 1 | Lynch/Park Anhang B.3, ‖q‖ = 1 | freigegeben (2026-11-01, Seti) |
| G-06-A | Winkel A (um z) | A = atan2(r_21, r_11) | rad | Lynch/Park Anhang B.1.1, Gl. (B.3) bis (B.5); Weber/Koch Gl. (2.22) | freigegeben (2026-11-01, Seti) |
| G-06-B | Winkel B (um y′) | B = atan2(−r_31, √(r_11² + r_21²)) | rad | Lynch/Park Anhang B.1.1, Gl. (B.3) bis (B.5); Weber/Koch Gl. (2.22) | freigegeben (2026-11-01, Seti) |
| G-06-C | Winkel C (um x″) | C = atan2(r_32, r_33) | rad | Lynch/Park Anhang B.1.1, Gl. (B.3) bis (B.5); Weber/Koch Gl. (2.22) | freigegeben (2026-11-01, Seti) |
| G-06-KN | Kardansperre B = −90°: C bei A = 0 | Kardansperre B = −90° (√(r_11² + r_21²) ≤ 10⁻⁹, r_31 > 0): A = 0, C = atan2(−r_12, r_22) | rad | Lynch/Park Anhang B.1.1 (c); Weber/Koch Gl. (2.23): nur A + C bestimmt (dort Vorzeichen: richtig A + C = atan2(−r_23, −r_13)) | freigegeben (2026-11-01, Seti) |
| G-06-KP | Kardansperre B = +90°: C bei A = 0 | Kardansperre B = +90° (√(r_11² + r_21²) ≤ 10⁻⁹, r_31 < 0): A = 0, C = atan2(r_12, r_22) | rad | Lynch/Park Anhang B.1.1 (b); Weber/Koch Gl. (2.23): nur A − C bestimmt | freigegeben (2026-11-01, Seti) |
| G-07-K0 | Sonderfall θ = 0: ψ bei φ = 0 | Sonderfall θ = 0 (√(r_31² + r_32²) ≤ 10⁻⁹, r_33 > 0): φ = 0, ψ = atan2(r_21, r_11) | rad | Weber/Koch Gl. (2.20): nur φ + ψ bestimmt | freigegeben (2026-11-01, Seti) |
| G-07-K180 | Sonderfall θ = 180°: ψ bei φ = 0 | Sonderfall θ = 180° (√(r_31² + r_32²) ≤ 10⁻⁹, r_33 < 0): φ = 0, ψ = atan2(r_21, r_22) | rad | Lynch/Park Gl. (B.6) mit β = 180°: nur φ − ψ bestimmt | freigegeben (2026-11-01, Seti) |
| G-07-P | Winkel φ (um z) | φ = atan2(r_23, r_13) | rad | Lynch/Park Gl. (B.6), Lösung analog B.1.1; Weber/Koch Gl. (2.19) (dort χ ohne Minus: richtig χ = atan2(r_32, −r_31)) | freigegeben (2026-11-01, Seti) |
| G-07-S | Winkel ψ (um z″) | ψ = atan2(r_32, −r_31) | rad | Lynch/Park Gl. (B.6), Lösung analog B.1.1; Weber/Koch Gl. (2.19) (dort χ ohne Minus: richtig χ = atan2(r_32, −r_31)) | freigegeben (2026-11-01, Seti) |
| G-07-T | Winkel θ (um y′) | θ = atan2(√(r_31² + r_32²), r_33) | rad | Lynch/Park Gl. (B.6), Lösung analog B.1.1; Weber/Koch Gl. (2.19) (dort χ ohne Minus: richtig χ = atan2(r_32, −r_31)) | freigegeben (2026-11-01, Seti) |
| G-08-0 | Sonderfall θ = 0: Achse unbestimmt | Sonderfall θ = 0 (θ ≤ 10⁻¹²): ω̂ unbestimmt, gesetzt ω̂ = (0, 0, 1) | 1 | Lynch/Park Algorithmus S. 74 (a) | freigegeben (2026-11-01, Seti) |
| G-08-S | Drehachse ω̂ (θ > 90°, symmetrischer Anteil) | θ > 90°: ω̂_k = √((r_kk − cos θ)/(1 − cos θ)), k = größtes r_kk; ω̂_j = (r_jk + r_kj)/(2·(1 − cos θ)·ω̂_k); Vorzeichen mit ω̂·v ≥ 0, bei v = 0 (θ = 180°) erste von 0 verschiedene Komponente in x, y, z positiv | 1 | Lynch/Park Gl. (3.52), (3.55) bis (3.60) verallgemeinert auf θ > 90° | freigegeben (2026-11-01, Seti) |
| G-08-T | Drehwinkel θ | θ = atan2(½·‖v‖, ½·(tr R − 1)), v = (r_32 − r_23, r_13 − r_31, r_21 − r_12) | rad | Lynch/Park Gl. (3.53), (3.54), Algorithmus S. 74 f.; atan2 statt arccos (gleichwertig, genauer nahe 0 und 180°) | freigegeben (2026-11-01, Seti) |
| G-08-W | Drehachse ω̂ (θ ≤ 90°) | ω̂ = v/(2·sin θ) = v/‖v‖ | 1 | Lynch/Park Gl. (3.53), (3.54), Algorithmus S. 74 f., Gl. (3.61) | freigegeben (2026-11-01, Seti) |
| G-09-V | Quaternion eindeutig (Vorzeichen) | q und −q beschreiben dieselbe Drehung: Vorzeichen so, dass w ≥ 0; bei \|w\| ≤ 10⁻¹² erste von 0 verschiedene Komponente in x, y, z positiv | 1 | Lynch/Park Anhang B.3 (q und −q); Konzept K1, Abschnitt 2 | freigegeben (2026-11-01, Seti) |
| G-09-W | Quaternion, Zweig tr R | tr R größtes Glied: w = ½·√(1 + tr R), x = (r_32 − r_23)/(4w), y = (r_13 − r_31)/(4w), z = (r_21 − r_12)/(4w) | 1 | Lynch/Park Gl. (B.10), (B.11); Weber/Koch Gl. (2.29) | freigegeben (2026-11-01, Seti) |
| G-09-X | Quaternion, Zweig r_11 | r_11 größtes Glied: x = ½·√(1 + r_11 − r_22 − r_33), w = (r_32 − r_23)/(4x), y = (r_12 + r_21)/(4x), z = (r_13 + r_31)/(4x) | 1 | Lynch/Park Gl. (B.10), (B.11); Weber/Koch Gl. (2.29); Zweig nach Shepperd | freigegeben (2026-11-01, Seti) |
| G-09-Y | Quaternion, Zweig r_22 | r_22 größtes Glied: y = ½·√(1 − r_11 + r_22 − r_33), w = (r_13 − r_31)/(4y), x = (r_12 + r_21)/(4y), z = (r_23 + r_32)/(4y) | 1 | Lynch/Park Gl. (B.10), (B.11); Weber/Koch Gl. (2.29); Zweig nach Shepperd | freigegeben (2026-11-01, Seti) |
| G-09-Z | Quaternion, Zweig r_33 | r_33 größtes Glied: z = ½·√(1 − r_11 − r_22 + r_33), w = (r_21 − r_12)/(4z), x = (r_13 + r_31)/(4z), y = (r_23 + r_32)/(4z) | 1 | Lynch/Park Gl. (B.10), (B.11); Weber/Koch Gl. (2.29); Zweig nach Shepperd | freigegeben (2026-11-01, Seti) |
| G-10-D | Determinante | det R = +1 (rechtshändig), Toleranz 10⁻⁹ | 1 | Lynch/Park Gl. (3.21); ISO 9787:2013, 4.1 | freigegeben (2026-11-01, Seti) |
| G-10-O | Orthogonalität | e = ‖RᵀR − I‖_F, gültig für e ≤ 10⁻⁹ | 1 | Lynch/Park Gl. (3.19) | freigegeben (2026-11-01, Seti) |
| G-11-F | Drehung um feste Achse (links multiplizieren) | Drehung um feste Achse (in {a}): R′ = Rot·R | 1 | Lynch/Park Gl. (3.23) | freigegeben (2026-11-01, Seti) |
| G-11-I | Umkehrung | R_ba = R_ab⁻¹ = R_abᵀ | 1 | Lynch/Park Prop. 3.3, S. 61 | freigegeben (2026-11-01, Seti) |
| G-11-M | Drehung um mitgedrehte Achse (rechts multiplizieren) | Drehung um mitgedrehte Achse (in {b}): R″ = R·Rot | 1 | Lynch/Park Gl. (3.24) | freigegeben (2026-11-01, Seti) |
| G-11-V | Verkettung | R_ac = R_ab·R_bc | 1 | Lynch/Park Gl. (3.22) | freigegeben (2026-11-01, Seti) |
| G-12 | Vektor in {a} ausdrücken | p_a = R_ab·p_b | m | Lynch/Park S. 62 (Rab·pb = pa) | freigegeben (2026-11-01, Seti) |
| G-13 | Homogene Transformation aus R und p | T = [R p; 0 0 0 1], R = Orientierung, p = Ursprung von {b} in {a} | m | Lynch/Park Def. 3.13, Gl. (3.62); Weber/Koch Gl. (2.12) | freigegeben (2026-11-07, Seti) |
| G-13-P | Homogene Transformation aus Pose (x, y, z, A, B, C) | T = [R_z(A)·R_y(B)·R_x(C)  (x, y, z)ᵀ; 0 0 0 1], R nach G-02 | m | Lynch/Park Gl. (3.62) mit R aus Gl. (B.8); Weber/Koch Gl. (2.12), (2.21); Pose wie KUKA-Frame (X, Y, Z, A, B, C) | freigegeben (2026-11-07, Seti) |
| G-13-X | Pose aus homogener Transformation | (x, y, z) = p; (A, B, C) aus R nach G-06; Ergebnis (x, y, z in m; A, B, C in rad) | m | Lynch/Park Def. 3.13 und Anhang B.1.1; Weber/Koch Gl. (2.22) | freigegeben (2026-11-07, Seti) |
| G-13-Z | Zerlegung in R und p | R = (t_ij), i, j = 1…3; p = (t_14, t_24, t_34) | m | Lynch/Park Def. 3.13 | freigegeben (2026-11-07, Seti) |
| G-14 | Letzte Zeile der homogenen Transformation | e_4 = ‖(t_41, t_42, t_43, t_44) − (0, 0, 0, 1)‖, gültig für e_4 ≤ 10⁻⁹ (zusammen mit G-10-O, G-10-D) | 1 | Lynch/Park Def. 3.13, Gl. (3.62) | freigegeben (2026-11-07, Seti) |
| G-15 | Inverse der homogenen Transformation | T_ba = T_ab⁻¹ = [R_abᵀ  −R_abᵀ·p_ab; 0 0 0 1] | m | Lynch/Park Prop. 3.15, Gl. (3.64); Weber/Koch Gl. (2.16) | freigegeben (2026-11-07, Seti) |
| G-15-K | Kontrolle der Inversen | e = ‖T·T⁻¹ − I‖_F (4×4), Rundungsfehler im Bereich 10⁻¹⁵ | 1 | Lynch/Park Prop. 3.15 | freigegeben (2026-11-07, Seti) |
| G-15-P | Ursprung von {a} in {b} | p_ba = −R_abᵀ·p_ab | m | Weber/Koch Gl. (2.16); Lynch/Park Gl. (3.64) | freigegeben (2026-11-07, Seti) |
| G-16 | Verkettung zweier Transformationen | T_ac = T_ab·T_bc | m | Lynch/Park S. 78 (T_ab·T_bc = T_ac), Prop. 3.16; Weber/Koch Gl. (2.17) | freigegeben (2026-11-07, Seti) |
| G-16-N | Kette aus n Transformationen | T_0n = T_01·T_12·…·T_(n−1)n (Zwischenprodukte T_0k nacheinander) | m | Weber/Koch Gl. (2.17); Lynch/Park S. 78, Bsp. 3.19 | freigegeben (2026-11-07, Seti) |
| G-16-P | Ursprung der Verkettung | p_ac = R_ab·p_bc + p_ab | m | Lynch/Park Gl. (3.62) ausmultipliziert | freigegeben (2026-11-07, Seti) |
| G-16-R | Orientierung der Verkettung | R_ac = R_ab·R_bc | 1 | Lynch/Park Gl. (3.62) ausmultipliziert | freigegeben (2026-11-07, Seti) |
| G-17 | Punkt in {a} ausdrücken (Ortsvektor) | [x_a; 1] = T_ab·[x_b; 1], also x_a = R_ab·x_b + p_ab | m | Lynch/Park Gl. (3.65); Weber/Koch Gl. (2.14) | freigegeben (2026-11-07, Seti) |
| G-18 | Richtung in {a} ausdrücken (freier Vektor) | [v_a; 0] = T_ab·[v_b; 0], also v_a = R_ab·v_b | m | Weber/Koch Gl. (2.13); Lynch/Park S. 77 f. | freigegeben (2026-11-07, Seti) |
| G-19-F | Verschieben im festen Rahmen (links multiplizieren) | T_sb′ = T_op·T_sb: erst drehen um ω̂ in {s}, dann verschieben um p in {s} | m | Lynch/Park Gl. (3.66), Abb. 3.15 links | freigegeben (2026-11-07, Seti) |
| G-19-M | Verschieben im mitgedrehten Rahmen (rechts multiplizieren) | T_sb″ = T_sb·T_op: erst verschieben um p in {b}, dann drehen um ω̂ von {b} | m | Lynch/Park Gl. (3.67), Abb. 3.15 rechts | freigegeben (2026-11-07, Seti) |
| G-19-R | Drehoperator Rot(ω̂, θ) | Rot(ω̂, θ) = [R 0; 0 0 0 1], R nach G-04 | m | Lynch/Park S. 79 | freigegeben (2026-11-07, Seti) |
| G-19-T | Verschiebeoperator Trans(p) | Trans(p) = [I p; 0 0 0 1] | m | Lynch/Park S. 79 | freigegeben (2026-11-07, Seti) |
| G-20-A | Werkzeug im Aufgabensystem | T_kt = T_0k⁻¹·T_0t (Lage des TCP im Aufgaben- bzw. BASE-System) | m | ISO 9787:2013, 5.6; Lynch/Park S. 78 (T_de = T_ed⁻¹) | freigegeben (2026-11-07, Seti) |
| G-20-F | Flansch-Soll aus TCP-Soll | T_1m = T_01⁻¹·T_0t,soll·T_mt⁻¹ (Umstellen von G-20-K) | m | G-20-K umgestellt; Lynch/Park Prop. 3.15, 3.17 | freigegeben (2026-11-07, Seti) |
| G-20-K | Werkzeug in Welt (Rahmenkette ISO 9787) | T_0t = T_01·T_1m·T_mt (Welt, Basis, Flansch, Werkzeug) | m | ISO 9787:2013, 5.1 bis 5.4; Weber/Koch Kap. 2 (DH, Werkzeugsystem am letzten Gliedsystem); Lynch/Park S. 78 | freigegeben (2026-11-07, Seti) |
| G-20-R | Relative Lage zweier Rahmen im Baum | T_ik = T_ri⁻¹·T_rk (r = Wurzel; T_ri, T_rk als Ketten G-16-N) | m | Lynch/Park S. 78 (T_de = T_ed⁻¹) und Bsp. 3.19; Weber/Koch Gl. (2.17) | freigegeben (2026-11-07, Seti) |
| G-21 | Gliedmatrix (DH klassisch) | A_i = Rot_z(θ_i)·Trans_z(d_i)·Trans_x(a_i)·Rot_x(α_i) = [R  (a_i cos θ_i, a_i sin θ_i, d_i)ᵀ; 0 0 0 1] | m | Weber/Koch Gl. (2.34), Kap. 2.2.2 | freigegeben (2026-11-08, Seti) |
| G-21-R | Rotation eines Glieds (DH klassisch) | R = Rot_z(θ_i)·Rot_x(α_i) = [cos θ −sin θ cos α  sin θ sin α; sin θ  cos θ cos α  −cos θ sin α; 0  sin α  cos α] | 1 | Weber/Koch Gl. (2.33) | freigegeben (2026-11-08, Seti) |
| G-22 | Gliedmatrix (DH modifiziert, Craig) | A_i = Rot_x(α_{i−1})·Trans_x(a_{i−1})·Trans_z(d_i)·Rot_z(θ_i) = [R  (a_{i−1}, −d_i sin α_{i−1}, d_i cos α_{i−1})ᵀ; 0 0 0 1] | m | Lynch/Park Anhang C.3, S. 510, Gl. (C.2) bis (C.5) | freigegeben (2026-11-08, Seti) |
| G-22-R | Rotation eines Glieds (DH modifiziert) | R = Rot_x(α_{i−1})·Rot_z(θ_i) = [cos θ  −sin θ  0; sin θ cos α  cos θ cos α  −sin α; sin θ sin α  cos θ sin α  cos α] | 1 | Lynch/Park Anhang C.3, S. 510 | freigegeben (2026-11-08, Seti) |
| G-23-G | Gelenkgrenzen | q_min,i ≤ q_i ≤ q_max,i für alle Gelenke; sonst Warnung, Ergebnis bleibt | 1 | eigene Festlegung (Konzept K3, Abschn. 1) | freigegeben (2026-11-08, Seti) |
| G-23-P | Gelenkwert Schubgelenk | d_i = q_i + d_i,0 (θ_i fest) | m | Weber/Koch S. 42 (Schublänge d_i Gelenkkoordinate beim Schubgelenk); Lynch/Park Anhang C.1, Abb. C.2 | freigegeben (2026-11-08, Seti) |
| G-23-R | Gelenkwert Drehgelenk | θ_i = q_i + θ_i,0 (d_i fest) | rad | Weber/Koch S. 42 (θ_i Gelenkkoordinate beim Drehgelenk); Lynch/Park Bsp. C.1 (Offset θ₂ − 90°) | freigegeben (2026-11-08, Seti) |
| G-24 | Vorwärtskinematik (Kette der Gliedmatrizen) | T_0n(q) = A_1(q_1)·A_2(q_2)·…·A_n(q_n), Zwischenrahmen T_0k = A_1·…·A_k | m | Weber/Koch Gl. (2.35), (3.2); Lynch/Park Anhang C, Gl. (C.1) | freigegeben (2026-11-08, Seti) |
| G-24-W | Vorwärtskinematik mit Basis und Werkzeug | T_Wt = T_W0·T_0n(q)·T_nt (wie G-20-K mit T_01 = T_W0, T_1m = T_0n, T_mt = T_nt) | m | Weber/Koch S. 46 (konstante Werkzeugmatrix am letzten Gliedsystem); ISO 9787:2013, 5.1 bis 5.4 | freigegeben (2026-11-08, Seti) |
| G-25-P | Kontrolle planare Kette geschlossen | x = Σ a_k cos(θ_1+…+θ_k), y = Σ a_k sin(θ_1+…+θ_k), z = Σ d_k, φ = Σ θ_k; e = max(\|p − p_0n\|, \|R_0n − R_z(φ)\|) | m | Lynch/Park Gl. (4.1) bis (4.3); Weber/Koch Bild 3.5 | freigegeben (2026-11-08, Seti) |
| G-25-S | Kontrolle SCARA geschlossen | p = (a_1 cos θ_1 + a_2 cos(θ_1+θ_2), a_1 sin θ_1 + a_2 sin(θ_1+θ_2), d_1+d_2+d_3+d_4), A = θ_1+θ_2+θ_3+θ_4; e = max(\|p − p_04\|, \|R_04 − R_z(A)\|) | m | Weber/Koch Gl. (3.8), (3.9), (3.10), Bild 3.8 | freigegeben (2026-11-08, Seti) |
| G-26 | Prüfung der Gelenkkette | 1 ≤ n ≤ 8; Typ je Gelenk R (Dreh) oder P (Schub); Konvention klassisch oder modifiziert; alle Werte endlich; q_min < q_max | 1 | Weber/Koch Kap. 2.2.2 (S. 40 bis 42); Lynch/Park Anhang C.1 | freigegeben (2026-11-08, Seti) |
| G-27-KM | Umrechnung klassisch → modifiziert | modifiziert: Zeile i = (α_{i−1}, a_{i−1}, d_i, θ_i) mit α_0 = a_0 = 0; T_nt′ = Trans_x(a_n)·Rot_x(α_n)·T_nt; Kontrolle e = max \|T_Wt − T_Wt′\| an derselben Stellung q | m | Weber/Koch Gl. (2.34); Lynch/Park Anhang C.3 (Reihenfolge der Faktoren in Paaren vertauschbar, S. 511) | freigegeben (2026-11-08, Seti) |
| G-27-MK | Umrechnung modifiziert → klassisch | klassisch: Zeile i = (θ_i, d_i, a_i, α_i) mit a_i, α_i aus Zeile i+1, a_n = α_n = 0; T_W0′ = T_W0·Rot_x(α_0)·Trans_x(a_0); Kontrolle e = max \|T_Wt − T_Wt′\| an derselben Stellung q | m | Weber/Koch Gl. (2.34); Lynch/Park Anhang C.3 (Reihenfolge der Faktoren in Paaren vertauschbar, S. 511) | freigegeben (2026-11-08, Seti) |

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

## Pumpe und Anlage

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| PU-AFF-H | Förderhöhe bei geänderter Drehzahl | H = H₀·(n/n₀)² | m | Dubbel 26 Bd. 3 S. 232; ISO 9906 Abschn. 6.1.1 Gl. (28) | freigegeben (2026-11-06, Seti) |
| PU-AFF-NPSH | NPSH_R bei geänderter Drehzahl | NPSH_R = NPSH_R,0·(n/n₀)^x | m | ISO 9906 Abschn. 6.1.1 Gl. (31), x = 2 erste Näherung | freigegeben (2026-11-06, Seti) |
| PU-AFF-P | Leistungsbedarf bei geänderter Drehzahl | P = P₀·(n/n₀)³, η = η₀ | W | Dubbel 26 Bd. 3 S. 232; ISO 9906 Abschn. 6.1.1 Gl. (29), (30) | freigegeben (2026-11-06, Seti) |
| PU-AFF-Q | Förderstrom bei geänderter Drehzahl | V̇ = V̇₀·n/n₀ | m³/s | Dubbel 26 Bd. 3 S. 232; ISO 9906 Abschn. 6.1.1 Gl. (27) | freigegeben (2026-11-06, Seti) |
| PU-BE | Druck nach der Pumpe | p_2 = p_1 + ρ/2·(v_1² − v_2²) + ρ·g·H_A | Pa | Dubbel 26 Bd. 3 Gl. (8.5), (8.6) | freigegeben (2026-11-06, Seti) |
| PU-BP | Betriebspunkt | V̇_B mit H(V̇_B) = H_A(V̇_B) (Raster 200, Bisektion 100 Schritte) | m³/s | Dubbel 26 Bd. 3 S. 231 | freigegeben (2026-11-06, Seti) |
| PU-FIT-ETA | Wirkungsgradkennlinie (Ausgleichspolynom) | η(V̇) = b₀ + b₁·V̇ + b₂·V̇² | 1 | Verfahren (R12) | freigegeben (2026-11-06, Seti) |
| PU-FIT-H | Förderhöhenkennlinie (Ausgleichspolynom) | H(V̇) = a₀ + a₁·V̇ + a₂·V̇² (kleinste Quadrate) | m | Verfahren (R12), Dubbel 26 Bd. 3 S. 230 | freigegeben (2026-11-06, Seti) |
| PU-FIT-NPSH | NPSH_R-Kennlinie (Ausgleichspolynom) | NPSH_R(V̇) = c₀ + c₁·V̇ + c₂·V̇² | m | Verfahren (R12) | freigegeben (2026-11-06, Seti) |
| PU-FIT-R2 | Güte des Ausgleichs | R² = 1 − Σ(y − ŷ)²/Σ(y − ȳ)²; größte Abweichung max\|y − ŷ\| | 1 | Verfahren (R12) | freigegeben (2026-11-06, Seti) |
| PU-HA | Förderhöhe der Anlage | H_A(V̇) = Δp_erf(V̇)/(ρ·g) | m | Dubbel 26 Bd. 3 Gl. (8.6); RH-DP-ERF | freigegeben (2026-11-06, Seti) |
| PU-N-AFF | Gültigkeit der Modellgesetze | \|n/n₀ − 1\| ≤ 0,2 | 1 | Dubbel 26 Bd. 3 S. 232 | freigegeben (2026-11-06, Seti) |
| PU-N-BER | Kennlinienbereich und Stabilität | V̇_min·n/n₀ ≤ V̇_B ≤ V̇_max·n/n₀; dH/dV̇ ≤ ε mit ε = 10⁻⁶·H_max/V̇_max (an beiden Rändern) | m/(m³/s) | Verfahren (R12); Dubbel 26 Bd. 3 S. 230 | freigegeben (2026-11-06, Seti) |
| PU-N-BIS | Drehzahl für Soll-Förderstrom | n mit H_n(V̇_soll) = H_A(V̇_soll), H_n(V̇) = (n/n₀)²·H₀(V̇·n₀/n) (Raster 200, Bisektion 100 Schritte) | 1/s | Verfahren (R16); Dubbel 26 Bd. 3 S. 232 | freigegeben (2026-11-06, Seti) |
| PU-N-NPSH | Kavitation Saugseite (NPSH) | NPSH_A ≥ NPSH_R + s | m | Dubbel 26 Bd. 3 S. 230 (Sicherheit ca. 1 bis 2 m) | freigegeben (2026-11-06, Seti) |
| PU-NPSHA | NPSH der Anlage | NPSH_A = (p_abs,S + ρ·v_S²/2 − p_v)/(ρ·g) | m | Dubbel 26 Bd. 3 Gl. (8.2), S. 229 | freigegeben (2026-11-06, Seti) |
| PU-NQ | Spezifische Drehzahl (Bestpunkt) | n_q = 333·n·√V̇/(g·H)^(3/4), n in s⁻¹ | 1 | Dubbel 26 Bd. 3 Gl. (8.1), S. 226 | freigegeben (2026-11-06, Seti) |
| PU-P | Leistungsbedarf der Pumpe | P = P_u/η(V̇_B) | W | Dubbel 26 Bd. 3 S. 231 | freigegeben (2026-11-06, Seti) |
| PU-PU | Förderleistung | P_u = ρ·g·V̇·H | W | Dubbel 26 Bd. 3 Gl. (2.5a) | freigegeben (2026-11-06, Seti) |
| PU-RES | NPSH-Reserve | ΔNPSH = NPSH_A − NPSH_R(V̇_B) | m | Dubbel 26 Bd. 3 S. 230 | freigegeben (2026-11-06, Seti) |

## Pressverband

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| PV-AF | Fugenfläche | A_F = π·D_F·l_F | mm² | Roloff/Matek 27 (Q219) (12.10) | freigegeben (2026-11-08, Seti) |
| PV-DAA | Aufweitung des Nabenaußendurchmessers (p_max) | ΔD_aA = D_aA·σ_tAa/E_A (σ_r = 0 außen) | mm | Hooke; Lamé P-ZY-U | freigegeben (2026-11-08, Seti) |
| PV-EP-P | Fugendruck elastisch-plastisch | p = R_eLA/√3·[1 + 2·ln ζ − (Q_A·ζ)²] | N/mm² | DIN 7190-1:2017 (Q235) Gl. (43) | freigegeben (2026-11-08, Seti) |
| PV-EP-PPA | Grenzfugendruck vollplastische Nabe | p_PA = −2·R_eLA·ln Q_A/√3 (Q_A ≥ 1/e) | N/mm² | DIN 7190-1:2017 (Q235) Gl. (27), (28) | freigegeben (2026-11-08, Seti) |
| PV-EP-PPI | Grenzfugendruck vollplastische Vollwelle | p_PI = 2·R_eLI/√3 | N/mm² | DIN 7190-1:2017 (Q235) Gl. (30) | freigegeben (2026-11-08, Seti) |
| PV-EP-QPA | Plastischer Flächenanteil der Nabe | q_PA/q_A = (ζ² − 1)·Q_A²/(1 − Q_A²) | 1 | DIN 7190-1:2017 (Q235) Gl. (35) | freigegeben (2026-11-08, Seti) |
| PV-EP-XI | Bezogenes wirksames Übermaß aus ζ | ξ_w = 2/√3·ζ²·R_eLA/E | 1 | DIN 7190-1:2017 (Q235) Gl. (34) | freigegeben (2026-11-08, Seti) |
| PV-EP-ZETA | Bezogener Plastizitätsdurchmesser | 2·ln ζ − (Q_A·ζ)² + 1 − √3·p/R_eLA = 0, 1 ≤ ζ ≤ 1/Q_A | 1 | DIN 7190-1:2017 (Q235) Gl. (31) bis (33), Anhang B | freigegeben (2026-11-08, Seti) |
| PV-EP-ZU | ζ aus ξ_w | ζ = √(√3·ξ_w·E/(2·R_eLA)) | 1 | DIN 7190-1:2017 (Q235) Gl. (42) | freigegeben (2026-11-08, Seti) |
| PV-EP-ZZUL | Zulässiger bezogener Plastizitätsdurchmesser | ζ_zul aus Gl. (32) mit p = p_PA/S_PA (Fall 2) | 1 | DIN 7190-1:2017 (Q235) Gl. (37) bis (41) | freigegeben (2026-11-08, Seti) |
| PV-FAX | Übertragbare Axialkraft (p_min) | F_ax = π·D_F·l_F·p·ν_rl/S_r | N | DIN 7190-1:2017 (Q235) Gl. (2) | freigegeben (2026-11-08, Seti) |
| PV-FE | Einpresskraft | F_e = π·D_F·l_F·ν_ll·p_max | N | DIN 7190-1:2017 (Q235) Gl. (48); Roloff/Matek 27 (Q219) (12.22) | freigegeben (2026-11-08, Seti) |
| PV-FIT-H | Grenzabmaße Bohrung H6 | EI = 0, ES = IT(D_F, Grad) | mm | ISO 286-1:2019 (Q236) Tab. 1, 2 | freigegeben (2026-11-08, Seti) |
| PV-FIT-SEL | Zulässige Passungen | H6 bis H8 × p bis z × IT5 bis IT8 mit U_k ≥ Ü_u und U_g ≤ Ü_o, sortiert nach \|(U_k + U_g)/2 − (Ü_u + Ü_o)/2\| | 1 | Roloff/Matek 27 (Q219) S. 446, Bild 12.17; Verfahren | freigegeben (2026-11-08, Seti) |
| PV-FIT-W | Grenzabmaße Welle r6 | ei = Grundabmaß(D_F, Feld); es = ei + IT(D_F, Grad) | mm | ISO 286-1:2019 (Q236) Tab. 1, 5 | freigegeben (2026-11-08, Seti) |
| PV-FL-NG | Grenzdrehzahl (Abheben) | n_g = u_ab/(π·D_aA) | 1/s | Roloff/Matek 27 (Q219) (12.24a); DIN 7190-1:2017 (Q235) Gl. (56), (58) | freigegeben (2026-11-08, Seti) |
| PV-FL-PN | Fugendruck bei Drehzahl n | p_n = [1 − (u/u_ab)²]·p | N/mm² | DIN 7190-1:2017 (Q235) Gl. (57) | freigegeben (2026-11-08, Seti) |
| PV-FL-TN | Übertragbares Moment bei Drehzahl n | T_n = T·[1 − (n/n_g)²] | N·mm | Roloff/Matek 27 (Q219) (12.25) | freigegeben (2026-11-08, Seti) |
| PV-FL-U | Umfangsgeschwindigkeit der Nabe außen | u = π·n·D_aA | mm/s | DIN 7190-1:2017 (Q235) Gl. (56) | freigegeben (2026-11-08, Seti) |
| PV-FL-UAB | Abhebegeschwindigkeit | u_ab = 2·√(E·ξ_w/((3 + μ)·ρ)) | mm/s | DIN 7190-1:2017 (Q235) Gl. (58) | freigegeben (2026-11-08, Seti) |
| PV-FRES | Rutschkraft (Auslegung) | F_R = S_r·K_A·√(F_ax² + F_t²) | N | Roloff/Matek 27 (Q219) (12.9) | freigegeben (2026-11-08, Seti) |
| PV-FT | Umfangskraft in der Fuge | F_t = 2·T/D_F | N | Roloff/Matek 27 (Q219) S. 449 | freigegeben (2026-11-08, Seti) |
| PV-GL | Glättung | G = 0,4·(Rz_A + Rz_I) | mm | DIN 7190-1:2017 (Q235) Gl. (7); Roloff/Matek 27 (Q219) (12.15) | freigegeben (2026-11-08, Seti) |
| PV-K | Hilfsgröße K | K = E_A/E_I·[(1 + Q_I²)/(1 − Q_I²) − μ_I] + (1 + Q_A²)/(1 − Q_A²) + μ_A | 1 | DIN 7190-1:2017 (Q235) Gl. (13), (14); Roloff/Matek 27 (Q219) (12.13) | freigegeben (2026-11-08, Seti) |
| PV-LE | Fasenlänge | l_e ≈ ∛D_F (D_F ≤ 50 mm, Tab. 6 beginnt über 50 mm) | mm | DIN 7190-1:2017 (Q235) Tab. 6, Gl. (49) | freigegeben (2026-11-08, Seti) |
| PV-N-ELAST | Warnung plastisch | p_max > p_zul,A oder p_zul,I → plastische Dehnung (Überschreitung in %) | % | DIN 7190-1:2017 (Q235) Abschn. 4.1, S. 9 | freigegeben (2026-11-08, Seti) |
| PV-N-EP | Grenzen elastisch-plastisch | ξ_w ≤ 2/√3·ζ_zul²·R_eLA/E (41) und q_PA/q_A ≤ 0,30 (35) | 1 | DIN 7190-1:2017 (Q235) Gl. (26), (29), (33), (36), (41), (35) | freigegeben (2026-11-08, Seti) |
| PV-N-FL | Fliehkraft rein elastisch | ξ_w ≤ (3 + μ)/(3 + μ + (1 − μ)·Q_A²)·R_eLA/E (54) und ξ_w ≤ R_eLI/(Q_A²·E) (55) | 1 | DIN 7190-1:2017 (Q235) Gl. (54), (55) | freigegeben (2026-11-08, Seti) |
| PV-N-FL10 | Druckabfall höchstens 10 % | u ≤ √0,1·u_ab ≈ 0,316·u_ab (Verhältnis) | 1 | DIN 7190-1:2017 (Q235) Gl. (59) | freigegeben (2026-11-08, Seti) |
| PV-N-GEO | Gestaltung | Torsion l_F/D_F ≤ 1,5; Biegung l_F/D_F > 0,5; Q_A ≤ 0,5 empfohlen (Hinweise) | 1 | DIN 7190-1:2017 (Q235) Gl. (46), (47), S. 16 | freigegeben (2026-11-08, Seti) |
| PV-N-PASS | Passung trägt | U_k ≥ Ü_u und U_g ≤ Ü_o (kleinster Abstand) | mm | Roloff/Matek 27 (Q219) S. 446 | freigegeben (2026-11-08, Seti) |
| PV-N-SPA | Nachweis Nabe rein elastisch | p_max ≤ p_zul,A (Auslastung p_max/p_zul,A) | 1 | DIN 7190-1:2017 (Q235) Gl. (15), (20) | freigegeben (2026-11-08, Seti) |
| PV-N-SPI | Nachweis Welle rein elastisch | p_max ≤ p_zul,I (Auslastung p_max/p_zul,I) | 1 | DIN 7190-1:2017 (Q235) Gl. (16), (17), (21) | freigegeben (2026-11-08, Seti) |
| PV-N-SR | Nachweis Rutschen | S_r,ist ≥ S_r (mit p_min, bei Drehzahl mit p_n) | 1 | DIN 7190-1:2017 (Q235) Gl. (1), (2) | freigegeben (2026-11-08, Seti) |
| PV-N-TA | Nachweis Fügetemperatur | ϑ_A,erf ≤ ϑ_A,zul (Reserve ϑ_A,zul − ϑ_A,erf) | K | DIN 7190-1:2017 (Q235) Tab. 8, S. 23 | freigegeben (2026-11-08, Seti) |
| PV-N-VERF | Verformbarkeit Nabe | A ≥ 10 % (Z ≥ 30 % selbst prüfen) | % | DIN 7190-1:2017 (Q235) Gl. (8), (9) | freigegeben (2026-11-08, Seti) |
| PV-P | Fugendruck aus Übermaß | p = ξ_w·E_A/K | N/mm² | DIN 7190-1:2017 (Q235) Gl. (24) | freigegeben (2026-11-08, Seti) |
| PV-PERF | Erforderlicher Fugendruck | p_erf = F_R/(A_F·ν_r) | N/mm² | Roloff/Matek 27 (Q219) (12.10); DIN 7190-1:2017 (Q235) Gl. (1), (2) umgestellt | freigegeben (2026-11-08, Seti) |
| PV-PT | Passtoleranz | PT = Ü_o − Ü_u | mm | Roloff/Matek 27 (Q219) (12.20) | freigegeben (2026-11-08, Seti) |
| PV-PZA | Zulässiger Fugendruck Nabe (rein elastisch) | p_zul,A = (1 − Q_A²)·R_eLA/(√3·S_PA) | N/mm² | DIN 7190-1:2017 (Q235) Gl. (15); Roloff/Matek 27 (Q219) (12.17) | freigegeben (2026-11-08, Seti) |
| PV-PZI-H | Zulässiger Fugendruck Hohlwelle | p_zul,I = (1 − Q_I²)·R_eLI/(√3·S_PI) | N/mm² | DIN 7190-1:2017 (Q235) Gl. (16) | freigegeben (2026-11-08, Seti) |
| PV-PZI-V | Zulässiger Fugendruck Vollwelle | p_zul,I = 2·R_eLI/(√3·S_PI) | N/mm² | DIN 7190-1:2017 (Q235) Gl. (17) | freigegeben (2026-11-08, Seti) |
| PV-QA | Durchmesserverhältnis Nabe | Q_A = D_F/D_aA | 1 | DIN 7190-1:2017 (Q235) Gl. (10) | freigegeben (2026-11-08, Seti) |
| PV-QI | Durchmesserverhältnis Welle | Q_I = D_iI/D_F (Vollwelle: 0) | 1 | DIN 7190-1:2017 (Q235) Gl. (11) | freigegeben (2026-11-08, Seti) |
| PV-RZ | Rz aus Ra | Ra 0,8/1,6/3,2 µm → Rz 6,3/12,5/20 µm | µm | DIN 7190-1:2017 (Q235) Tab. 1 | freigegeben (2026-11-08, Seti) |
| PV-S-TAA | Tangentialspannung Nabe außen (p_max) | σ_tAa = 2·p·Q_A²/(1 − Q_A²) | N/mm² | Roloff/Matek 27 (Q219) (12.6) | freigegeben (2026-11-08, Seti) |
| PV-S-TAI | Tangentialspannung Nabe innen (p_max) | σ_tAi = p·(1 + Q_A²)/(1 − Q_A²); σ_r = −p | N/mm² | Roloff/Matek 27 (Q219) (12.6) | freigegeben (2026-11-08, Seti) |
| PV-S-TIA | Tangentialspannung Welle außen (p_max) | σ_tIa = −p·(1 + Q_I²)/(1 − Q_I²) | N/mm² | Roloff/Matek 27 (Q219) (12.7) | freigegeben (2026-11-08, Seti) |
| PV-S-TII | Tangentialspannung Welle innen (p_max) | Vollwelle: σ_t = σ_r = −p | N/mm² | Roloff/Matek 27 (Q219) (12.7), S. 443 | freigegeben (2026-11-08, Seti) |
| PV-S-VA | Vergleichsspannung Nabe innen (SH) | σ_vAi = 2·p/(1 − Q_A²) | N/mm² | Roloff/Matek 27 (Q219) (12.8); Dubbel 2 S. 199 | freigegeben (2026-11-08, Seti) |
| PV-S-VI | Vergleichsspannung Welle (SH) | Vollwelle: σ_vI = p | N/mm² | Roloff/Matek 27 (Q219) (12.8) | freigegeben (2026-11-08, Seti) |
| PV-SPA | Ist-Sicherheit Nabe gegen plastische Dehnung | S_PA = (1 − Q_A²)·R_eLA/(√3·p_max) | 1 | DIN 7190-1:2017 (Q235) Gl. (15) umgestellt | freigegeben (2026-11-08, Seti) |
| PV-SPI | Ist-Sicherheit Welle gegen plastische Dehnung | S_PI = 2·R_eLI/(√3·p_max) | 1 | DIN 7190-1:2017 (Q235) Gl. (16), (17) umgestellt | freigegeben (2026-11-08, Seti) |
| PV-SR | Ist-Sicherheit gegen Rutschen | S_r,ist = p·A_F·ν_r/(K_A·√(F_ax² + F_t²)) mit p = p_min (Stillstand) bzw. p = p_n (Drehzahl n) | 1 | Roloff/Matek 27 (Q219) S. 449 (S_H′); DIN 7190-1:2017 (Q235) Gl. (57) | freigegeben (2026-11-08, Seti) |
| PV-T | Übertragbares Drehmoment (p_min) | T = π/2·D_F²·l_F·p·ν_ru/S_r | N·mm | DIN 7190-1:2017 (Q235) Gl. (1) | freigegeben (2026-11-08, Seti) |
| PV-TA | Erforderliche Fügetemperatur der Nabe | ϑ_A,erf = ϑ_R + U_F/(α_A·D_F) + α_I/α_A·(ϑ_I − ϑ_R) | °C | DIN 7190-1:2017 (Q235) Gl. (52); Roloff/Matek 27 (Q219) (12.23) | freigegeben (2026-11-08, Seti) |
| PV-U-MAN | Übermaß von Hand | U_k, U_g eingegeben (U_k ≤ U_i ≤ U_g) | mm | DIN 7190-1:2017 (Q235) Gl. (6) | freigegeben (2026-11-08, Seti) |
| PV-UF | Übermaß beim Fügen | U_F = U_g + U_sϑ | mm | DIN 7190-1:2017 (Q235) Gl. (51) (mit U_g, Befund B5) | freigegeben (2026-11-08, Seti) |
| PV-UG | Höchstübermaß | U_g = A_oI − A_uA | mm | DIN 7190-1:2017 (Q235) Gl. (4) | freigegeben (2026-11-08, Seti) |
| PV-UK | Mindestübermaß | U_k = A_uI − A_oA | mm | DIN 7190-1:2017 (Q235) Gl. (5) | freigegeben (2026-11-08, Seti) |
| PV-UMAX | Größtes fügbares Übermaß | U_max = D_F·[α_A·(ϑ_A,zul − ϑ_R) − α_I·(ϑ_I − ϑ_R)] − U_sϑ | mm | DIN 7190-1:2017 (Q235) Gl. (53) | freigegeben (2026-11-08, Seti) |
| PV-UO | Größtes zulässiges Übermaß | Ü_o = K·min(p_zul,A; p_zul,I)·D_F/E_A + G | mm | Roloff/Matek 27 (Q219) (12.18), (12.19) | freigegeben (2026-11-08, Seti) |
| PV-US | Fügespiel | U_sϑ = 0,001·D_F | mm | DIN 7190-1:2017 (Q235) Gl. (50) | freigegeben (2026-11-08, Seti) |
| PV-UU | Kleinstes erforderliches Übermaß | Ü_u = K·p_erf·D_F/E_A + G | mm | Roloff/Matek 27 (Q219) (12.14), (12.16); DIN 7190-1:2017 (Q235) Gl. (18), (7) | freigegeben (2026-11-08, Seti) |
| PV-UW | Wirksames Übermaß | U_w = U − G | mm | DIN 7190-1:2017 (Q235) Gl. (7) | freigegeben (2026-11-08, Seti) |
| PV-XI | Bezogenes wirksames Übermaß | ξ_w = U_w/D_F | 1 | DIN 7190-1:2017 (Q235) Gl. (12) | freigegeben (2026-11-08, Seti) |
| PV-XIERF | Bezogenes wirksames Übermaß für p_erf | ξ_w = K·p/E_A | 1 | DIN 7190-1:2017 (Q235) Gl. (18) | freigegeben (2026-11-08, Seti) |

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
| RH-A-RE | Fläche Rechteck | A = b·h | m² | Geometrie | freigegeben (2026-11-06, Seti) |
| RH-A-RI | Fläche Kreisring | A = π·(d_a² − d_i²)/4 | m² | Geometrie | freigegeben (2026-11-06, Seti) |
| RH-AU-MAN | Fläche und benetzter Umfang (Eingabe) | A, U = Eingabe | m² | Eingabe | freigegeben (2026-11-06, Seti) |
| RH-BE | Druck nach dem Element | p_2 = p_1 + ρ/2·(v_1² − v_2²) + ρ·g·(z_1 − z_2) − Δp_v | Pa | Dubbel 26 Bd. 1 Gl. (17.10) | freigegeben (2026-10-29, Seti) |
| RH-D-BIS | Kleinster Innendurchmesser | d mit Δp_erf(d) = Δp_zul (Bisektion im log-Raum, 100 Schritte) | m | Verfahren (R7) | freigegeben (2026-10-29, Seti) |
| RH-D-DN | Gewähltes Rohr | kleinstes Rohr mit d_i = d_a − 2·s ≥ d_min | m | Anhang A, Tab. A.2, S. 17 (Q224) | freigegeben (2026-10-29, Seti) |
| RH-DH | hydraulischer Durchmesser | d_h = 4·A/U | m | Dubbel 26 Bd. 1 Abschn. 17.2.3 (S. 322) | freigegeben (2026-11-06, Seti) |
| RH-DI | Innendurchmesser | d_i = d_a − 2·s | m | DIN EN 10220 Reihe 1, Tab. 1, S. 6 f. (Wanddicken mit Massenangabe, T ≤ 20 mm) | freigegeben (2026-10-29, Seti) |
| RH-DP-ERF | Erforderliche Druckerhöhung | Δp_erf = (p_E − p_A) + Δp_geo + ρ/2·(v_E² − v_A²) + Δp_v | Pa | Dubbel 26 Bd. 1 Gl. (17.10) | freigegeben (2026-10-29, Seti) |
| RH-DP-GEO | Höhendruck | Δp_geo = ρ·g·(z_E − z_A) | Pa | Roloff 27 Gl. 18.7 | freigegeben (2026-10-29, Seti) |
| RH-DP-R | Reibungsdruckverlust | Δp_R = λ·(L/d)·ρ·v²/2 | Pa | Roloff 27 Gl. 18.5; VDI-WA L1.2 Gl. (1) | freigegeben (2026-10-29, Seti) |
| RH-DP-V | Summe der Verluste | Δp_v = Σ Δp_R + Σ Δp_ζ | Pa | Roloff 27 Gl. 18.7 | freigegeben (2026-10-29, Seti) |
| RH-DP-Z | Druckverlust | Δp_ζ = n·ζ·ρ·v_B²/2 | Pa | Roloff 27 Gl. 18.6 | freigegeben (2026-10-29, Seti) |
| RH-DS-AH | Wellengeschwindigkeit (Eingabe) | a = Eingabe | m/s | Eingabe | freigegeben (2026-11-06, Seti) |
| RH-DS-AK | Wellengeschwindigkeit bei elastischer Rohrwand | a = √(K/(ρ·[1 + (K/E)·ψ])) | m/s | Chaudhry 2014 (Q234) Gl. (2-65), S. 50 | freigegeben (2026-11-06, Seti) |
| RH-DS-AR | Wellengeschwindigkeit (Richtwert) | a aus fd_wave_speed | m/s | S. 747 (zu Gl. 18.21) (Q219) | freigegeben (2026-11-06, Seti) |
| RH-DS-AW | Wellengeschwindigkeit bei starrer Wand | a = √(K/ρ) (ψ = 0) | m/s | Chaudhry 2014 (Q234) Gl. (2-65), (2-66), S. 50 | freigegeben (2026-11-06, Seti) |
| RH-DS-J | Druckstoß bei schnellem Schließen (Joukowsky) | Δp = ρ·a·Δv (t_S ≤ t_R) | Pa | Roloff 27 Abschn. 18.4 Nr. 4 Gl. (18.21) | freigegeben (2026-11-06, Seti) |
| RH-DS-L | Druckstoß bei langsamem Schließen (Stoßabminderung) | Δp = ρ·a·Δv·t_R/t_S (t_S > t_R, gleichbedeutend mit l < a·t_S/2; lineares Schließgesetz) | Pa | Roloff 27 Abschn. 18.4 Nr. 4 Gl. (18.22) | freigegeben (2026-11-06, Seti) |
| RH-DS-N | Unterdruck beim Druckstoß | p_min ≥ p_s | 1 | Roloff 27 Abschn. 18.4 Nr. 4 S. 747; IAPWS-IF97 Gl. (30) | freigegeben (2026-11-06, Seti) |
| RH-DS-P | Extremdrücke an der Armatur | p_max = p + Δp; p_min = p − Δp | Pa | Roloff 27 Abschn. 18.4 Nr. 4 S. 747 | freigegeben (2026-11-06, Seti) |
| RH-DS-PSI-D | Wandbeiwert dünnwandig | ψ = (D/e)·(1 − ν²) \| (D/e)·(1 − 0,5ν) \| D/e (Verankerung ganze Länge \| oberes Ende \| Dehnfugen) | 1 | Chaudhry 2014 (Q234) Gl. (2-70) bis (2-72), S. 52 | freigegeben (2026-11-06, Seti) |
| RH-DS-PSI-K | Wandbeiwert dickwandig | ψ = 2(1 + ν)·[(R_o² + R_i²)/(R_o² − R_i²) − 2νR_i²/(R_o² − R_i²)] \| 2·[(R_o² + R_i²)/(R_o² − R_i²) + ν] (Verankerung ganze Länge \| Dehnfugen) | 1 | Chaudhry 2014 (Q234) Gl. (2-67), (2-69), S. 51 | freigegeben (2026-11-06, Seti) |
| RH-DS-TR | Reflexionszeit | t_R = 2·l/a | s | Roloff 27 Abschn. 18.4 Nr. 4 Gl. (18.20) | freigegeben (2026-11-06, Seti) |
| RH-EPS | relative Rauheit | ε = k/d | 1 | VDI-WA L1.2 Gl. (8) | freigegeben (2026-10-29, Seti) |
| RH-H-E | Energiehöhe | H = p/(ρ·g) + v²/(2g) + z | m | Dubbel 26 Bd. 1 Gl. (17.10) | freigegeben (2026-10-29, Seti) |
| RH-H-P | Druckhöhe | h_p = p/(ρ·g) | m | Dubbel 26 Bd. 1 S. 325 | freigegeben (2026-10-29, Seti) |
| RH-H-PG | Überdruckhöhe | h_pe = (p − p_L)/(ρ·g) | m | Dubbel 26 Bd. 1 Gl. (17.10); Überdruck gegen Umgebung | freigegeben (2026-11-06, Seti) |
| RH-HV | Verlusthöhe | h_v = Δp_v/(ρ·g) | m | Dubbel 26 Bd. 1 Gl. (17.11b) | freigegeben (2026-10-29, Seti) |
| RH-K | Rauheit | k = k_min bzw. k_max aus fd_roughness | m | TB 18-6 (Q219) | freigegeben (2026-10-29, Seti) |
| RH-L-CB | Rohrreibungszahl turbulent (Colebrook) | 1/√λ = −2·lg(2,51/(Re·√λ) + ε/3,71) | 1 | Roloff 27 Gl. 18.11; VDI-WA L1.2 Gl. (10) | freigegeben (2026-10-29, Seti) |
| RH-L-EX | Rohrreibungszahl Näherung (Startwert) | λ_0 = 0,11·(ε + 68/Re)^0,25 | 1 | Roloff 27 S. 742 | freigegeben (2026-10-29, Seti) |
| RH-L-LAM | Rohrreibungszahl laminar | λ = 64/Re | 1 | Roloff 27 Gl. 18.9; VDI-WA L1.2 Gl. (4) | freigegeben (2026-10-29, Seti) |
| RH-L-LAM-PHI | Rohrreibungszahl laminar, nicht kreisförmig | λ = φ·64/Re | 1 | Dubbel 26 Bd. 1 Abschn. 17.2.3 (S. 322) | freigegeben (2026-11-06, Seti) |
| RH-M-BETA | Durchmesserverhältnis | β = d/D | 1 | ISO 5167-1:2023 Gl. (1), (2) (Q228) | freigegeben (2026-11-06, Seti) |
| RH-M-CB | Durchflusskoeffizient Blende (Reader-Harris/Gallagher) | C = 0,5961 + 0,0261β² − 0,216β⁸ + 0,000521(10⁶β/Re_D)^0,7 + (0,0188 + 0,0063A)β^3,5(10⁶/Re_D)^0,3 + (0,043 + 0,080e^(−10L₁) − 0,123e^(−7L₁))(1 − 0,11A)β⁴/(1 − β⁴) − 0,031(M′₂ − 0,8M′₂^1,1)β^1,3 [+ 0,011(0,75 − β)(2,8 − D/25,4) für D < 71,12 mm]; A = (19 000β/Re_D)^0,8; M′₂ = 2L′₂/(1 − β) | 1 | ISO 5167-2:2023 (Q229) Abschn. 5.3.2.1 Gl. (4) | freigegeben (2026-11-06, Seti) |
| RH-M-CV | Durchflusskoeffizient Venturi | C aus fd_flowmeter je Bauart und Re_D-Bereich, sonst Eingabe | 1 | Abschn. 5.5.3 (S. 16) (Q230) | freigegeben (2026-11-06, Seti) |
| RH-M-DP | Wirkdruck | Δp = (ρ/2)·[V̇·√(1 − β⁴)/(C·ε·π·d²/4)]² | Pa | ISO 5167-1:2023 Gl. (1), (2) (Q228), umgestellt | freigegeben (2026-11-06, Seti) |
| RH-M-DW | Bleibender Druckverlust Blende | Δϖ = [√(1 − β⁴(1 − C²)) − C·β²]/[√(1 − β⁴(1 − C²)) + C·β²]·Δp | Pa | ISO 5167-2:2023 (Q229) Abschn. 5.4 Gl. (7) | freigegeben (2026-11-06, Seti) |
| RH-M-DWV | Bleibender Druckverlust Venturi | Δϖ = ξ·Δp (ξ von Hand) | Pa | ISO 5167-4:2023 (Q230) Abschn. 5.9.2 Gl. (3) (Definition) | freigegeben (2026-11-06, Seti) |
| RH-M-N | Gültigkeit des Messgeräts | D, β, Re_D in den Grenzen der Bauart | 1 | ISO 5167-2:2023 (Q229) Abschn. 5.3.1 (S. 19) | freigegeben (2026-11-06, Seti) |
| RH-M-Q | Volumenstrom (Wirkdruckverfahren) | V̇ = C/√(1 − β⁴)·ε·(π·d²/4)·√(2·Δp/ρ), ε = 1 (Flüssigkeit) | m³/s | ISO 5167-1:2023 Gl. (1), (2) (Q228) | freigegeben (2026-11-06, Seti) |
| RH-M-QIT | Volumenstrom aus Wirkdruck (C hängt von Re_D ab) | V̇ mit Δp(V̇, C(Re_D)) = Δp_gemessen (Bisektion, 100 Schritte) | m³/s | Verfahren (R19) | freigegeben (2026-11-06, Seti) |
| RH-M-ZETA | Ersatz-Widerstandszahl für den Strang | ζ = Δϖ/(ρ·v_D²/2), v_D = V̇/(π·D²/4) | 1 | Roloff 27 Gl. 18.6 (umgestellt) | freigegeben (2026-11-06, Seti) |
| RH-N-KAV | Kavitationsgefahr (Abstand zum Dampfdruck) | p_abs,min/p_s ≥ 1 | 1 | IAPWS-IF97 Gl. (30) | freigegeben (2026-10-29, Seti) |
| RH-N-RE | Strömungsbereich (größte Reynolds-Zahl im Strang) | Re_max = max Re_i; Re < 2 320 laminar; 2 320 ≤ Re < 4 000 Übergang; Re ≥ 4 000 turbulent | 1 | Roloff 27 S. 741; VDI-WA L1.2 | freigegeben (2026-10-29, Seti) |
| RH-N-V | Geschwindigkeit gegen Richtwert | v_min ≤ v_max,Strang ≤ v_max | m/s | TB 18-5 (Q219) | freigegeben (2026-10-29, Seti) |
| RH-P-HYD | Hydraulische Leistung | P_h = Δp_erf·V̇ | W | Roloff 27 S. 742 | freigegeben (2026-10-29, Seti) |
| RH-P-W | Antriebsleistung | P = P_h/η | W | Roloff 27 S. 742 | freigegeben (2026-10-29, Seti) |
| RH-PHI | Formbeiwert laminar (Interpolation) | φ = φ_a + (φ_b − φ_a)·(x − x_a)/(x_b − x_a) | 1 | Abschn. 17.2.3 (S. 322) (Q220), linear zwischen Zeilen | freigegeben (2026-11-06, Seti) |
| RH-Q-BIS | Volumenstrom bei verfügbarer Druckerhöhung | V̇ mit Δp_erf(V̇) = Δp_verf (Bisektion, 100 Schritte) | m³/s | Verfahren (R7) | freigegeben (2026-10-29, Seti) |
| RH-RE | Reynolds-Zahl | Re = v·d/ν | 1 | Roloff 27 Gl. 18.8; VDI-WA L1.2 Gl. (2) | freigegeben (2026-10-29, Seti) |
| RH-U-RE | benetzter Umfang Rechteck | U = 2·(b + h) | m | Geometrie | freigegeben (2026-11-06, Seti) |
| RH-U-RI | benetzter Umfang Kreisring | U = π·(d_a + d_i) | m | Geometrie | freigegeben (2026-11-06, Seti) |
| RH-V | mittlere Geschwindigkeit | v = V̇/A | m/s | Roloff 27 Gl. 18.3 | freigegeben (2026-10-29, Seti) |
| RH-Z-BC | plötzliche Erweiterung (Borda-Carnot) | ζ_1 = (1 − A_1/A_2)² | 1 | VDI-WA L1.3 Gl. (7); TB 18-7; Dubbel 26 Bd. 1 S. 324 | freigegeben (2026-10-29, Seti) |
| RH-Z-IP | Widerstandszahl Bogen 90° (Interpolation über r/d) | ζ = ζ_a + (ζ_b − ζ_a)·(r/d − x_a)/(x_b − x_a) | 1 | TB 18-7 (Q219), linear zwischen Zeilen | freigegeben (2026-10-29, Seti) |
| RH-Z-MAN | Widerstandszahl (Eingabe) | ζ = Eingabe | 1 | Eingabe | freigegeben (2026-10-29, Seti) |
| RH-Z-TAB | Widerstandszahl | ζ aus fd_loss_coeff | 1 | TB 18-7 (Q219) | freigegeben (2026-10-29, Seti) |

## Schraubenverbindung

| ID | Größe | Formel | Einheit | Quelle | Status |
|---|---|---|---|---|---|
| SV-A3 | Kernquerschnitt | A_d3 = π/4·d₃² | mm² | VDI 2230-1:2015 (Q237) Abschn. 5.1.1 | freigegeben (2026-11-09, Seti) |
| SV-AN | Nennquerschnitt | A_N = π/4·d² | mm² | VDI 2230-1:2015 (Q237) Abschn. 5.1.1 | freigegeben (2026-11-09, Seti) |
| SV-AP | Auflagefläche | A_p,min = π/4·(d_W² − D_Ki²), D_Ki = max(d_h, d_ha) bzw. d₁ der Scheibe | mm² | VDI 2230-1:2015 (Q237) Gl. (193); Roloff/Matek 27 (Q219) (8.36) | freigegeben (2026-11-09, Seti) |
| SV-AS | Spannungsquerschnitt | A_s = π/4·((d₂ + d₃)/2)² | mm² | Roloff/Matek 27 (Q219) (8.34); VDI 2230-1:2015 (Q237) Tab. A11; DIN 13-1:1999 (Q238) S. 3 | freigegeben (2026-11-09, Seti) |
| SV-ASMIN | Mindestquerschnitt nach Kübler (Vorwahl R0) | A_s ≥ (F_B + F_Kl)/(R_p0,2/(κ·k_A) − β·E_S·f_Z/l_K), κ nach μ_G, β 1,1/0,8/0,6 | mm² | Roloff/Matek 27 (Q219) (8.2), Bsp. 8.3 | freigegeben (2026-11-09, Seti) |
| SV-AT | Taillenquerschnitt (Dehnschaft) | A_T = π/4·d_T², Vorschlag d_T = 0,9·d₃ | mm² | Roloff/Matek 27 (Q219) (8.34b) | freigegeben (2026-11-09, Seti) |
| SV-DAGR | Grenzdurchmesser des Verformungskegels | D_A,Gr = d_W + w·l_K·tan φ (w = 1 DSV, 2 ESV) | mm | VDI 2230-1:2015 (Q237) Gl. (39) | freigegeben (2026-11-09, Seti) |
| SV-DG | Nachgiebigkeit eingeschraubtes Gewinde | δ_G = 0,5·d/(E_S·A_d3) | mm/N | VDI 2230-1:2015 (Q237) Abschn. 5.1.1 (S. 40) | freigegeben (2026-11-09, Seti) |
| SV-DGEW | Nachgiebigkeit freies Gewinde | δ_Gew = l_Gew/(E_S·A_d3) | mm/N | VDI 2230-1:2015 (Q237) Abschn. 5.1.1 (S. 40) | freigegeben (2026-11-09, Seti) |
| SV-DI | Nachgiebigkeit Schaftelement 1 | δ_i = l_i/(E_S·A_i), A_i = π/4·d_i² | mm/N | VDI 2230-1:2015 (Q237) Abschn. 5.1.1; Roloff/Matek 27 (Q219) (8.8) | freigegeben (2026-11-09, Seti) |
| SV-DKM | Reibdurchmesser der Kopfauflage | D_Km = (d_W + D_Ki)/2 | mm | VDI 2230-1:2015 (Q237) R13; Roloff/Matek 27 (Q219) zu (8.24) | freigegeben (2026-11-09, Seti) |
| SV-DM | Nachgiebigkeit Innengewinde (ESV) | δ_M = l_M/(E_M·A_N), l_M = 0,33·d, E_M = E_BI | mm/N | VDI 2230-1:2015 (Q237) Abschn. 5.1.1 (S. 40) | freigegeben (2026-11-09, Seti) |
| SV-DP-H | Nachgiebigkeit Platten, nur Hülse (d_W ≥ D_A) | δ_P = 4·l_K/(E_P·π·(D_A² − d_h²)) | mm/N | VDI 2230-1:2015 (Q237) Abschn. 5.1.2, Gl. (49) | freigegeben (2026-11-09, Seti) |
| SV-DP-HZ | Nachgiebigkeit Platten, Hohlzylinder (Roloff) | A_ers = π/4·(d_w² − d_h²) + π/8·d_w·(D_A − d_w)·((x + 1)² − 1), x = ∛(l_K·d_w/D_A²), D_A ≤ d_w + l_K; δ_T = Σ l_i/(A_ers·E_i) | mm/N | Roloff/Matek 27 (Q219) (8.9), (8.10) | freigegeben (2026-11-09, Seti) |
| SV-DP-K | Nachgiebigkeit Platten, Kegel (D_A ≥ D_A,Gr) | δ_P = 2·ln[((d_W + d_h)(d_W + w·l_K·tan φ − d_h))/((d_W − d_h)(d_W + w·l_K·tan φ + d_h))]/(w·E_P·π·d_h·tan φ) | mm/N | VDI 2230-1:2015 (Q237) Gl. (40) | freigegeben (2026-11-09, Seti) |
| SV-DP-KH | Nachgiebigkeit Platten, Kegel und Hülse (d_W < D_A < D_A,Gr) | l_V = (D_A − d_W)/(2·tan φ), l_H = l_K − 2·l_V/w, δ_P = 2/w·δ_P^V + δ_P^H | mm/N | VDI 2230-1:2015 (Q237) Gl. (41), (44) bis (49) (S. 47) | freigegeben (2026-11-09, Seti) |
| SV-DP-T | Nachgiebigkeit Platten, Teilkörper mit eigenem E | Zerlegung nach l_i, d_W,i = d_W + 2·tan φ·Σl_j, δ_P = Σ δ_P,i (Kegelstumpf bzw. Hülse je Abschnitt) | mm/N | VDI 2230-1:2015 (Q237) S. 48 Hinweis 3 | freigegeben (2026-11-09, Seti) |
| SV-DS | Nachgiebigkeit der Schraube | δ_S = δ_SK + Σδ_i + δ_Gew + δ_G + δ_M | mm/N | VDI 2230-1:2015 (Q237) Gl. (19); Roloff/Matek 27 (Q219) (8.7) | freigegeben (2026-11-09, Seti) |
| SV-DS0 | Durchmesser zu A_s und Rechendurchmesser d₀ | d_S = (d₂ + d₃)/2; d₀ = d_S, Dehnschraube d₀ = d_T | mm | VDI 2230-1:2015 (Q237) R7; Roloff/Matek 27 (Q219) (8.32) | freigegeben (2026-11-09, Seti) |
| SV-DSK | Nachgiebigkeit Schraubenkopf | δ_SK = l_SK/(E_S·A_N), l_SK = 0,4·d (Innensechskant) | mm/N | VDI 2230-1:2015 (Q237) Abschn. 5.1.1 (S. 40 f.); Roloff/Matek 27 (Q219) (8.8) | freigegeben (2026-11-09, Seti) |
| SV-FAM | Ausschlag- und Mittelkraft der Schraube | F_a = (F_SAo − F_SAu)/2; F_m = F_V + (F_Ao + F_Au)/2·Φ_n (F_V = F_M,zul) | N | Roloff/Matek 27 (Q219) (8.15), (8.16) | freigegeben (2026-11-09, Seti) |
| SV-FBS01 | Zulässige Zusatzkraft nach Roloff (Kurznachweis) | F_SA ≤ 0,1·R_p0,2·A₀ (bei ν = 0,9) | N | Roloff/Matek 27 (Q219) (8.34a/b) | freigegeben (2026-11-09, Seti) |
| SV-FKERF | Erforderliche Klemmkraft | F_Kerf = max(F_KQ; F_KP + F_K,Hand) (F_KA = 0, zentrisch) | N | VDI 2230-1:2015 (Q237) (R2/4) | freigegeben (2026-11-09, Seti) |
| SV-FKP | Dichtkraft | F_KP = A_D·p_i,max | N | VDI 2230-1:2015 (Q237) (R2/2) | freigegeben (2026-11-09, Seti) |
| SV-FKQ | Klemmkraft für Querkraft und Moment (Reibschluss) | F_KQ = F_Q,max/(q_F·μ_T,min) + M_Y,max/(q_M·r_a·μ_T,min) | N | VDI 2230-1:2015 (Q237) (R2/1); Roloff/Matek 27 (Q219) (8.18) | freigegeben (2026-11-09, Seti) |
| SV-FKR | Kleinste Restklemmkraft | F_KR,min = F_V,min − (1 − Φ_n)·F_A,max | N | VDI 2230-1:2015 (Q237) (R12/1); Roloff/Matek 27 (Q219) (8.13) | freigegeben (2026-11-09, Seti) |
| SV-FMMAX | Maximalmontagevorspannkraft | F_M,max = α_A·F_M,min | N | VDI 2230-1:2015 (Q237) (R6/1); Roloff/Matek 27 (Q219) (8.29) | freigegeben (2026-11-09, Seti) |
| SV-FMMIN | Mindestmontagevorspannkraft | F_M,min = F_Kerf + (1 − Φ_n)·F_A,max + F_Z + ΔF′_Vth (Zunahme ΔF′_Vth < 0 → 0) | N | VDI 2230-1:2015 (Q237) (R5/1); Roloff/Matek 27 (Q219) (8.29), (8.30) | freigegeben (2026-11-09, Seti) |
| SV-FMZUL | Zulässige Montagevorspannkraft | F_M,zul = A₀·ν·R_p0,2min/√(1 + 3·[3/2·d₂/d₀·(P/(π·d₂) + 1,155·μ_G,min)]²) | N | VDI 2230-1:2015 (Q237) (R7/2); Roloff/Matek 27 (Q219) (8.32), (8.33); ISO 898-1:2013 (Q239) Tab. 3 | freigegeben (2026-11-09, Seti) |
| SV-FPA | Plattenentlastung | F_PA = (1 − Φ_n)·F_A | N | VDI 2230-1:2015 (Q237) (R3/2); Roloff/Matek 27 (Q219) (8.12) | freigegeben (2026-11-09, Seti) |
| SV-FQT | Querkraft je Schraube aus Moment am Lochkreis | F_Q = 2·T/(D_t·z) + F_Q,direkt/z | N | Roloff/Matek 27 (Q219) (8.18); VDI 2230-1:2015 (Q237) B2 S. 137 | freigegeben (2026-11-09, Seti) |
| SV-FSA | Schraubenzusatzkraft | F_SA = Φ_n·F_A (max und min) | N | VDI 2230-1:2015 (Q237) (R3/1); Roloff/Matek 27 (Q219) (8.11) | freigegeben (2026-11-09, Seti) |
| SV-FSMAX | Maximale Schraubenkraft | F_S,max = F_M,zul + Φ_n·F_A,max − ΔF_Vth (nur Zunahme, ΔF_Vth < 0) | N | VDI 2230-1:2015 (Q237) (R8/1); Roloff/Matek 27 (Q219) (8.14) | freigegeben (2026-11-09, Seti) |
| SV-FVMIN | Kleinste Vorspannkraft im Betrieb | F_V,min = F_M,zul/α_A − F_Z − ΔF′_Vth (Zunahme ΔF′_Vth < 0 → 0) | N | VDI 2230-1:2015 (Q237) (R12/1) | freigegeben (2026-11-09, Seti) |
| SV-FZ | Vorspannkraftverlust durch Setzen | F_Z = f_Z/(δ_S + δ_P) | N | VDI 2230-1:2015 (Q237) (R4/1); Roloff/Matek 27 (Q219) (8.19) | freigegeben (2026-11-09, Seti) |
| SV-FZSUM | Setzbetrag (von Hand) | f_Z eingegeben | mm | VDI 2230-1:2015 (Q237) Tab. 5; Roloff/Matek 27 (Q219) TB 8-10a | freigegeben (2026-11-09, Seti) |
| SV-KEF | Vorschlag Krafteinleitungsfaktor (VDI Tab. 2) | lineare Interpolation in l_A/h und a_k/h je Typ SV 1 bis SV 6 | 1 | VDI 2230-1:2015 (Q237) Tab. 2 (S. 62) | freigegeben (2026-11-09, Seti) |
| SV-LE | Erforderliche Einschraubtiefe (Anhaltswert) | l_e = Faktor·d nach Werkstoff Innengewinde, R_m, Klasse, d/P (oberer Wert) | mm | Roloff/Matek 27 (Q219) TB 8-15 | freigegeben (2026-11-09, Seti) |
| SV-LGEW | Freie belastete Gewindelänge | l_Gew = l_K − Σ l_i (Schaftelemente in der Klemmlänge) | mm | VDI 2230-1:2015 (Q237) Bild 6; Roloff/Matek 27 (Q219) Bsp. 8.1 | freigegeben (2026-11-09, Seti) |
| SV-LK | Klemmlänge | l_K = Σ h_i (Platten und Scheiben) | mm | VDI 2230-1:2015 (Q237) Bild 6 | freigegeben (2026-11-09, Seti) |
| SV-MA | Anziehmoment | M_A = F_M,zul·(0,16·P + 0,58·d₂·μ_G,min + D_Km/2·μ_K,min) | N·mm | VDI 2230-1:2015 (Q237) (R13/1); Roloff/Matek 27 (Q219) (8.26) | freigegeben (2026-11-09, Seti) |
| SV-MA-EX | Anziehmoment exakt | M_A = F_M·[d₂/2·tan(φ + ρ′) + D_Km/2·μ_K], tan ρ′ = μ_G/cos 30° | N·mm | Roloff/Matek 27 (Q219) (8.24); VDI 2230-1:2015 (Q237) Abschn. 5.4.3 | freigegeben (2026-11-09, Seti) |
| SV-MG | Gewindemoment | M_G = F_M,zul·d₂/2·(P/(π·d₂) + 1,155·μ_G,min) | N·mm | VDI 2230-1:2015 (Q237) Gl. (154); Roloff/Matek 27 (Q219) (8.23) | freigegeben (2026-11-09, Seti) |
| SV-ML | Losdrehmoment | M_L = F_V·[d₂/2·tan(ρ′ − φ) + D_Km/2·μ_K], F_V = F_M,zul − F_Z | N·mm | Roloff/Matek 27 (Q219) S. 277 | freigegeben (2026-11-09, Seti) |
| SV-MLI | Inneres Losdrehmoment | M_Li = F_V·P/(2·π) | N·mm | Roloff/Matek 27 (Q219) S. 278 | freigegeben (2026-11-09, Seti) |
| SV-MVORH | Vorhandene wirksame Einschraubtiefe | m_eff,vorh = m_ges − 2·P | mm | VDI 2230-1:2015 (Q237) Gl. (208), B1 S. 136 | freigegeben (2026-11-09, Seti) |
| SV-N-FBS | Kurznachweis Roloff (nur Anzeige) | F_SA ≤ 0,1·R_p0,2·A₀ (Verhältnis) | 1 | Roloff/Matek 27 (Q219) (8.34) | freigegeben (2026-11-09, Seti) |
| SV-N-FM | Nachweis Schraubengröße | F_M,max ≤ F_M,zul (Reserve F_M,zul/F_M,max) | 1 | VDI 2230-1:2015 (Q237) (R7/3); Roloff/Matek 27 (Q219) S. 273 | freigegeben (2026-11-09, Seti) |
| SV-N-GEO | Gestaltung | l_K/d < 2 Hinweis α_A; l_K/d > 5 Dehnschraube empfohlen; Gewindeauslauf nicht in der Trennfuge | 1 | VDI 2230-1:2015 (Q237) Tab. A8; Roloff/Matek 27 (Q219) Abschn. 8.2.2 | freigegeben (2026-11-09, Seti) |
| SV-N-GUELT | Gültigkeit | M4 bis M39, 8.8 bis 12.9, Stahlschraube, zentrisch, D_A > d_h, Raumtemperatur | 1 | VDI 2230-1:2015 (Q237) Abschn. 1 | freigegeben (2026-11-09, Seti) |
| SV-N-KR | Nachweis Restklemmkraft | F_KR,min ≥ F_Kerf; F_KR,min ≤ 0: Trennfuge öffnet | N | VDI 2230-1:2015 (Q237) R5; Roloff/Matek 27 (Q219) (8.13) | freigegeben (2026-11-09, Seti) |
| SV-N-LE | Nachweis Einschraubtiefe | m_eff,vorh ≥ l_e (ESV) | mm | VDI 2230-1:2015 (Q237) R11; Roloff/Matek 27 (Q219) TB 8-15 | freigegeben (2026-11-09, Seti) |
| SV-N-P | Nachweis Flächenpressung Kopfseite | S_p = p_G/p_max je Auflage, p_max = max(p_M; p_B), p_M = F_M,zul/A_p,min (Montage), p_B = (F_V,max + F_SA,max − ΔF_Vth)/A_p,min (Betrieb), F_V,max = F_M,zul − F_Z; streckgrenz- bzw. drehwinkelgesteuert p_max = 1,4·F_M,Tab/A_p,min; maßgebend die kleinere Sicherheit; Nachweis S_p/S_p,erf ≥ 1 | 1 | VDI 2230-1:2015 (Q237) R10, (R10/1) bis (R10/4) | freigegeben (2026-11-10, Seti) |
| SV-N-SA | Nachweis Abscheren (Ausfallbetrachtung) | S_A ≥ S_A,erf (Verhältnis) | 1 | VDI 2230-1:2015 (Q237) R12 | freigegeben (2026-11-09, Seti) |
| SV-N-SD | Nachweis Dauerhaltbarkeit | S_D ≥ S_D,erf (Verhältnis) | 1 | VDI 2230-1:2015 (Q237) R9 | freigegeben (2026-11-09, Seti) |
| SV-N-SF | Nachweis Fließen im Betrieb | S_F ≥ S_F,erf (Verhältnis) | 1 | VDI 2230-1:2015 (Q237) R8 | freigegeben (2026-11-09, Seti) |
| SV-N-SG | Nachweis Gleiten | S_G ≥ S_G,erf (Verhältnis) | 1 | VDI 2230-1:2015 (Q237) R12 | freigegeben (2026-11-09, Seti) |
| SV-NV | Nicht vorgespannte Schraube | A_s ≥ F/(R_p0,2/S), S = 1,25 bzw. 1,5 unter Last angezogen | mm² | Roloff/Matek 27 (Q219) (8.38) | freigegeben (2026-11-09, Seti) |
| SV-OPT-A24 | Nichtrostende Schraube (Option) | R_p0,2 = R_pf und R_m aus ISO 3506-1; σ_A nur von Hand (VDI-Werte gelten nicht) | N/mm² | ISO 3506-1:2020 (Q247) | freigegeben (2026-11-09, Seti) |
| SV-OPT-FEIN | Feingewinde (Option) | Datenzeile fd_threads Reihe fein, gleiche Formeln wie Regelgewinde | mm | DIN 13-2 bis 13-11; Roloff/Matek 27 (Q219) TB 8-2 | freigegeben (2026-11-09, Seti) |
| SV-OPT-FL | Axialkraft je Schraube am Flansch (Option) | F_A = p·π/4·d_m²/z (Druck bis Dichtungsmitte) | N | Roloff/Matek 27 (Q219) Bsp. 8.2 (S. 303) | freigegeben (2026-11-09, Seti) |
| SV-OPT-SAZ | Zeitfestigkeit (Option) | σ_AZSG = σ_ASG·(N_D/N_Z)^(1/6), N_D = 2·10⁶ | N/mm² | VDI 2230-1:2015 (Q237) (R9/6-1), (R9/6-2) | freigegeben (2026-11-09, Seti) |
| SV-OPT-VTH | Vorspannkraftänderung durch Temperatur (Option, vereinfacht) | ΔF′_Vth = l_K·(α_S·ΔT_S − α_P·ΔT_P)/(δ_S·E_SRT/E_ST + δ_P·E_PRT/E_PT), hier E(T) = E_RT | N | VDI 2230-1:2015 (Q237) (R4/2) | freigegeben (2026-11-09, Seti) |
| SV-PB | Flächenpressung Betrieb | p_B,max = (F_V,max + F_SA,max − ΔF_Vth)/A_p,min, F_V,max = F_M,zul − F_Z (ΔF_Vth > 0 → 0, Druck: F_SA = 0) | N/mm² | VDI 2230-1:2015 (Q237) (R10/2), Gl. (191) | freigegeben (2026-11-09, Seti) |
| SV-PHI | Steigungswinkel | φ = arctan(P/(π·d₂)) | ° | Roloff/Matek 27 (Q219) (8.1) | freigegeben (2026-11-09, Seti) |
| SV-PHIK | Kraftverhältnis Kopf/Mutter (n = 1) | Φ_K = (δ_P + δ_PZu)/(δ_S + δ_P); VDI Gl. (83): δ_PZu = (w − 1)·δ_M (w = 1 DSV, 2 ESV); Roloff (8.17): δ_PZu = 0 (Schalter δ_PZu aus) | 1 | VDI 2230-1:2015 (Q237) Gl. (83); Roloff/Matek 27 (Q219) (8.17) | freigegeben (2026-11-09, Seti) |
| SV-PHIN | Kraftverhältnis mit Krafteinleitung | Φ_n = n·Φ_K | 1 | VDI 2230-1:2015 (Q237) (R3/3); Roloff/Matek 27 (Q219) (8.17) | freigegeben (2026-11-09, Seti) |
| SV-PM | Flächenpressung Montage | p_M,max = F_M,zul/A_p,min | N/mm² | VDI 2230-1:2015 (Q237) (R10/1); Roloff/Matek 27 (Q219) (8.36) | freigegeben (2026-11-09, Seti) |
| SV-PSG | Flächenpressung streckgrenz- bzw. drehwinkelgesteuert | p_max = 1,4·F_M,Tab/A_p,min (F_M,Tab mit ν = 0,9) | N/mm² | VDI 2230-1:2015 (Q237) (R10/3); Roloff/Matek 27 (Q219) (8.37) | freigegeben (2026-11-09, Seti) |
| SV-SA | Spannungsausschlag | σ_a = (F_SAo − F_SAu)/(2·A_s) | N/mm² | VDI 2230-1:2015 (Q237) (R9/1); Roloff/Matek 27 (Q219) (8.20a) | freigegeben (2026-11-09, Seti) |
| SV-SAB | Sicherheit gegen Abscheren | S_A = τ_B·A_τ/F_Q,max, τ_B = (τ_B/R_m)·R_m | 1 | VDI 2230-1:2015 (Q237) (R12/7), Tab. 7 | freigegeben (2026-11-09, Seti) |
| SV-SASG | Dauerhaltbarkeit schlussgewalzt | σ_ASG = (2 − F_Sm/F_0,2min)·σ_ASV, F_0,2min = A_s·R_p0,2min | N/mm² | VDI 2230-1:2015 (Q237) (R9/5-2); Roloff/Matek 27 (Q219) (8.22) | freigegeben (2026-11-09, Seti) |
| SV-SASV | Dauerhaltbarkeit schlussvergütet | σ_ASV = 0,85·(150/d + 45) | N/mm² | VDI 2230-1:2015 (Q237) (R9/5-1); Roloff/Matek 27 (Q219) (8.21) | freigegeben (2026-11-09, Seti) |
| SV-SD | Sicherheit gegen Dauerbruch | S_D = σ_AS/σ_a | 1 | VDI 2230-1:2015 (Q237) (R9/4); Roloff/Matek 27 (Q219) (8.20b) | freigegeben (2026-11-09, Seti) |
| SV-SF | Sicherheit gegen Fließen | S_F = R_p0,2min/σ_red,B | 1 | VDI 2230-1:2015 (Q237) (R8/5-2); Roloff/Matek 27 (Q219) (8.35a) | freigegeben (2026-11-09, Seti) |
| SV-SG | Sicherheit gegen Gleiten | S_G = F_KR,min/F_KQerf | 1 | VDI 2230-1:2015 (Q237) (R12/4) | freigegeben (2026-11-09, Seti) |
| SV-SP | Sicherheit gegen Flächenpressung | S_p = p_G/p_max | 1 | VDI 2230-1:2015 (Q237) (R10/4) | freigegeben (2026-11-09, Seti) |
| SV-SREDB | Vergleichsspannung im Betrieb | σ_red,B = √(σ_z,max² + 3·(k_τ·τ_max)²), k_τ = 0,5 | N/mm² | VDI 2230-1:2015 (Q237) (R8/4); Roloff/Matek 27 (Q219) (8.35b) | freigegeben (2026-11-09, Seti) |
| SV-SREDM | Vergleichsspannung bei der Montage | σ_red,M = ν·R_p0,2min (bei F_M,zul) | N/mm² | VDI 2230-1:2015 (Q237) (R7/1); Roloff/Matek 27 (Q219) (8.31) | freigegeben (2026-11-09, Seti) |
| SV-SZMAX | Maximale Zugspannung | σ_z,max = F_S,max/A₀ | N/mm² | VDI 2230-1:2015 (Q237) (R8/2) | freigegeben (2026-11-09, Seti) |
| SV-TANPHI | Kegelwinkel (ESV, Gl. (42)) | tan φ_E = 0,348 + 0,013·ln β_L + 0,193·ln y; β_L = l_K/d_W, y = D′_A/d_W | 1 | VDI 2230-1:2015 (Q237) Gl. (42), (43) | freigegeben (2026-11-09, Seti) |
| SV-TAU | Torsionsspannung | τ_max = M_G/W_P | N/mm² | VDI 2230-1:2015 (Q237) (R8/3) | freigegeben (2026-11-09, Seti) |
| SV-TAUQ | Scherspannung bei Durchrutschen | τ_Q,max = F_Q,max/A_τ (A_τ mit d_τ = d_i im Schaft, d_S im Gewinde, B-sv6) | N/mm² | VDI 2230-1:2015 (Q237) (R12/5), Gl. (219) | freigegeben (2026-11-09, Seti) |
| SV-WAHL | Auslegung: gültige Schrauben | Aufzählung M4 bis M39 × 8.8, 10.9, 12.9 mit Geometrie aus der Norm; Länge = kleinste Normlänge der Norm (fd_bolt_geometry) mit l ≥ l_K + m + 2·P (DSV: Mutterhöhe m ISO 4032, Überstand 2·P) bzw. l ≥ l_K + l_e + 2·P (ESV, l_e TB 8-15, sonst 1,25·d) und Schaft l − b ≤ l_K (ISO 4014: b für l ≤ 125, ≤ 200, > 200 mm); je Größe gültig (alle Pflichtnachweise erfüllt), ungültig oder nicht bewertbar (Kennwert fehlt); sortiert nach d, dann Klasse; fehlt p_G einer Platte oder Scheibe: Abbruch mit Hinweis | mm | Verfahren (S6, U8) | freigegeben (2026-11-10, Seti) |
| SV-WP | Polares Widerstandsmoment | W_P = π/16·d₀³ | mm³ | VDI 2230-1:2015 (Q237) Gl. (156) | freigegeben (2026-11-09, Seti) |

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
| W-E | E-Modul | E (Werkstoffdatenbank, Standardvariante) | MPa | WDB 1.1.4 | freigegeben (2026-10-08, Seti) |
| W-G | Schubmodul | G = E / (2·(1 + ν)) | MPa | ν Klassen-Richtwert (Annahme) | freigegeben (2026-10-08, Seti) |
| W-G-DB | Schubmodul | G (Werkstoffdatenbank) | MPa | BIKAR EN AW-6082 | freigegeben (2026-10-08, Seti) |
| W-RHO | Dichte | ρ (Werkstoffdatenbank) | kg/m³ | WDB 1.1.4 | freigegeben (2026-10-08, Seti) |
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
- Kinematik K1 Orientierung (Modul kinematik, Greifwerk, ab 0.12.0): nur Drehungen starrer Körper, rechtshändige Systeme (ISO 9787), R_ab = Orientierung von {b} in {a} (Spalten = Achsen von {b}); Winkel intern rad. Z-Y-X mit KUKA-Bezeichnung A um z, B um y′, C um x″ (ISO 9787 nennt die Drehungen um x, y, z A, B, C, also umgekehrt; gleiche Matrix). Wertebereiche A, C, φ, ψ in (−180°, 180°], B in [−90°, 90°], θ in [0°, 180°], Quaternion (w, x, y, z) mit w ≥ 0. Kardansperre bzw. θ = 0, 180° bei √(r_11² + r_21²) bzw. √(r_31² + r_32²) ≤ 10⁻⁹: erster Winkel 0. Achse bei θ = 0 unbestimmt (gesetzt z), bei θ = 180° und w = 0 erste von 0 verschiedene Komponente (x, y, z) positiv. Prüfung der Matrix ‖RᵀR − I‖_F und |det R − 1| ≤ 10⁻⁹. Bei Matrix, Vektor und Quaternion ist das Ergebnis im Katalog ein Kontrollwert: Spur tr R = 1 + 2·cos θ (gleich für alle Darstellungen derselben Orientierung) bzw. Betrag; Matrix bzw. Vektor stehen im Beispiel. Nicht im Umfang: Translation, homogene Matrizen (K2), Gelenkketten (K3 bis K6).
