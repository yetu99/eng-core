#!/usr/bin/env python3
"""Tests für scripts/formelfreigabe.py (ab 0.21.0): Verlauf »erledigt« und Antwort gehen beim Import nie verloren.

  python3 scripts/formelfreigabe_test.py      (npm run freigabe:test)

1. Einheit: merge_row / merge_verlauf mit den Fällen aus der Übergabe v4 (EL-N03, EL-N07, EL-W05-CP).
2. Rundlauf: Export → Import ohne Änderung ergibt formelstatus.json inhaltsgleich (ganzer Kern und --modul elektrik).
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import formelfreigabe as ff  # noqa: E402

fails: list[str] = []


def check(name: str, cond: bool, info: object = "") -> None:
    print(f"{'ok  ' if cond else 'FEHL'} {name}{'' if cond else f': {info}'}")
    if not cond:
        fails.append(name)


# ---------------------------------------------------------------- 1. Einheit
prev = {"status": "freigegeben", "datum": "2026-11-13", "durch": "SETI", "erledigt": "Einwand A",
        "antwort": "Umgesetzt 12.11.2026", "formel": "F"}
# Zeile nur mit »[Antwort: …]«: Import entfernt den Vorsatz, Kommentar leer (Fehler bis 0.19.1)
r = ff.merge_row(prev, "freigegeben", None, "2026-11-13", "SETI", "F")
check("Antwort-Zeile behält erledigt", r and r.get("erledigt") == "Einwand A", r)
check("Antwort-Zeile behält antwort", r and r.get("antwort") == "Umgesetzt 12.11.2026", r)
check("Antwort-Zeile unverändert", r == prev, r)
# Formel geändert, Zeile offen ohne Kommentar: Eintrag bleibt mit Verlauf
r = ff.merge_row(prev, "offen", None, None, None, "F2")
check("offen nach Formeländerung behält Verlauf", r and r["status"] == "offen" and r.get("erledigt") == "Einwand A" and r.get("antwort"), r)
# offen ohne Kommentar und ohne Verlauf: kein Eintrag
check("offen ohne alles: kein Eintrag", ff.merge_row({}, "offen", None, None, None, "F") is None)
# neuer Einwand erledigt bei vorhandenem Verlauf: anhängen
prev2 = {**prev, "kommentar": "Einwand B"}
r = ff.merge_row(prev2, "freigegeben", "Einwand B", "2026-11-18", "SETI", "F")
check("neuer Einwand hängt an", r and r.get("erledigt") == "Einwand A ¦ Einwand B" and "kommentar" not in r, r)
check("Wiederholung nicht doppelt", ff.merge_verlauf("A ¦ B", "B") == "A ¦ B")
check("erster Verlauf", ff.merge_verlauf(None, "A") == "A")
# offener Kommentar bleibt offen, Verlauf bleibt
r = ff.merge_row(prev, "abgelehnt", "neu", "2026-11-18", "SETI", "F")
check("abgelehnt mit Kommentar behält Verlauf", r and r.get("kommentar") == "neu" and r.get("erledigt") == "Einwand A", r)

# Vorsatz »[Antwort: …]« mit eckigen Klammern in der Antwort (V-MB, Fehler bis 0.19.1)
ans = "Rechnung in t/mm: ρ[kg/m³]·10⁻¹² = ρ[t/mm³]."
check("Antwort mit Klammern exakt entfernt", ff.strip_prefixes(f"[Antwort: {ans}] Einwand", ans) == "Einwand")
check("nur Antwort ergibt leeren Kommentar", ff.strip_prefixes(f"[Antwort: {ans}]", ans) is None)
check("Formel geändert und Antwort", ff.strip_prefixes(f"[Formel geändert seit Prüfung vom 2026-11-13] [Antwort: {ans}] X", ans) == "X")
check("Kommentar ohne Vorsatz bleibt", ff.strip_prefixes("ρ[t/mm³] ist richtig", None) == "ρ[t/mm³] ist richtig")

# ---------------------------------------------------------------- 2. Rundlauf
# Regel des Imports: ein Kommentar, der bei »freigegeben« unverändert stehen bleibt, wandert in den Verlauf »erledigt«.
# Erster Rundlauf darf also nur solche Verschiebungen enthalten, der zweite muss bytegleich sein. Verlauf geht nie verloren.
def only_moves(a: dict, b: dict) -> bool:
    if a.get("status") != "freigegeben" or not a.get("kommentar") or b.get("kommentar"):
        return False
    return b.get("erledigt") == ff.merge_verlauf(a.get("erledigt"), a["kommentar"]) and \
        {k: v for k, v in a.items() if k not in ("kommentar", "erledigt")} == {k: v for k, v in b.items() if k != "erledigt"}


original = ff.STATUS_FILE.read_text(encoding="utf-8")
try:
    with tempfile.TemporaryDirectory() as td:
        for label, mods in (("ganzer Kern", None), ("--modul elektrik", ["elektrik"])):
            ff.STATUS_FILE.write_text(original, encoding="utf-8")
            cat = ff.load_catalog()
            old = cat["status"]
            x = Path(td) / "rund1.xlsx"
            ff.export(x, False, mods)
            out, warn, _ = ff.read_import(x, cat)
            diff = sorted(k for k in set(out) | set(old) if out.get(k) != old.get(k))
            cur = {e["id"]: e["formula"] for e in cat["entries"]}
            # Formel seit der Freigabe geändert: Zeile wird »offen«, Verlauf und Antwort bleiben, neue Formel wird gespeichert
            reopened = lambda k: k in old and k in out and old[k].get("formel") not in (None, cur.get(k)) and out[k]["status"] == "offen" \
                and out[k].get("antwort") == old[k].get("antwort") and set((old[k].get("erledigt") or "").split(ff.VERLAUF_SEP)) <= set((out[k].get("erledigt") or "").split(ff.VERLAUF_SEP))
            # ohne Verlauf entfällt der Eintrag (offen ohne Kommentar), wie bisher
            dropped = lambda k: k in old and k not in out and old[k].get("formel") not in (None, cur.get(k)) and not old[k].get("erledigt") and not old[k].get("antwort")
            bad = [k for k in diff if not ((k in old and k in out and (only_moves(old[k], out[k]) or reopened(k))) or dropped(k))]
            check(f"Rundlauf 1 {label}: nur Kommentar → erledigt ({len(diff)} Einträge)", not bad, bad[:5])
            check(f"Rundlauf 1 {label}: Verlauf vollständig", not any(w.startswith("Verlauf würde") for w in warn), warn)
            text1 = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
            ff.STATUS_FILE.write_text(text1, encoding="utf-8")
            cat2 = ff.load_catalog()
            ff.export(x, False, mods)
            out2, warn2, _ = ff.read_import(x, cat2)
            check(f"Rundlauf 2 {label}: bytegleich", json.dumps(out2, ensure_ascii=False, indent=2) + "\n" == text1,
                  sorted(k for k in set(out2) | set(out) if out2.get(k) != out.get(k))[:5])
finally:
    ff.STATUS_FILE.write_text(original, encoding="utf-8")

print(f"\n{'Alle Prüfungen bestanden' if not fails else f'{len(fails)} Prüfungen fehlgeschlagen'}")
sys.exit(1 if fails else 0)
