import type { TradeListInput, TradePage } from "./trade";

export interface TradeRepository {
  listByAccount(input: TradeListInput): Promise<TradePage>;
}
