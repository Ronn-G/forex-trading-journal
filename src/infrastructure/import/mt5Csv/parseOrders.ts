import type { ImportIssue, ParsedOrder } from "../../../domain/import/import";
import { optionalText, parseDecimalField, parseTimeField, pick, rowHasError, sectionRecords } from "./sectionHelpers";
import type { ScannedSection } from "./sectionScanner";

export function parseOrders(section: ScannedSection, timezone: string, issues: ImportIssue[]): ParsedOrder[] {
  return sectionRecords(section).map(({ row, raw }) => {
    const externalOrderId = pick(raw, "Order", "Ticket");
    const symbol = pick(raw, "Symbol");
    const orderType = pick(raw, "Type", "Order Type");
    const volumeInitialRaw = pick(raw, "Volume", "Volume Initial", "Volume Initial / Current");
    const placedAtRaw = pick(raw, "Time", "Open Time", "Placed At");
    if (!externalOrderId) issues.push({ code: "MISSING_ORDER_ID", severity: "ERROR", section: "ORDERS",
      rowNumber: row.rowNumber, field: "Order", message: "Order ID is required." });
    if (!orderType) issues.push({ code: "MISSING_ORDER_TYPE", severity: "ERROR", section: "ORDERS",
      rowNumber: row.rowNumber, field: "Type", message: "Order type is required." });
    if (!symbol) issues.push({ code: "MISSING_ORDER_SYMBOL", severity: "ERROR", section: "ORDERS",
      rowNumber: row.rowNumber, field: "Symbol", message: "Order symbol is required." });
    if (!volumeInitialRaw) issues.push({ code: "MISSING_ORDER_VOLUME_INITIAL", severity: "ERROR", section: "ORDERS",
      rowNumber: row.rowNumber, field: "Volume Initial", message: "Initial order volume is required." });
    if (!placedAtRaw) issues.push({ code: "MISSING_ORDER_PLACED_AT", severity: "ERROR", section: "ORDERS",
      rowNumber: row.rowNumber, field: "Time", message: "Order placement time is required." });
    return {
      rowNumber: row.rowNumber, raw, externalOrderId,
      externalPositionId: optionalText(pick(raw, "Position", "Position ID")),
      symbol, orderType,
      volumeInitial: parseDecimalField(volumeInitialRaw, "ORDERS", row.rowNumber, "Volume Initial", issues),
      volumeCurrent: parseDecimalField(pick(raw, "Volume Current"), "ORDERS", row.rowNumber, "Volume Current", issues),
      openPrice: parseDecimalField(pick(raw, "Price", "Open Price"), "ORDERS", row.rowNumber, "Open Price", issues),
      stopLoss: parseDecimalField(pick(raw, "S / L", "S/L", "SL"), "ORDERS", row.rowNumber, "SL", issues),
      takeProfit: parseDecimalField(pick(raw, "T / P", "T/P", "TP"), "ORDERS", row.rowNumber, "TP", issues),
      placedAt: parseTimeField(placedAtRaw, timezone, "ORDERS", row.rowNumber, "Time", issues),
      closedAt: parseTimeField(pick(raw, "Time.1", "Close Time"), timezone, "ORDERS", row.rowNumber, "Close Time", issues),
      comment: optionalText(pick(raw, "Comment")), magicNumber: optionalText(pick(raw, "Magic", "Magic Number")),
      valid: !rowHasError(issues, "ORDERS", row.rowNumber),
    };
  });
}
