export type TradeSide = "BUY" | "SELL";
export type TradeSourceType = "MT5_POSITION";
export type TradeStatus = "CLOSED";
export type TradeSort = "CLOSED_DESC" | "CLOSED_ASC" | "OPENED_DESC";

export interface Trade {
  readonly id: string;
  readonly accountId: string;
  readonly sourceType: TradeSourceType;
  readonly sourcePositionId: string;
  readonly importBatchId: string;
  readonly symbol: string;
  readonly side: TradeSide;
  readonly volume: string;
  readonly openedAt: number;
  readonly closedAt: number;
  readonly originalOpenedAt: string;
  readonly originalClosedAt: string;
  readonly openPrice: string;
  readonly closePrice: string;
  readonly stopLoss: string | null;
  readonly takeProfit: string | null;
  readonly commission: string;
  readonly swap: string;
  readonly grossProfit: string;
  readonly netProfit: string;
  readonly durationMs: number;
  readonly status: TradeStatus;
}

export interface TradeListInput {
  readonly accountId: string;
  readonly limit: number;
  readonly offset: number;
  readonly symbol?: string;
  readonly side?: TradeSide;
  readonly dateFrom?: number;
  readonly dateTo?: number;
  readonly sort: TradeSort;
}

export interface TradePage {
  readonly items: readonly Trade[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}
