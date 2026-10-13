#!/usr/bin/env python3
"""
Abnahme P5 (Abgleich mit unabhängiger FEM) und P6 (Abnahmeprotokoll) über eine Excel zum Ausfüllen.

  python3 scripts/abnahme.py export [--out DATEI.xlsx]
      Erzeugt die Excel mit Schritt-für-Schritt-Anleitung (Creo Simulate), Sollwerten aus dem Rechenkern
      (scripts/abnahme-faelle.ts), gelben Eingabezellen für die Ist-Werte und der Checkliste P6.

  python3 scripts/abnahme.py import DATEI.xlsx [--dry-run]
      Liest die ausgefüllte Excel, rechnet Abweichung und Toleranz selbst nach (Excel-Formeln sind nur Anzeige),
      prüft Kernversion, Prüfer und Datum und schreibt verification/abnahme.json (Status P5, P6) sowie
      verification/abnahme_p5.json (alle Soll- und Ist-Werte). Danach FORMELKATALOG.md und src/pruefstatus.json neu.

Regeln:
  - Die Excel gehört zur Kernversion beim Export. Weicht sie ab, bricht der Import ab (neu exportieren).
  - P5 ist bestanden, wenn alle Ist-Werte eingetragen sind und jede Abweichung innerhalb der Toleranz liegt.
  - P6 ist bestanden, wenn P5 bestanden ist und alle Prüfpunkte mit „ja“ beantwortet sind, mit Prüfer und Datum.
  - Teilweise ausgefüllt: Status „offen“, eine Abweichung oder ein „nein“: „nicht bestanden“.
  - Keine FEM-Dateien oder Creo-Modelle ins Repo, nur die Zahlen (abnahme_p5.json).

Abhängigkeiten: openpyxl, Node mit tsx (npm ci).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
ABN = ROOT / "verification" / "abnahme.json"
ABN_P5 = ROOT / "verification" / "abnahme_p5.json"

FONT = "Arial"
F_BASE = Font(name=FONT, size=10)
F_BOLD = Font(name=FONT, size=10, bold=True)
F_HEAD = Font(name=FONT, size=10, bold=True, color="FFFFFF")
F_TITLE = Font(name=FONT, size=14, bold=True)
F_SUB = Font(name=FONT, size=11, bold=True)
F_MUTED = Font(name=FONT, size=9, color="595959")
F_EX = Font(name=FONT, size=9, italic=True, color="7F7F7F")
FILL_HEAD = PatternFill("solid", start_color="1F3A5F")
FILL_GROUP = PatternFill("solid", start_color="D9E1EA")
FILL_INPUT = PatternFill("solid", start_color="FFF2CC")
FILL_OK = PatternFill("solid", start_color="C6EFCE")
FILL_BAD = PatternFill("solid", start_color="FFC7CE")
FILL_EX = PatternFill("solid", start_color="F2F2F2")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")

# Material wie Werkbank (WDB 1.0.1, W038 EN AW-6082): E und ν aus der Datenbank, ρ 2700 kg/m³
MATERIAL = "E = 70 000 MPa, ν = 0,3, ρ = 2,7·10⁻⁹ t/mm³ (= 2700 kg/m³)"

STEPS = [
    ("0", "Vorbereitung",
     "Creo Parametric › Anwendungen › Simulate, Modus Struktur. Einheitensystem mmNs (Länge mm, Kraft N, Zeit s, Masse t). "
     f"Material neu anlegen „EN AW-6082 Werkbank“: {MATERIAL}. Im Blatt „P5 FEM“ oben Prüfer, Datum, Creo-Version und Netz eintragen."),
    ("1", "D1 Dickwandrohr (Volumenmodell, statisch)",
     "Rohr Innen-Ø 100 mm, Außen-Ø 110 mm, Länge 400 mm als Viertelmodell (90°-Segment). Randbedingungen: beide Schnittflächen Symmetrie, "
     "Stirnfläche z = 0 nur axial gehalten (u_z = 0). Lasten: Innendruck 10 MPa auf die Innenfläche; Stirnfläche z = 400 Axialzug als "
     "Druck −47,619 MPa (negativ = Zug, entspricht dem Boden: p·a²/(b² − a²)) oder als Gesamtkraft 19 635 N (Viertel von p·π·a²). "
     "Statisch, Mehrfachdurchlauf, Konvergenz 2 %. Zylindrisches Koordinatensystem auf der Rohrachse anlegen und Spannungen darin ausgeben. "
     "Auslesen in Rohrmitte (z = 200 mm): σ_θ innen und außen, σ_r innen, σ_z, von Mises innen, radiale Verschiebung innen."),
    ("2", "F1 bis F4 Eigenfrequenzen (Balken, Modalanalyse)",
     "Bezugskurve gerade, 1200 mm, Idealisierung Träger (Balken), Querschnitt Rohr: Außenradius 30 mm, Innenradius 26 mm, Material wie oben. "
     "Modalanalyse, 10 Moden ab 0 Hz. Lagerung: F1 Krag: links alle 6 Freiheitsgrade fest. F2 gelenkig: links 3 Verschiebungen und Drehung um "
     "die Balkenachse fest, rechts beide Querverschiebungen fest. F3 eingespannt/gelenkig: links alle 6 fest, rechts beide Querverschiebungen fest. "
     "F4 beidseitig eingespannt: beide Enden alle 6 fest. Beim Rundrohr erscheint jede Biegefrequenz doppelt (zwei gleiche Ebenen): je Paar einen "
     "Wert eintragen. Torsions- und Längsschwingungen (in der Animation erkennbar) überspringen."),
    ("3", "T7, T10, T12 Lastliste (Balken, statisch)",
     "Gleicher Balken, statische Analyse. Kurve an x = 300, 400, 600, 900, 1000 mm teilen (Punkte für Lasten). T7 gelenkig: F = 3000 N quer bei x = 400. "
     "T10 beidseitig eingespannt: F = 3000 N bei x = 400. T12 gelenkig: F = 2000 N bei 300, F = 1500 N bei 900, Streckenlast 1 N/mm von 600 bis 1200, "
     "Moment 150 000 N·mm bei x = 1000, im Uhrzeigersinn, wenn x nach rechts und die Last nach unten zeigt. Auslesen: Lagerreaktion links A, "
     "betragsgrößtes Biegemoment, größte Querverschiebung; bei T10 die Reaktionsmomente beider Einspannungen (Beträge). "
     "Kontrolle Drehsinn: ergibt T12 A = 1,65 kN statt 1,90 kN, ist das Moment verkehrt herum."),
    ("4", "Ist-Werte eintragen",
     "Im Blatt „P5 FEM“ die gelben Zellen der Spalte „Ist Creo“ füllen (nur Zahl, in der Einheit der Zeile). Abweichung und Ergebnis erscheinen "
     "automatisch. Bei ABWEICHUNG: Einheiten, Lagerung, Lastort und Netz prüfen, Ursache in „Bemerkung“ notieren."),
    ("5", "P6 Abnahme",
     "Im Blatt „P6 Abnahme“ jeden Prüfpunkt kontrollieren und ja oder nein wählen. Name und Datum eintragen. Optional ausdrucken und unterschreiben."),
    ("6", "Zurück an Claude",
     "Datei im selben Ordner speichern als „…_ausgefuellt.xlsx“ und Claude Bescheid geben. Claude importiert mit python3 scripts/abnahme.py import, "
     "aktualisiert Prüfstatus und App. Du pushst beide Repos. Danach steht in jedem PDF „Abnahme P6 bestanden“."),
]

def p6_points(core: str, commit: str, app: str) -> list[tuple[str, str]]:
    return [
        (f"GitHub: Prüfung Rechenkern (CI) für eng-core {commit} ist grün", "github.com/yetu99/eng-core › Actions"),
        ("Gegenrechnung 467/467 innerhalb der Toleranz", "CI-Schritt „Unabhängige Gegenrechnung“ bzw. Fußzeile im PDF"),
        ("Formelfreigabe 192/192, Katalog in Supabase = 0.6.1 mit 192 freigegebenen Formeln", "Formelfreigabe_eng-core_0.6.1_freigegeben.xlsx, Kompendium"),
        (f"Live-App (Lovable, Stand {app}) zeigt eng-core {core} und WDB 1.0.1", "Kopfblock „Rechenkern“ in Blatt 1"),
        ("Stichprobe Live-App Biegung EQ (Standard): σ_b = 38,95 MPa, f = 2,782 mm", "Blatt 1, Ergebnisse"),
        ("Stichprobe Live-App Druckbehälter (Standard): σ_v,max = 99,8 MPa", "Blatt 1, Ergebnisse"),
        ("Stichprobe Live-App Eigenfrequenz Krag: f₁ = 39,28 Hz", "Blatt 1, Ergebnisse"),
        ("PDF-Export Blatt 1 und Blatt 2 vollständig, Rechenwege offen, Prüfvermerk vorhanden", "Knopf „PDF exportieren“"),
        ("Browser-Abnahmen OK: fq 37/37, pb 40/40, ll 29/29, p4 37/37", "Konzepte/Mechanik_Ashby/abnahme/*_ergebnis.json"),
        ("Grenzen gelesen und akzeptiert (Kasten unten)", "dieses Blatt"),
    ]

LIMITS = [
    "Die Werkbank ist eine Auslegungshilfe für Vorbemessung und Variantenvergleich, kein Normnachweis (keine EN 1993, EN 13445, AD 2000, VDI 2230).",
    "Linear-elastisch, statisch, kleine Verformungen, Bernoulli-Balken, isotrop, 23 °C. Keine Kerbwirkung, Ermüdung, Temperatur, Kriechen, Stabilität dünner Wände.",
    "Werkstoffwerte aus WDB 1.0.1 (Standard: unterer Wert der Datenbankzeile). Für verbindliche Auslegungen Werte des Lieferanten bzw. der Norm einsetzen.",
    "Eigenfrequenz in der Lastebene mit I; schwingt die andere Hauptachse tiefer, steht ein Hinweis (keine eigene Nachweiszeile).",
    "Ergebnisse gelten nur innerhalb der in Blatt 1 unter „Annahmen und Quellen“ genannten Grenzen.",
]


def run_ts(script: str) -> dict:
    res = subprocess.run(["npx", "--no-install", "tsx", script, "--json"], cwd=ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"{script} fehlgeschlagen:\n{res.stderr}")
    return json.loads(res.stdout)


def git_head() -> str:
    res = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    return res.stdout.strip() or "unbekannt"


def cell(ws, ref, value=None, font=F_BASE, fill=None, align=None, border=False, fmt=None):
    c = ws[ref]
    if value is not None:
        c.value = value
    c.font = font
    if fill:
        c.fill = fill
    if align:
        c.alignment = align
    if border:
        c.border = BORDER
    if fmt:
        c.number_format = fmt
    return c


# --------------------------------------------------------------------------------------------- Export
def export(out: Path, app: str) -> None:
    data = run_ts("scripts/abnahme-faelle.ts")
    core, rows, commit = data["core"], data["rows"], git_head()
    today = dt.date.today().strftime("%d.%m.%Y")
    wb = Workbook()

    # Anleitung
    ws = wb.active
    ws.title = "Anleitung"
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCD", (5, 30, 100, 11)):
        ws.column_dimensions[col].width = w
    cell(ws, "A1", f"Abnahme P5 und P6 · Ingenieur-Werkbank · eng-core {core}", F_TITLE)
    cell(ws, "A2", f"Rechenkern eng-core {core} (Commit {commit}) · App {app} · Werkstoffdaten {data['data']} · exportiert {today}", F_MUTED)
    cell(ws, "A4", "Zweck", F_SUB)
    cell(ws, "A5", "P5 vergleicht die Werkbank mit einer unabhängigen FEM-Rechnung (Creo Simulate) an 27 Werten. P6 ist die Abnahme mit Checkliste und Unterschrift. "
         "Danach zeigen alle Ausdrucke „Geprüft und abgenommen“.", F_BASE, align=WRAP)
    ws.merge_cells("A5:D5"); ws.row_dimensions[5].height = 30
    cell(ws, "A7", "Legende", F_SUB)
    cell(ws, "A8", None, fill=FILL_INPUT, border=True); cell(ws, "B8", "gelb = von dir auszufüllen (Zahl, Auswahl ja/nein, Text)")
    cell(ws, "A9", None, fill=FILL_OK, border=True); cell(ws, "B9", "grün = innerhalb der Toleranz bzw. erfüllt (automatisch)")
    cell(ws, "A10", None, fill=FILL_BAD, border=True); cell(ws, "B10", "rot = Abweichung bzw. nicht erfüllt (automatisch)")
    cell(ws, "A12", "Schritt für Schritt", F_SUB)
    for j, h in enumerate(("Nr.", "Schritt", "Was genau", "Erledigt")):
        c = ws.cell(row=13, column=j + 1, value=h); c.font = F_HEAD; c.fill = FILL_HEAD; c.border = BORDER
    dv_done = DataValidation(type="list", formula1='"ja"', allow_blank=True)
    ws.add_data_validation(dv_done)
    for i, (nr, t, d) in enumerate(STEPS):
        r = 14 + i
        cell(ws, f"A{r}", nr, F_BOLD, align=WRAP, border=True)
        cell(ws, f"B{r}", t, F_BOLD, align=WRAP, border=True)
        cell(ws, f"C{r}", d, F_BASE, align=WRAP, border=True)
        cell(ws, f"D{r}", None, F_BASE, fill=FILL_INPUT, border=True)
        dv_done.add(f"D{r}")
        ws.row_dimensions[r].height = max(30, 14 * (len(d) // 95 + 1))
    r = 14 + len(STEPS) + 1
    cell(ws, f"A{r}", "Hinweis: Toleranz 2 % für das Volumenmodell D1 (5 % für σ_r, Randwert), 1 % für Balken. Eingetragen wird immer in der Einheit der Zeile.", F_MUTED, align=WRAP)
    ws.merge_cells(f"A{r}:D{r}")
    ws.page_setup.orientation = "landscape"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # P5 FEM
    ws = wb.create_sheet("P5 FEM")
    ws.sheet_view.showGridLines = False
    widths = (5, 7, 44, 38, 7, 13, 9, 9, 13, 12, 13, 34)
    for j, w in enumerate(widths):
        ws.column_dimensions[chr(65 + j)].width = w
    cell(ws, "A1", f"P5 Abgleich mit FEM (Creo Simulate) · eng-core {core}", F_TITLE)
    cell(ws, "A2", f"Sollwerte aus dem Rechenkern (scripts/abnahme-faelle.ts, Commit {commit}). Material: {MATERIAL}.", F_MUTED)
    heads = [("Prüfer", "D4"), ("Datum (TT.MM.JJJJ)", "D5"), ("Creo-Version", "D6"), ("Elemente, Netz, Konvergenz", "D7")]
    for i, (lbl, ref) in enumerate(heads):
        cell(ws, f"C{4 + i}", lbl, F_BOLD)
        cell(ws, ref, None, F_BASE, fill=FILL_INPUT, border=True)
    cell(ws, "F4", "Kernversion", F_BOLD); cell(ws, "G4", core, F_BASE)
    hdr = ["Nr.", "Fall", "Modell", "Größe", "Einheit", "Soll Werkbank", "Toleranz", "Vergleich", "Ist Creo", "Abweichung", "Ergebnis", "Bemerkung"]
    H = 10
    for j, h in enumerate(hdr):
        c = ws.cell(row=H, column=j + 1, value=h); c.font = F_HEAD; c.fill = FILL_HEAD; c.border = BORDER; c.alignment = WRAP
    # Beispielzeile (zählt nicht)
    ex = ["Bsp.", "–", "Beispiel, wird nicht gewertet", "Biegeeigenfrequenz f_1", "Hz", 100.0, 0.01, "Wert", 100.4, None, None, "Netz 20 Elemente"]
    for j, v in enumerate(ex):
        c = ws.cell(row=H + 1, column=j + 1, value=v); c.font = F_EX; c.fill = FILL_EX; c.border = BORDER
    ws.cell(row=H + 1, column=7).number_format = "0%"
    ws.cell(row=H + 1, column=10).value = f"=ABS(I{H + 1}-F{H + 1})/ABS(F{H + 1})"; ws.cell(row=H + 1, column=10).number_format = "0.00%"
    ws.cell(row=H + 1, column=11).value = f'=IF(J{H + 1}<=G{H + 1},"OK","ABWEICHUNG")'
    first = H + 2
    last_fall = None
    for i, row in enumerate(rows):
        r = first + i
        same = row["fall"] == last_fall
        last_fall = row["fall"]
        vals = [i + 1, row["fall"], "" if same else row["titel"], row["groesse"], row["einheit"], row["soll"], row["tol"],
                "Betrag" if (row["vergleich"] == "betrag" or not row["fall"].startswith("D")) else "Wert"]
        for j, v in enumerate(vals):
            c = ws.cell(row=r, column=j + 1, value=v); c.font = F_BASE; c.border = BORDER; c.alignment = WRAP
        ws.cell(row=r, column=6).number_format = "0.0#####"
        ws.cell(row=r, column=7).number_format = "0%"
        ic = ws.cell(row=r, column=9); ic.fill = FILL_INPUT; ic.border = BORDER; ic.font = F_BASE; ic.number_format = "General"
        ws.cell(row=r, column=10).value = f'=IF(I{r}="","",IF(H{r}="Betrag",ABS(ABS(I{r})-ABS(F{r}))/ABS(F{r}),ABS(I{r}-F{r})/ABS(F{r})))'
        ws.cell(row=r, column=10).number_format = "0.00%"; ws.cell(row=r, column=10).border = BORDER; ws.cell(row=r, column=10).font = F_BASE
        ws.cell(row=r, column=11).value = f'=IF(I{r}="","offen",IF(J{r}<=G{r},"OK","ABWEICHUNG"))'
        ws.cell(row=r, column=11).border = BORDER; ws.cell(row=r, column=11).font = F_BOLD
        bc = ws.cell(row=r, column=12); bc.fill = FILL_INPUT; bc.border = BORDER; bc.font = F_BASE
        if not same and i:
            for j in range(12):
                ws.cell(row=r, column=j + 1).border = Border(left=THIN, right=THIN, bottom=THIN, top=Side(style="medium", color="1F3A5F"))
    last = first + len(rows) - 1
    rng = f"K{first}:K{last}"
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"OK"'], fill=FILL_OK))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"ABWEICHUNG"'], fill=FILL_BAD))
    s = last + 2
    n = len(rows)
    cell(ws, f"C{s}", "Werte gesamt", F_BOLD); cell(ws, f"D{s}", n)
    cell(ws, f"C{s + 1}", "eingetragen", F_BOLD); cell(ws, f"D{s + 1}", f"=COUNT(I{first}:I{last})")
    cell(ws, f"C{s + 2}", "innerhalb der Toleranz", F_BOLD); cell(ws, f"D{s + 2}", f'=COUNTIF(K{first}:K{last},"OK")')
    cell(ws, f"C{s + 3}", "größte Abweichung", F_BOLD); cell(ws, f"D{s + 3}", f'=IF(D{s + 1}=0,"",MAX(J{first}:J{last}))', fmt="0.00%")
    cell(ws, f"C{s + 4}", "Ergebnis P5", F_SUB)
    cell(ws, f"D{s + 4}", f'=IF(COUNTIF(K{first}:K{last},"ABWEICHUNG")>0,"nicht bestanden",IF(D{s + 1}<D{s},"offen","bestanden"))', F_SUB, border=True)
    ws.conditional_formatting.add(f"D{s + 4}", CellIsRule(operator="equal", formula=['"bestanden"'], fill=FILL_OK))
    ws.conditional_formatting.add(f"D{s + 4}", CellIsRule(operator="equal", formula=['"nicht bestanden"'], fill=FILL_BAD))
    p5_ref = f"'P5 FEM'!D{s + 4}"
    ws.freeze_panes = f"A{H + 1}"
    ws.print_title_rows = f"{H}:{H}"
    ws.page_setup.orientation = "landscape"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # P6 Abnahme
    ws = wb.create_sheet("P6 Abnahme")
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCDE", (5, 70, 46, 11, 34)):
        ws.column_dimensions[col].width = w
    cell(ws, "A1", f"P6 Abnahmeprotokoll · Ingenieur-Werkbank · eng-core {core}", F_TITLE)
    cell(ws, "A2", f"Rechenkern {core} (Commit {commit}) · App {app} · Werkstoffdaten {data['data']}", F_MUTED)
    for j, h in enumerate(("Nr.", "Prüfpunkt", "Wo nachsehen", "Erfüllt", "Bemerkung")):
        c = ws.cell(row=4, column=j + 1, value=h); c.font = F_HEAD; c.fill = FILL_HEAD; c.border = BORDER
    dv_yn = DataValidation(type="list", formula1='"ja,nein"', allow_blank=True)
    ws.add_data_validation(dv_yn)
    pts = p6_points(core, commit, app)
    for i, (t, wo) in enumerate(pts):
        r = 5 + i
        for j, v in enumerate((i + 1, t, wo)):
            c = ws.cell(row=r, column=j + 1, value=v); c.font = F_BASE; c.border = BORDER; c.alignment = WRAP
        for col in (4, 5):
            c = ws.cell(row=r, column=col); c.fill = FILL_INPUT; c.border = BORDER; c.font = F_BASE
        dv_yn.add(f"D{r}")
    r = 5 + len(pts)
    cell(ws, f"A{r}", len(pts) + 1, F_BASE, border=True)
    cell(ws, f"B{r}", "P5 Abgleich mit FEM bestanden (automatisch aus Blatt „P5 FEM“)", F_BASE, border=True, align=WRAP)
    cell(ws, f"C{r}", "Blatt „P5 FEM“, Ergebnis P5", F_BASE, border=True)
    cell(ws, f"D{r}", f'=IF({p5_ref}="bestanden","ja",IF({p5_ref}="offen","",  "nein"))', F_BOLD, border=True)
    lastp = r
    ws.conditional_formatting.add(f"D5:D{lastp}", CellIsRule(operator="equal", formula=['"ja"'], fill=FILL_OK))
    ws.conditional_formatting.add(f"D5:D{lastp}", CellIsRule(operator="equal", formula=['"nein"'], fill=FILL_BAD))
    r += 2
    cell(ws, f"B{r}", "Ergebnis P6", F_SUB)
    cell(ws, f"D{r}", f'=IF(COUNTIF(D5:D{lastp},"nein")>0,"nicht bestanden",IF(COUNTIF(D5:D{lastp},"ja")={lastp - 4},"bestanden","offen"))', F_SUB, border=True)
    ws.conditional_formatting.add(f"D{r}", CellIsRule(operator="equal", formula=['"bestanden"'], fill=FILL_OK))
    ws.conditional_formatting.add(f"D{r}", CellIsRule(operator="equal", formula=['"nicht bestanden"'], fill=FILL_BAD))
    r += 2
    cell(ws, f"B{r}", "Grenzen der Werkbank (gelesen und akzeptiert, Punkt 10)", F_SUB)
    for k, t in enumerate(LIMITS):
        cell(ws, f"B{r + 1 + k}", f"• {t}", F_BASE, align=WRAP); ws.merge_cells(f"B{r + 1 + k}:E{r + 1 + k}"); ws.row_dimensions[r + 1 + k].height = 28
    r += len(LIMITS) + 2
    cell(ws, f"B{r}", "Abgenommen durch", F_SUB)
    for k, lbl in enumerate(("Name", "Datum (TT.MM.JJJJ)", "Ort", "Unterschrift")):
        cell(ws, f"B{r + 1 + k}", lbl, F_BOLD)
        c = cell(ws, f"C{r + 1 + k}", None, F_BASE, fill=FILL_INPUT, border=True)
        if lbl == "Unterschrift":
            ws.row_dimensions[r + 1 + k].height = 36
    ws.page_setup.orientation = "portrait"; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # Metadaten für den Import (ausgeblendet)
    meta = wb.create_sheet("_meta")
    for k, (a, b) in enumerate((("core", core), ("commit", commit), ("app", app), ("export", today), ("first", first), ("last", last), ("p6_first", 5), ("p6_last", lastp - 1), ("p6_name_row", r + 1))):
        meta.cell(row=k + 1, column=1, value=a); meta.cell(row=k + 1, column=2, value=b)
    meta.sheet_state = "hidden"
    wb.active = 0
    wb.save(out)
    print(f"{out}: {n} Werte P5, {len(pts) + 1} Prüfpunkte P6, eng-core {core} ({commit})")


# --------------------------------------------------------------------------------------------- Import
def parse_date(v) -> str | None:
    if v is None or v == "":
        return None
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    s = str(v).strip()
    for f in ("%d.%m.%Y", "%Y-%m-%d", "%d.%m.%y"):
        try:
            return dt.datetime.strptime(s, f).date().isoformat()
        except ValueError:
            pass
    raise SystemExit(f"Datum nicht lesbar: {s!r} (erwartet TT.MM.JJJJ)")


def num(v) -> float | None:
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip().replace(" ", "").replace(",", "."))
    except ValueError:
        raise SystemExit(f"Ist-Wert ist keine Zahl: {v!r}")


def do_import(path: Path, dry: bool) -> None:
    wb = load_workbook(path)  # Formeln werden ignoriert, Python rechnet selbst
    meta = {r[0]: r[1] for r in wb["_meta"].iter_rows(values_only=True)}
    data = run_ts("scripts/abnahme-faelle.ts")
    if meta["core"] != data["core"]:
        raise SystemExit(f"Excel gehört zu eng-core {meta['core']}, Kern ist {data['core']}: neu exportieren")
    ws = wb["P5 FEM"]
    pruefer, datum = ws["D4"].value, parse_date(ws["D5"].value)
    creo, netz = ws["D6"].value or "", ws["D7"].value or ""
    rows_out, filled = [], 0
    first, last = int(meta["first"]), int(meta["last"])
    if last - first + 1 != len(data["rows"]):
        raise SystemExit("Anzahl der Prüfwerte passt nicht zum Kern: neu exportieren")
    for i, ref in enumerate(data["rows"]):
        r = first + i
        if abs(float(ws.cell(row=r, column=6).value) - ref["soll"]) > 1e-9 * max(1.0, abs(ref["soll"])):
            raise SystemExit(f"Sollwert Zeile {r} weicht vom Kern ab: neu exportieren")
        ist = num(ws.cell(row=r, column=9).value)
        betrag = ws.cell(row=r, column=8).value == "Betrag"
        dev = None if ist is None else (abs(abs(ist) - abs(ref["soll"])) if betrag else abs(ist - ref["soll"])) / abs(ref["soll"])
        ok = dev is not None and dev <= ref["tol"] + 1e-12
        filled += ist is not None
        rows_out.append({**ref, "ist": ist, "abweichung": None if dev is None else round(dev, 6), "ok": ok, "bemerkung": ws.cell(row=r, column=12).value or ""})
    n = len(rows_out)
    fails_any = any(x["ist"] is not None and not x["ok"] for x in rows_out)
    p5 = "nicht bestanden" if fails_any else ("offen" if filled < n else "bestanden")
    if p5 != "offen" and (not pruefer or not datum):
        raise SystemExit("P5: Prüfer und Datum im Blatt „P5 FEM“ fehlen")
    maxdev = max((x["abweichung"] for x in rows_out if x["abweichung"] is not None), default=None)
    fails = [f"{x['fall']} {x['groesse']}" for x in rows_out if x["ist"] is not None and not x["ok"]]
    ws6 = wb["P6 Abnahme"]
    answers = [str(ws6.cell(row=r, column=4).value or "").strip().lower() for r in range(int(meta["p6_first"]), int(meta["p6_last"]) + 1)]
    nr = int(meta["p6_name_row"])
    name, datum6 = ws6.cell(row=nr, column=3).value, parse_date(ws6.cell(row=nr + 1, column=3).value)
    p6 = "nicht bestanden" if "nein" in answers or p5 == "nicht bestanden" else ("bestanden" if all(a == "ja" for a in answers) and p5 == "bestanden" else "offen")
    if p6 == "bestanden" and (not name or not datum6):
        raise SystemExit("P6: Name und Datum im Blatt „P6 Abnahme“ fehlen")
    export_d = parse_date(meta["export"])
    for d, w in ((datum, "P5"), (datum6, "P6")):
        if d and export_d and d < export_d:
            raise SystemExit(f"{w}: Datum {d} liegt vor dem Export {export_d}, bitte prüfen")
    abn = {
        "P5": {"status": p5, "text": f"Abgleich mit FEM ({creo or 'Creo Simulate'}): {filled}/{n} Werte (D1, F1 bis F4, T7, T10, T12)"
               + (f", größte Abweichung {maxdev * 100:.2f} %".replace(".", ",") if maxdev is not None else "") + (f"; außerhalb: {', '.join(fails)}" if fails else "")
               + (f"; {pruefer}" if pruefer else ""), **({"datum": datum} if datum else {})},
        "P6": {"status": p6, "text": f"Abnahmeprotokoll eng-core {data['core']} (App {meta['app']}): {answers.count('ja')}/{len(answers)} Prüfpunkte ja"
               + (f"; {name}" if name else ""), **({"datum": datum6} if datum6 else {})},
    }
    detail = {"core": data["core"], "commit": meta["commit"], "app": meta["app"], "creo": creo, "netz": netz, "pruefer": pruefer, "datum": datum, "rows": rows_out}
    print(json.dumps(abn, ensure_ascii=False, indent=1))
    if dry:
        print("--dry-run: nichts geschrieben"); return
    ABN.write_text(json.dumps(abn, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    ABN_P5.write_text(json.dumps(detail, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    res = subprocess.run(["npx", "--no-install", "tsx", "scripts/formelkatalog.ts"], cwd=ROOT, capture_output=True, text=True)
    print(res.stdout.strip() or res.stderr.strip())
    print(f"verification/abnahme.json: P5 {p5}, P6 {p6}. Danach: node scripts/sync-to-app.mjs <app>, Abnahmeskripte, Push.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    ex = sub.add_parser("export"); ex.add_argument("--out", type=Path, default=None); ex.add_argument("--app", default="78d7c77", help="App-Commit für den Kopf")
    im = sub.add_parser("import"); im.add_argument("datei", type=Path); im.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.cmd == "export":
        core = run_ts("scripts/abnahme-faelle.ts")["core"]
        export(a.out or ROOT / f"Abnahme_P5_P6_eng-core_{core}.xlsx", a.app)
    else:
        do_import(a.datei, a.dry_run)


if __name__ == "__main__":
    main()
