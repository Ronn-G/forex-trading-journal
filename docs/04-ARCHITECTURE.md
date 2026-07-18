# 04. Application Architecture

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

Story 5 writes no normalized trades. Story 6 remains unimplemented.
