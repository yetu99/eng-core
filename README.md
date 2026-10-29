# eng-core

Deterministischer Rechenkern der Ingenieur-Werkbank und der Ingenieur-Fachtools. Single Point of Truth für alle Formeln der Werkbank (Festigkeit, Ermüdung, Eigenfrequenz, Werkstoffauswahl nach Ashby) und ab 0.11.0 der Fachtools (Rohrhydraulik, Pressverband, Schraube, O-Ring, Fachwerk).

## Inhalt

| Ordner | Inhalt |
|---|---|
| `src/` | TypeScript, reine Funktionen: Querschnitte, Auslegungswerte, Zug, Druck/Knicken, Biegung (sechs Standardfälle und Lastliste `mechanics/loadlist.ts`), Torsion, Druckbehälter (`mechanics/pressure.ts`), Eigenfrequenz (`mechanics/vibration.ts`), Kerbwirkung und Ermüdung (`mechanics/fatigue.ts`), Überlagerung, Bemessen, Ashby-Indizes, Screening, Ranking, Form, Zielkonflikte; dazu Prüfstatus für Berichte (`report.ts`, `pruefstatus.json`) und Werkstoff-Detailansicht (`materialDetail.ts`) |
| `data/` | Versionierter Abzug der Werkstoffdaten aus Supabase (Tabellen `wa_*`, identisch mit dem Werkstoffatlas), Datenstand in `data/snapshot.json`; Fachdaten (`fd_*`) in `data/fd/` mit eigenem `snapshot.json` |
| `test/` | Vitest: `golden.json` aus der Gegenrechnung, Grenzfälle, Auslegungswerte, Bemessen, Ashby, Lastliste (`loadlist.test.ts`: Spezialfälle, Spiegelung, Superposition, Randbedingungen, Eingabeprüfung), Druckbehälter (`pressure.test.ts`: Randbedingungen, Gleichgewicht, Grenzfälle, Monotonie, Bemessen), Eigenfrequenz (`vibration.test.ts`: Einklammerung, Skalierung, Ordnung der Lagerungen, Eigenformen, Orthogonalität, Rayleigh, Bemessen), Ermüdung (`fatigue.test.ts`: Gültigkeitsgrenzen α_k, Stetigkeit n, Literaturbeispiele, Schalter aus, Datenregeln E8 und E10) |
| `verification/` | `pruefung.py`: unabhängige Python-Gegenrechnung (numerische Integration, Finite Differenzen, Reihenlösungen), `ergebnis.json` (letztes Ergebnis), `abnahme.json` (Stufen P5/P6, von Hand gepflegt) |
| `publish/` | `katalog.json`: Formelkatalog für den Spiegel in Supabase (`fk_*`), erzeugt mit `npm run katalog:publish` |
| `supabase/` | Migrationen der Tabellen `fk_*` und der Funktion `fk_publish_github` (Projekt Kompendium); `fk_03_module.sql` (0.10.0) erweitert den Modul-Check um die Fachtools-Module und setzt Werkzeug-Verweise je Modul |
| `scripts/` | `katalog.ts` (Formelkatalog als Daten), `formelkatalog.ts` (erzeugt FORMELKATALOG.md), `formelfreigabe.py` (Freigabe-Excel Export/Import), `sync-to-app.mjs` (kopiert den Kern in eine App) |
| `freigabe/` | Ablage für die Freigabe-Excel (nicht versioniert) |
| `FORMELKATALOG.md` | alle Formeln mit ID, Quelle und Freigabestatus (aus `formelstatus.json`, nie von Hand bearbeiten) |

Einheiten intern: N, mm, MPa, kg/m³. Eingaben: F und N in kN, q in kN/m, T in N·m.

**Lastliste (ab 0.5.0).** Biegebalken mit Lagern an den Enden (Krag, gelenkig, eingespannt/gelenkig, beidseitig eingespannt) und bis zu 20 Einzelkräften, Trapez-Streckenlasten und Einzelmomenten (`StrengthInput.sub = "LL"`, `StrengthInput.loadList`). Lösung exakt mit Föppl-Klammern und 4 × 4-Randwertsystem, Extremwerte über vollständige Nullstellensuche je Segment. x ab linkem Ende, Lasten nach unten positiv, Momente im Uhrzeigersinn positiv, Positionen in mm, F in kN, q in kN/m, M in N·m. Gegenrechnung in `pruefung.py` unabhängig über Kraftgrößenverfahren, Gleichgewicht am rechten Teilsystem, Finite Differenzen und Roark Tab. 8.1.

