# Sprint 1 Plan — Accounts and MT5 Import

**Project:** Forex Trading Journal
**Branch:** `sprint/01-accounts-and-mt5-import`
**Plan status:** STORIES 1–4 COMMITTED; STORY 5 IMPLEMENTED — PENDING GPT CODE REVIEW
**Prepared from:** repository at commit `124cd49`, project documentation, and the supplied Vantage MT5 CSV/HTML reports.

---

## 1. Executive decision

Sprint 1 will deliver a complete vertical slice from account creation to importing a real Vantage MT5 report and viewing normalized closed trades.

The implementation order is:

1. Trading account management.
2. Import schema and immutable raw storage.
3. Vantage MT5 multi-section CSV parser.
4. Import preview and validation.
5. Atomic import through a Rust/Tauri command.
6. Position-based normalization.
7. Basic trade list.
8. HTML parser only after the CSV path is stable.

### Main technical decisions

- The first supported source format is the supplied **Vantage MT5 Trade History CSV**, not a generic one-table CSV.
- The CSV is a multi-section report containing metadata, `Positions`, `Orders`, `Deals`, and `Results`.
- The supplied account is a **USD real Hedge account**.
- `Positions` is the primary source for the first normalized trade representation.
- `Orders` and `Deals` are still persisted for traceability, reconciliation, and later support for partial close/add-on cases.
- Raw imported records are immutable.
- Import commit must be atomic; `pending + cleanup` is not accepted as a transaction substitute.
- Account CRUD may use the existing TypeScript repository over `@tauri-apps/plugin-sql`.
- Multi-table import commit will use a Tauri Rust command backed by a real SQLite transaction.
- No real trading report will be committed to the repository. Test fixtures must be sanitized and reduced.

---

## 2. Current state

Sprint 0 provides:

- React 19 + TypeScript + Vite frontend.
- Tauri v2 Rust shell.
- SQLite through `@tauri-apps/plugin-sql`.
- Migration runner with migration checksums.
- Typed repository precedent through `MigrationRepository`.
- Router and application shell.
- Initialization failure handling.
- Shared date utilities and error types.
- Vitest and Testing Library.
- Lint, typecheck, frontend build, Tauri build, and NSIS packaging.

Current source structure is intentionally small:

```text
src/
├── app/
├── features/status/
├── infrastructure/database/
├── shared/
├── tests/
├── App.tsx
└── main.tsx

src-tauri/
├── capabilities/
├── src/
│   ├── lib.rs
│   └── main.rs
├── Cargo.toml
└── tauri.conf.json
```

### Constraints inherited from the project constitution

- Raw MT5 data, normalized trading data, and user journal data remain separate.
- Raw MT5 data is never edited after import.
- One MT5 deal must not be assumed to equal one trade.
- All schema changes require migrations and migration tests.
- React components must not contain business logic or query SQLite directly.
- The application remains local-first and offline-capable.
- No MT5 password, investor password, broker API key, or authentication token is stored.
- No ORM or framework change is permitted.

---

## 3. Evidence from the supplied MT5 reports

### 3.1 Account metadata

The report exposes:

- Account currency: `USD`
- Broker/server: `VantageMarkets-Live 13`
- Environment: `real`
- Account mode: `Hedge`

The account number and owner name are sensitive and must not appear in committed fixtures.

### 3.2 CSV format

The CSV:

- Uses UTF-8 with BOM.
- Is not a flat table.
- Contains the following sections in order:
  - report metadata
  - `Positions`
  - `Orders`
  - `Deals`
  - `Results`
- Uses a comma delimiter.
- Can contain embedded spaces in numeric values:
  - `4 070.75`
  - `- 15.15`
- Uses timestamps in the form:
  - `YYYY.MM.DD HH:mm:ss`
- Uses lowercase trade sides such as `buy` and `sell`.
- Contains blank SL/TP values.
- Contains multiple asset precision patterns:
  - XAUUSD prices with two decimals
  - JPY pairs with three decimals
  - major FX pairs with five decimals

### 3.3 HTML format

The HTML report represents the same semantic sections and metadata. It must be treated as untrusted input:

- never render imported HTML directly;
- parse text/table structure only;
- ignore scripts, styles, and event attributes;
- reject malformed documents above configured limits.

### 3.4 Consequence for normalization

Because the `Positions` section already contains:

- position ID;
- open time;
- close time;
- symbol;
- side;
- volume;
- entry price;
- exit price;
- SL;
- TP;
- commission;
- swap;
- profit;

the first normalized trade can be created directly from one closed position row.

This avoids guessing trade boundaries from deals in the first implementation.

`Deals` and `Orders` remain necessary because later versions must support:

- partial close;
- add-on;
- scale-out;
- reversal;
- reconciliation;
- commission or swap distributed across executions.

