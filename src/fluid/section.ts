/**
 * Nicht kreisförmige Rohrquerschnitte (Modul fluid, RH b, eng-core 0.13.0, Entscheidung R24).
 * Dubbel 26 Bd. 1 Abschn. 17.2.3 (S. 322): mit dem hydraulischen Durchmesser d_h = 4A/U wird wie beim Kreisrohr gerechnet,
 * laminar gilt λ = φ·64/Re (Re mit d_h); φ für Kreisring über d_a/d_i und Rechteck über h/b aus fd_shape_factor
 * (fd 1.1), linear zwischen den Tabellenzeilen. Die Geschwindigkeit ist v = V̇/A mit der wahren Fläche A.
 * Einheiten SI (m, m²). Querschnitt von Hand (A, U): φ = 1 mit Hinweis.
 */
import { fmt } from "../format";
import { step, type CalcStep } from "../trace";
import type { FdRepo, FdShapeFactor } from "./fdData";

export type PipeSection =
  /** Kreisring (Spalt zwischen zwei Rohren), Durchmesser in m. */
  | { kind: "ring"; da: number; di: number }
  /** Rechteck mit Seiten b und h in m (Reihenfolge beliebig). */
  | { kind: "rechteck"; b: number; h: number }
  /** Fläche (m²) und benetzter Umfang (m) von Hand. */
  | { kind: "au"; A: number; U: number };

export interface SectionGeometry { A: number; U: number; dh: number; phi: number; steps: CalcStep[]; errors: string[]; warnings: string[] }

const REF = "Dubbel 26 Bd. 1 Abschn. 17.2.3 (S. 322)";

/** φ durch lineare Interpolation über den Tabellenparameter (Kreisring d_a/d_i 1 bis 100, Rechteck h/b 0 bis 1). */
export function shapeFactor(fd: FdRepo, section: "Kreisring" | "Rechteck", x: number): { phi: number; a: FdShapeFactor; b: FdShapeFactor } | null {
  const rows = fd.shapeFactors.filter((r) => r.section === section).slice().sort((p, q) => p.param_value - q.param_value);
  if (rows.length < 2 || !(x >= rows[0]!.param_value) || x > rows[rows.length - 1]!.param_value) return null;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!, b = rows[i + 1]!;
    if (x >= a.param_value && x <= b.param_value) return { phi: a.phi + (b.phi - a.phi) * (x - a.param_value) / (b.param_value - a.param_value), a, b };
  }
  return null;
}

