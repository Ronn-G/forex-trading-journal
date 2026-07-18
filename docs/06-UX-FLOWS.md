# 06. UX Flows

## 1. Navigation

Sidebar:

- Dashboard
- Trades
- Import
- Setups
- Reviews
- Analytics
- Playbook
- Settings

## 2. Import flow

1. Chọn tài khoản.
2. Chọn file MT5.
3. App nhận diện format.
4. Parse.
5. Hiển thị preview.
6. Hiển thị:
   - Dòng hợp lệ.
   - Dòng trùng.
   - Dòng lỗi.
   - Số trade dự kiến.
7. Người dùng xác nhận.
8. Transaction import.
9. Normalize trades.
10. Hiển thị kết quả.

Không import ngay khi vừa chọn file.

## 3. Review flow

Trang chi tiết trade có tab:

- Overview.
- Chart & Images.
- Setup.
- Psychology.
- Review.
- Raw MT5.

Nút cố định:

- Previous.
- Save.
- Save & Next.

Quick review tối thiểu:

- Setup.
- Compliance.
- Mistake.
- Emotion.
- One lesson.
- Decision quality.

## 4. Setup editor flow

- Tạo setup.
- Tạo version đầu tiên.
- Thêm rules.
- Sắp xếp rule.
- Đặt rule type.
- Preview checklist.
- Publish version.

Sau khi version đã có trade sử dụng:
- Chỉnh typo nhỏ được phép nếu không đổi nghĩa.
- Thay đổi quy tắc phải tạo version mới.

## 5. Trade list

Cột mặc định:

- Date.
- Symbol.
- Direction.
- Setup.
- Net P&L.
- R.
- Compliance.
- Review status.

Filters:

- Date range.
- Account.
- Symbol.
- Direction.
- Setup.
- Session.
- Result.
- Compliance.
- Mistake.
- Emotion.
- Has image.
- Review status.

## 6. Empty states

Mỗi màn hình phải giải thích bước tiếp theo.

Ví dụ Dashboard chưa có dữ liệu:
- “Import lịch sử MT5 đầu tiên để bắt đầu.”
- Nút: `Import MT5 history`.

## 7. Accessibility

- Keyboard navigation.
- Label rõ cho input.
- Không chỉ dùng màu để biểu thị Win/Loss.
- Dialog nguy hiểm phải có mô tả hậu quả.
- Font và khoảng cách đủ đọc ở màn hình desktop.
