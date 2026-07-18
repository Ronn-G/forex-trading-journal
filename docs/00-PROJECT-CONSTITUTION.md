# 00. Project Constitution

## 1. Mục đích

Tài liệu này chứa các nguyên tắc bất biến. Gemini CLI không được tự ý thay đổi những nguyên tắc này nếu chưa có yêu cầu rõ ràng từ chủ dự án.

## 2. Nguyên tắc kiến trúc

### 2.1. Ba lớp dữ liệu

Hệ thống phải tách rõ:

1. **Raw MT5 Data**
   - Dữ liệu gốc import từ MT5.
   - Không chỉnh sửa.
   - Có thể import lại và đối chiếu.

2. **Normalized Trading Data**
   - Deal, order và position được ghép thành trade.
   - Có thể tái tạo từ raw data và quy tắc normalization.

3. **User Journal Data**
   - Setup.
   - Checklist.
   - Ảnh.
   - Link TradingView.
   - Cảm xúc.
   - Lỗi giao dịch.
   - Review.
   - Tags.
   - Playbook.

Không được trộn ba lớp trên thành một bảng hoặc một model duy nhất.

### 2.2. Dữ liệu người dùng là local-first

- App hoạt động đầy đủ khi không có internet.
- SQLite là nguồn dữ liệu chính.
- Ảnh được lưu trong thư mục dữ liệu ứng dụng.
- Không phụ thuộc dịch vụ cloud để mở app hoặc xem dữ liệu.

### 2.3. Không phá vỡ dữ liệu lịch sử

- Mọi thay đổi schema phải có migration.
- Migration phải có test.
- Không xóa cột hoặc bảng đang chứa dữ liệu mà không có chiến lược chuyển đổi.
- Không đổi ý nghĩa trường dữ liệu cũ mà không tăng version.

### 2.4. Setup có phiên bản

- `setup` là danh tính lâu dài.
- `setup_version` chứa bộ quy tắc tại một thời điểm.
- Trade phải tham chiếu `setup_version_id`.
- Chỉnh sửa lớn quy tắc setup phải tạo phiên bản mới.
- Không sửa ngược nội dung phiên bản setup đã được dùng bởi trade đã review.

### 2.5. Tách kết quả khỏi chất lượng quyết định

Mỗi trade phải hỗ trợ phân loại độc lập:

- Good decision + Win.
- Good decision + Loss.
- Bad decision + Win.
- Bad decision + Loss.

Không được dùng `net_profit > 0` để tự động kết luận trade tốt.

## 3. Nguyên tắc nghiệp vụ

### 3.1. Đơn vị đánh giá chính

Ứng dụng phải hỗ trợ đồng thời:

- Tiền tệ tài khoản.
- Phần trăm tài khoản.
- R-multiple.

Trong phân tích chiến lược, ưu tiên R-multiple.

### 3.2. Dữ liệu import không phải dữ liệu review

Import thành công không đồng nghĩa trade đã hoàn thiện. Trade có thể ở trạng thái:

- `IMPORTED`
- `NEEDS_CLASSIFICATION`
- `NEEDS_REVIEW`
- `REVIEWED`
- `LOCKED`
- `DATA_ERROR`
- `IGNORED`

### 3.3. Một trade có thể gồm nhiều deal

Không giả định một ticket MT5 luôn tương ứng một trade.

Phải hỗ trợ:

- Vào nhiều lần.
- Đóng từng phần.
- Add-on.
- Scale-out.
- Commission và swap ở nhiều deal.
- Một position gồm nhiều execution.

## 4. Nguyên tắc phát triển

- Mỗi sprint phải nhỏ, có thể kiểm thử và commit riêng.
- Không refactor ngoài phạm vi nếu không cần thiết.
- Không thêm dependency mới nếu chưa giải thích lý do.
- Không thay framework hoặc ORM trong lúc triển khai tính năng.
- Không tạo abstraction chỉ để “có vẻ sạch”.
- Ưu tiên code rõ ràng, test được, ít side effect.

## 5. Quy tắc cho AI coding agent

Trước khi code, agent phải:

1. Đọc tài liệu liên quan.
2. Kiểm tra trạng thái Git.
3. Xác định phạm vi thay đổi.
4. Liệt kê file dự kiến sửa.
5. Nêu migration nếu có.
6. Nêu test cần thêm.
7. Chỉ bắt đầu code sau khi đã hiểu acceptance criteria.

Sau khi code, agent phải:

1. Chạy test.
2. Chạy typecheck.
3. Chạy lint.
4. Chạy build.
5. Kiểm tra migration.
6. Tóm tắt file đã thay đổi.
7. Nêu rõ phần chưa làm hoặc rủi ro còn lại.
