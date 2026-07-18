# 13. Prompt Templates for Gemini CLI

## A. Prompt khởi động một sprint

```text
Bạn đang làm việc trong repository Forex Trading Journal.

Trước khi code:
1. Đọc README.md.
2. Đọc 00-PROJECT-CONSTITUTION.md.
3. Đọc 11-ROADMAP.md.
4. Đọc các tài liệu liên quan sprint.
5. Kiểm tra git status, branch, HEAD và code hiện tại.
6. Không chỉ dựa vào README.

Nhiệm vụ:
[Điền mục tiêu sprint]

Yêu cầu:
- Giữ nguyên kiến trúc hiện tại.
- Không thay framework, ORM hoặc database.
- Không sửa dữ liệu raw MT5.
- Schema change phải có migration.
- Thêm unit/integration test phù hợp.
- Cập nhật tài liệu nếu behavior thay đổi.
- Không refactor ngoài phạm vi.
- Sau khi sửa phải chạy lint, typecheck, test, build và Tauri build nếu có.
- Nếu chưa đạt acceptance criteria, không tuyên bố hoàn tất.

Trước tiên hãy phân tích code và đưa kế hoạch file-level. Sau đó triển khai.
```

## B. Prompt sửa bug

```text
Hãy sửa bug sau trong Forex Trading Journal:

[Miêu tả bug]
[Steps to reproduce]
[Expected]
[Actual]

Quy trình bắt buộc:
- Đọc Project Constitution.
- Tìm root cause, không chỉ vá UI.
- Viết regression test tái hiện bug.
- Giữ backward compatibility dữ liệu.
- Không refactor ngoài phạm vi.
- Chạy toàn bộ validation.
- Báo cáo root cause, file sửa và test đã thêm.
```

## C. Prompt thay đổi database

```text
Hãy triển khai thay đổi schema sau:

[Thay đổi]

Yêu cầu bắt buộc:
- Đọc 03-DATABASE-DESIGN.md và 09-BACKUP-AND-MIGRATION.md.
- Không chỉnh sửa schema trực tiếp mà không migration.
- Migration phải chạy được trên database mới và database version trước.
- Không làm mất dữ liệu.
- Cập nhật database schema, migration SQL, repository, domain types, backup mapping và tests.
- Nêu rõ schema version mới.
```

## D. Prompt review code

```text
Hãy review code hiện tại so với tài liệu dự án.

Kiểm tra:
- Có vi phạm Project Constitution không?
- Raw MT5 data có bị sửa không?
- Domain có phụ thuộc React/plugin-sql/Tauri không?
- Có query DB trong component không?
- Setup version có được giữ đúng không?
- Migration và backup có an toàn không?
- Analytics có xử lý missing data không?
- Có test cho logic quan trọng không?
- Có tuyên bố sai về build hoặc compatibility không?

Chỉ ra:
- Critical.
- High.
- Medium.
- Low.
- Đề xuất thứ tự sửa.
```

## E. Prompt kết thúc sprint

```text
Hãy kiểm tra sprint này trước khi kết luận.

Thực hiện:
- Đối chiếu acceptance criteria.
- Kiểm tra git diff.
- Chạy lint.
- Chạy typecheck.
- Chạy unit/integration tests.
- Chạy build.
- Chạy Tauri build.
- Test migration.
- Test backup nếu phạm vi có liên quan.
- Kiểm tra tài liệu đã cập nhật.

Sau đó báo cáo:
- Đạt.
- Chưa đạt.
- Bằng chứng.
- Rủi ro còn lại.
- Commit message đề xuất.

Không tuyên bố hoàn thành nếu còn điều kiện nghiệm thu chưa đạt.
```