---

## 4. Sprint goal

A user can:

1. create and manage one or more trading accounts;
2. select an account;
3. choose a Vantage MT5 CSV report;
4. see a safe import preview;
5. confirm import;
6. import without duplicate records or partial writes;
7. restart the app and retain the data;
8. view the imported closed positions as basic normalized trades.

---

## 5. In scope

### 5.1 Account management

- Create account.
- View active accounts.
- Edit account metadata.
- Archive account.
- Unarchive account.
- View archived accounts through an explicit filter.
- Prevent hard deletion from the UI.

Required fields:

- `name`
- `broker`
- `server`
- `login_masked`
- `account_currency`
- `account_type`
- `timezone`
- `is_demo`

System fields:

- `id`
- `is_archived`
- `created_at`
- `updated_at`

### 5.2 Import foundation

- Select target account.
- Select file with `<input type="file">`.
- Validate size and supported type.
- Compute SHA-256 on the original bytes.
- Detect Vantage MT5 multi-section CSV.
- Decode UTF-8 BOM.
- Parse metadata and sections.
- Validate rows.
- Classify valid, duplicate, warning, and error rows.
- Preview counts and sample errors.
- Confirm or cancel import.
- Persist import batch, raw records, positions, orders, deals, and normalized trades atomically.
- Show result summary.

### 5.3 Basic normalized trading data

- Normalize supported closed position rows into trades.
- Display a basic trade list.
- Filter by account.
- Sort by close time descending.
- Show:
  - symbol;
  - direction;
  - volume;
  - open time;
  - close time;
  - entry;
  - exit;
  - commission;
  - swap;
  - net profit;
  - import status.

### 5.4 HTML parser

HTML support is included as the final optional story of Sprint 1. It begins only after the CSV import path passes all quality gates.

Sprint 1 may be accepted without HTML only when:

- CSV end-to-end import is complete;
- docs explicitly record HTML as deferred;
- the roadmap/status is updated;
- no acceptance criterion falsely claims HTML support.

---

## 6. Out of scope

- MT5 login or broker connectivity.
- Realtime synchronization.
- Order placement.
- Cloud sync.
- Mobile app.
- Trade notes and review.
- Images and TradingView links.
- Setup and setup version.
- Behavioral mistake tagging.
- Analytics dashboard.
- R-multiple calculations.
- Equity curve.
- Backup and restore.
- Editing raw MT5 records.
- Full reconstruction of partial close/add-on/reversal trades.
- Automatic timezone discovery from the report.
- Importing arbitrary broker CSV formats.

---

## 7. Acceptance criteria

### Accounts

1. A valid account can be created and remains after restart.
2. Invalid required fields show field-level validation.
3. An account can be edited.
4. An account can be archived and unarchived.
5. Archived accounts are excluded from the default account selector.
6. No UI operation hard deletes an account.
7. Duplicate business identity is handled by an explicit policy.

Recommended identity constraint:

```text
normalized broker + normalized server + normalized login_masked
```

Use a unique index only if the normalization policy is implemented consistently. Otherwise perform duplicate detection in the service and defer the database uniqueness rule.

### Preview

1. A supplied Vantage MT5 CSV is detected correctly.
2. Report metadata is shown without exposing unnecessary sensitive values.
3. Section counts are correct.
4. Unsupported or malformed files are rejected with a clear reason.
5. Numeric values with embedded spaces are parsed correctly.
6. Negative values such as `- 15.15` are parsed as negative decimals.
7. Blank optional values remain null.
8. Preview performs no persistence of trading records.
9. Preview reports:
   - valid;
   - duplicate;
   - warning;
   - error;
   - estimated normalized trades.

### Import

1. Import is committed only after confirmation.
2. All business rows are committed in one database transaction.
3. Any fatal error rolls back the complete import.
4. Importing the same file into the same account is idempotent.
5. The same external IDs may exist in different accounts.
6. Raw records are retained and immutable.
7. Parser version and source SHA-256 are stored.
8. Restarting the app does not create or lose records.
9. No secrets are stored or logged.

### Normalization

1. A valid closed `Positions` row creates one normalized trade.
2. `external_position_id` is unique within an account.
3. Open or malformed positions are not falsely marked as closed trades.
4. A trade retains links to its raw source and imported execution data where available.
5. Complex or unresolved cases are marked instead of guessed.

### Quality

The following pass:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run tauri build
```

Manual smoke testing also passes in the packaged desktop application.

---

## 8. Architecture

### 8.1 Dependency direction

```text
React UI
  ↓
Application services
  ↓
Domain ports/repository interfaces
  ↓
Infrastructure adapters
  ↓
SQLite plugin or Tauri command
  ↓
