/**
 * Offene dünnwandige Profile I, U, L, T (parametrisch, scharfkantig, ohne Ausrundungen), eng-core 0.7.0.
 * Konzept: mechanik_ashby/konzept_offene_profile.md (Freigabe O1 bis O10 am 15.10.2026).
 *
 * Koordinaten des Querschnitts: y waagerecht nach rechts, z senkrecht nach oben (nur Geometrie).
 * Ursprung der Eingabe: I und T Mitte, U Stegaußenkante, L äußere Ecke. Biegung um die waagerechte Schwerachse
 * (Last senkrecht). Lage „schwach“ (nur I und U): Profil um 90° gedreht, Biegung um z; U dann mit Flanschen nach unten.
 * Einheiten: mm, mm², mm³, mm⁴.
 *
 * Quellen: Gross/Hauger/Schröder/Wall, Technische Mechanik 2, Kap. 4.2 (Flächenmomente, Steiner),
 * Kap. 4.6 (Schubspannungen nach Jourawski, Schubmittelpunkt), Kap. 5.4 (Torsion dünnwandiger offener Profile).
 */
import { fmt } from "./format";
import { step, type CalcStep } from "./trace";
import type { Dims } from "./sections";

export type OpenSecType = "i_profil" | "i_profil_z" | "u_profil" | "u_profil_z" | "l_profil" | "t_profil";

/** Rechteck [y0, z0, Breite in y, Höhe in z] */
type Rect = readonly [number, number, number, number];

export interface OpenSectionOut {
  A: number; I: number; Imin: number; e: number; W: number; K: number; Wt: number; kappa: number;
  Iy: number; Iz: number; Iyz: number; I1: number; I2: number; alpha: number;
  ys: number; zs: number; eo: number; eu: number; eM: number | null;
  /** Ort z der größten Querkraftschubspannung, gemessen von der Schwerachse (positiv nach oben) */
  zTau: number;
}

const val = (d: Dims, k: string): number => { const v = d[k]; return typeof v === "number" && Number.isFinite(v) ? v : NaN; };

/** Rechteckzerlegung je Profil in der Lage „stark“ (Ursprung siehe Kopf). */
function rects(type: OpenSecType, d: Dims): Rect[] {
  const h = val(d, "h"), b = val(d, "b");
  switch (type) {
    case "i_profil": case "i_profil_z": {
      const tw = val(d, "tw"), tf = val(d, "tf");
      return [[-b / 2, h / 2 - tf, b, tf], [-b / 2, -h / 2, b, tf], [-tw / 2, -h / 2 + tf, tw, h - 2 * tf]];
    }
    case "u_profil": case "u_profil_z": {
      const tw = val(d, "tw"), tf = val(d, "tf");
      return [[0, -h / 2, tw, h], [tw, h / 2 - tf, b - tw, tf], [tw, -h / 2, b - tw, tf]];
    }
    case "l_profil": { const t = val(d, "t"); return [[0, 0, t, h], [t, 0, b - t, t]]; }
    case "t_profil": {
      const tw = val(d, "tw"), tf = val(d, "tf");
      return [[-b / 2, h - tf, b, tf], [-tw / 2, 0, tw, h - tf]];
    }
  }
}

/** Drehung für Lage „schwach“: I symmetrisch (y, z) → (z, y); U mit Steg oben und Flanschen nach unten (y, z) → (z, −y). */
function rotate(type: OpenSecType, R: Rect[]): Rect[] {
  if (type === "i_profil_z") return R.map(([y, z, w, hh]) => [z, y, hh, w] as const);
  if (type === "u_profil_z") return R.map(([y, z, w, hh]) => [z, -y - w, hh, w] as const);
  return R;
}

