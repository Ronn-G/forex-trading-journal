# 10. Test Strategy

## Sprint 1 implemented coverage

- Frontend unit/behavior tests: account domain/services/repository/UI; parser metadata, sections,
  required fields, timestamps and decimals; read-only preview and stale binding; import UI; startup
  orchestration/privacy/retry; trade repository/service/UI, pagination, stale responses,
  accessibility roles and responsive labels.
- Real SQLite migration-SQL/schema integration: exact SQL files 0001–0005 execute; tables, indexes,
  FK, account-scoped unique and implemented CHECK constraints are enforced. This harness does not
  execute production TypeScript `runMigrations` and uses synthetic registry checksums.
- Mock production-migrator boundary: production metadata/checksum calculation and mismatch, ordered
  application, and no rerun for already-applied versions.
- Rust transaction integration: atomic import, `BEGIN IMMEDIATE` concurrency, provenance/conflicts,
  every rollback checkpoint, exact-decimal normalization/backfill, then close/reopen persistence and
  idempotent backfill. The reopen test does not rerun migrations.
- Manual packaged acceptance: account/import/trades/restart/privacy/keyboard/responsive behavior and
  NSIS install/uninstall are recorded in `sprint_1_manual_acceptance.md`.

All fixtures are synthetic. Tests do not use a real report or real account identity. SQLite file tests
create isolated temp databases and close pools before cleanup.

Partial-close/add-on reconstruction, setup/review/analytics, backup/restore and HTML import are future
scope; this document does not claim they are covered by Sprint 1.

## 1. Test pyramid

### Unit tests

Bắt buộc cho:

- R calculation.
- Weighted entry/exit.
- Profit factor.
- Expectancy.
- Drawdown.
- Setup checklist.
- Rule disqualifier.
- Import fingerprint.
- Trade normalization.
- Backup conflict resolution.

### Integration tests

- Database repositories.
- Migrations.
- Import transaction.
- Backup merge.
- Backup replace.
- Image storage.
- Trade + deal mapping.

### End-to-end tests

Luồng chính:

1. Tạo tài khoản.
2. Import MT5 file.
3. Xem trade.
4. Tạo setup.
5. Gắn setup.
6. Thêm ảnh.
7. Review.
8. Xem analytics.
9. Export backup.
10. Restore backup.

## 2. Fixture policy

Fixtures phải chứa:

- Một lệnh vào và thoát toàn bộ.
- Partial close.
- Add-on.
- Commission.
- Swap.
- Break-even.
- Open position.
- Duplicate deal.
- Invalid row.
- Different timezone.
- Netting account.
- Hedging account.

## 3. Regression tests

Mỗi bug production phải có test tái hiện trước khi sửa.

## 4. Acceptance gate

Không merge hoặc tuyên bố hoàn thành nếu:

- Test fail.
- Typecheck fail.
- Build fail.
- Migration fail.
- Import reconciliation fail.
