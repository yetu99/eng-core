/**
 * Exakte Brüche mit BigInt (Modul chemie, CH-B02, CH-O, CH-R). Stets gekürzt, Nenner > 0.
 */
const abs = (x: bigint): bigint => (x < 0n ? -x : x);
export function gcdB(a: bigint, b: bigint): bigint { a = abs(a); b = abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
export function lcmB(a: bigint, b: bigint): bigint { if (a === 0n || b === 0n) return 0n; return abs(a / gcdB(a, b) * b); }

export class Q {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = typeof n === "bigint" ? n : BigInt(n), dd = typeof d === "bigint" ? d : BigInt(d);
    if (dd === 0n) throw new Error("Bruch mit Nenner 0");
    if (dd < 0n) { nn = -nn; dd = -dd; }
    const g = gcdB(nn, dd) || 1n;
    this.n = nn / g; this.d = dd / g;
  }
  static readonly ZERO = new Q(0n);
  static readonly ONE = new Q(1n);
  static of(x: number): Q { if (!Number.isInteger(x)) throw new Error(`keine ganze Zahl: ${x}`); return new Q(BigInt(x)); }
  add(o: Q): Q { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Q): Q { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Q): Q { return new Q(this.n * o.n, this.d * o.d); }
  div(o: Q): Q { if (o.n === 0n) throw new Error("Division durch 0"); return new Q(this.n * o.d, this.d * o.n); }
  neg(): Q { return new Q(-this.n, this.d); }
  isZero(): boolean { return this.n === 0n; }
  sign(): number { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
  eq(o: Q): boolean { return this.n === o.n && this.d === o.d; }
  isInt(): boolean { return this.d === 1n; }
  toNumber(): number { return Number(this.n) / Number(this.d); }
  /** "+8/3", "−2", "0" (Vorzeichen nur mit signed). */
  toString(signed = false): string {
    const s = this.n < 0n ? "−" : signed && this.n > 0n ? "+" : "";
    const a = abs(this.n);
    return this.d === 1n ? `${s}${a}` : `${s}${a}/${this.d}`;
  }
}