**Druckbehälter (ab 0.6.0).** Belastungsart `kind = "PB"` mit den Lastfällen `ZG` (Zylinder geschlossen), `ZO` (Zylinder offen, σ_z = 0) und `KU` (Hohlkugel), Eingabe `StrengthInput.pressure` (Innen- oder Außendurchmesser in mm, Wandstärke in mm, p_i und p_a als Überdruck in MPa). Lamé für jede Wandstärke, Kesselformel als Vergleich ab D_m/t ≥ 20, Nachweis mit GEH am Innen- und Außenrand gegen σ_zul = min(R_p/S_F, R_m/S_B), Tresca als Kennwert. Bemessen mit `designPressureStrength`: geschlossene Lösung bei p_a = 0 (Zylinder geschlossen, Kugel), sonst Bisektion im log-Raum, Aufrunden auf 0,5 mm. Zug positiv, u(r) nach außen positiv. Gegenrechnung in `pruefung.py` unabhängig über Finite Differenzen der Verschiebungsgleichung (Zylinder mit ε_z als Unbekannter und Axialkraftbilanz), eigene Lamé-Umsetzung und Rückeinsetzen der Bemessung.

**Eigenfrequenz (ab 0.6.1).** Belastungsart `kind = "FQ"`, Lastfall = Lagerung wie Lastliste (`KR`, `GG`, `EG`, `EE`), Eingabe `StrengthInput.vibration` (Zusatzmasse m_z in kg/m, f_min und f_err in Hz, Δ_min in %), Querschnitt und Länge aus Blatt 1. Euler-Bernoulli, Biegeeigenfrequenzen f₁ bis f₃ in der Lastebene, Einheiten N, mm, t, s (ρ[t/mm³] = ρ[kg/m³]·10⁻¹²). Wurzeln der Frequenzgleichung deterministisch (Einklammerung an k·π, Bisektion 80 Schritte), Eigenformen normiert (max |φ| = 1, erste Halbwelle nach unten), Knoten, Rayleigh-Kontrolle mit der Biegelinie der Lastliste unter Eigengewicht. Nachweise f₁ ≥ f_min und Resonanzabstand |f_err − f₁|/f₁ ≥ Δ_min. Bemessen mit `designSize(…, "formtreu")`: s = f_min/f₁ ohne Zusatzmasse, sonst Bisektion. Gegenrechnung in `pruefung.py` unabhängig über Finite Elemente (Hermite-Balkenelemente, 200 Elemente, `scipy.linalg.eigh`), Literaturwerte Blevins Tab. 8.1, eigene Wurzeln mit brentq und Rayleigh-Quotient der statischen FE-Lösung.

**Offene Profile (ab 0.7.0).** Querschnitte `i_profil`, `u_profil`, `l_profil`, `t_profil` (parametrisch, scharfkantig, ohne Ausrundungen) in `src/openSections.ts`, Kachelgruppe `SECTIONS[t].group = "offen"`. Lage „schwach“ für I und U als eigene Typen `i_profil_z`, `u_profil_z` (`weakOf` verweist auf den Grundtyp, die Oberfläche zeigt eine Kachel mit Schalter). Geschlossene Formeln für A, Schwerpunkt, I_y, I_z (L zusätzlich I_yz, I₁, I₂, α), W über den maßgebenden Rand, Iₜ = Σ s·t³/3 mit Mittellinienlängen, Wₜ = Iₜ/t_max, Querkraftschub exakt nach Jourawski (κ = A·S/(I·b) an der Stelle größter Schubspannung), Schubmittelpunkt U. Zusatzwerte in `SectionProps.open`. Hinweise: Biegedrillknicken und Schubmittelpunkt bei Biegung, Wölbkrafttorsion bei Torsion, schiefe Biegung beim L-Profil, Beulen (c/t) und Dickwandigkeit als Plausibilität. Gegenrechnung unabhängig über Umrisspolygone (Gaußscher Integralsatz), Breitenfunktion b(z) mit numerischer Integration und Prandtlsche Spannungsfunktion mit Finiten Differenzen (Iₜ exakt, Toleranz 6 %).

