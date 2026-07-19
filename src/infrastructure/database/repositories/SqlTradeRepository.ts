import type Database from "@tauri-apps/plugin-sql";
import type { TradeRepository } from "../../../domain/trades/TradeRepository";
import type { Trade, TradeListInput, TradePage } from "../../../domain/trades/trade";
import { getDatabaseConnection } from "../client";

type TradeDatabase = Pick<Database, "select">;
type DatabaseProvider = () => Promise<TradeDatabase>;

interface TradeRow {
  id: string; account_id: string; source_type: "MT5_POSITION"; source_position_id: string;
  import_batch_id: string; symbol: string; side: "BUY" | "SELL"; volume: string;
  opened_at: number; closed_at: number; original_opened_at: string; original_closed_at: string;
  open_price: string; close_price: string; stop_loss: string | null; take_profit: string | null;
  commission: string; swap: string; gross_profit: string; net_profit: string;
  duration_ms: number; status: "CLOSED";
}

const SELECT_COLUMNS = `id, account_id, source_type, source_position_id, import_batch_id,
 symbol, side, volume, opened_at, closed_at, original_opened_at, original_closed_at,
 open_price, close_price, stop_loss, take_profit, commission, swap, gross_profit,
 net_profit, duration_ms, status`;

function mapRow(row: TradeRow): Trade {
  if (!row.id || !row.account_id || row.source_type !== "MT5_POSITION"
    || !["BUY", "SELL"].includes(row.side) || row.status !== "CLOSED"
    || typeof row.duration_ms !== "number") throw new Error("Malformed trade row");
  return {
    id: row.id, accountId: row.account_id, sourceType: row.source_type,
    sourcePositionId: row.source_position_id, importBatchId: row.import_batch_id,
    symbol: row.symbol, side: row.side, volume: row.volume, openedAt: row.opened_at,
    closedAt: row.closed_at, originalOpenedAt: row.original_opened_at,
    originalClosedAt: row.original_closed_at, openPrice: row.open_price,
    closePrice: row.close_price, stopLoss: row.stop_loss, takeProfit: row.take_profit,
    commission: row.commission, swap: row.swap, grossProfit: row.gross_profit,
    netProfit: row.net_profit, durationMs: row.duration_ms, status: row.status,
  };
}

export class SqlTradeRepository implements TradeRepository {
  constructor(private readonly getDb: DatabaseProvider = getDatabaseConnection) {}

  async listByAccount(input: TradeListInput): Promise<TradePage> {
    const db = await this.getDb();
    const where = ["account_id = $1"]; const params: unknown[] = [input.accountId];
    const add = (sql: string, value: unknown) => { params.push(value); where.push(`${sql} $${params.length}`); };
    if (input.symbol) add("symbol LIKE", `%${input.symbol}%`);
    if (input.side) add("side =", input.side);
    if (input.dateFrom !== undefined) add("closed_at >=", input.dateFrom);
    if (input.dateTo !== undefined) add("closed_at <=", input.dateTo);
    const order = {
      CLOSED_DESC: "closed_at DESC, id ASC", CLOSED_ASC: "closed_at ASC, id ASC",
      OPENED_DESC: "opened_at DESC, id ASC",
    }[input.sort];
    if (!order) throw new Error("Unsupported trade sort");
    const rows = await db.select<TradeRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM trades WHERE ${where.join(" AND ")}
       ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, input.limit, input.offset],
    );
    const totals = await db.select<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total FROM trades WHERE ${where.join(" AND ")}`, params,
    );
    return { items: rows.map(mapRow), total: totals[0]?.total ?? 0, limit: input.limit, offset: input.offset };
  }
}
