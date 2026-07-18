# 07. MT5 Import Specification

## 1. Mục tiêu

Import dữ liệu từ báo cáo MT5 mà không làm mất tính nguyên bản và không tạo trùng lặp.

## 2. Format ưu tiên

Thứ tự triển khai:

1. CSV chuẩn được app định nghĩa.
2. HTML statement xuất từ MT5.
3. XML hoặc các format khác nếu có mẫu thực tế.
4. Local bridge ở giai đoạn sau.

## 3. Pipeline

```text
File
→ Detect format
→ Parse raw rows
→ Validate
→ Map normalized fields
→ Preview
→ Persist raw records
→ Persist MT5 deals/orders
→ Normalize trades
→ Reconcile totals
```

## 4. Deduplication

Ưu tiên key:

- account_id
- external_deal_id

Nếu file không có deal ID đáng tin cậy, tạo fingerprint từ:

- account.
- symbol.
- executed_at.
- side.
- volume.
- price.
- profit.
- commission.

Fingerprint chỉ là fallback và phải lưu parser warning.

## 5. Preview result

Preview phải trả về:

- file summary.
- detected format.
- parser version.
- row count.
- valid count.
- duplicate count.
- warning count.
- error count.
- estimated trades.
- sample errors.

## 6. Transaction rule

Commit import phải trong transaction:

- import batch.
- raw records.
- orders.
- deals.
- normalized trade mapping.

Nếu lỗi nghiêm trọng:
- rollback toàn bộ.

Nếu cho phép partial import:
- phải hiển thị rõ và có status `PARTIAL`.

## 7. Normalization

### Netting account

Position có thể được xác định bằng:
- account_id.
- position_id.

### Hedging account

Có thể cần:
- position_id.
- order/deal relationships.
- chronology.
- symbol and direction.

### Partial close

Trade aggregate phải tính:
- weighted average entry.
- weighted average exit.
- total volume entered.
- total volume exited.
- remaining open volume.
- commission.
- swap.
- realized profit.

## 8. Reconciliation

Sau import phải kiểm tra:

```text
sum(deal profit + commission + swap)
≈ sum(normalized trade net profit)
```

Cho phép sai số nhỏ do rounding, nhưng phải có tolerance rõ ràng.

## 9. Parser version

Mỗi import batch lưu `parser_version`.

Nếu parser thay đổi:
- dữ liệu raw vẫn giữ.
- có thể chạy lại normalization.
- không ghi đè journal của người dùng.
