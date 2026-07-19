# 11. Roadmap

> Status 2026-07-19: Stories 1–6 are done and committed. Optional Story 7 (HTML import) is skipped.
> Story 8 hardening is implemented pending GPT review and manual acceptance. Sprint 1 remains
> incomplete until those gates and final branch verification pass; Sprint 2 is deferred.

## Sprint 0 – Foundation

- Khởi tạo Tauri + React + TypeScript.
- SQLite + @tauri-apps/plugin-sql.
- Migration framework (raw SQL).
- App data directories.
- Logging.
- Error boundary.
- Test framework.
- CI cơ bản.
- Build strategy (Release executable & NSIS installer mandatory; Portable ZIP & MSI optional).

## Sprint 1 – Accounts and MT5 Import

- Account CRUD with archive/unarchive. **Done.**
- Active/archived account filter and `/accounts` navigation.
- Account validation, loading, empty, and database-error states.
- Import file picker.
- CSV parser.
- Preview.
- Raw records.
- Deals.
- Deduplication.
- Import transaction.
- Basic normalization.
- Trade list.
- Story 7 HTML import. **Skipped (optional).**
- Story 8 hardening/docs/verification. **Implemented; pending review/manual acceptance.**

## Sprint 2 – Trade Journal

- Trade detail.
- Notes.
- TradingView links.
- Upload image.
- Paste image.
- Image gallery.
- Tags.
- Quick review.

## Sprint 3 – Setup System

- Setup CRUD.
- Setup version.
- Rules.
- Checklist.
- Attach setup to trade.
- Compliance status.
- Setup metrics.

## Sprint 4 – Analytics

- Dashboard.
- R metrics.
- Win rate.
- Profit factor.
- Expectancy.
- Equity curve.
- Filters.
- Compliant vs non-compliant.

## Sprint 5 – Reviews and Playbook

- Daily review.
- Weekly review.
- Mistake library.
- Best examples.
- Playbook entries.
- Evidence links.

## Sprint 6 – Backup and Reliability

- Export.
- Dry-run import.
- Merge.
- Replace.
- Checksum.
- Restore tests.
- Upgrade tests.

## Sprint 7 – MT5 Local Sync

- Read-only EA or bridge.
- Sync protocol.
- Local authentication.
- Incremental sync.
- Open position state.
- Conflict handling.

## Sprint rule

Mỗi sprint phải có:

- Scope.
- Acceptance criteria.
- Schema changes.
- Tests.
- Migration.
- Documentation update.
- Build artifact.