/** Fläche, Umfang, d_h und φ eines nicht kreisförmigen Querschnitts mit Rechenweg; `tag` kennzeichnet das Rohr. */
export function sectionGeometry(fd: FdRepo, s: PipeSection, tag = ""): SectionGeometry {
  const pre = tag ? `${tag}: ` : "";
  const steps: CalcStep[] = [], errors: string[] = [], warnings: string[] = [];
  const bad = (m: string): SectionGeometry => ({ A: NaN, U: NaN, dh: NaN, phi: NaN, steps, errors: [`${pre}${m}`], warnings });
  let A: number, U: number, phi: number;
  if (s.kind === "ring") {
    if (!(s.da > 0 && s.di > 0) || !(s.di < s.da)) return bad("Kreisring braucht 0 < d_i < d_a.");
    A = Math.PI * (s.da * s.da - s.di * s.di) / 4; U = Math.PI * (s.da + s.di);
    steps.push(step("RH-A-RI", "Fläche Kreisring", "A = π·(d_a² − d_i²)/4", `${pre}A = π·(${fmt(s.da, 6)}² − ${fmt(s.di, 6)}²)/4`, A, "m²", "Geometrie"));
    steps.push(step("RH-U-RI", "benetzter Umfang Kreisring", "U = π·(d_a + d_i)", `${pre}U = π·(${fmt(s.da, 6)} + ${fmt(s.di, 6)})`, U, "m", "Geometrie"));
    const x = s.da / s.di, f = shapeFactor(fd, "Kreisring", x);
    if (!f) return bad(`d_a/d_i = ${fmt(x)} außerhalb der Tabelle φ (1 bis 100) oder Fachdaten fd 1.1 fehlen.`);
    phi = f.phi;
    steps.push(step("RH-PHI", "Formbeiwert laminar (Interpolation)", "φ = φ_a + (φ_b − φ_a)·(x − x_a)/(x_b − x_a)",
      `${pre}Kreisring d_a/d_i = ${fmt(x, 6)}, ${f.a.id}/${f.b.id}: φ = ${fmt(f.a.phi)} + (${fmt(f.b.phi)} − ${fmt(f.a.phi)})·(${fmt(x, 6)} − ${fmt(f.a.param_value)})/(${fmt(f.b.param_value)} − ${fmt(f.a.param_value)})`, phi, "1", `${f.a.source_locator} (${f.a.source_id}), linear zwischen Zeilen`));
  } else if (s.kind === "rechteck") {
    if (!(s.b > 0 && s.h > 0)) return bad("Rechteck braucht b > 0 und h > 0.");
    A = s.b * s.h; U = 2 * (s.b + s.h);
    steps.push(step("RH-A-RE", "Fläche Rechteck", "A = b·h", `${pre}A = ${fmt(s.b, 6)}·${fmt(s.h, 6)}`, A, "m²", "Geometrie"));
    steps.push(step("RH-U-RE", "benetzter Umfang Rechteck", "U = 2·(b + h)", `${pre}U = 2·(${fmt(s.b, 6)} + ${fmt(s.h, 6)})`, U, "m", "Geometrie"));
    const x = Math.min(s.b, s.h) / Math.max(s.b, s.h), f = shapeFactor(fd, "Rechteck", x);
    if (!f) return bad("Fachdaten fd 1.1 (Formbeiwert Rechteck) fehlen.");
    phi = f.phi;
    steps.push(step("RH-PHI", "Formbeiwert laminar (Interpolation)", "φ = φ_a + (φ_b − φ_a)·(x − x_a)/(x_b − x_a)",
      `${pre}Rechteck h/b = ${fmt(x, 6)} (kurze/lange Seite), ${f.a.id}/${f.b.id}: φ = ${fmt(f.a.phi)} + (${fmt(f.b.phi)} − ${fmt(f.a.phi)})·(${fmt(x, 6)} − ${fmt(f.a.param_value)})/(${fmt(f.b.param_value)} − ${fmt(f.a.param_value)})`, phi, "1", `${f.a.source_locator} (${f.a.source_id}), linear zwischen Zeilen`));
  } else {
    if (!(s.A > 0 && s.U > 0)) return bad("Fläche und Umfang von Hand müssen größer als 0 sein.");
    if (s.U * s.U < 4 * Math.PI * s.A * (1 - 1e-12)) return bad(`Umfang ${fmt(s.U)} m kleiner als der eines Kreises gleicher Fläche (${fmt(Math.sqrt(4 * Math.PI * s.A))} m): Eingabe unmöglich.`);
    A = s.A; U = s.U; phi = 1;
    steps.push(step("RH-AU-MAN", "Fläche und benetzter Umfang (Eingabe)", "A, U = Eingabe", `${pre}A = ${fmt(A, 6)} m², U = ${fmt(U, 6)} m`, A, "m²", "Eingabe"));
    warnings.push(`${pre}Querschnitt von Hand: laminar mit φ = 1 gerechnet (Formbeiwert unbekannt, Dubbel S. 322 nennt φ nur für Kreisring und Rechteck).`);
  }
  const dh = 4 * A / U;
  steps.push(step("RH-DH", "hydraulischer Durchmesser", "d_h = 4·A/U", `${pre}d_h = 4·${fmt(A, 6)}/${fmt(U, 6)}`, dh, "m", REF));
  return { A, U, dh, phi, steps, errors, warnings };
}
