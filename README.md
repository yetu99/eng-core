# eng-core

Deterministischer Rechenkern der Ingenieur-Werkbank. Single Point of Truth für alle Formeln von Blatt 1 (Festigkeit) und Blatt 2 (Werkstoffauswahl nach Ashby).

## Inhalt

| Ordner | Inhalt |
|---|---|
| `src/` | TypeScript, reine Funktionen: Querschnitte, Auslegungswerte, Zug, Druck/Knicken, Biegung, Torsion, Überlagerung, Bemessen, Ashby-Indizes, Screening, Ranking, Form, Zielkonflikte |
| `data/` | Versionierter Abzug der Werkstoffdaten aus Supabase (Tabellen `wa_*`, identisch mit dem Werkstoffatlas), Datenstand in `data/snapshot.json` |
| `test/` | Vitest: `golden.json` aus der Gegenrechnung, Grenzfälle, Auslegungswerte, Bemessen, Ashby |
| `verification/` | `pruefung.py`: unabhängige Python-Gegenrechnung (numerische Integration, Finite Differenzen, Reihenlösungen) |
| `scripts/` | `katalog.ts` (Formelkatalog als Daten), `formelkatalog.ts` (erzeugt FORMELKATALOG.md), `formelfreigabe.py` (Freigabe-Excel Export/Import), `sync-to-app.mjs` (kopiert den Kern in eine App) |
| `freigabe/` | Ablage für die Freigabe-Excel (nicht versioniert) |
| `FORMELKATALOG.md` | alle Formeln mit ID, Quelle und Freigabestatus (aus `formelstatus.json`, nie von Hand bearbeiten) |

Einheiten intern: N, mm, MPa, kg/m³. Eingaben: F und N in kN, q in kN/m, T in N·m.

## Prüfen

```bash
npm ci
npx tsc --noEmit
npx vitest run
pip install -r verification/requirements.txt
python3 verification/pruefung.py
```

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

## Änderungen am Kern

Nur hier, nie in der App. Jede neue Formel braucht: Rechenschritt mit ID, Eintrag im Formelkatalog (automatisch), Referenzwert in `verification/pruefung.py`, danach `npm run golden`.
