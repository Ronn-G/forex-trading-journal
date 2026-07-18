# 08. Analytics Specification

## 1. Công thức

### Win rate

```text
winning_closed_trades / closed_trades
```

Break-even phải có chính sách riêng, không tự động tính là win.

### Profit factor

```text
gross_profit / abs(gross_loss)
```

### Expectancy theo R

```text
average(result_r)
```

Hoặc:

```text
win_rate × average_win_r
- loss_rate × average_loss_r_abs
```

Hai cách phải cho kết quả tương thích trong cùng sample.

### Average win/loss

Chỉ tính closed trades.

### Drawdown

Dựa trên equity curve hoặc cumulative normalized P&L.

Cần ghi rõ:
- balance drawdown.
- equity drawdown nếu sau này có open-position snapshots.

## 2. Filter dimensions

- Account.
- Symbol.
- Setup.
- Setup version.
- Direction.
- Session.
- Hour.
- Day of week.
- Month.
- Compliance.
- Decision quality.
- Execution grade.
- Mistake.
- Emotion.
- Trade number of day.
- Holding duration.
- Planned RR.
- Result R range.

## 3. Sample size

Mọi metric theo setup phải hiển thị sample size.

Gợi ý cảnh báo:

- `< 10`: rất ít dữ liệu.
- `10–29`: sơ bộ.
- `30–99`: có thể tham khảo.
- `>= 100`: đáng tin cậy hơn, nhưng vẫn phụ thuộc điều kiện thị trường.

Không dùng màu hoặc ngôn từ khiến người dùng hiểu nhầm rằng sample nhỏ đã chứng minh edge.

## 4. Behavioral analytics

Báo cáo bắt buộc:

- Compliant vs non-compliant.
- Planned vs unplanned.
- First trade vs later trades.
- Before vs after cutoff time.
- With vs without FOMO.
- With vs without add-on.
- Reviewed vs unreviewed.
- Setup-qualified vs setup-disqualified.

## 5. Missing data

- Không tự điền 0 cho dữ liệu chưa có.
- Phân biệt `unknown`, `not_applicable` và `false`.
- Không tính R nếu thiếu planned risk.
- Metric phải công bố số trade bị loại do thiếu dữ liệu.
