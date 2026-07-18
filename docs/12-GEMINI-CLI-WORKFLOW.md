# 12. Gemini CLI Workflow

## 1. Mỗi phiên làm việc

Gemini CLI phải bắt đầu bằng:

1. Đọc `README.md`.
2. Đọc `00-PROJECT-CONSTITUTION.md`.
3. Đọc tài liệu liên quan task.
4. Chạy `git status`.
5. Kiểm tra branch và HEAD.
6. Đọc code hiện tại trước khi đề xuất.
7. Không giả định README phản ánh đúng code nếu chưa kiểm tra.

## 2. Trước khi sửa

Gemini phải trả lời theo mẫu:

```text
Understanding
- Mục tiêu:
- Phạm vi:
- Không thuộc phạm vi:

Current state
- Kiến trúc hiện tại:
- File liên quan:
- Rủi ro:

Planned changes
- File tạo mới:
- File sửa:
- Migration:
- Test:
- Documentation:
```

## 3. Trong khi sửa

- Thay đổi nhỏ, có thể review.
- Không format toàn repo.
- Không đổi dependency ngoài phạm vi.
- Không sửa file không liên quan.
- Không xóa TODO hoặc code cũ nếu chưa hiểu.
- Nếu phát hiện mâu thuẫn tài liệu, dừng việc mở rộng phạm vi và ghi nhận vào Decision Log.

## 4. Sau khi sửa

Chạy tối thiểu:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Nếu có desktop build:

```bash
npm run tauri build
```

Nếu có migration:

- Tạo database mới từ zero.
- Upgrade database fixture từ version trước.
- Kiểm tra dữ liệu.

## 5. Báo cáo kết quả

```text
Implemented
- ...

Files changed
- ...

Database
- Migration:
- Schema version:

Validation
- Lint:
- Typecheck:
- Tests:
- Build:
- Portable build (optional):

Not completed
- ...

Risks
- ...

Recommended next commit
- ...
```

## 6. Không được tuyên bố

Không nói:

- “Hoàn tất” nếu chưa build.
- “Không có lỗi” nếu chỉ đọc code.
- “Tương thích backup cũ” nếu chưa test.
- “Không mất dữ liệu” nếu chưa có migration/restore test.
- “MT5 sync hoạt động” nếu chỉ mock data.
