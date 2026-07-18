# 14. Architecture Decision Log

Mọi quyết định lớn phải được ghi thêm theo mẫu:

## ADR-XXX: Tên quyết định

- Date:
- Status: Proposed / Accepted / Superseded
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Migration impact:
- Backup impact:

## ADR-001: Local-first desktop app

- Date: 2026-07-18
- Status: Accepted
- Context: Người dùng cần app riêng tư, hoạt động offline và lưu ảnh local.
- Decision: Dùng Tauri, React, TypeScript và SQLite.
- Alternatives considered: Electron, web app cloud.
- Consequences: Cần xử lý file system, migration và portable build.
- Migration impact: Có.
- Backup impact: Có.

## ADR-002: Raw MT5 data immutable

- Date: 2026-07-18
- Status: Accepted
- Context: Cần audit và tái normalize.
- Decision: Lưu raw record riêng, không cho UI chỉnh sửa.
- Consequences: Tốn thêm storage nhưng tăng độ tin cậy.
- Migration impact: Có.
- Backup impact: Có.

## ADR-003: Versioned setups

- Date: 2026-07-18
- Status: Accepted
- Context: Quy tắc setup thay đổi theo thời gian.
- Decision: Tách setup và setup_version.
- Consequences: Analytics phức tạp hơn nhưng lịch sử chính xác.
- Migration impact: Có.
- Backup impact: Có.

## ADR-004: Direct SQLite & Tauri SQL plugin connection (Dropping Drizzle ORM)

- Date: 2026-07-18
- Status: Accepted
- Context: Tối giản dependency trong Sprint 0 và đảm bảo kết nối SQLite chạy offline an toàn thông qua Tauri IPC. Custom Drizzle adapter trên `@tauri-apps/plugin-sql` chưa thực sự cần thiết ở giai đoạn này.
- Decision: Loại bỏ Drizzle ORM và Drizzle Kit. Kết nối SQLite trực tiếp qua `@tauri-apps/plugin-sql`, dùng raw SQL và migration runner tự chế viết bằng TypeScript, kiểm tra checksum SHA-256 của migration, ánh xạ/kiểm tra kiểu dữ liệu sử dụng Zod.
- Alternatives considered: Drizzle ORM, custom SQLx/Rust SQLite commands.
- Consequences: Tự viết migration runner đơn giản, truy vấn SQL thủ công tham số hóa (parameterized queries) thay vì query builder, đảm bảo hiệu năng và tính độc lập cao của các module.
- Migration impact: Có (các tệp migration SQL được nạp tĩnh trong code).
- Backup impact: Không ảnh hưởng (SQLite file được lưu trữ trực tiếp).

## ADR-005: Custom packaging and optional installer policies

- Date: 2026-07-18
- Status: Accepted
- Context: Ứng dụng chủ yếu chạy trên máy cá nhân của tác giả. Thiết lập MSI installer và Portable ZIP tốn thời gian và dễ gặp lỗi không cần thiết trên môi trường Windows sạch.
- Decision: Quy định Portable ZIP và MSI installer là OPTIONAL (tùy chọn). Đầu ra bắt buộc của ứng dụng chỉ gồm Windows Release Executable (.exe) chạy được và NSIS Installer là installer ưu tiên.
- Alternatives considered: Đóng gói tất cả (all) các định dạng, chỉ build standalone exe.
- Consequences: Tránh được các lỗi build installer không cần thiết cản trở tiến độ của Sprint 0.

