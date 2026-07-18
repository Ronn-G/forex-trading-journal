# 09. Backup and Migration

## 1. Backup format

Backup là file ZIP có cấu trúc:

```text
manifest.json
database.json hoặc database.sqlite
images/
metadata/
checksums.json
```

Manifest gồm:

- app name.
- backup format version.
- app version.
- schema version.
- created_at.
- account count.
- trade count.
- image count.
- checksum algorithm.

## 2. Không backup

- Logs.
- Cache.
- Temporary files.
- Secret.
- Password.
- API key.
- Build artifacts.

## 3. Import modes

### Merge

- Giữ dữ liệu hiện có.
- Dùng stable IDs khi không conflict.
- Remap IDs khi conflict nội dung.
- Không làm giảm counters.
- Không ghi đè review mới hơn bằng review cũ hơn.
- Giữ cả hai nếu cùng ID nhưng nội dung khác và không thể xác định đúng.

### Replace all

- Xóa dữ liệu thuộc phạm vi backup.
- Import trong transaction.
- Rollback nếu lỗi.
- Cần xác nhận rõ.

## 4. Backup compatibility

- Backup cũ phải import được nếu trong phạm vi version hỗ trợ.
- Migration backup tách khỏi migration database.
- Không giả định schema nội bộ giống format backup.

## 5. Database migrations

Mỗi migration phải có:

- Version.
- Mô tả.
- Up migration.
- Chiến lược rollback hoặc ghi rõ không thể rollback.
- Test từ database version trước.
- Kiểm tra dữ liệu sau migration.

## 6. Image integrity

- Lưu SHA-256.
- Validate mime type.
- Validate magic bytes.
- Chặn path traversal.
- Ghi file atomic.
- Không ghi đè ảnh khác khi trùng tên.