/** Schwerpunkt und Flächenmomente über die Rechteckzerlegung (Steiner). Rechtecke mit Fläche 0 tragen nicht bei. */
export function composite(R: readonly Rect[]): { A: number; ys: number; zs: number; Iy: number; Iz: number; Iyz: number; zmin: number; zmax: number } {
  let A = 0, Sy = 0, Sz = 0;
  for (const [y, z, w, hh] of R) { const a = w * hh; A += a; Sy += a * (y + w / 2); Sz += a * (z + hh / 2); }
  const ys = Sy / A, zs = Sz / A;
  let Iy = 0, Iz = 0, Iyz = 0, zmin = Infinity, zmax = -Infinity;
  for (const [y, z, w, hh] of R) {
    const a = w * hh, dy = y + w / 2 - ys, dz = z + hh / 2 - zs;
    Iy += w * hh ** 3 / 12 + a * dz * dz; Iz += hh * w ** 3 / 12 + a * dy * dy; Iyz += a * dy * dz;
    if (a > 0) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z + hh); }
  }
  return { A, ys, zs, Iy, Iz, Iyz, zmin, zmax };
}

/** Statisches Moment der Fläche oberhalb von z um die Schwerachse z_s. */
function firstMomentAbove(R: readonly Rect[], z: number, zs: number): number {
  let S = 0;
  for (const [, z0, w, hh] of R) { const lo = Math.max(z0, z), hi = z0 + hh; if (hi > lo && w > 0) S += w * (hi - lo) * ((hi + lo) / 2 - zs); }
  return S;
}
/** Breite der Schnittlinie auf Höhe z; an einem Sprung die kleinere der beiden Breiten (maßgebend für τ). */
function widthAt(R: readonly Rect[], z: number): number {
  const eps = 1e-9 * Math.max(1, ...R.map((r) => Math.abs(r[1]) + r[3]));
  const wAt = (zz: number) => R.reduce((s, [, z0, w, hh]) => s + (zz > z0 && zz < z0 + hh && hh > 0 ? w : 0), 0);
  const a = wAt(z - eps), b = wAt(z + eps);
  return a > 0 && b > 0 ? Math.min(a, b) : Math.max(a, b);
}
/**
 * Größte Querkraftschubspannung nach Jourawski τ(z) = Q·S(z) / (I·b(z)): Kandidaten sind die Schwerachse und alle
 * Rechteckgrenzen (dort die kleinere Breite). Rückgabe S und b an der Stelle des Maximums.
 */
function jourawski(R: readonly Rect[], zs: number): { S: number; b: number; z: number } {
  const cand = [zs, ...R.flatMap(([, z0, , hh]) => [z0, z0 + hh])];
  let best = { S: 0, b: NaN, z: zs, r: -Infinity };
  for (const z of cand) {
    const b = widthAt(R, z); if (!(b > 0)) continue;
    const S = firstMomentAbove(R, z, zs), r = S / b;
    if (r > best.r + 1e-12 * Math.abs(r)) best = { S, b, z, r };
  }
  return { S: best.S, b: best.b, z: best.z - zs };
}

/** Geometrische Gültigkeit; Gleichheit (z. B. t_w = b) ist erlaubt und ergibt den Grenzfall Rechteck. */
export function openSectionErrors(type: OpenSecType, d: Dims): string[] {
  const h = val(d, "h"), b = val(d, "b"), E: string[] = [];
  if (type === "l_profil") { const t = val(d, "t"); if (t > h) E.push("Schenkeldicke t darf höchstens h sein"); if (t > b) E.push("Schenkeldicke t darf höchstens b sein"); return E; }
  const tw = val(d, "tw"), tf = val(d, "tf");
  if (tw > b) E.push("Stegdicke t_w darf höchstens b sein");
  if (type === "t_profil") { if (tf > h) E.push("Flanschdicke t_f darf höchstens h sein"); }
  else if (2 * tf > h) E.push("Flanschdicke t_f darf höchstens h/2 sein");
  return E;
}

/**
 * Querschnittswerte eines offenen Profils mit Rechenweg und Hinweisen.
 * Voraussetzung: alle Maße > 0 und openSectionErrors leer (prüft sectionProps).
 */