**Weitere Materialindizes (ab 0.8.0).** Blatt 2 kennt zwei Bauarten von Indizes (`src/ashby/catalog.ts`). *legacy*: M = y^n / x^k wie bis 0.7.0 (IDs, Texte, Werte unverändert), dazu Balken mit freier Variable „nur Höhe“ bzw. „nur Breite“ (`A-IX-BAH-…`, `A-IX-BAB-…`, Ashby Gl. 5.12, 5.13, Tab. B1, B2) und elastisches Gelenk σ_f/E (`A-IX-GE-F-L`). *product*: M = Y^a · X^b mit Achsgruppen als Produkt von Kennwerten (Wärmedämmung, Wärmespeicher, Präzisionsteil, Thermoschock, Wärmetauscherwand, Druckbehälter; Ashby Anhang B Tab. B5, B6, Tab. 5.7), Leitlinie mit Steigung −b/a, keine Formwirkung, Rechenweg `A-K-*`, `A-GR-*`, `A-MP`. `FUNC_GROUPS` ordnet die Funktionen den Kachelgruppen Mechanisch und Thermisch zu, `productTasks(fn)` liefert die Ziel-Chips. `coverage()` zählt bewertbare Werkstoffe (alle Kennwerte belegt und > 0, keine Schätzung) und nennt fehlende Kennwerte je Werkstoff sowie Klassen mit weniger als der Hälfte. `indexLabel(id)` liefert den Klartext jeder A-ID (Tooltip, Kürzelliste). Gegenrechnung unabhängig aus `data/*.json` mit expliziten Formeln über alle 100 Werkstoffe (Einzelwerte, Bewertbarkeit, Σ ln M, Extremwerte, Ränge).

**Datenstand WDB 1.0.2 (0.8.1, nur Daten).** Keine Formeländerung, Freigabe 273/273 unverändert. Bewertbarkeit steigt deutlich (z. B. Wärmespeicher 53 → 88, Druckbehälter 5 → 24, Präzisionsteil 71 → 90, Thermoschock 69 → 92 von 100). σ_f folgt weiter R_p, sonst R_m, sonst σ_bB; bei Al2O3 (W082) liegt jetzt R_m vor, daher σ_f 267 statt 300 MPa. Werttyp `Marktpreis` ist nie die repräsentative Zeile; Ashby, Preisfilter und Zielkonflikte rechnen mit der Schätzung (Test in `test/data.test.ts`). Bekannte Grenzen: Thermoschock σ_f/(E·α) setzt Elastomere nach vorn (ΔT rechnerisch weit über T_max, Index ohne Temperaturgrenze); Druckbehälter „Fließen vor Bruch“ bewertet auch spröde Werkstoffe (Beton) formal; K_IC Metalle 3 von 57.

**Kerbwirkung und Ermüdung (ab 0.9.0).** Zusatznachweis Dauerfestigkeit für Zug, Biegung, Torsion und Überlagerung, Eingabe `StrengthInput.fatigue` (Schalter `on`, Standard aus; `FATIGUE_DEFAULT`), Ergebnis `StrengthResult.fatigue`, Rechenweg-Gruppe `ermuedung`, IDs `E-*` (`src/mechanics/fatigue.ts`, `notch.ts`, `fatigueGroups.ts`). Nennspannungskonzept nach Roloff/Matek 27 Kap. 3.4 bis 3.7: Struktur DIN 743, Werkstoffgruppen FKM. α_k aus TB 3-6 (Absatz D/d, r/t; Nut; Querbohrung) oder von Hand, G′ aus TB 3-7a, Stützzahl n (FKM, drei Bereiche), β_k = α_k/n oder von Hand, K_t (TB 3-10a/b), K_g (TB 3-10d), K_R (FKM, für Stahl gleich DIN 743), K_D = (β_k/K_g + 1/K_R − 1)/K_V, Mittelspannung mit ψ = a_M·R_m + b_M und Überlastungsfall 1, 2 oder 3, Fließbegrenzung, S_D aus quadratischer Überlagerung von Normal- und Schubanteil, Mindestsicherheit nach TB 3-16a. Wechselfestigkeit: Datenbankwert mit P ≥ 97,5 % direkt; Wert ohne oder mit kleinerem P wird mit der Abschätzung verglichen, das Minimum zählt (E10); Abschätzung Stahl 0,4 / 0,5 / 0,3·R_mN (DIN 743, E11), Guss und Al nach FKM-Gruppe; Cu, Ti, Ni, AZ31B, Zn nur mit Eingabe. Zeitfestigkeit mit Wöhlerlinie Typ I (N_D = 10⁶, k = 5 bzw. 8) oder Typ II (Al, Guss: k_II bis 10⁸). Druck: Hinweis, kein Nachweis. G aus der Datenbank wird nur genutzt, wenn er statisch ist; Abweichung von E/(2(1+ν)) über 15 % ergibt eine Warnung. Gegenrechnung unabhängig in `verification/ermuedung.py` (eigene Gruppen, eigener Datenleser), Literaturfälle Roloff/Matek Bsp. 3.3c und 3.4 exakt (S_D 3,494 und 1,933). Diagrammdaten für Blatt 3 ohne eigene Formeln: `alphaKChart` (Kurvenschar α_k über r/t mit D/d als Parameter bzw. über d_B/d, nur mit `alphaK` gerechnet) und `woehlerChart` (σ_AK(N) mit derselben Wöhlerlinie wie E-WL1/E-WL2). `test/golden.json` wurde nur ergänzt; alte Einträge bleiben unverändert (andere numpy/scipy-Version erzeugt sonst Rundungsrauschen).

