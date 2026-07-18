CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  source_type TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('PENDING', 'PREVIEWED', 'IMPORTED', 'PARTIAL', 'FAILED', 'ROLLED_BACK')
  ),
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  warning_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  failure_code TEXT,
  failure_message TEXT,
  UNIQUE(account_id, source_sha256)
);

CREATE INDEX idx_import_batches_account_started
  ON import_batches(account_id, started_at DESC);

CREATE TABLE raw_mt5_records (
  id TEXT PRIMARY KEY,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  record_type TEXT NOT NULL,
  external_id TEXT,
  row_number INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(import_batch_id, record_type, row_number),
  UNIQUE(account_id, record_type, external_id)
);

CREATE INDEX idx_raw_mt5_records_batch
  ON raw_mt5_records(import_batch_id);

CREATE INDEX idx_raw_mt5_records_account_type
  ON raw_mt5_records(account_id, record_type);
