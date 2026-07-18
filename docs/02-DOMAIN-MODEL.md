# 02. Domain Model

## 1. Bounded contexts

### Account Context
- TradingAccount
- Broker
- AccountSnapshot

### Import Context
- ImportBatch
- RawImportFile
- RawMT5Record
- ImportError

### Trading Context
- MT5Order
- MT5Deal
- Trade
- TradeLeg
- TradeGroup
- RiskPlan

### Setup Context
- Setup
- SetupVersion
- SetupRule
- TradeSetupEvaluation

### Journal Context
- TradeImage
- TradingViewLink
- TradeNote
- Emotion
- Mistake
- Tag
- Review

### Analytics Context
- TradeMetrics
- SetupMetrics
- BehaviorMetrics
- EquityPoint
- DrawdownPeriod

### Playbook Context
- PlaybookEntry
- PlaybookEvidence

## 2. Định nghĩa entity

### TradingAccount

Một tài khoản giao dịch cụ thể tại broker.

Identity:
- `id`

Business key:
- `broker`
- `server`
- `login_masked`

### ImportBatch

Một lần import file MT5.

Trạng thái:
- `PENDING`
- `PREVIEWED`
- `IMPORTED`
- `PARTIAL`
- `FAILED`
- `ROLLED_BACK`

### MT5Deal

Một execution do MT5 ghi nhận. Đây là dữ liệu bất biến.

### Trade

Một vị thế giao dịch đã được chuẩn hóa từ một hoặc nhiều deal.

Trade có:
- Direction.
- Entry trung bình.
- Exit trung bình.
- Tổng volume.
- P&L.
- Commission.
- Swap.
- Open time.
- Close time.
- Position identity.
- Review state.

### TradeGroup

Một ý tưởng giao dịch gồm nhiều trade có liên quan.

Ví dụ:
- Sell XAUUSD sau stop hunt.
- Có ba lần vào lệnh riêng biệt.
- Người dùng muốn review chung dưới một thesis.

### Setup

Tên và định danh chiến lược dài hạn.

### SetupVersion

Bản quy tắc cụ thể của setup.

### SetupRule

Các loại:
- `REQUIRED`
- `CONFIRMATION`
- `DISQUALIFIER`

### TradeSetupEvaluation

Snapshot kết quả checklist tại thời điểm review.

Không được tính lại tự động bằng rule đã sửa nếu trade đã `LOCKED`.

### Review

Đánh giá trade sau khi đóng.

Bao gồm:
- Decision quality.
- Execution quality.
- Compliance.
- Lessons.
- Grade.
- Mistakes.
- Emotions.

## 3. Value objects

### Money
- amount
- currency

### RMultiple
- value
- method
- source risk

### Price
- value
- precision

### TimeRange
- start
- end

### RiskPlan
- initial stop loss
- planned risk money
- planned risk percent
- planned R:R
- invalidation note

### PerformanceMetric
- value
- sample size
- period
- filters

## 4. Invariants

- `close_time >= open_time`.
- Closed trade phải có exit price.
- `setup_version_id` phải thuộc đúng `setup_id`.
- Raw deal không được update sau khi import.
- Một raw deal chỉ thuộc một normalized trade, trừ trường hợp được đánh dấu lỗi mapping.
- `result_r` chỉ được tính khi có planned risk hợp lệ.
- Setup version đang được dùng không được hard delete.
- Trade `LOCKED` không được sửa review nếu chưa unlock có chủ đích.
