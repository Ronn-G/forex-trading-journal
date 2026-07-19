CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  source_type TEXT NOT NULL CHECK (source_type = 'MT5_POSITION'),
  source_position_id TEXT NOT NULL,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  volume TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER NOT NULL,
  original_opened_at TEXT NOT NULL,
  original_closed_at TEXT NOT NULL,
  open_price TEXT NOT NULL,
  close_price TEXT NOT NULL,
  stop_loss TEXT,
  take_profit TEXT,
  commission TEXT NOT NULL,
  swap TEXT NOT NULL,
  gross_profit TEXT NOT NULL,
  net_profit TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  status TEXT NOT NULL CHECK (status = 'CLOSED'),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(account_id, source_type, source_position_id),
  CHECK (closed_at >= opened_at)
);

CREATE INDEX idx_trades_account_closed ON trades(account_id, closed_at DESC);
CREATE INDEX idx_trades_account_opened ON trades(account_id, opened_at DESC);
CREATE INDEX idx_trades_account_symbol ON trades(account_id, symbol);
CREATE INDEX idx_trades_account_side ON trades(account_id, side);
CREATE INDEX idx_trades_batch ON trades(import_batch_id);
CREATE INDEX idx_trades_source_position ON trades(source_position_id);
