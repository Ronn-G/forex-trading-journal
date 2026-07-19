import type { TradeRepository } from "../../domain/trades/TradeRepository";
import type { TradeListInput, TradePage, TradeSide, TradeSort } from "../../domain/trades/trade";

export interface TradeQuery {
  readonly accountId: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly symbol?: string;
  readonly side?: TradeSide;
  readonly dateFrom?: number;
  readonly dateTo?: number;
  readonly sort?: TradeSort;
}

export class TradeQueryError extends Error {
  constructor(message: string) { super(message); this.name = "TradeQueryError"; }
}

export class TradeListError extends Error {
  constructor(public readonly cause?: unknown) {
    super("Không thể tải danh sách giao dịch."); this.name = "TradeListError";
  }
}

export class ListTradesService {
  constructor(private readonly repository: TradeRepository) {}

  async execute(query: TradeQuery): Promise<TradePage> {
    const accountId = query.accountId.trim();
    if (!accountId) throw new TradeQueryError("Account ID is required.");
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 1 || limit > 200
      || !Number.isFinite(offset) || !Number.isInteger(offset) || offset < 0) {
      throw new TradeQueryError("Pagination is invalid.");
    }
    if (query.side !== undefined && !["BUY", "SELL"].includes(query.side)) {
      throw new TradeQueryError("Side is invalid.");
    }
    if (query.sort !== undefined && !["CLOSED_DESC", "CLOSED_ASC", "OPENED_DESC"].includes(query.sort)) {
      throw new TradeQueryError("Sort is invalid.");
    }
    for (const date of [query.dateFrom, query.dateTo]) {
      if (date !== undefined && (!Number.isFinite(date) || !Number.isInteger(date) || date < 0)) {
        throw new TradeQueryError("Date range is invalid.");
      }
    }
    if (query.dateFrom !== undefined && query.dateTo !== undefined && query.dateFrom > query.dateTo) {
      throw new TradeQueryError("Date range is invalid.");
    }
    const symbol = query.symbol?.trim() || undefined;
    if (symbol && symbol.length > 64) throw new TradeQueryError("Symbol is too long.");
    const input: TradeListInput = {
      accountId, limit, offset, symbol, side: query.side,
      dateFrom: query.dateFrom, dateTo: query.dateTo, sort: query.sort ?? "CLOSED_DESC",
    };
    try { return await this.repository.listByAccount(input); }
    catch (error) { throw new TradeListError(error); }
  }
}
