import type { ImportIssue, ParsedDeal } from "../../../domain/import/import";
import { optionalText, parseDecimalField, parseTimeField, pick, rowHasError, sectionRecords } from "./sectionHelpers";
import type { ScannedSection } from "./sectionScanner";

export function parseDeals(section: ScannedSection, timezone: string, issues: ImportIssue[]): ParsedDeal[] {
  return sectionRecords(section).map(({ row, raw }) => {
    const externalDealId = pick(raw, "Deal", "Ticket");
    const symbol = pick(raw, "Symbol");
    const sideRaw = pick(raw, "Type", "Side").toLowerCase();
    const side = sideRaw === "buy" ? "BUY" : sideRaw === "sell" ? "SELL" : null;
    const entryType = pick(raw, "Direction", "Entry", "Entry Type");
    const volumeRaw = pick(raw, "Volume");
    const priceRaw = pick(raw, "Price");
    const executedAtRaw = pick(raw, "Time", "Executed At");
    if (!externalDealId) issues.push({ code: "MISSING_DEAL_ID", severity: "ERROR", section: "DEALS",
      rowNumber: row.rowNumber, field: "Deal", message: "Deal ID is required." });
    if (!symbol) issues.push({ code: "MISSING_DEAL_SYMBOL", severity: "ERROR", section: "DEALS",
      rowNumber: row.rowNumber, field: "Symbol", message: "Deal symbol is required." });
    if (!sideRaw) issues.push({ code: "MISSING_DEAL_SIDE", severity: "ERROR", section: "DEALS",
      rowNumber: row.rowNumber, field: "Type", message: "Deal side is required." });
    else if (!side) issues.push({ code: "UNSUPPORTED_DEAL_SIDE", severity: "ERROR", section: "DEALS",
      rowNumber: row.rowNumber, field: "Type", message: "Only buy and sell deals are supported." });
    if (!entryType) issues.push({ code: "MISSING_DEAL_ENTRY_TYPE", severity: "ERROR", section: "DEALS",
      rowNumber: row.rowNumber, field: "Entry", message: "Deal entry type is required." });
    if (!volumeRaw) issues.push({ code: "MISSING_DEAL_VOLUME", severity: "ERROR", section: "DEALS",
      rowNumber: row.rowNumber, field: "Volume", message: "Deal volume is required." });
    if (!priceRaw) issues.push({ code: "MISSING_DEAL_PRICE", severity: "ERROR", section: "DEALS",
      rowNumber: row.rowNumber, field: "Price", message: "Deal price is required." });
    if (!executedAtRaw) issues.push({ code: "MISSING_DEAL_EXECUTED_AT", severity: "ERROR", section: "DEALS",
      rowNumber: row.rowNumber, field: "Time", message: "Deal execution time is required." });
    return {
      rowNumber: row.rowNumber, raw, externalDealId,
      externalOrderId: optionalText(pick(raw, "Order")),
      externalPositionId: optionalText(pick(raw, "Position", "Position ID")),
      symbol, side, entryType,
      volume: parseDecimalField(volumeRaw, "DEALS", row.rowNumber, "Volume", issues),
      price: parseDecimalField(priceRaw, "DEALS", row.rowNumber, "Price", issues),
      commission: parseDecimalField(pick(raw, "Commission"), "DEALS", row.rowNumber, "Commission", issues),
      swap: parseDecimalField(pick(raw, "Swap"), "DEALS", row.rowNumber, "Swap", issues),
      profit: parseDecimalField(pick(raw, "Profit"), "DEALS", row.rowNumber, "Profit", issues),
      executedAt: parseTimeField(executedAtRaw, timezone, "DEALS", row.rowNumber, "Time", issues),
      comment: optionalText(pick(raw, "Comment")), magicNumber: optionalText(pick(raw, "Magic", "Magic Number")),
      valid: !rowHasError(issues, "DEALS", row.rowNumber),
    };
  });
}
