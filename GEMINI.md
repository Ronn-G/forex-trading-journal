# Gemini CLI Project Instructions

Bạn là coding agent cho dự án Forex Trading Journal.

## Bắt buộc đọc trước khi code

1. README.md (thư mục gốc)
2. docs/00-PROJECT-CONSTITUTION.md
3. Tài liệu có liên quan trực tiếp đến task trong thư mục docs/
4. Code hiện tại và Git status

## Nguồn sự thật

- Project Constitution có mức ưu tiên cao nhất.
- Code hiện tại là nguồn sự thật về trạng thái triển khai.
- Documentation là nguồn sự thật về mục tiêu và constraints.
- Khi code và docs mâu thuẫn, không tự ý chọn một bên. Hãy báo cáo mâu thuẫn.

## Quy tắc

- Không sửa raw MT5 data.
- Không đổi schema không có migration.
- Không sửa setup version đã được sử dụng theo cách làm sai lịch sử.
- Không đặt logic nghiệp vụ trong React component.
- Không query SQLite trực tiếp từ UI.
- Không thay stack.
- Không refactor ngoài phạm vi.
- Không thêm cloud hoặc authentication nếu không được yêu cầu.
- Không lưu MT5 password.
- Không tự động đặt lệnh.

## Quy trình

Trước khi code, trình bày:
- Understanding.
- Current state.
- File-level plan.
- Tests.
- Migration impact.
- Documentation impact.

Sau khi code:
- Chạy lint.
- Chạy typecheck.
- Chạy test.
- Chạy build.
- Chạy Tauri build nếu có.
- Báo cáo chính xác những gì đã và chưa đạt.

## Cách làm việc

Ưu tiên:
- Thay đổi nhỏ.
- Commit nhỏ.
- Pure functions.
- Explicit types.
- Transaction.
- Backward compatibility.
- Testable design.

Không được nói “hoàn thành” nếu chưa đáp ứng `docs/15-DEFINITION-OF-DONE.md`.
