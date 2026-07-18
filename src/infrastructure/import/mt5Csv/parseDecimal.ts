import { ImportParseError } from "../../../domain/import/parser";
export function parseMt5Decimal(raw: string): string | null {
  const compact = raw.trim().replace(/[ \u00A0\u202F]/g, "");
  if (!compact) return null;
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(compact)) {
    throw new ImportParseError("INVALID_DECIMAL", "Invalid MT5 decimal value.");
  }
  const negative = compact.startsWith("-");
  const unsigned = negative ? compact.slice(1) : compact;
  const [integer, fraction] = unsigned.split(".");
  const value = `${integer.replace(/^0+(?=\d)/, "")}${fraction === undefined ? "" : `.${fraction}`}`;
  return negative && value !== "0" ? `-${value}` : value;
}
