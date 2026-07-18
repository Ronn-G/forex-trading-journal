CREATE TABLE mt5_positions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  raw_record_id TEXT NOT NULL REFERENCES raw_mt5_records(id),
  external_position_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  volume TEXT NOT NULL,
  open_price TEXT NOT NULL,
  stop_loss TEXT,
  take_profit TEXT,
  opened_at INTEGER NOT NULL,
  original_opened_at TEXT NOT NULL,
  close_price TEXT,
  closed_at INTEGER,
  original_closed_at TEXT,
  commission TEXT NOT NULL,
  swap TEXT NOT NULL,
  profit TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'INVALID', 'UNRESOLVED')),
  created_at INTEGER NOT NULL,
  UNIQUE(account_id, external_position_id),
  CHECK (status <> 'CLOSED' OR (close_price IS NOT NULL AND closed_at IS NOT NULL AND original_closed_at IS NOT NULL))
);
CREATE INDEX idx_mt5_positions_account_opened ON mt5_positions(account_id, opened_at);
CREATE INDEX idx_mt5_positions_account_closed ON mt5_positions(account_id, closed_at);
CREATE INDEX idx_mt5_positions_batch ON mt5_positions(import_batch_id);

CREATE TABLE mt5_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  raw_record_id TEXT NOT NULL REFERENCES raw_mt5_records(id),
  external_order_id TEXT NOT NULL,
  external_position_id TEXT,
  symbol TEXT NOT NULL,
  order_type TEXT NOT NULL,
  volume_initial TEXT NOT NULL,
  volume_current TEXT,
  open_price TEXT,
  stop_loss TEXT,
  take_profit TEXT,
  placed_at INTEGER NOT NULL,
  original_placed_at TEXT NOT NULL,
  closed_at INTEGER,
  original_closed_at TEXT,
  comment TEXT,
  magic_number TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(account_id, external_order_id)
);
CREATE INDEX idx_mt5_orders_batch ON mt5_orders(import_batch_id);
CREATE INDEX idx_mt5_orders_account_position ON mt5_orders(account_id, external_position_id);
CREATE INDEX idx_mt5_orders_account_placed ON mt5_orders(account_id, placed_at);

CREATE TABLE mt5_deals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  raw_record_id TEXT NOT NULL REFERENCES raw_mt5_records(id),
  external_deal_id TEXT NOT NULL,
  external_order_id TEXT,
  external_position_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  entry_type TEXT NOT NULL,
  volume TEXT NOT NULL,
  price TEXT NOT NULL,
  commission TEXT,
  swap TEXT,
  profit TEXT,
  executed_at INTEGER NOT NULL,
  original_executed_at TEXT NOT NULL,
  comment TEXT,
  magic_number TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(account_id, external_deal_id)
);
CREATE INDEX idx_mt5_deals_batch ON mt5_deals(import_batch_id);
CREATE INDEX idx_mt5_deals_account_position ON mt5_deals(account_id, external_position_id);
CREATE INDEX idx_mt5_deals_account_order ON mt5_deals(account_id, external_order_id);
CREATE INDEX idx_mt5_deals_account_executed ON mt5_deals(account_id, executed_at);
