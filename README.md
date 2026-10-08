# eng-core

Deterministischer Rechenkern der Ingenieur-Werkbank. Single Point of Truth für alle Formeln von Blatt 1 (Festigkeit) und Blatt 2 (Werkstoffauswahl nach Ashby).

## Inhalt

| Ordner | Inhalt |
|---|---|
| `src/` | TypeScript, reine Funktionen: Querschnitte, Auslegungswerte, Zug, Druck/Knicken, Biegung, Torsion, Überlagerung, Bemessen, Ashby-Indizes, Screening, Ranking, Form, Zielkonflikte |
| `data/` | JSON-Export der Werkstoffdatenbank v0.3 (identisch mit dem Werkstoffatlas) |
| `test/` | Vitest: `golden.json` aus der Gegenrechnung, Grenzfälle, Auslegungswerte, Bemessen, Ashby |
| `verification/` | `pruefung.py`: unabhängige Python-Gegenrechnung (numerische Integration, Finite Differenzen, Reihenlösungen) |
| `scripts/` | `formelkatalog.ts` (erzeugt FORMELKATALOG.md), `sync-to-app.mjs` (kopiert den Kern in eine App) |
| `FORMELKATALOG.md` | alle Formeln mit ID, Quelle und Freigabestatus (aus `formelstatus.json`) |

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

## In eine App einspielen

```bash
node scripts/sync-to-app.mjs ../fidelity-overlay-app
```

Kopiert `src/` nach `<app>/src/core` und `data/` nach `<app>/src/data` und schreibt `MANIFEST.json` mit Prüfsummen. In der App werden diese Ordner nie direkt bearbeitet.

## Formel freigeben

1. Formel im FORMELKATALOG.md prüfen (Quelle, Gültigkeit, Testfall).
2. In `formelstatus.json` eintragen, z. B. `{ "B-M-EQ": { "status": "freigegeben", "datum": "2026-10-10", "durch": "S. Frotscher" } }`.
3. `npx tsx scripts/formelkatalog.ts` ausführen, committen.

## Änderungen am Kern

Nur hier, nie in der App. Jede neue Formel braucht: Rechenschritt mit ID, Eintrag im Formelkatalog (automatisch), Referenzwert in `verification/pruefung.py`, danach `npm run golden`.