**Rohrhydraulik (ab 0.11.0, Modul fluid, Fachtools).** `src/fluid/`: `water.ts` (IAPWS-IF97 Region 1 Dichte, Region 4 Sättigungsdruck, IAPWS R12-08 Viskosität mit μ̄₂ = 1), `props.ts` (Wasser, Tabellenfluid aus `fd_fluid_values`, von Hand), `friction.ts` (64/Re, Colebrook mit Newton ab Roloff-Näherung), `line.ts` (Strang aus Rohren, Formstücken, Armaturen; Knoten, Energie- und Drucklinie; Aufgaben A Druckverlust, B Durchfluss, C Durchmesser mit Normrohr aus `fd_pipe_sizes`), `fdData.ts` (Fachdaten fd 1.0 aus `data/fd/`), `units.ts` (Anzeigeeinheiten). Einheiten intern SI. IDs `FS-*` und `RH-*` (42), Rechenweg-Gruppen `stoffwerte`, `geometrie`, `reibung`, `verluste`, `energie`, `nachweis`. Gegenrechnung unabhängig in `verification/fluid.py` (IAPWS-Prüfwerte IF97 Tab. 5 und 35, R12-08 Tab. 4, Roloff Bsp. 18.2, Dubbel Abb. 17.16, Hagen-Poiseuille, Colebrook mit brentq, Grenzfälle VDI-WA L1.2, Energiebilanz, Rückeinsetzen B und C). Beispielfälle `scripts/fluid-faelle.ts`.

**Abnahme P5 und P6.** `python3 scripts/abnahme.py export` erzeugt eine Excel mit Schritt-für-Schritt-Anleitung für den Abgleich mit FEM (Creo Simulate: D1, F1 bis F4, T7, T10, T12) und der Abnahme-Checkliste, Sollwerte aus `scripts/abnahme-faelle.ts`. `python3 scripts/abnahme.py import <datei.xlsx>` rechnet Abweichungen selbst nach und schreibt `verification/abnahme.json` (Status für Fußzeile und Prüfvermerk) und `verification/abnahme_p5.json` (alle Soll- und Ist-Werte). `python3 scripts/abnahme.py freigabe --pruefer NAME --datum TT.MM.JJJJ` gibt P5 und P6 ohne übertragene FEM-Einzelwerte frei; der Vermerk steht im Text beider Stufen. Die Excel selbst gehört nicht ins Repo.

## Module und Werkzeuge (ab 0.10.0)

Ein Kern, zwei Werkzeuge. `src/modules.json` ordnet jedes Formel-ID-Präfix genau einem Modul zu und jedes Modul einem Werkzeug. Die Skripte lesen dieselbe Datei; ein neues Präfix oder ein neuer Ordner wird nur dort eingetragen (eine nicht zugeordnete ID bricht `scripts/katalog.ts` ab).

