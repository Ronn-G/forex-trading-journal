# 04. Application Architecture

## Sprint 1 runtime architecture

React components never execute SQL. Account CRUD, import-preview duplicate reads and trade reads flow
through application services and typed TypeScript repositories using `@tauri-apps/plugin-sql`.
User values are bound parameters; trade sorting is a fixed whitelist and symbol search is escaped
literal-contains.

Atomic import and normalization use a typed Tauri command backed by Rust/sqlx. Rust opens the same
`app_config_dir/database/journal.db` used by plugin-sql, enables foreign keys/WAL/busy timeout, and
acquires `BEGIN IMMEDIATE` before duplicate checks and all writes.

Startup order is:

1. plugin-sql opens the relative database path;
2. TypeScript verifies/applies migrations and checks immutable checksums;
3. Rust performs idempotent missing-trade backfill;
4. the router renders only after both steps succeed.

Migration/backfill failure renders a retry screen with a stable safe message. Raw SQL, stack traces,
payloads and filesystem paths are not rendered. The trade route is
`TradesScreen → ListTradesService → TradeRepository → SqlTradeRepository`.

Story 7 HTML import is skipped. Only Vantage MT5 Trade History CSV in English is supported.

## 1. Stack

- Tauri.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- SQLite.
- @tauri-apps/plugin-sql.
- Zod.
- Vitest.
- Playwright.

## 2. Kiến trúc module

```text
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── shell/
├── features/
│   ├── accounts/
│   ├── imports/
│   ├── trades/
│   ├── setups/
│   ├── reviews/
│   ├── analytics/
│   ├── playbook/
│   └── settings/
├── domain/
│   ├── account/
│   ├── import/
│   ├── trade/
│   ├── setup/
│   ├── review/
│   └── analytics/
├── infrastructure/
│   ├── database/
│   ├── filesystem/
│   ├── mt5/
│   └── backup/
├── shared/
│   ├── ui/
│   ├── validation/
│   ├── errors/
│   ├── dates/
│   └── types/
└── tests/
```

## 3. Dependency rule

Hướng phụ thuộc:

```text
UI → Application Services → Domain → Interfaces
Infrastructure → Interfaces
```

Domain không được import:

- React.
- Tauri.
- plugin-sql.
- File system.
- HTTP client.

## 4. Repository pattern

Repository chỉ dùng cho persistence boundary có giá trị rõ ràng:

- TradeRepository.
- ImportRepository.
- SetupRepository.
- ReviewRepository.
- BackupRepository.

Không tạo repository cho mọi bảng nhỏ nếu không cần.

## 5. Application services

Ví dụ:

- `PreviewMt5ImportService`
- `CommitMt5ImportService`
- `NormalizeTradesService`
- `AttachTradeImageService`
- `ReviewTradeService`
- `CalculateTradeMetricsService`
- `ExportBackupService`
- `ImportBackupService`

## 6. UI state

- Server/database state dùng query layer thống nhất.
- Form state dùng React Hook Form.
- Validation schema dùng Zod.
- Không nhân đôi domain state trong nhiều store.
- Global state chỉ dành cho app shell, filters dùng chung hoặc user preferences.

## 7. Error handling

Các nhóm lỗi:

- ValidationError.
- ImportParseError.
- DuplicateImportError.
- DataIntegrityError.
- MigrationError.
- FileStorageError.
- BackupCompatibilityError.

UI phải hiển thị thông báo dễ hiểu và ghi log kỹ thuật riêng.

## 8. Image storage

Cấu trúc:

```text
app-data/
├── database/
├── images/
│   └── trades/
│       └── <trade-id>/
├── backups/
├── imports/
└── logs/
```

Tên file nội bộ dùng UUID hoặc hash, không phụ thuộc tên file gốc.

## 9. Không được làm

- Không query database trực tiếp trong React component.
- Không tính analytics trong UI component.
- Không nhét logic import vào route handler.
- Không lưu toàn bộ app state trong localStorage.
- Không dùng localStorage làm nguồn dữ liệu chính.
- Không sửa database bằng SQL rời rạc ngoài migration hoặc repository.

## 10. Story 4 import preview boundary

```text
React ImportScreen
-> ImportPreviewService
-> domain parser/read ports
-> Vantage CSV parser and SqlImportReadRepository
-> SQLite read queries
```

The preview path is read-only. React does not query SQLite, the parser does not import React/Tauri/SQL,
and the read repository exposes no raw-record update or delete operation. Parser sections are isolated
into `parsePositions`, `parseOrders`, `parseDeals`, and `parseResults`.

## 11. Story 5 atomic import boundary

```text
ImportScreen
-> ImportService
-> invoke("commit_mt5_import")
-> Rust validation
-> sqlx SQLite transaction
-> import batch + immutable raw records + MT5 positions/orders/deals
```

`tauri-plugin-sql 2.4.0` resolves `sqlite:database/journal.db` under
`app.path().app_config_dir()`. The Rust database helper uses the identical
`app_config_dir/database/journal.db` contract in development and packaged builds.
The command enables foreign keys, a five-second busy timeout, and WAL mode.
It acquires the SQLite writer with `BEGIN IMMEDIATE` before duplicate checks, so concurrent import
commands cannot both pass the source/entity prechecks. Lock failures are mapped to a safe typed
transaction error without exposing SQLite details.

Story 5 itself wrote no normalized trades; Story 6 extends that transaction as described below.

## 12. Story 6 normalization and read boundary

`commit_mt5_import` now normalizes valid CLOSED positions after MT5 entity inserts and before batch
finalization in the same `BEGIN IMMEDIATE` transaction. `rust_decimal` calculates canonical
`net_profit = profit + commission + swap` without binary floating-point. Open positions create no
closed trade. The `/trades` route reads through `ListTradesService` and `SqlTradeRepository`; React
does not query SQLite directly. Story 7 remains unimplemented.

After TypeScript migrations complete, application bootstrap invokes Rust `backfill_missing_trades`.
The command uses `BEGIN IMMEDIATE` and the same shared normalization/insert helpers as new imports to
create missing trades for Story 5 CLOSED positions, including archived-account history. It never
overwrites an existing trade and is safe to rerun.
