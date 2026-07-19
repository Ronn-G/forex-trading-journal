# Release Checklist

- [ ] Version và changelog đã duyệt.
- [ ] Branch đúng, sạch, remote synced và đã review; không release từ working tree bẩn.
- [ ] `npm ci`, lint, typecheck, frontend/Rust tests và builds pass.
- [ ] Cargo fmt/clippy/test và real SQLite migration-SQL/schema integration pass.
- [ ] Mock production-migrator ordering/repeat/checksum tests và real SQLite constraints pass.
- [ ] Manual acceptance đạt.
- [ ] Release executable và NSIS installer được tạo.
- [ ] Install/launch/uninstall smoke test đạt.
- [ ] Nhắc người dùng backup `database/journal.db` trước upgrade.
- [ ] Không chứa report/account ID/database/log/secret thật.
- [ ] Tính checksum artifact nếu phát hành file tải xuống.
- [ ] Tag và GitHub Release chỉ tạo sau phê duyệt.
- [ ] Story 8 được commit và merge theo quy trình sau review.
- [ ] Rollback: giữ installer trước và bản backup DB; không downgrade schema bằng cách sửa migration cũ.
