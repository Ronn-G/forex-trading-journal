import { maskAccountLogin, type ReportAccountMetadata } from "../../../domain/import/import";
import type { CsvRow } from "./sectionScanner";

export function parseMetadata(rows: readonly CsvRow[]): ReportAccountMetadata {
  const flat = rows.flatMap((row) => row.cells).map((value) => value.trim());
  const valueAfter = (label: string) => {
    const inline = flat.find((value) => value.toLowerCase().startsWith(`${label.toLowerCase()}:`));
    if (inline && inline.slice(inline.indexOf(":") + 1).trim()) {
      return inline.slice(inline.indexOf(":") + 1).trim();
    }
    const index = flat.findIndex((value) => value.toLowerCase() === `${label.toLowerCase()}:`);
    return index >= 0 ? flat[index + 1] ?? "" : "";
  };
  const account = valueAfter("Account");
  const accountMatch = /^(\d+)\s*\(\s*([^,()]+)\s*,\s*([^,()]+)\s*,\s*(demo|real)\s*,\s*(hedge|netting)\s*\)$/i.exec(account);
  const accountNumber = accountMatch?.[1] ?? (/^\d+/.exec(account)?.[0] ?? "");
  const server = accountMatch?.[3]?.trim() || valueAfter("Company") || valueAfter("Server");
  const currency = accountMatch?.[2]?.trim().toUpperCase() || valueAfter("Currency").toUpperCase() || null;
  const environment = accountMatch?.[4]?.toUpperCase() as "DEMO" | "REAL" | undefined;
  const accountMode = accountMatch?.[5]?.toUpperCase() as "HEDGE" | "NETTING" | undefined;
  const mode = valueAfter("Mode");
  return {
    loginMasked: accountNumber ? maskAccountLogin(accountNumber) : null,
    currency,
    server: server || null,
    environment: environment ?? (/^demo$/i.test(valueAfter("Environment")) ? "DEMO" :
      /^real$/i.test(valueAfter("Environment")) ? "REAL" : null),
    accountMode: accountMode ?? (/hedge/i.test(mode) ? "HEDGE" : /netting/i.test(mode) ? "NETTING" : null),
    generatedAtOriginal: valueAfter("Report Date") || null,
  };
}