SQLite
```

### 8.2 Read and CRUD path

Use TypeScript repositories for simple CRUD and read operations:

```text
AccountsScreen
→ AccountService
→ AccountRepository
→ SqlAccountRepository
→ @tauri-apps/plugin-sql
→ SQLite
```

The trade list can use the same pattern.

### 8.3 Preview path

Preview does not write to SQLite:

```text
ImportScreen
→ ImportPreviewService
→ file bytes
→ decoder
→ format detector
→ section parser
→ row validators
→ duplicate query
→ preview model
```

Parsing and normalization preparation should be pure TypeScript wherever possible.

### 8.4 Atomic commit path

```text
ImportScreen
→ ImportService.confirmImport()
→ invoke("commit_mt5_import", payload)
→ Rust command
→ SQLite transaction
→ import batch
→ raw records
→ positions/orders/deals
→ trades/mappings
→ commit
```

The transaction must be implemented in Rust with a transaction-capable SQLite connection.

No TypeScript loop may execute independent inserts and call that atomic.

### 8.5 Boundary validation

- Zod validates UI form inputs.
- Zod validates parser outputs before forming the commit payload.
- Rust validates all command payloads again.
- SQL constraints enforce final persistence invariants.

---

## 9. Database plan

Use small migrations rather than one oversized migration.

### Migration `0002_accounts.sql`

#### `accounts`

```text
id                  TEXT PRIMARY KEY
name                TEXT NOT NULL
broker              TEXT NOT NULL
server              TEXT NOT NULL
login_masked        TEXT NOT NULL
account_currency    TEXT NOT NULL
account_type        TEXT NOT NULL
timezone            TEXT NOT NULL
is_demo             INTEGER NOT NULL CHECK (is_demo IN (0,1))
is_archived         INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1))
created_at          INTEGER NOT NULL
updated_at          INTEGER NOT NULL
```

Indexes:

```text
idx_accounts_archived_name (is_archived, name)
idx_accounts_broker_server (broker, server)
```

Optional unique index after identity normalization is finalized:

```text
(account broker normalized, server normalized, login_masked normalized)
```

### Migration `0003_import_foundation.sql`

#### `import_batches`

```text
id                  TEXT PRIMARY KEY
account_id          TEXT NOT NULL REFERENCES accounts(id)
source_type         TEXT NOT NULL
source_filename     TEXT NOT NULL
source_sha256       TEXT NOT NULL
parser_version      TEXT NOT NULL
status              TEXT NOT NULL
total_rows          INTEGER NOT NULL DEFAULT 0
imported_rows       INTEGER NOT NULL DEFAULT 0
skipped_rows        INTEGER NOT NULL DEFAULT 0
warning_rows        INTEGER NOT NULL DEFAULT 0
error_rows          INTEGER NOT NULL DEFAULT 0
started_at          INTEGER NOT NULL
completed_at        INTEGER
failure_code        TEXT
failure_message     TEXT
```

Constraints:

```text
UNIQUE(account_id, source_sha256)
CHECK status IN (
  'PENDING',
  'PREVIEWED',
  'IMPORTED',
  'PARTIAL',
  'FAILED',
  'ROLLED_BACK'
)
```

For the first atomic implementation, successful commits should normally produce `IMPORTED`. `PARTIAL` remains reserved and is not used until a documented partial-import policy exists.

#### `raw_mt5_records`

```text
id                  TEXT PRIMARY KEY
import_batch_id     TEXT NOT NULL REFERENCES import_batches(id)
account_id          TEXT NOT NULL REFERENCES accounts(id)
record_type         TEXT NOT NULL
external_id         TEXT
row_number          INTEGER NOT NULL
raw_json            TEXT NOT NULL
created_at          INTEGER NOT NULL
```

Constraints and indexes:

```text
UNIQUE(import_batch_id, record_type, row_number)
UNIQUE(account_id, record_type, external_id)
idx_raw_records_batch (import_batch_id)
idx_raw_records_account_type (account_id, record_type)
```

`external_id` may be null for metadata/result rows.

Immutability policy:

- no update repository method;
- no UI edit path;
- optional database trigger rejecting `UPDATE` and `DELETE`, except controlled test/reset tooling;
- raw data deletion only through a future explicit account/data purge design.

### Migration `0004_mt5_entities.sql`

#### `mt5_positions`

The existing database design discusses orders, deals, and trades, but the supplied report proves that a first-class imported position record is valuable.

```text
id                      TEXT PRIMARY KEY
account_id              TEXT NOT NULL REFERENCES accounts(id)
import_batch_id         TEXT NOT NULL REFERENCES import_batches(id)
raw_record_id           TEXT NOT NULL REFERENCES raw_mt5_records(id)
external_position_id    TEXT NOT NULL
symbol                  TEXT NOT NULL
side                    TEXT NOT NULL
volume                  TEXT NOT NULL
open_price              TEXT NOT NULL
stop_loss               TEXT
take_profit             TEXT
opened_at                INTEGER NOT NULL
close_price             TEXT
closed_at                INTEGER
commission              TEXT NOT NULL
swap                    TEXT NOT NULL
profit                  TEXT NOT NULL
status                  TEXT NOT NULL
```

Use decimal strings at the command boundary and an agreed storage strategy:

- preferred SQLite storage: canonical decimal text;
- never binary floating-point for persisted money/price quantities.

Constraints:

```text
UNIQUE(account_id, external_position_id)
CHECK side IN ('BUY','SELL')
CHECK status IN ('OPEN','CLOSED','INVALID','UNRESOLVED')
```

#### `mt5_orders`

Use the documented fields, adding provenance:

```text
id
account_id
import_batch_id
raw_record_id
external_order_id
external_position_id
symbol
order_type
volume_initial
volume_current
open_price
stop_loss
take_profit
placed_at
closed_at
comment
magic_number
```

Unique:

```text
UNIQUE(account_id, external_order_id)
```

#### `mt5_deals`

```text
id
account_id
import_batch_id
raw_record_id
external_deal_id
external_order_id
external_position_id
symbol
side
entry_type
volume
price
commission
swap
profit
executed_at
comment
magic_number
```

Unique:

```text
UNIQUE(account_id, external_deal_id)
```

Indexes:

```text
idx_deals_position (account_id, external_position_id)
idx_deals_order (account_id, external_order_id)
idx_deals_executed_at (account_id, executed_at)
```

### Migration `0005_basic_trades.sql`

#### `trades`

```text
id                      TEXT PRIMARY KEY
account_id              TEXT NOT NULL REFERENCES accounts(id)
source_position_id      TEXT REFERENCES mt5_positions(id)
external_position_id    TEXT NOT NULL
symbol                  TEXT NOT NULL
direction               TEXT NOT NULL
volume                  TEXT NOT NULL
entry_price             TEXT NOT NULL
exit_price              TEXT
open_time               INTEGER NOT NULL
close_time              INTEGER
commission              TEXT NOT NULL
swap                    TEXT NOT NULL
gross_profit            TEXT NOT NULL
net_profit              TEXT NOT NULL
normalization_status    TEXT NOT NULL
review_status           TEXT NOT NULL
created_at              INTEGER NOT NULL
updated_at              INTEGER NOT NULL
```

Unique:

```text
UNIQUE(account_id, external_position_id)
```

Statuses:

```text
normalization_status:
  NORMALIZED
  UNSUPPORTED
  UNRESOLVED
  NEEDS_RECONCILIATION

