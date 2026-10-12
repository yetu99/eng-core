# eng-core

Deterministischer Rechenkern der Ingenieur-Werkbank. Single Point of Truth für alle Formeln von Blatt 1 (Festigkeit) und Blatt 2 (Werkstoffauswahl nach Ashby).

## Inhalt

| Ordner | Inhalt |
|---|---|
| `src/` | TypeScript, reine Funktionen: Querschnitte, Auslegungswerte, Zug, Druck/Knicken, Biegung (sechs Standardfälle und Lastliste `mechanics/loadlist.ts`), Torsion, Druckbehälter (`mechanics/pressure.ts`), Überlagerung, Bemessen, Ashby-Indizes, Screening, Ranking, Form, Zielkonflikte; dazu Prüfstatus für Berichte (`report.ts`, `pruefstatus.json`) und Werkstoff-Detailansicht (`materialDetail.ts`) |
| `data/` | Versionierter Abzug der Werkstoffdaten aus Supabase (Tabellen `wa_*`, identisch mit dem Werkstoffatlas), Datenstand in `data/snapshot.json` |
| `test/` | Vitest: `golden.json` aus der Gegenrechnung, Grenzfälle, Auslegungswerte, Bemessen, Ashby, Lastliste (`loadlist.test.ts`: Spezialfälle, Spiegelung, Superposition, Randbedingungen, Eingabeprüfung), Druckbehälter (`pressure.test.ts`: Randbedingungen, Gleichgewicht, Grenzfälle, Monotonie, Bemessen) |
| `verification/` | `pruefung.py`: unabhängige Python-Gegenrechnung (numerische Integration, Finite Differenzen, Reihenlösungen), `ergebnis.json` (letztes Ergebnis), `abnahme.json` (Stufen P5/P6, von Hand gepflegt) |
| `publish/` | `katalog.json`: Formelkatalog für den Spiegel in Supabase (`fk_*`), erzeugt mit `npm run katalog:publish` |
| `supabase/` | Migrationen der Tabellen `fk_*` und der Funktion `fk_publish_github` (Projekt Kompendium) |
| `scripts/` | `katalog.ts` (Formelkatalog als Daten), `formelkatalog.ts` (erzeugt FORMELKATALOG.md), `formelfreigabe.py` (Freigabe-Excel Export/Import), `sync-to-app.mjs` (kopiert den Kern in eine App) |
| `freigabe/` | Ablage für die Freigabe-Excel (nicht versioniert) |
| `FORMELKATALOG.md` | alle Formeln mit ID, Quelle und Freigabestatus (aus `formelstatus.json`, nie von Hand bearbeiten) |

Einheiten intern: N, mm, MPa, kg/m³. Eingaben: F und N in kN, q in kN/m, T in N·m.

**Lastliste (ab 0.5.0).** Biegebalken mit Lagern an den Enden (Krag, gelenkig, eingespannt/gelenkig, beidseitig eingespannt) und bis zu 20 Einzelkräften, Trapez-Streckenlasten und Einzelmomenten (`StrengthInput.sub = "LL"`, `StrengthInput.loadList`). Lösung exakt mit Föppl-Klammern und 4 × 4-Randwertsystem, Extremwerte über vollständige Nullstellensuche je Segment. x ab linkem Ende, Lasten nach unten positiv, Momente im Uhrzeigersinn positiv, Positionen in mm, F in kN, q in kN/m, M in N·m. Gegenrechnung in `pruefung.py` unabhängig über Kraftgrößenverfahren, Gleichgewicht am rechten Teilsystem, Finite Differenzen und Roark Tab. 8.1.

**Druckbehälter (ab 0.6.0).** Belastungsart `kind = "PB"` mit den Lastfällen `ZG` (Zylinder geschlossen), `ZO` (Zylinder offen, σ_z = 0) und `KU` (Hohlkugel), Eingabe `StrengthInput.pressure` (Innen- oder Außendurchmesser in mm, Wandstärke in mm, p_i und p_a als Überdruck in MPa). Lamé für jede Wandstärke, Kesselformel als Vergleich ab D_m/t ≥ 20, Nachweis mit GEH am Innen- und Außenrand gegen σ_zul = min(R_p/S_F, R_m/S_B), Tresca als Kennwert. Bemessen mit `designPressureStrength`: geschlossene Lösung bei p_a = 0 (Zylinder geschlossen, Kugel), sonst Bisektion im log-Raum, Aufrunden auf 0,5 mm. Zug positiv, u(r) nach außen positiv. Gegenrechnung in `pruefung.py` unabhängig über Finite Differenzen der Verschiebungsgleichung (Zylinder mit ε_z als Unbekannter und Axialkraftbilanz), eigene Lamé-Umsetzung und Rückeinsetzen der Bemessung.

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
