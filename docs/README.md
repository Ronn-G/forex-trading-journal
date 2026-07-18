# Forex Trading Journal – Project Documentation

Bộ tài liệu này là nguồn sự thật chính thức cho dự án app nhật ký giao dịch Forex.

## Mục tiêu

Xây dựng ứng dụng desktop chạy offline, hỗ trợ:

- Import lịch sử giao dịch từ MT5.
- Lưu nguyên bản dữ liệu MT5.
- Ghép deal thành trade hoàn chỉnh.
- Gắn setup và phiên bản setup.
- Lưu ảnh chụp TradingView hoặc link TradingView.
- Review từng lệnh.
- Theo dõi lỗi hành vi và tâm lý.
- Thống kê hiệu suất theo R, setup và mức độ tuân thủ.
- Sao lưu, phục hồi và xuất dữ liệu.
- Sau này có thể bổ sung đồng bộ tự động với MT5.

## Thứ tự ưu tiên tài liệu

Khi tài liệu có mâu thuẫn, áp dụng thứ tự:

1. `00-PROJECT-CONSTITUTION.md`
2. `01-PRODUCT-REQUIREMENTS.md`
3. `02-DOMAIN-MODEL.md`
4. `03-DATABASE-DESIGN.md`
5. `04-ARCHITECTURE.md`
6. `05-CODING-STANDARDS.md`
7. `06-UX-FLOWS.md`
8. `07-IMPORT-MT5-SPEC.md`
9. `08-ANALYTICS-SPEC.md`
10. `09-BACKUP-AND-MIGRATION.md`
11. `10-TEST-STRATEGY.md`
12. `11-ROADMAP.md`
13. `12-GEMINI-CLI-WORKFLOW.md`
14. `13-PROMPT-TEMPLATES.md`
15. `14-DECISION-LOG.md`
16. `15-DEFINITION-OF-DONE.md`

## Quy tắc bắt buộc

- Không sửa hoặc ghi đè dữ liệu gốc đã import từ MT5.
- Không thay đổi schema trực tiếp; mọi thay đổi phải qua migration.
- Không dùng kết quả tiền để đánh giá chất lượng quyết định.
- Mọi thống kê setup phải gắn với `setup_version_id`.
- Không tuyên bố hoàn thành khi chưa chạy test và build.
- Sau mỗi thay đổi lớn phải cập nhật tài liệu liên quan.