| Modul | Werkzeug | Präfixe | Ordner unter `src/` | Einheiten intern | Fachdaten |
|---|---|---|---|---|---|
| gemeinsam | Werkbank (auch Fachtools) | Q, F, W | `sections.ts`, `openSections.ts`, `materials.ts`, `materialDetail.ts`, `data.ts` | N, mm, MPa | nein |
| festigkeit | Werkbank | B, Z, K, T, N, D, P, V, E | `mechanics/` | N, mm, MPa | nein |
| ashby | Werkbank | A, C | `ashby/` | Werkstoffdaten | nein |
| fluid | Fachtools | RH, PU, FS | `fluid/` | SI (m, kg, s, Pa, m³/s, K) | ja |
| verbindungen | Fachtools | SV, PV | `joints/` | N, mm, MPa | ja |
| dichtungen | Fachtools | OR | `seals/` | N, mm, MPa | ja |
| stabwerke | Fachtools | FW | `structures/` | N, mm, MPa | nein |

`WL` ist reserviert (Wälzlager als Linkkarte, keine Formeln). Module der Fachtools dürfen Formeln anderer Module aufrufen (Pressverband nutzt Lamé aus `mechanics/pressure.ts`); deren IDs behalten ihr Modul.

- **Rechenweg-Gruppen**: `TRACE_GROUPS` je Modul, `TraceGroupOf<"fluid">`, `Trace<G>`; `TraceGroup` und `Trace` ohne Typargument bleiben die Gruppen der Werkbank Blatt 1. Überschriften für neue Oberflächen in `TRACE_GROUP_TITLES`.
- **Prüfstatus je Modul**: `src/pruefstatus.json` enthält `modules` (Formeln, Freigaben, Gegenrechnung je Modul; Summe = Gesamtwerte) und `acceptanceTools` (Abnahme weiterer Werkzeuge aus `verification/abnahme.json`, Schlüssel `tools`). `reportMeta(tool, modules?)` zählt nur die Module des Werkzeugs: `reportMeta()` = Werkbank (unverändert), `reportMeta("Ingenieur-Fachtools")` = Fachtools mit Fachdaten-Stand in Fußzeile und Prüfvermerk.
- **Gegenrechnung je Modul**: `verification/pruefung.py` ordnet jeden Prüffall über `case["module"]` zu (sonst über den Falltyp) und schreibt `verification/ergebnis.json` mit `modules`. Neue Module hängen ihre Fälle aus `verification/<modul>.py` ein und setzen `module`.
- **Sync nach Modulen**: `node scripts/sync-to-app.mjs <app> --tool werkbank|fachtools` oder `--modules gemeinsam,fluid` kopiert die Basisdateien, die Ordner der Module und alles, was davon über relative Importe erreicht wird; `index.ts` wird auf die kopierten Dateien gekürzt, Dateien des letzten Syncs, die nicht mehr dazugehören, werden entfernt. Ohne Option wie bisher der ganze Kern. `--dry-run` zeigt die Liste.
- **Freigabe je Modul**: `npm run freigabe:export -- --modul fluid` (auch `--modul werkbank|fachtools`, kombinierbar mit `--offen`) → `freigabe/Formelfreigabe_eng-core_<version>_<modul>.xlsx`. Der Import übernimmt nur die Zeilen der Excel; alle anderen Formeln behalten ihren Status.
- **Fachdaten**: `npm run data:pull:fd` schreibt `data/fd/*.json` und `data/fd/snapshot.json` aus den Tabellen in `scripts/fd-tables.json` (wächst mit jedem Fachtool), Stand aus `fd_v_current_release`. Offline: `node scripts/pull-data.mjs --fd --from-file <export.json>` (Export `fd_export_snapshot.sql`). Im Kern: `FD_VERSION`, `FD_FILES` (`src/fdVersion.ts`), solange nichts freigegeben ist `null`.

## Prüfen

```bash
npm ci
npx tsc --noEmit
npx vitest run
pip install -r verification/requirements.txt
python3 verification/pruefung.py --check-ergebnis
npx tsx scripts/formelkatalog.ts --check && npx tsx scripts/katalog-publish.ts --check
```

`npm run pruefstatus` schreibt nach einer Änderung `verification/ergebnis.json`, `FORMELKATALOG.md`, `src/pruefstatus.json` und `publish/katalog.json` neu.

Bei jedem Push läuft dasselbe automatisch auf GitHub (`.github/workflows/verify.yml`).

## Werkstoffdaten aktualisieren

