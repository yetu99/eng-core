// Fallback-Typ für JSON-Importe in Projekten ohne "resolveJsonModule" (z. B. die Werkbank-App).
declare module "*.json" {
  const value: unknown;
  export default value;
}
