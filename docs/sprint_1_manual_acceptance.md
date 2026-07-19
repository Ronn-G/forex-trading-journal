# Sprint 1 Manual Acceptance

Không mục nào được Codex tự đánh dấu PASS. Với mỗi mục, điền `Status: PASS / FAIL / BLOCKED` và Notes.
Precondition chung: dùng report synthetic, backup database đang có và không nhập thông tin tài khoản thật.

| # | Check | Preconditions and steps | Expected result | Status / Notes |
|---|---|---|---|---|
| 1 | Fresh database | Dùng app-config test sạch; launch app | `database/journal.db` được tạo, không màn hình trắng | Status: ___ Notes: ___ |
| 2 | First launch | DB chưa migrate | migration rồi backfill, app ready | Status: ___ Notes: ___ |
| 3 | Account create/edit | App ready; tạo rồi sửa name/timezone | chỉ login masked; dữ liệu cập nhật | Status: ___ Notes: ___ |
| 4 | Archive/unarchive | Có account | archive chặn import; unarchive khôi phục | Status: ___ Notes: ___ |
| 5 | Restart persistence | Có account/import | đóng hẳn rồi mở lại | mọi dữ liệu còn, không duplicate | Status: ___ Notes: ___ |
| 6 | Valid preview | Chọn Vantage English CSV synthetic | metadata/counts/issues đúng; chưa write | Status: ___ Notes: ___ |
| 7 | Import commit | Preview hợp lệ | một atomic batch thành công | Status: ___ Notes: ___ |
| 8 | Result counters | Sau commit | inserted/skipped/warning/error khớp | Status: ___ Notes: ___ |
| 9 | Duplicate import | Import lại cùng file/account | typed duplicate, không partial rows | Status: ___ Notes: ___ |
| 10 | Account-scoped fixture | Import cùng fixture vào account khác | được phép, không lẫn dữ liệu | Status: ___ Notes: ___ |
| 11 | Trade backfill | DB Story 5 có CLOSED position | tạo đúng một trade; rerun tạo 0 | Status: ___ Notes: ___ |
| 12 | Trade list | Có CLOSED và OPEN positions | chỉ CLOSED; decimals/timezone đúng | Status: ___ Notes: ___ |
| 13 | Filters | Gõ symbol, side, `%`, `_`, `\` | literal contains, account isolation | Status: ___ Notes: ___ |
| 14 | Clear filters | Filter đang áp dụng | danh sách đầy đủ trở lại | Status: ___ Notes: ___ |
| 15 | Keyboard submit | Focus form bằng Tab; nhấn Enter | filter submit, focus-visible rõ | Status: ___ Notes: ___ |
| 16 | Desktop headers | Width desktop | bảng có 11 semantic headers | Status: ___ Notes: ___ |
| 17 | Mobile cards | Width mobile | cards có labels, không ép bảng/tràn | Status: ___ Notes: ___ |
| 18 | Archived history | Account archived có trades | history vẫn đọc được | Status: ___ Notes: ___ |
| 19 | Invalid file | Chọn empty/HTML/malformed file | lỗi an toàn, không writes | Status: ___ Notes: ___ |
| 20 | Startup privacy | Gây migration/backfill failure trong DB test | retry screen; không SQL/path/stack/login | Status: ___ Notes: ___ |
| 21 | Packaged install | Build NSIS; chạy installer | cài đặt thành công | Status: ___ Notes: ___ |
| 22 | Installed launch | Mở app đã cài | startup thành công | Status: ___ Notes: ___ |
| 23 | Installed import | Dùng fixture synthetic | preview/commit/trade hoạt động | Status: ___ Notes: ___ |
| 24 | Installed restart | Đóng/mở app đã cài | persistence và idempotency đúng | Status: ___ Notes: ___ |
| 25 | Git hygiene | Sau review và commit được duyệt | status sạch; không DB/report/installer | Status: ___ Notes: ___ |
