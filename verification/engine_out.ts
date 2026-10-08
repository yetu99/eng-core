/** Gibt die Ergebnisse des Rechenkerns für die Prüffälle aus pruefung.py als JSON aus. Aufruf: npx tsx verification/engine_out.ts <cases.json> */
import { readFileSync } from "node:fs";
import { computeStrength, sectionProps, type StrengthInput, type SecType } from "../src/index";
import { repo } from "../src/data";

type Case = { id: string; type: "section"; sec: SecType; dims: Record<string, number> } | { id: string; type: "calc"; inp: StrengthInput };
const cases = JSON.parse(readFileSync(process.argv[2] ?? "", "utf8")) as Case[];
const out: Record<string, Record<string, number | null>> = {};
for (const c of cases) {
  if (c.type === "section") {
    const s = sectionProps(c.sec, c.dims);
    out[c.id] = { A: s.A, I: s.I, W: s.W, K: s.K, Wt: s.Wt, phiBe: s.phiBe, phiTe: s.phiTe, phiBf: s.phiBf, phiTf: s.phiTf };
  } else {
    const r = computeStrength(repo, c.inp);
    out[c.id] = { M: r.bend?.M ?? null, w: r.bend?.w ?? null, sv: r.sigmaV, dL: r.axial?.dL ?? null, sk: r.buck?.sigmaK ?? null, lamT: r.buck?.lambdaT ?? null, theta: r.tors?.theta ?? null, tau: r.tauT, util: r.util };
  }
}
process.stdout.write(JSON.stringify(out));
