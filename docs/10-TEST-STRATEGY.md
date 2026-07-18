# 10. Test Strategy

## 1. Test pyramid

### Unit tests

Bắt buộc cho:

- R calculation.
- Weighted entry/exit.
- Profit factor.
- Expectancy.
- Drawdown.
- Setup checklist.
- Rule disqualifier.
- Import fingerprint.
- Trade normalization.
- Backup conflict resolution.

### Integration tests

- Database repositories.
- Migrations.
- Import transaction.
- Backup merge.
- Backup replace.
- Image storage.
- Trade + deal mapping.

### End-to-end tests

Luồng chính:

1. Tạo tài khoản.
2. Import MT5 file.
3. Xem trade.
4. Tạo setup.
5. Gắn setup.
6. Thêm ảnh.
7. Review.
8. Xem analytics.
9. Export backup.
10. Restore backup.

## 2. Fixture policy

Fixtures phải chứa:

- Một lệnh vào và thoát toàn bộ.
- Partial close.
- Add-on.
- Commission.
- Swap.
- Break-even.
- Open position.
- Duplicate deal.
- Invalid row.
- Different timezone.
- Netting account.
- Hedging account.

## 3. Regression tests

Mỗi bug production phải có test tái hiện trước khi sửa.

## 4. Acceptance gate

Không merge hoặc tuyên bố hoàn thành nếu:

- Test fail.
- Typecheck fail.
- Build fail.
- Migration fail.
- Import reconciliation fail.
