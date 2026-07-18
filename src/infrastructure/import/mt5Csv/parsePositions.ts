import type { ImportIssue, ParsedPosition } from "../../../domain/import/import";
import { parseDecimalField, parseTimeField, pick, rowHasError, sectionRecords } from "./sectionHelpers";
import type { ScannedSection } from "./sectionScanner";

export function parsePositions(section: ScannedSection, timezone: string, issues: ImportIssue[]): ParsedPosition[] {
  return sectionRecords(section).map(({ row, raw }) => {
    const externalPositionId = pick(raw, "Position", "Ticket", "Position ID");
    const symbol = pick(raw, "Symbol");
    const sideRaw = pick(raw, "Type", "Side").toLowerCase();
    const side = sideRaw === "buy" ? "BUY" : sideRaw === "sell" ? "SELL" : null;
    const volumeRaw = pick(raw, "Volume");
    const openPriceRaw = pick(raw, "Price", "Open Price");
    const openedAtRaw = pick(raw, "Time", "Open Time");
    const closePriceRaw = pick(raw, "Price.1", "Close Price");
    const closedAtRaw = pick(raw, "Time.1", "Close Time");
    const commissionRaw = pick(raw, "Commission");
    const swapRaw = pick(raw, "Swap");
    const profitRaw = pick(raw, "Profit");
    const closed = Boolean(closePriceRaw || closedAtRaw);
    const missing = (value: string, code: string, field: string) => {
      if (!value.trim()) issues.push({ code, severity: "ERROR", section: "POSITIONS",
        rowNumber: row.rowNumber, field, message: `${field} is required.` });
    };
    if (!externalPositionId) issues.push({ code: "MISSING_POSITION_ID", severity: "ERROR", section: "POSITIONS",
      rowNumber: row.rowNumber, field: "Position", message: "Position ID is required." });
    missing(symbol, "MISSING_POSITION_SYMBOL", "Symbol");
    if (!sideRaw) issues.push({ code: "MISSING_POSITION_SIDE", severity: "ERROR", section: "POSITIONS",
      rowNumber: row.rowNumber, field: "Type", message: "Position side is required." });
    else if (!side) issues.push({ code: "UNSUPPORTED_POSITION_SIDE", severity: "ERROR", section: "POSITIONS",
      rowNumber: row.rowNumber, field: "Type", message: "Only buy and sell positions are supported." });
    missing(volumeRaw, "MISSING_POSITION_VOLUME", "Volume");
    missing(openPriceRaw, "MISSING_POSITION_OPEN_PRICE", "Open Price");
    missing(openedAtRaw, "MISSING_POSITION_OPENED_AT", "Open Time");
    missing(commissionRaw, "MISSING_POSITION_COMMISSION", "Commission");
    missing(swapRaw, "MISSING_POSITION_SWAP", "Swap");
    missing(profitRaw, "MISSING_POSITION_PROFIT", "Profit");
    if (closed) {
      missing(closePriceRaw, "MISSING_POSITION_CLOSE_PRICE", "Close Price");
      missing(closedAtRaw, "MISSING_POSITION_CLOSED_AT", "Close Time");
    }
    const openedAt = parseTimeField(openedAtRaw, timezone, "POSITIONS", row.rowNumber, "Time", issues);
    const closedAt = parseTimeField(closedAtRaw, timezone, "POSITIONS", row.rowNumber, "Close Time", issues);
    if (openedAt && closedAt && closedAt.epochMs < openedAt.epochMs) issues.push({
      code: "CLOSE_BEFORE_OPEN", severity: "ERROR", section: "POSITIONS", rowNumber: row.rowNumber,
      message: "Close time is before open time.",
    });
    if (!closed) issues.push({ code: "OPEN_POSITION", severity: "WARNING", section: "POSITIONS",
      rowNumber: row.rowNumber, message: "Open position is excluded from estimated closed trades." });
    const result: ParsedPosition = {
      rowNumber: row.rowNumber, raw, externalPositionId, symbol, side,
      volume: parseDecimalField(volumeRaw, "POSITIONS", row.rowNumber, "Volume", issues),
      openPrice: parseDecimalField(openPriceRaw, "POSITIONS", row.rowNumber, "Open Price", issues),
      stopLoss: parseDecimalField(pick(raw, "S / L", "S/L", "SL"), "POSITIONS", row.rowNumber, "SL", issues),
      takeProfit: parseDecimalField(pick(raw, "T / P", "T/P", "TP"), "POSITIONS", row.rowNumber, "TP", issues),
      openedAt, closePrice: parseDecimalField(closePriceRaw, "POSITIONS", row.rowNumber, "Close Price", issues),
      closedAt, commission: parseDecimalField(commissionRaw, "POSITIONS", row.rowNumber, "Commission", issues),
      swap: parseDecimalField(swapRaw, "POSITIONS", row.rowNumber, "Swap", issues),
      profit: parseDecimalField(profitRaw, "POSITIONS", row.rowNumber, "Profit", issues),
      valid: false, open: !closed,
    };
    return { ...result, valid: !rowHasError(issues, "POSITIONS", row.rowNumber) };
  });
}