export function openSection(type: OpenSecType, d: Dims, T: CalcStep[], notes: string[]): OpenSectionOut {
  const h = val(d, "h"), b = val(d, "b");
  const R0 = rects(type, d), R = rotate(type, R0), c = composite(R);
  const weak = type === "i_profil_z" || type === "u_profil_z";
  const out = { Iyz: 0, I1: NaN, I2: NaN, alpha: 0, eM: null as number | null } as Partial<OpenSectionOut> & { eM: number | null };
  let A: number, Iy: number, Iz: number, K: number, tmax: number, ys = 0, zs = 0;
  const L = "Gross/Hauger TM 2, Kap. 4.2";

  if (type === "i_profil" || type === "i_profil_z") {
    const tw = val(d, "tw"), tf = val(d, "tf"); tmax = Math.max(tw, tf);
    A = 2 * b * tf + (h - 2 * tf) * tw;
    Iy = (b * h ** 3 - (b - tw) * (h - 2 * tf) ** 3) / 12;
    Iz = (2 * tf * b ** 3 + (h - 2 * tf) * tw ** 3) / 12;
    const webThrough = tw <= tf;
    K = webThrough ? (2 * (b - tw) * tf ** 3 + h * tw ** 3) / 3 : (2 * b * tf ** 3 + (h - 2 * tf) * tw ** 3) / 3;
    T.push(step("Q-IP-A", "Fläche", "A = 2·b·t_f + (h − 2t_f)·t_w", `2·${fmt(b)}·${fmt(tf)} + (${fmt(h)} − 2·${fmt(tf)})·${fmt(tw)}`, A, "mm²", "scharfkantig, ohne Ausrundungen"));
    T.push(step("Q-IP-IY", "Flächenträgheitsmoment um y (stark)", "I_y = [b·h³ − (b − t_w)·(h − 2t_f)³] / 12", `[${fmt(b)}·${fmt(h)}³ − ${fmt(b - tw)}·${fmt(h - 2 * tf)}³] / 12`, Iy, "mm⁴", L));
    T.push(step("Q-IP-IZ", "Flächenträgheitsmoment um z (schwach)", "I_z = [2·t_f·b³ + (h − 2t_f)·t_w³] / 12", `[2·${fmt(tf)}·${fmt(b)}³ + ${fmt(h - 2 * tf)}·${fmt(tw)}³] / 12`, Iz, "mm⁴", L));
    T.push(step("Q-IP-K", "Torsionsträgheitsmoment (dünnwandig offen)", "Iₜ = [2·(b − t_w)·t_f³ + h·t_w³] / 3 für t_w ≤ t_f, sonst [2·b·t_f³ + (h − 2t_f)·t_w³] / 3", webThrough ? `t_w ≤ t_f: [2·${fmt(b - tw)}·${fmt(tf)}³ + ${fmt(h)}·${fmt(tw)}³] / 3` : `t_w > t_f: [2·${fmt(b)}·${fmt(tf)}³ + ${fmt(h - 2 * tf)}·${fmt(tw)}³] / 3`, K, "mm⁴", "Gross/Hauger TM 2, Kap. 5.4; überlappungsfreie Zerlegung, Knotenfläche dem dünneren Teil (Gegenrechnung Prandtl)"));
    if ((b - tw) / 2 / tf > 20) notes.push(`Flansch schlank: c/t_f = ${fmt((b - tw) / 2 / tf, 3)} > 20, lokales Beulen prüfen (Plausibilität, keine Norm)`);
    if ((h - 2 * tf) / tw > 70) notes.push(`Steg schlank: d/t_w = ${fmt((h - 2 * tf) / tw, 3)} > 70, lokales Beulen prüfen (Plausibilität, keine Norm)`);
    if (tf / b > 0.2 || tw / (h - tf) > 0.2) notes.push("Iₜ dünnwandig: gilt für t/s ≤ 0,2, hier dickwandig (Näherung)");
  } else if (type === "u_profil" || type === "u_profil_z") {
    const tw = val(d, "tw"), tf = val(d, "tf"); tmax = Math.max(tw, tf);
    A = 2 * b * tf + (h - 2 * tf) * tw;
    ys = (tw * tw * h + 2 * tf * (b * b - tw * tw)) / (2 * A);
    Iy = (b * h ** 3 - (b - tw) * (h - 2 * tf) ** 3) / 12;
    Iz = (h * tw ** 3 + 2 * tf * (b ** 3 - tw ** 3)) / 3 - A * ys * ys;
    const bp = b - tw / 2, hp = h - tf;
    const webThrough = tw <= tf;
    K = webThrough ? (2 * (b - tw) * tf ** 3 + h * tw ** 3) / 3 : (2 * b * tf ** 3 + (h - 2 * tf) * tw ** 3) / 3;
    const eM = bp * bp * hp * hp * tf / (4 * Iy); out.eM = eM;
    T.push(step("Q-UP-A", "Fläche", "A = 2·b·t_f + (h − 2t_f)·t_w", `2·${fmt(b)}·${fmt(tf)} + (${fmt(h)} − 2·${fmt(tf)})·${fmt(tw)}`, A, "mm²", "scharfkantig, ohne Ausrundungen"));
    T.push(step("Q-UP-YS", "Schwerpunktabstand von der Stegaußenkante", "y_s = [t_w²·h + 2·t_f·(b² − t_w²)] / (2A)", `[${fmt(tw)}²·${fmt(h)} + 2·${fmt(tf)}·(${fmt(b)}² − ${fmt(tw)}²)] / (2·${fmt(A)})`, ys, "mm", L));
    T.push(step("Q-UP-IY", "Flächenträgheitsmoment um y (stark)", "I_y = [b·h³ − (b − t_w)·(h − 2t_f)³] / 12", `[${fmt(b)}·${fmt(h)}³ − ${fmt(b - tw)}·${fmt(h - 2 * tf)}³] / 12`, Iy, "mm⁴", L));
    T.push(step("Q-UP-IZ", "Flächenträgheitsmoment um z (senkrechte Schwerachse parallel zum Steg, schwach; Symmetrieachse ist y)", "I_z = [h·t_w³ + 2·t_f·(b³ − t_w³)] / 3 − A·y_s²", `[${fmt(h)}·${fmt(tw)}³ + 2·${fmt(tf)}·(${fmt(b)}³ − ${fmt(tw)}³)] / 3 − ${fmt(A)}·${fmt(ys)}²`, Iz, "mm⁴", "Steinerscher Satz"));
    T.push(step("Q-UP-K", "Torsionsträgheitsmoment (dünnwandig offen)", "Iₜ = [2·(b − t_w)·t_f³ + h·t_w³] / 3 für t_w ≤ t_f, sonst [2·b·t_f³ + (h − 2t_f)·t_w³] / 3", webThrough ? `t_w ≤ t_f: [2·${fmt(b - tw)}·${fmt(tf)}³ + ${fmt(h)}·${fmt(tw)}³] / 3` : `t_w > t_f: [2·${fmt(b)}·${fmt(tf)}³ + ${fmt(h - 2 * tf)}·${fmt(tw)}³] / 3`, K, "mm⁴", "Gross/Hauger TM 2, Kap. 5.4; überlappungsfreie Zerlegung, Knotenfläche dem dünneren Teil (Gegenrechnung Prandtl)"));
    T.push(step("Q-UP-EM", "Schubmittelpunkt (Abstand von der Stegmitte, nach außen)", "e_M = b'²·h'²·t_f / (4·I_y),  b' = b − t_w/2, h' = h − t_f", `${fmt(bp)}²·${fmt(hp)}²·${fmt(tf)} / (4·${fmt(Iy)})`, eM, "mm", "Gross/Hauger TM 2, Kap. 4.6 (dünnwandig)"));
    if ((b - tw) / tf > 20) notes.push(`Flansch schlank: c/t_f = ${fmt((b - tw) / tf, 3)} > 20, lokales Beulen prüfen (Plausibilität, keine Norm)`);
    if ((h - 2 * tf) / tw > 70) notes.push(`Steg schlank: d/t_w = ${fmt((h - 2 * tf) / tw, 3)} > 70, lokales Beulen prüfen (Plausibilität, keine Norm)`);
    if (tf / bp > 0.2 || tw / hp > 0.2) notes.push("Iₜ dünnwandig: gilt für t/s ≤ 0,2, hier dickwandig (Näherung)");
  } else if (type === "l_profil") {
    const t = val(d, "t"); tmax = t;
    A = t * (h + b - t);
    ys = (h * t * t + (b * b - t * t) * t) / (2 * A);
    zs = (b * t * t + (h * h - t * t) * t) / (2 * A);
    Iy = (t * h ** 3 + (b - t) * t ** 3) / 3 - A * zs * zs;
    Iz = (h * t ** 3 + t * (b ** 3 - t ** 3)) / 3 - A * ys * ys;
    const Iyz = (t * t * h * h + t * t * (b * b - t * t)) / 4 - A * ys * zs;
    const m = (Iy + Iz) / 2, r = Math.hypot((Iy - Iz) / 2, Iyz);
    const I1 = m + r, I2 = m - r, alpha = 0.5 * Math.atan2(-2 * Iyz, Iy - Iz) * 180 / Math.PI;
    Object.assign(out, { Iyz, I1, I2, alpha });
    const hp = h - t / 2, bp = b - t / 2;
    K = (hp + bp) * t ** 3 / 3;
    T.push(step("Q-LP-A", "Fläche", "A = t·(h + b − t)", `${fmt(t)}·(${fmt(h)} + ${fmt(b)} − ${fmt(t)})`, A, "mm²", "scharfkantig, ohne Ausrundungen"));
    T.push(step("Q-LP-YS", "Schwerpunktabstand von der Außenkante des senkrechten Schenkels", "y_s = [h·t² + (b² − t²)·t] / (2A)", `[${fmt(h)}·${fmt(t)}² + (${fmt(b)}² − ${fmt(t)}²)·${fmt(t)}] / (2·${fmt(A)})`, ys, "mm", L));
    T.push(step("Q-LP-ZS", "Schwerpunktabstand von der Unterkante", "z_s = [b·t² + (h² − t²)·t] / (2A)", `[${fmt(b)}·${fmt(t)}² + (${fmt(h)}² − ${fmt(t)}²)·${fmt(t)}] / (2·${fmt(A)})`, zs, "mm", L));
    T.push(step("Q-LP-IY", "Flächenträgheitsmoment um y (waagerechte Schwerachse, Biegeachse; ∫(z − z_s)² dA, senkrechter Schenkel h liefert h³)", "I_y = [t·h³ + (b − t)·t³] / 3 − A·z_s²", `[${fmt(t)}·${fmt(h)}³ + ${fmt(b - t)}·${fmt(t)}³] / 3 − ${fmt(A)}·${fmt(zs)}²`, Iy, "mm⁴", "Steinerscher Satz"));
    T.push(step("Q-LP-IZ", "Flächenträgheitsmoment um z (senkrechte Schwerachse; ∫(y − y_s)² dA, waagerechter Schenkel b liefert b³)", "I_z = [h·t³ + t·(b³ − t³)] / 3 − A·y_s²", `[${fmt(h)}·${fmt(t)}³ + ${fmt(t)}·(${fmt(b)}³ − ${fmt(t)}³)] / 3 − ${fmt(A)}·${fmt(ys)}²`, Iz, "mm⁴", "Steinerscher Satz"));
    T.push(step("Q-LP-IYZ", "Deviationsmoment", "I_yz = [t²·h² + t²·(b² − t²)] / 4 − A·y_s·z_s", `[${fmt(t)}²·${fmt(h)}² + ${fmt(t)}²·(${fmt(b)}² − ${fmt(t)}²)] / 4 − ${fmt(A)}·${fmt(ys)}·${fmt(zs)}`, Iyz, "mm⁴", "Steinerscher Satz, I_yz = ∫(y − y_s)(z − z_s) dA"));
    T.push(step("Q-LP-I1", "Größtes Hauptträgheitsmoment", "I₁ = (I_y + I_z)/2 + √[((I_y − I_z)/2)² + I_yz²]", `${fmt(m)} + √[(${fmt((Iy - Iz) / 2)})² + (${fmt(Iyz)})²]`, I1, "mm⁴", "Mohrscher Trägheitskreis"));
    T.push(step("Q-LP-I2", "Kleinstes Hauptträgheitsmoment", "I₂ = (I_y + I_z)/2 − √[((I_y − I_z)/2)² + I_yz²]", `${fmt(m)} − √[(${fmt((Iy - Iz) / 2)})² + (${fmt(Iyz)})²]`, I2, "mm⁴", "Mohrscher Trägheitskreis"));
    T.push(step("Q-LP-AL", "Winkel der Hauptachse 1 gegen y", "α = ½·atan2(−2·I_yz, I_y − I_z), gegen den Uhrzeigersinn positiv", `½·atan2(${fmt(-2 * Iyz)}, ${fmt(Iy - Iz)})`, alpha, "°", "Mohrscher Trägheitskreis"));
    T.push(step("Q-LP-K", "Torsionsträgheitsmoment (dünnwandig offen)", "Iₜ = [(h − t/2) + (b − t/2)]·t³ / 3", `[${fmt(hp)} + ${fmt(bp)}]·${fmt(t)}³ / 3`, K, "mm⁴", "Gross/Hauger TM 2, Kap. 5.4"));
    if ((Math.max(h, b) - t) / t > 20) notes.push(`Schenkel schlank: c/t = ${fmt((Math.max(h, b) - t) / t, 3)} > 20, lokales Beulen prüfen (Plausibilität, keine Norm)`);
    if (t / Math.min(hp, bp) > 0.2) notes.push("Iₜ dünnwandig: gilt für t/s ≤ 0,2, hier dickwandig (Näherung)");
    notes.push(`L-Profil: Biegung um die waagerechte Schwerachse y gilt nur bei seitlicher Führung. Ohne Führung schiefe Biegung um die Hauptachsen (α = ${fmt(alpha, 3)}°), Spannung und Durchbiegung größer. Knicken mit I₂`);
  } else {
    const tw = val(d, "tw"), tf = val(d, "tf"); tmax = Math.max(tw, tf);
    A = b * tf + (h - tf) * tw;
    zs = (tw * (h - tf) ** 2 / 2 + b * tf * (h - tf / 2)) / A;
    Iy = (tw * (h - tf) ** 3 + b * (h ** 3 - (h - tf) ** 3)) / 3 - A * zs * zs;
    Iz = (tf * b ** 3 + (h - tf) * tw ** 3) / 12;
    const webThrough = tw <= tf;
    K = webThrough ? ((b - tw) * tf ** 3 + h * tw ** 3) / 3 : (b * tf ** 3 + (h - tf) * tw ** 3) / 3;
    T.push(step("Q-TP-A", "Fläche", "A = b·t_f + (h − t_f)·t_w", `${fmt(b)}·${fmt(tf)} + (${fmt(h)} − ${fmt(tf)})·${fmt(tw)}`, A, "mm²", "scharfkantig, ohne Ausrundungen"));
    T.push(step("Q-TP-ZS", "Schwerpunktabstand von der Unterkante", "z_s = [t_w·(h − t_f)²/2 + b·t_f·(h − t_f/2)] / A", `[${fmt(tw)}·${fmt(h - tf)}²/2 + ${fmt(b)}·${fmt(tf)}·${fmt(h - tf / 2)}] / ${fmt(A)}`, zs, "mm", L));
    T.push(step("Q-TP-IY", "Flächenträgheitsmoment um y (waagerechte Schwerachse)", "I_y = [t_w·(h − t_f)³ + b·(h³ − (h − t_f)³)] / 3 − A·z_s²", `[${fmt(tw)}·${fmt(h - tf)}³ + ${fmt(b)}·(${fmt(h)}³ − ${fmt(h - tf)}³)] / 3 − ${fmt(A)}·${fmt(zs)}²`, Iy, "mm⁴", "Steinerscher Satz"));
    T.push(step("Q-TP-IZ", "Flächenträgheitsmoment um z (Symmetrieachse)", "I_z = [t_f·b³ + (h − t_f)·t_w³] / 12", `[${fmt(tf)}·${fmt(b)}³ + ${fmt(h - tf)}·${fmt(tw)}³] / 12`, Iz, "mm⁴", L));
    T.push(step("Q-TP-K", "Torsionsträgheitsmoment (dünnwandig offen)", "Iₜ = [(b − t_w)·t_f³ + h·t_w³] / 3 für t_w ≤ t_f, sonst [b·t_f³ + (h − t_f)·t_w³] / 3", webThrough ? `t_w ≤ t_f: [${fmt(b - tw)}·${fmt(tf)}³ + ${fmt(h)}·${fmt(tw)}³] / 3` : `t_w > t_f: [${fmt(b)}·${fmt(tf)}³ + ${fmt(h - tf)}·${fmt(tw)}³] / 3`, K, "mm⁴", "Gross/Hauger TM 2, Kap. 5.4; überlappungsfreie Zerlegung, Knotenfläche dem dünneren Teil (Gegenrechnung Prandtl)"));
    if ((b - tw) / 2 / tf > 20) notes.push(`Flansch schlank: c/t_f = ${fmt((b - tw) / 2 / tf, 3)} > 20, lokales Beulen prüfen (Plausibilität, keine Norm)`);
    if ((h - tf) / tw > 20) notes.push(`Steg (frei endend) schlank: c/t_w = ${fmt((h - tf) / tw, 3)} > 20, lokales Beulen prüfen (Plausibilität, keine Norm)`);
    if (tf / b > 0.2 || tw / (h - tf / 2) > 0.2) notes.push("Iₜ dünnwandig: gilt für t/s ≤ 0,2, hier dickwandig (Näherung)");
  }

  // Biegeachse und Randabstände (aus der gedrehten Rechteckzerlegung, Schwerachse wie oben)
  const P = type.slice(0, 1).toUpperCase() + "P";
  const Ibend = weak ? Iz : Iy;
  const eo = c.zmax - c.zs, eu = c.zs - c.zmin, e = Math.max(eo, eu), W = Ibend / e;
  const asym = Math.abs(eo - eu) > 1e-9 * e;
  const Isym = weak ? "I_z" : "I_y";
  if (weak) T.push(step(`Q-${P}-WZ`, "Widerstandsmoment Biegung um z (Lage schwach)", asym ? "W = I_z / max(e_o, e_u)" : "W = I_z / (b/2)", asym ? `${fmt(Iz)} / max(${fmt(eo)}; ${fmt(eu)})` : `${fmt(Iz)} / ${fmt(e)}`, W, "mm³"));
  else T.push(step(`Q-${P}-W`, "Widerstandsmoment Biegung (maßgebender Rand)", asym ? "W = I_y / max(e_o, e_u)" : "W = I_y / (h/2)", asym ? `${fmt(Iy)} / max(${fmt(eo)}; ${fmt(eu)})` : `${fmt(Iy)} / ${fmt(e)}`, W, "mm³"));
  const Wt = K / tmax;
  T.push(step(`Q-${P}-WT`, "Widerstandsmoment Torsion", "Wₜ = Iₜ / t_max", `${fmt(K)} / ${fmt(tmax)}`, Wt, "mm³", "Gross/Hauger TM 2, Kap. 5.4"));

  // Querkraftschub nach Jourawski: κ = A·S / (I·b) an der Stelle größter Schubspannung
  const j = jourawski(R, c.zs);
  const kappa = A * j.S / (Ibend * j.b);
  const sfx = weak ? "Z" : "";
  T.push(step(`Q-${P}-S${sfx}`, "Statisches Moment an der Stelle größter Schubspannung", "S = ∫ (z − z_s) dA über die Fläche oberhalb der Schnittlinie (Schwerachse oder Querschnittssprung)", `Schnitt bei z − z_s = ${fmt(j.z)} mm, Breite b = ${fmt(j.b)} mm`, j.S, "mm³", "Gross/Hauger TM 2, Kap. 4.6"));
  T.push(step(`Q-${P}-KA${sfx}`, "Faktor Querkraftschub (Jourawski)", `κ = A·S / (${Isym}·b),  τ_Q = κ·Q / A`, `${fmt(A)}·${fmt(j.S)} / (${fmt(Ibend)}·${fmt(j.b)})`, kappa, "–", "Jourawski, exakt für die Rechteckzerlegung"));

  let Imin: number;
  if (type === "l_profil") Imin = out.I2 as number;
  else Imin = Math.min(Iy, Iz);
  if (type !== "l_profil") { out.I1 = Math.max(Iy, Iz); out.I2 = Imin; }
  return {
    A, I: Ibend, Imin, e, W, K, Wt, kappa, Iy, Iz, Iyz: out.Iyz as number, I1: out.I1 as number, I2: out.I2 as number, alpha: out.alpha as number,
    ys, zs, eo, eu, eM: out.eM, zTau: j.z,
  };
}

/** Höhe des Querschnitts in Lastrichtung (Lage beachten). */
export function openSectionHeight(type: OpenSecType, d: Dims): number {
  return type === "i_profil_z" || type === "u_profil_z" ? val(d, "b") : val(d, "h");
}
