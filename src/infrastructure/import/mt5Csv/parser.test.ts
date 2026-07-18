import { describe, expect, it } from "vitest";
import { ImportParseError } from "../../../domain/import/parser";
import { assertVantageMt5Csv } from "../detectFormat";
import { decodeUtf8 } from "../encoding";
import { parseMt5Decimal } from "./parseDecimal";
import { parseMt5Timestamp } from "./parseTimestamp";
import { VantageMt5CsvParser } from "./vantageMt5CsvParser";
import minimalFixture from "../../../tests/fixtures/mt5/vantage-report-minimal.csv?raw";
import bomFixture from "../../../tests/fixtures/mt5/vantage-report-bom.csv?raw";
import { sha256Hex } from "../hash";
import { parseCsvRows, scanSections, type ScannedSection } from "./sectionScanner";
import { parsePositions } from "./parsePositions";
import { parseOrders } from "./parseOrders";
import { parseDeals } from "./parseDeals";
import { parseResults } from "./parseResults";
import { parseMetadata } from "./parseMetadata";

describe("MT5 primitives", () => {
  it.each([
    ["4070.75", "4070.75"], ["4 070.75", "4070.75"], ["-15.15", "-15.15"],
    ["- 15.15", "-15.15"], ["0", "0"], ["0.01", "0.01"], ["", null],
  ])("parses decimal %s", (raw, expected) => expect(parseMt5Decimal(raw)).toBe(expected));
  it.each(["--1", "1.2.3", "abc", "1e3", "Infinity"])("rejects decimal %s", (raw) =>
    expect(() => parseMt5Decimal(raw)).toThrow(ImportParseError));
  it("parses a real calendar date in an IANA timezone", () => {
    const parsed = parseMt5Timestamp("2024.02.29 12:30:00", "Asia/Ho_Chi_Minh");
    expect(parsed.original).toBe("2024.02.29 12:30:00");
    expect(new Date(parsed.epochMs).toISOString()).toBe("2024-02-29T05:30:00.000Z");
  });
  it("rejects invalid dates and timezones", () => {
    expect(() => parseMt5Timestamp("2023.02.29 12:00:00", "UTC")).toThrow();
    expect(() => parseMt5Timestamp("2024.02.29 12:00:00", "Mars/Olympus")).toThrow();
  });
});

describe("Vantage parser", () => {
  it("parses all report sections and preserves safe metadata", async () => {
    const bytes = new TextEncoder().encode(minimalFixture);
    const parsed = await new VantageMt5CsvParser().parse(bytes, "Asia/Ho_Chi_Minh");
    expect(parsed.positions).toHaveLength(3); expect(parsed.orders).toHaveLength(1);
    expect(parsed.deals).toHaveLength(1); expect(parsed.results).toHaveLength(1);
    expect(parsed.positions[0].openPrice).toBe("4070.75");
    expect(parsed.positions[0].commission).toBe("-1.15");
    expect(parsed.metadata.loginMasked).toBe("***5678");
    expect(parsed.issues.some((issue) => issue.code === "OPEN_POSITION")).toBe(true);
  });
  it("decodes BOM and rejects binary, HTML, and generic CSV", () => {
    expect(decodeUtf8(new Uint8Array([0xef, 0xbb, 0xbf, 65]))).toBe("A");
    expect(() => decodeUtf8(new Uint8Array([65, 0, 66]))).toThrow();
    expect(() => assertVantageMt5Csv("<html>Trade History Report</html>")).toThrow();
    expect(() => assertVantageMt5Csv("a,b\n1,2")).toThrow();
  });
  it("parses the BOM fixture equivalently while hashing original bytes", async () => {
    const plain = new TextEncoder().encode(minimalFixture);
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...plain]);
    expect([...bom.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bomFixture.replace(/^\uFEFF/, "")).toBe(minimalFixture);
    const parser = new VantageMt5CsvParser();
    const [plainResult, bomResult] = await Promise.all([
      parser.parse(plain, "Asia/Ho_Chi_Minh"), parser.parse(bom, "Asia/Ho_Chi_Minh"),
    ]);
    expect(bomResult.positions).toEqual(plainResult.positions);
    expect(await sha256Hex(bom)).not.toBe(await sha256Hex(plain));
  });
});

function section(text: string): ScannedSection {
  const rows = parseCsvRows(text);
  return { header: rows[0], rows: rows.slice(1) };
}