Master der Werkstoffdaten ist Supabase (Projekt Kompendium, Tabellen `wa_*`, seit WDB 1.0). `data/` ist ein Abzug davon, damit Rechnungen, Golden-Tests und PDFs reproduzierbar bleiben. Der Datenstand steht in jedem Rechenweg (`W-E`, `W-RHO`).

```bash
npm run data:check   # meldet, ob die Datenbank einen neueren Stand hat (Exit 1 = veraltet)
npm run data:pull    # schreibt data/*.json und data/snapshot.json neu (gleicher Stand = gleiche Bytes)
npx vitest run && python3 verification/pruefung.py && npx tsx scripts/formelkatalog.ts
```

Danach committen und mit `sync-to-app` in die Werkbank einspielen. Die Dateien in `data/` nie von Hand ändern; der Test `test/data.test.ts` prüft die Prüfsummen.

## In eine App einspielen

```bash
node scripts/sync-to-app.mjs ../fidelity-overlay-app
```

Kopiert `src/` nach `<app>/src/core` und `data/` nach `<app>/src/data` und schreibt `MANIFEST.json` mit Prüfsummen. In der App werden diese Ordner nie direkt bearbeitet.

## Formel freigeben

Die Freigabe läuft über eine Excel-Datei. `formelstatus.json` wird nur vom Import-Skript geschrieben.

1. Export (nach jeder Kernänderung): `npm run freigabe:export` → `freigabe/Formelfreigabe_eng-core_<version>.xlsx`. Bereits erteilte Freigaben sind vorbefüllt. Mit `npm run freigabe:export -- --offen` nur die Formeln ohne gültige Freigabe (Nachprüfung).
2. In Excel ausfüllen, nur die gelben Spalten: Freigabe (offen / freigegeben / abgelehnt), Datum, Prüfer, Kommentar oder Verbesserung. Jede Zeile enthält ein nachrechenbares Beispiel und den Rechenfall, aus dem es stammt.
3. Import: `npm run freigabe:import -- <datei.xlsx>` (Probelauf mit `--dry-run`). Schreibt `formelstatus.json`, erzeugt `FORMELKATALOG.md` neu und listet alle Einwände auf.
4. Abgelehnte Formeln im Kern korrigieren, Gegenrechnung und Golden-Tests anpassen, neu exportieren.
5. Committen: `formelstatus.json` und `FORMELKATALOG.md`. Die Excel selbst wird nicht versioniert (`freigabe/*.xlsx` steht in `.gitignore`).

Eine Freigabe speichert den geprüften Formeltext. Ändert sich die Formel später, zeigt der Katalog „geändert, neu prüfen“ und der nächste Export setzt die Zeile auf offen.

## Prüfstatus in Berichten

`reportMeta()`, `traceApproval(steps)`, `reportFooter(meta, usage)` und `reportVerdict(meta, usage)` liefern Versionen, Freigabestand der im Blatt verwendeten Formeln, Ergebnis der Gegenrechnung und Abnahmestand (P5, P6) für Fußzeile und Prüfvermerk. Quelle ist `src/pruefstatus.json`, erzeugt aus `formelstatus.json`, `verification/ergebnis.json` und `verification/abnahme.json`. Solange P6 offen ist, lautet der Vermerk nie „abgenommen“.

## Formelkatalog in Supabase

Spiegel für andere Tools (Kompendium, Werkstoffatlas, neue Fachtools), Master bleibt dieses Repo. Tabellen `fk_releases`, `fk_formulas`, `fk_formula_versions`, `fk_formula_links`, Sichten `fk_v_formulas`, `fk_v_current_release` (lesbar mit dem Publishable Key, schreibbar nur über `fk_publish`).

1. `npm run katalog:publish` schreibt `publish/katalog.json` und gibt die MD5-Summe aus.
2. Committen und pushen.
3. Über das Supabase-MCP: `select * from public.fk_publish_github('<commit>', '<md5>');` Die Datenbank lädt die Datei genau dieses Commits von GitHub, prüft die MD5-Summe und übernimmt sie (idempotent; Formeln ohne Kern-Eintrag werden `retired`, nie gelöscht; Text- oder Statusänderungen landen in `fk_formula_versions`).

## Änderungen am Kern

Nur hier, nie in der App. Jede neue Formel braucht: Rechenschritt mit ID, Eintrag im Formelkatalog (automatisch), Referenzwert in `verification/pruefung.py`, danach `npm run golden`.
