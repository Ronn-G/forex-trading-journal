# 01. Product Requirements Document

## 1. Người dùng mục tiêu

Người dùng chính là trader cá nhân giao dịch Forex và XAUUSD trên MT5, phân tích biểu đồ bằng TradingView, muốn kiểm chứng setup và cải thiện kỷ luật.

## 2. Vấn đề cần giải quyết

- Lịch sử MT5 có dữ liệu khớp lệnh nhưng thiếu bối cảnh.
- Khó biết setup nào thực sự có lợi thế.
- Khó tách thua do hệ thống khỏi thua do vi phạm kỷ luật.
- Ảnh biểu đồ bị phân tán.
- Không có quy trình review nhất quán.
- Không đo được chi phí của FOMO, revenge trade, vào sớm hoặc nhồi lệnh.
- Dữ liệu dễ mất khi app được sửa hoặc nâng cấp.

## 3. Giá trị cốt lõi

App phải giúp người dùng trả lời:

- Setup nào có expectancy dương?
- Setup nào chỉ hoạt động trong điều kiện cụ thể?
- Lỗi hành vi nào làm mất nhiều R nhất?
- Lệnh đúng quy tắc có hiệu suất thế nào?
- Sau 20, 50 hoặc 100 lệnh, điều gì đã được chứng minh?

## 4. Phạm vi MVP

### 4.1. Bắt buộc

- Quản lý một hoặc nhiều tài khoản giao dịch.
- Import lịch sử MT5 từ file.
- Lưu raw import.
- Chống import trùng.
- Ghép deal thành trade.
- Danh sách trade có bộ lọc.
- Trang chi tiết trade.
- Gắn setup và setup version.
- Checklist setup.
- Thêm ảnh hoặc paste ảnh.
- Thêm link TradingView.
- Gắn lỗi giao dịch.
- Gắn cảm xúc.
- Review trade.
- Tính P&L, R, win rate, profit factor và expectancy.
- Dashboard cơ bản.
- Backup và restore.

### 4.2. Chưa thuộc MVP

- Tự động đặt lệnh.
- Quản lý tài khoản broker.
- Lưu mật khẩu MT5.
- Cloud sync.
- Mobile app.
- AI tự đánh giá setup bằng hình ảnh.
- Trình vẽ biểu đồ nâng cao.
- Đồng bộ realtime.

## 5. User stories chính

### Import

- Là trader, tôi muốn import file lịch sử MT5 để không phải nhập lệnh thủ công.
- Tôi muốn xem preview trước khi import.
- Tôi muốn hệ thống bỏ qua deal trùng.
- Tôi muốn biết dòng nào lỗi và vì sao.

### Journal

- Tôi muốn thêm ảnh H1, M5, entry và exit cho từng trade.
- Tôi muốn dán ảnh trực tiếp từ clipboard.
- Tôi muốn thêm link TradingView.
- Tôi muốn ghi lại cảm xúc và lỗi hành vi.

### Setup

- Tôi muốn tạo setup có điều kiện bắt buộc, điều kiện hỗ trợ và điều kiện loại bỏ.
- Tôi muốn mỗi trade được đánh giá theo đúng phiên bản setup tại thời điểm giao dịch.
- Tôi muốn so sánh hiệu suất giữa các phiên bản setup.

### Review

- Tôi muốn review nhanh trong dưới hai phút.
- Tôi muốn dùng `Save & Next`.
- Tôi muốn phân biệt trade tốt với trade thắng.

### Analytics

- Tôi muốn xem expectancy theo setup.
- Tôi muốn so sánh trade đúng và sai quy tắc.
- Tôi muốn biết trade buổi tối có làm giảm kết quả không.
- Tôi muốn biết lỗi nào khiến tôi mất nhiều R nhất.

## 6. Yêu cầu phi chức năng

- Chạy offline.
- Khởi động trong thời gian hợp lý.
- Không mất dữ liệu sau update.
- Có backup versioned.
- Có migration.
- Có test cho logic thống kê.
- UI ưu tiên desktop 1366×768 trở lên.
- Hỗ trợ Windows trước.
- Tất cả timestamps lưu UTC, hiển thị theo timezone tài khoản hoặc người dùng.