describe("section parsers", () => {
  it.each([
    ["20842041 (USD, VantageMarkets-Live 13, real, Hedge)", {
      loginMasked: "***2041", currency: "USD", server: "VantageMarkets-Live 13",
      environment: "REAL", accountMode: "HEDGE",
    }],
    ["87654321 (EUR, VantageMarkets-Demo 7, demo, Netting)", {
      loginMasked: "***4321", currency: "EUR", server: "VantageMarkets-Demo 7",
      environment: "DEMO", accountMode: "NETTING",
    }],
  ])("parses the real Vantage Account format without masking server digits: %s", (value, expected) => {
    expect(parseMetadata([{ rowNumber: 2, cells: ["Account:", value] }])).toMatchObject(expected);
  });
  it("returns safe nulls for malformed Account metadata", () => {
    expect(parseMetadata([{ rowNumber: 2, cells: ["Account:", "not a Vantage account (Live 13)"] }]))
      .toMatchObject({ loginMasked: null, currency: null, server: null, environment: null, accountMode: null });
  });
  it("parses positions independently", () => {
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    const positions = parsePositions(section(
      "Time,Position,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit\n" +
      "2026.01.01 10:00:00,1,EURUSD,buy,0.10,1.12345,,,2026.01.01 11:00:00,1.12400,- 1.00,0,5",
    ), "UTC", issues);
    expect(positions[0]).toMatchObject({ externalPositionId: "1", side: "BUY", volume: "0.10", valid: true });
  });
  it("parses every supported order field and optional blanks", () => {
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    const orders = parseOrders(section(
      "Time,Order,Symbol,Type,Volume,Volume Current,Price,S / L,T / P,Time,Comment,Magic,Position\n" +
      '2026.01.01 10:00:00,2,EURUSD,buy limit,0.20,0,1.12000,,,2026.01.01 11:00:00,"safe, note",42,1',
    ), "UTC", issues);
    expect(orders[0]).toMatchObject({
      externalOrderId: "2", externalPositionId: "1", volumeInitial: "0.20", volumeCurrent: "0",
      openPrice: "1.12000", stopLoss: null, takeProfit: null, comment: "safe, note", magicNumber: "42", valid: true,
    });
    expect(orders[0].placedAt?.original).toBe("2026.01.01 10:00:00");
  });
  it("parses every supported deal field without treating it as a trade", () => {
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    const deals = parseDeals(section(
      "Time,Deal,Symbol,Type,Direction,Volume,Price,Order,Commission,Swap,Profit,Comment,Magic,Position\n" +
      "2026.01.01 10:00:00,3,EURUSD,sell,out,0.20,1.12000,2,- 1.00,0.01,4.50,safe,42,1",
    ), "UTC", issues);
    expect(deals[0]).toMatchObject({
      externalDealId: "3", externalOrderId: "2", externalPositionId: "1", side: "SELL",
      entryType: "out", volume: "0.20", price: "1.12000", commission: "-1.00",
      swap: "0.01", profit: "4.50", comment: "safe", magicNumber: "42", valid: true,
    });
  });
  it("emits stable issues for unsupported or malformed order/deal values", () => {
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    const orders = parseOrders(section("Time,Order,Type,Volume\nbad,,,abc"), "UTC", issues);
    const deals = parseDeals(section("Time,Deal,Type,Direction,Volume\nbad,,hold,,1e3"), "UTC", issues);
    expect(orders[0].valid).toBe(false); expect(deals[0].valid).toBe(false);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "MISSING_ORDER_ID", "MISSING_ORDER_TYPE", "INVALID_DECIMAL", "INVALID_TIMESTAMP",
      "MISSING_DEAL_ID", "UNSUPPORTED_DEAL_SIDE", "MISSING_DEAL_ENTRY_TYPE",
    ]));
  });
  it("parses results independently", () => {
    expect(parseResults(section("Metric,Value\nBalance,100"))[0]).toMatchObject({ label: "Balance", value: "100" });
  });
  it.each([
    [0, "MISSING_POSITION_OPENED_AT"], [1, "MISSING_POSITION_ID"], [2, "MISSING_POSITION_SYMBOL"],
    [3, "MISSING_POSITION_SIDE"], [4, "MISSING_POSITION_VOLUME"], [5, "MISSING_POSITION_OPEN_PRICE"],
    [9, "MISSING_POSITION_CLOSE_PRICE"], [10, "MISSING_POSITION_COMMISSION"],
    [11, "MISSING_POSITION_SWAP"], [12, "MISSING_POSITION_PROFIT"],
  ])("invalidates a closed position when required column %i is blank", (column, code) => {
    const values = ["2026.01.01 10:00:00", "1", "EURUSD", "buy", "0.1", "1.1", "", "",
      "2026.01.01 11:00:00", "1.2", "0", "0", "1"];
    values[column] = "";
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    const parsed = parsePositions(section(
      `Time,Position,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit\n${values.join(",")}`,
    ), "UTC", issues);
    expect(parsed[0].valid).toBe(false);
    expect(issues).toContainEqual(expect.objectContaining({ code }));
  });
  it("requires closedAt when closePrice proves the position is closed", () => {
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    const parsed = parsePositions(section(
      "Time,Position,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit\n" +
      "2026.01.01 10:00:00,1,EURUSD,buy,0.1,1.1,,,,1.2,0,0,1",
    ), "UTC", issues);
    expect(parsed[0].valid).toBe(false);
    expect(issues).toContainEqual(expect.objectContaining({ code: "MISSING_POSITION_CLOSED_AT" }));
  });
  it("allows open positions without close fields but excludes them from valid trade estimation", () => {
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    const parsed = parsePositions(section(
      "Time,Position,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit\n" +
      "2026.01.01 10:00:00,1,EURUSD,buy,0.1,1.1,,,,,0,0,0",
    ), "UTC", issues);
    expect(parsed[0]).toMatchObject({ valid: true, open: true, closePrice: null, closedAt: null });
    expect(issues).toContainEqual(expect.objectContaining({ code: "OPEN_POSITION", severity: "WARNING" }));
  });
  it.each([
    [0, "MISSING_ORDER_PLACED_AT"], [1, "MISSING_ORDER_ID"], [2, "MISSING_ORDER_SYMBOL"],
    [3, "MISSING_ORDER_TYPE"], [4, "MISSING_ORDER_VOLUME_INITIAL"],
  ])("invalidates an order when required column %i is blank", (column, code) => {
    const values = ["2026.01.01 10:00:00", "2", "EURUSD", "buy", "0.1"];
    values[column] = "";
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    expect(parseOrders(section(`Time,Order,Symbol,Type,Volume\n${values.join(",")}`), "UTC", issues)[0].valid).toBe(false);
    expect(issues).toContainEqual(expect.objectContaining({ code }));
  });
  it.each([
    [0, "MISSING_DEAL_EXECUTED_AT"], [1, "MISSING_DEAL_ID"], [2, "MISSING_DEAL_SYMBOL"],
    [3, "MISSING_DEAL_SIDE"], [4, "MISSING_DEAL_ENTRY_TYPE"], [5, "MISSING_DEAL_VOLUME"],
    [6, "MISSING_DEAL_PRICE"],
  ])("invalidates a deal when required column %i is blank", (column, code) => {
    const values = ["2026.01.01 10:00:00", "3", "EURUSD", "buy", "in", "0.1", "1.1"];
    values[column] = "";
    const issues: import("../../../domain/import/import").ImportIssue[] = [];
    expect(parseDeals(section(`Time,Deal,Symbol,Type,Direction,Volume,Price\n${values.join(",")}`), "UTC", issues)[0].valid).toBe(false);
    expect(issues).toContainEqual(expect.objectContaining({ code }));
  });
});

describe("unknown section scanning", () => {
  it("warns and resumes at the next supported section", () => {
    const report = scanSections(
      "Trade History Report\nPositions\nA,B\n1,2\nExposure\nA,B\nx,y\nOrders\nA,B\n3,4\nResults\nA,B\n5,6",
    );
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "UNKNOWN_SECTION", rowNumber: 5 }));
    expect(report.positions.rows).toHaveLength(1); expect(report.orders.rows).toHaveLength(1);
  });
  it("warns for an unknown section at end of file", () => {
    const report = scanSections("Trade History Report\nPositions\nA,B\n1,2\nStatistics\nA,B\nx,y");
    expect(report.issues.some((issue) => issue.code === "UNKNOWN_SECTION")).toBe(true);
    expect(report.positions.rows).toHaveLength(1);
  });
});