review_status:
  IMPORTED
  NEEDS_CLASSIFICATION
  NEEDS_REVIEW
  REVIEWED
  LOCKED
  DATA_ERROR
  IGNORED
```

#### `trade_deals`

```text
trade_id                TEXT NOT NULL REFERENCES trades(id)
deal_id                 TEXT NOT NULL REFERENCES mt5_deals(id)
sequence_no             INTEGER NOT NULL
role                    TEXT NOT NULL
PRIMARY KEY (trade_id, deal_id)
```

This table may initially be empty when a position can be normalized but deal linkage cannot yet be proven safely.

---

## 10. Parser design

### 10.1 Parser identity

```text
format: VANTAGE_MT5_TRADE_HISTORY_CSV
parser version: vantage-mt5-trade-history-csv@1
```

### 10.2 Detection

A file is accepted only when multiple signals match:

- UTF-8/UTF-8-BOM decodes successfully;
- first non-empty row contains `Trade History Report`;
- metadata rows include `Account:`;
- section labels include at least `Positions`;
- the following header resembles the expected position columns;
- the document is not HTML/XML.

File extension and MIME type are hints only.

### 10.3 Section scanner

Use a deterministic state machine:

```text
METADATA
→ POSITIONS_HEADER
→ POSITIONS_ROWS
→ ORDERS_HEADER
→ ORDERS_ROWS
→ DEALS_HEADER
→ DEALS_ROWS
→ RESULTS
```

Unknown sections produce a warning rather than silent data loss.

### 10.4 Numeric normalization

Implement one pure function:

```ts
parseMt5Decimal(raw: string): DecimalString | null
```

Rules:

1. trim;
2. remove normal spaces, non-breaking spaces, and narrow non-breaking spaces used as grouping;
3. normalize a separated sign:
   - `- 15.15` → `-15.15`;
4. accept only a strict decimal grammar;
5. preserve canonical text;
6. reject `NaN`, `Infinity`, exponent notation unless explicitly supported;
7. never call `parseFloat` and persist the result as authoritative financial data.

### 10.5 Date parsing

Input pattern:

```text
YYYY.MM.DD HH:mm:ss
```

The report does not prove its UTC offset. Account timezone is therefore mandatory.

Pipeline:

```text
broker-local timestamp
→ parse with account timezone
→ UTC epoch milliseconds
```

Timezone must not be hard-coded from the broker name.

### 10.6 Row classification

#### Valid

All required fields parse and satisfy domain constraints.

#### Duplicate

An existing account-scoped external ID is found, or the same source hash was already imported.

#### Warning

Examples:

- optional SL/TP missing;
- order/deal linkage unavailable;
- result section ignored;
- metadata differs from selected account;
- unresolved timezone confirmation;
- position is open;
- record is structurally valid but not normalizable.

#### Error

Examples:

- missing external ID;
- invalid timestamp;
- invalid decimal;
- unsupported side;
- close time before open time;
- malformed row width;
- file truncation;
- unexpected repeated section header.

### 10.7 Preview model

```ts
interface ImportPreview {
  source: {
    filename: string;
    sizeBytes: number;
    sha256: string;
    detectedFormat: string;
    parserVersion: string;
  };
  reportAccount: {
    maskedLogin: string | null;
    currency: string | null;
    server: string | null;
    environment: string | null;
    mode: string | null;
  };
  counts: {
    positionRows: number;
    orderRows: number;
    dealRows: number;
    valid: number;
    duplicate: number;
    warning: number;
    error: number;
    estimatedTrades: number;
  };
  sampleIssues: ImportIssue[];
  commitTokenOrPayload: PreparedImport;
}
```

The UI must not display the full raw file or all raw JSON by default.

---

## 11. Atomic transaction design

### 11.1 Rust command

Proposed command:

```rust
#[tauri::command]
async fn commit_mt5_import(
    app: tauri::AppHandle,
    payload: CommitMt5ImportPayload
) -> Result<CommitMt5ImportResult, ImportCommandError>
```

Responsibilities:

1. validate payload size and structure;
2. open the same application database;
3. enable foreign keys;
4. begin transaction;
5. verify account exists and is not archived;
6. enforce source hash idempotency;
7. insert import batch;
8. insert raw records;
9. insert parsed positions, orders, and deals;
10. insert safe normalized trades;
11. insert proven trade/deal links;
12. update final batch counters/status;
13. commit;
14. return persisted counts.

Any failure before commit causes rollback.

### 11.2 Avoid duplicate database ownership

Before implementation, the agent must decide and document how Rust opens the same SQLite file currently used by the SQL plugin.

Required checks:

- identical database path;
- safe SQLite journal mode;
- foreign keys enabled;
- no second unintended database file;
- expected locking behavior;
- connection timeout.

### 11.3 Payload limits

Do not send an unlimited multi-megabyte object over IPC without limits.

Recommended first limits:

- maximum input file: 20 MB;
- maximum total parsed records: 100,000;
- maximum issue samples returned to UI: 100;
- full issue count retained separately.

These values may be adjusted after testing the supplied report.

---

## 12. UI plan

### 12.1 Routes

```text
/accounts
/import
/trades
```

### 12.2 Accounts screen

Components:

- page header;
- active/archived filter;
- account table/cards;
- create account button;
- edit action;
- archive/unarchive action;
- empty state;
- error state.

### 12.3 Account form

Fields:

- display name;
- broker;
- server;
- masked login;
- currency;
- account type;
- timezone;
- demo/real.

Use an IANA timezone selector or validated text input. Do not use ambiguous `GMT+2` as the only stored identity if daylight-saving behavior matters.

### 12.4 Import screen

Stages:

```text
SELECT_ACCOUNT
→ SELECT_FILE
→ PARSING
→ PREVIEW
→ COMMITTING
→ RESULT
```

Preview shows:

- filename;
- size;
- detected format;
- account metadata mismatch warning;
- section counts;
- valid/duplicate/warning/error;
- sample issues;
- estimated trades;
- confirm/cancel.

### 12.5 Trade list

Columns:

- close time;
- account;
- symbol;
- direction;
- volume;
- entry;
- exit;
- net P&L;
- normalization status.

Filters:

- account;
- symbol text;
- direction;
- date range;
- normalization status.

Only account filtering is required for Sprint acceptance; the others may be deferred if scope pressure appears.

---

## 13. File-level implementation plan

Paths are proposed to fit the current repository. The implementation agent may make minor naming changes, but must preserve responsibilities.

### Story 1 files

Create:

```text
src/domain/accounts/account.ts
src/domain/accounts/AccountRepository.ts
src/application/accounts/AccountService.ts
src/infrastructure/database/repositories/SqlAccountRepository.ts
src/features/accounts/AccountsScreen.tsx
src/features/accounts/AccountForm.tsx
src/features/accounts/AccountList.tsx
src/features/accounts/accounts.test.tsx
src/infrastructure/database/migrations/0002_accounts.sql
src/infrastructure/database/repositories/SqlAccountRepository.test.ts
```

Modify:

```text
src/app/router/index.tsx
src/app/shell/AppShell.tsx
src/infrastructure/database/migrator.ts
docs/03-DATABASE-DESIGN.md
docs/11-ROADMAP.md
```

### Story 2 files

Create:

```text
src/domain/import/import.ts
src/domain/import/ImportRepository.ts
src/domain/import/parser.ts
src/application/import/ImportPreviewService.ts
src/infrastructure/database/repositories/SqlImportReadRepository.ts
src/infrastructure/database/migrations/0003_import_foundation.sql
src/infrastructure/database/repositories/SqlImportReadRepository.test.ts
```

### Story 3 files

Create:

```text
src/infrastructure/import/detectFormat.ts
src/infrastructure/import/encoding.ts
src/infrastructure/import/mt5Csv/sectionScanner.ts
src/infrastructure/import/mt5Csv/parseMetadata.ts
src/infrastructure/import/mt5Csv/parsePositions.ts
src/infrastructure/import/mt5Csv/parseOrders.ts
src/infrastructure/import/mt5Csv/parseDeals.ts
src/infrastructure/import/mt5Csv/parseDecimal.ts
src/infrastructure/import/mt5Csv/parseTimestamp.ts
src/infrastructure/import/mt5Csv/vantageMt5CsvParser.ts
src/infrastructure/import/mt5Csv/*.test.ts
src/tests/fixtures/mt5/vantage-report-minimal.csv
src/tests/fixtures/mt5/vantage-report-invalid.csv
```

Fixture rules:

- synthetic account identity;
- synthetic IDs;
- small number of records;
- no real owner name, account number, or complete trading history;
- preserve section layout and number formats.

### Story 4 files

Create:

```text
src/features/import/ImportScreen.tsx
src/features/import/ImportFilePicker.tsx
src/features/import/ImportPreview.tsx
src/features/import/ImportIssueList.tsx
src/features/import/ImportResult.tsx
src/features/import/import.test.tsx
```

Modify:

```text
src/app/router/index.tsx
src/app/shell/AppShell.tsx
```

### Story 5 files

Create:

```text
src/infrastructure/database/migrations/0004_mt5_entities.sql
src-tauri/src/import/mod.rs
src-tauri/src/import/models.rs
src-tauri/src/import/command.rs
src-tauri/src/import/repository.rs
src-tauri/src/import/error.rs
```

Modify:

```text
src-tauri/src/lib.rs
src-tauri/Cargo.toml
src-tauri/capabilities/default.json
```

Cargo dependency changes require justification. Prefer the SQLite stack already transitively compatible with Tauri where practical; otherwise add the smallest explicit transaction-capable dependency.

### Story 6 files

Create:

```text
src/domain/trades/trade.ts
src/domain/trades/TradeRepository.ts
src/application/trades/TradeQueryService.ts
src/infrastructure/database/repositories/SqlTradeRepository.ts
src/infrastructure/database/migrations/0005_basic_trades.sql
src/features/trades/TradeListScreen.tsx
src/features/trades/TradeFilters.tsx
src/features/trades/TradeTable.tsx
src/features/trades/trades.test.tsx
```

Modify:

```text
src/app/router/index.tsx
src/app/shell/AppShell.tsx
```

### Story 7 files

Create:

```text
src/infrastructure/import/mt5Html/vantageMt5HtmlParser.ts
src/infrastructure/import/mt5Html/tableScanner.ts
src/infrastructure/import/mt5Html/*.test.ts
src/tests/fixtures/mt5/vantage-report-minimal.html
```

Do not render the fixture HTML in the app.

---

## 14. Story breakdown and commits

## Story 1 — Account foundation

**Goal:** persistent account CRUD with archive/unarchive.

**Acceptance:** all account criteria pass.

**Implementation status (2026-07-18):**

- Account domain validation, repository port, application service, and parameterized SQLite adapter implemented.
- Create, edit, archive, unarchive, active/archived filter, loading, empty, validation, and database error states implemented at `/accounts`.
- Migration `0002_accounts.sql` registered with the migration runner.
- Domain, service, repository, migration, and UI automated tests added.
- Stories 2–8 remain intentionally unimplemented.

**Commit:**

```text
feat: add trading account management
```

## Story 2 — Import domain and persistence foundation

**Goal:** migrations and domain models for batches and raw records.

**Acceptance:** migration upgrade from schema v1 succeeds; raw repository has no update path.

**Implementation status (2026-07-18): IMPLEMENTED — PENDING GPT CODE REVIEW.**

Migration 0003, import domain models, and account-scoped read/dedup repository are implemented.
Raw-record immutability is enforced at the repository/application boundary. Preview creates no batch.

**Commit:**

```text
feat: add import batch and raw record foundation
```

## Story 3 — Vantage CSV parser

**Goal:** parse supplied report structure into a validated preview model.

**Acceptance:** sanitized fixtures cover metadata, positions, orders, deals, grouping spaces, negative values, blank cells, and mixed price precision.

**Implementation status (2026-07-18): IMPLEMENTED — PENDING GPT CODE REVIEW.**

The supported identity is `VANTAGE_MT5_TRADE_HISTORY_CSV`, parser version
`vantage-mt5-trade-history-csv@1`. Section parsers are isolated, unknown sections emit warnings,
and UTF-8/BOM fixtures contain synthetic identities only. Broker-local timestamps retain their
original text and are converted with the selected account IANA timezone.

**Commit:**

```text
feat: parse Vantage MT5 trade history CSV
```

## Story 4 — Import preview UI

**Goal:** user can select account/file and inspect preview without persistence.

**Acceptance:** loading, empty, error, retry, cancel, and mismatch warning states work.

**Implementation status (2026-07-18): IMPLEMENTED — PENDING GPT CODE REVIEW.**

Route `/import` provides account selection, local file parsing, safe preview, issue samples, and reset.
Duplicate checks are account-scoped. Preview is read-only and has no commit side effect.
Story 5 and its Rust transaction remain unimplemented; Sprint 1 is not complete.

`duplicateFile` reports file-level duplication as a boolean; `counts.duplicate` counts record-level
external ID duplicates only. Story 5 must enforce raw-record/import-batch account identity inside the
future transaction.

**Commit:**

```text
feat: add MT5 import preview flow
```

## Story 5 — Atomic import

**Goal:** commit all import data with a real SQLite transaction.

**Acceptance:** injected failure mid-import leaves zero business rows; duplicate import is idempotent.

**Implementation status (2026-07-18): IMPLEMENTED — PENDING GPT CODE REVIEW.**

The Rust `commit_mt5_import` command opens the same app-config SQLite file as plugin-sql and commits
batch/raw/position/order/deal writes in one sqlx transaction. Failures roll back completely and are not
persisted as failed audit attempts. Story 6 trades and normalization remain unimplemented.

**Commit:**

```text
feat: commit MT5 imports atomically
```

## Story 6 — Position normalization and trade list

**Goal:** create basic trades from safe closed positions and display them.

**Acceptance:** no complex case is guessed; unsupported cases remain visible.

**Commit:**

```text
feat: normalize imported positions and list trades
```

## Story 7 — HTML support

**Goal:** parse the supplied MT5 HTML report into the same intermediate model.

**Acceptance:** HTML and CSV representing equivalent data produce equivalent canonical position records for the fixture subset.

**Commit:**

```text
feat: support Vantage MT5 HTML reports
```

## Story 8 — Sprint hardening and documentation

**Goal:** full regression, packaged smoke test, docs update.

**Commit:**

```text
docs: finalize sprint 1 accounts and MT5 import
```

---

## 15. Test plan

### 15.1 Unit tests

Accounts:

- required field validation;
- currency normalization;
- archive state transitions;
- masked login rules;
- timezone validation.

Parser:

- BOM decoding;
- format detection;
- section boundaries;
- decimal grouping spaces;
- separated negative sign;
- blank decimal;
- mixed precision;
- timestamp parsing;
- row width errors;
- repeated section;
- truncated file;
- metadata parsing;
- account mode parsing.

Normalization:

- closed position;
- open position;
- close before open;
- duplicate position ID;
- missing position ID;
- unsupported side;
- net P&L calculation rule.

### 15.2 Repository integration tests

- migration from v1 to latest;
- account insert/update/archive;
- foreign-key rejection;
- duplicate source hash;
- duplicate deal in same account;
- same deal ID across different accounts;
- raw record immutability;
- trade query filter by account.

### 15.3 Rust transaction tests

- full successful commit;
- duplicate source rollback;
- failure after raw inserts;
- failure after position inserts;
- failure before trade inserts;
- all failures leave no partial business state;
- completed batch counters match rows;
- invalid payload rejected before transaction.

### 15.4 UI tests

- account empty state;
- create/edit/archive/unarchive;
- no active account import state;
- unsupported file;
- parsing progress;
- preview counts;
- issue samples;
- cancel;
- confirm;
- commit error and retry;
- result summary;
- trade list empty and populated states.

### 15.5 Manual tests

1. Start from a clean database.
2. Verify migration success.
3. Create the Vantage account.
4. Restart app.
5. Confirm persistence.
6. Import sanitized CSV.
7. Compare preview counts with fixture expectations.
8. Confirm import.
9. Verify trade list.
10. Restart app.
11. Re-import same file.
12. Confirm duplicates and no new records.
13. Import equivalent file into a different account.
14. Confirm account-scoped uniqueness.
15. Archive account and confirm it is excluded from default import selection.
16. Run packaged NSIS app and repeat smoke flow.

---

## 16. Security and data integrity

- Maximum file size enforced before parsing.
- Maximum record count enforced.
- Extension and MIME type are not trusted alone.
- HTML is never inserted into the DOM as trusted markup.
- Raw files are not logged.
- Issue messages omit unnecessary account identity.
- Real sample reports remain outside the repository.
- SQL is parameterized.
- Multi-table commit uses a real transaction.
- Source bytes are hashed before parsing.
- SHA-256 is account-scoped for import idempotency.
- External IDs are account-scoped.
- Raw records are immutable.
- UTC timestamps are stored only after timezone resolution.
- File parsing is deterministic and versioned.
- Parser changes that alter canonical output require a parser-version bump and regression fixtures.

---

## 17. Risks

### BLOCKER

**Timezone offset is not verified.**

The report contains local-looking timestamps but no proven UTC offset. Before importing real data, the user must set the account timezone accurately.

Mitigation:

- make timezone mandatory;
- show timezone in preview;
- require confirmation on first import;
- retain original timestamp text in raw JSON.

### HIGH

**Rust and SQL plugin may accidentally target different SQLite paths.**

Mitigation:

- integration test exact file path;
- expose a temporary health diagnostic in development;
- document connection ownership;
- verify imported data is visible through the TypeScript read repository.

### HIGH

**Report format may vary by MT5 build, language, or broker.**

Mitigation:

- parser identified as Vantage English report v1;
- strict detector;
- clear unsupported-format error;
- sanitized fixtures from multiple exports before broadening support.

### HIGH

**Position rows simplify the first normalization but do not solve all execution relationships.**

Mitigation:

- store orders and deals;
- keep normalization status;
- never infer unsupported mappings;
- add full execution normalization in a later sprint.

### MEDIUM

**The real report is large.**

Mitigation:

- benchmark parse time;
- cap size and records;
- avoid rendering thousands of issue rows;
- use summary plus samples.

### MEDIUM

**Financial decimal precision.**

Mitigation:

- canonical decimal strings;
- no authoritative binary floats;
- central arithmetic strategy before analytics begins.

### LOW

**HTML parser increases scope.**

Mitigation:

- implement last;
- defer cleanly if CSV meets the core goal.

---

## 18. Open decisions before Story 5

1. Confirm the account timezone as an IANA timezone or a documented fixed broker offset.
2. Confirm whether open positions should be imported in Sprint 1:
   - recommended: persist them as `OPEN`, exclude them from the default closed-trade list.
3. Confirm whether archived accounts may still be viewed in the trade list:
   - recommended: yes.
4. Confirm whether the real report will only be used locally for manual verification:
   - required: yes, never commit it.
5. Decide whether HTML support is mandatory for Sprint 1 acceptance:
   - recommended: optional after CSV is complete.

---

## 19. Definition of Done for Sprint 1

Sprint 1 is complete only when:

- all accepted stories meet their criteria;
- database migrations upgrade a schema-v1 database;
- raw MT5 records cannot be edited through application code;
- duplicate import is idempotent;
- atomic rollback is demonstrated by automated tests;
- supported CSV fixture imports end-to-end;
- imported trades remain after restart;
- no secret or real report is committed;
- empty/loading/error states exist;
- lint passes;
- typecheck passes;
- all tests pass;
- frontend build passes;
- Tauri build passes;
- packaged app smoke test passes;
- database, import, roadmap, and decision documentation are updated;
- GPT review finds no unresolved BLOCKER or HIGH-severity defect.

---

## 20. Recommended execution order

```text
Story 1
→ GPT review
→ commit

Story 2
→ GPT review
→ commit

Story 3
→ GPT parser review
→ commit

Story 4
→ manual preview test
→ GPT review
→ commit

Story 5
→ transaction failure tests
→ GPT review
→ commit

Story 6
→ end-to-end import test
→ GPT review
→ commit

Story 7 (optional)
→ cross-format equivalence tests
→ GPT review
→ commit

Story 8
→ full quality gate
→ tag or merge preparation
```

---

## Final recommendation

Proceed with **Story 1 — Account foundation** first.

Do not begin the Rust import transaction until:

- account timezone behavior is confirmed;
- the database path sharing design is written down;
- the sanitized fixture set exists;
- the CSV parser produces a stable canonical payload.

**Status: READY FOR IMPLEMENTATION, with timezone verification required before importing real data.**
