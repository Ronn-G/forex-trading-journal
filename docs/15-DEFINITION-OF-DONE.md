# 15. Definition of Done

Một story chỉ được coi là Done khi:

## Functional

- Đúng acceptance criteria.
- Không làm hỏng luồng cũ.
- Có empty/loading/error states.
- Validation rõ ràng.

## Data

- Schema đúng tài liệu.
- Có migration nếu cần.
- Không mất dữ liệu.
- Có transaction nếu thao tác nhiều bước.
- Backup mapping được cập nhật nếu cần.

## Code quality

- Không vi phạm dependency rule.
- Không để logic nghiệp vụ trong UI.
- Không thêm `any` không cần thiết.
- Không thêm dependency không giải thích.
- Không có dead code rõ ràng.

## Tests

- Unit test cho logic.
- Integration test cho persistence.
- Regression test cho bug.
- E2E nếu là luồng người dùng quan trọng.

## Validation

- Lint pass.
- Typecheck pass.
- Tests pass.
- Build pass.
- Tauri build pass nếu môi trường cho phép.

## Documentation

- Cập nhật PRD nếu behavior đổi.
- Cập nhật database doc nếu schema đổi.
- Cập nhật ADR nếu có quyết định lớn.
- Cập nhật roadmap/status.

## Delivery

- Git diff đã kiểm tra.
- Commit message rõ.
- Working tree sạch sau commit.
- Có Release Executable & NSIS installer (bắt buộc); Portable ZIP & MSI (optional) theo yêu cầu sprint.
