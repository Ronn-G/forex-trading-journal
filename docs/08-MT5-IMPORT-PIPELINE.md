# MT5 Import Pipeline

## Current support

- Format: Vantage MT5 Trade History CSV in English.
- Parser: `vantage-mt5-trade-history-csv@1`.
- Limits: 20 MB and 100,000 CSV rows.
- Encoding: UTF-8 and UTF-8 BOM.
- Sections: metadata, Positions, Orders, Deals, Results.
- Section modules: `parsePositions`, `parseOrders`, `parseDeals`, and `parseResults`.
- Unknown sections: stable `UNKNOWN_SECTION` warning; parsing resumes at the next supported section.
- Hash: SHA-256 over original bytes using Web Crypto.
- Time: `YYYY.MM.DD HH:mm:ss` interpreted with the selected account IANA timezone.

## Safety and persistence

Preview is local and read-only. It does not upload the report, log its contents, create an import
batch, or write trading records. Duplicate files and external IDs are checked within the selected
account only. Login values are masked before display.

File hashes and external IDs are scoped to the selected account for duplicate decisions. The same
hash or external ID in another account is not a duplicate.

Preview exposes two deliberately separate duplicate signals:

- `duplicateFile` is a boolean indicating whether the selected account already has an import batch
  with the same source SHA-256.
- `counts.duplicate` counts existing position, order, and deal external IDs for that account. It does
  not include the file-level boolean.

Raw records are immutable through the repository/application boundary: no update or delete port is
provided. Database mutation triggers are deferred to avoid obstructing the Story 5 transaction and
controlled migration/test cleanup.

Fixtures contain only synthetic owners, account numbers, and record IDs. No real report is committed.

## Status and limitations

Stories 2–4 are committed. Story 5 atomic persistence is implemented and pending GPT review.
Sprint 1 is not complete; Story 6 normalization and trade list remain unimplemented.

Only the named Vantage English CSV variant is supported. HTML/XML and arbitrary broker CSV files are
rejected. Open positions are warnings and excluded from estimated closed trades. Preview issue samples
are capped at 100 while full summary counts are retained.

Migration tests use the existing mocked migration-runner harness; they validate SQL text, registration,
ordering, and already-applied behavior, but are not claimed as real SQLite integration tests.

Story 5 must validate inside its database transaction that every raw record `accountId` equals the
referenced import batch `accountId`; trusting only the preview payload is not sufficient.

## Story 5 transaction policy

- Each import starts a SQLite `BEGIN IMMEDIATE` transaction before account, source-hash, or entity
  duplicate checks. SQLite therefore serializes import writers; a concurrent command waits under the
  configured busy timeout and performs its checks only after the previous writer commits or rolls back.
- One Rust/sqlx transaction inserts the batch, raw records, positions, orders, and deals.
- Any error drops/rolls back the transaction; no `PENDING` or partial rows remain.
- Failed attempts are not persisted as audit batches.
- Duplicate source hashes return `DUPLICATE_IMPORT`; existing entity IDs return `ENTITY_CONFLICT`.
- A raw `POSITION`, `ORDER`, or `DEAL` uniqueness conflict is also `ENTITY_CONFLICT`; database error
  text is never returned to the frontend.
- External IDs and source hashes remain account-scoped.
- The payload contains one top-level account ID; entity rows cannot supply a different account.
- Raw records have no update/delete command and no `INSERT OR REPLACE` behavior.
- Canonical financial values remain decimal `TEXT`.

## Story 5 raw storage policy

Story 5 does not store the original file or claim to persist every source row. It stores immutable raw
JSON only for records in the canonical commit payload:

- valid, non-duplicate positions, orders, and deals selected by preview;
- parsed Results rows included in the prepared payload.

Rows rejected as invalid and rows skipped as existing duplicates are represented by preview/batch
counts and issues but are not inserted into `raw_mt5_records`. Raw entity records must use the matching
`POSITION`, `ORDER`, or `DEAL` type and external ID; Results records must have no external ID.
