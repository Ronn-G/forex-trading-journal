# Kế hoạch Triển khai Sprint 0 – Foundation (Đã cập nhật)

Tài liệu này chứa kế hoạch triển khai chi tiết cho Sprint 0 của ứng dụng **Forex Trading Journal**, tích hợp toàn bộ các quyết định kỹ thuật đã chốt.

---

## 1. Stack công nghệ và Dependency thực sự cần thiết

### Core Stack
- **Tauri v2**: Runtime ứng dụng Desktop chạy offline.
- **React 18 / 19** + **TypeScript** + **Vite**: Phát triển giao diện người dùng.
- **Tailwind CSS** + **shadcn/ui**: Thiết kế giao diện theo các quy chuẩn hiện đại.
- **SQLite** + **@tauri-apps/plugin-sql**: Lưu trữ và quản lý truy vấn dữ liệu cục bộ.

### Danh sách Dependency sẽ cài đặt trong Sprint 0
Chúng ta tuân thủ quy tắc chỉ cài đặt các dependency được sử dụng thực tế.

#### Dependencies chính (`package.json`):
- `react`, `react-dom`
- `react-router-dom` (Hỗ trợ routing giữa các màn hình)
- `@tauri-apps/api` (Giao tiếp frontend với Rust core)
- `@tauri-apps/plugin-sql` (Thực thi các lệnh SQL trên SQLite)
- `zod` (Xác thực và chuyển đổi kiểu dữ liệu từ database row sang domain model)
- `clsx`, `tailwind-merge` (Xử lý class Tailwind động cho UI)
- `lucide-react` (Icons)

#### DevDependencies (`package.json`):
- `@tauri-apps/cli` (Công cụ build và quản lý ứng dụng Tauri v2)
- `typescript`, `@types/react`, `@types/react-dom`
- `vite` (Vite build tool)
- `tailwindcss`, `postcss`, `autoprefixer`
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom` (Khung kiểm thử unit/integration)
- `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` (Kiểm tra mã nguồn tĩnh)
- `prettier` (Format code tự động)

---

## 2. Kế hoạch File-level của Sprint 0

Dưới đây là danh sách chi tiết các file sẽ được tạo hoặc sửa đổi:

### 2.1. Cấu hình Tauri v2 & Rust Backend
- `src-tauri/Cargo.toml`: Thêm dependency Rust cho Tauri v2 (`tauri-plugin-sql`, `tauri-plugin-log`, `serde`, `serde_json`, `tauri-plugin-fs`).
- `src-tauri/tauri.conf.json`: Cấu hình plugin SQL, fs và log. Khai báo định danh app, cấu hình build và quyền truy cập (permissions) cần thiết.
- `src-tauri/src/lib.rs` & `src-tauri/src/main.rs`:
  - Khởi tạo Tauri App.
  - Setup logic tự động kiểm tra và tạo các thư mục ứng dụng tại `APPDATA/Local` (`database`, `images`, `backups`, `imports`, `logs`) khi bắt đầu.
  - Đăng ký các plugin: `tauri-plugin-sql`, `tauri-plugin-log`, `tauri-plugin-fs`.

### 2.2. Frontend Infrastructure & Database
- `src/infrastructure/database/client.ts`: Quản lý kết nối SQLite thông qua `@tauri-apps/plugin-sql`. Cấu hình tự động bật Foreign Keys (`PRAGMA foreign_keys = ON;`).
- `src/infrastructure/database/migrator.ts`:
  - Đọc danh sách các tệp migration từ code (được nhúng dưới dạng static raw SQL strings hoặc import trực tiếp để chạy offline).
  - Tạo bảng `schema_migrations` nếu chưa tồn tại.
  - Đọc dữ liệu từ bảng `schema_migrations` để so sánh danh sách các file migration đã chạy.
  - Tính checksum của từng file migration (sử dụng thuật toán SHA-256 hoặc hash đơn giản).
  - So sánh checksum của các migration đã áp dụng. Nếu có mismatch, báo lỗi nghiêm trọng (`MigrationError`) và ngăn chặn app khởi động.
  - Chạy các migration mới theo thứ tự tăng dần trong một transaction duy nhất.
- `src/infrastructure/database/migrations/`: Thư mục lưu trữ các file SQL migration thuần.
  - `0001_initial.sql`: File SQL migration đầu tiên.
- `src/infrastructure/database/repositories/MigrationRepository.ts`: Lớp tương tác DB thuần để CRUD thông tin bảng `schema_migrations`.
- `src/shared/dates/index.ts`:
  - Hàm chuyển đổi từ JavaScript `Date` sang Unix epoch milliseconds UTC (`INTEGER`).
  - Hàm format ngày tháng không giờ `YYYY-MM-DD`.
  - Hàm chuyển đổi hiển thị ngày giờ dựa theo IANA Timezone string được lưu trữ.
- `src/shared/errors/index.ts`: Định nghĩa các lỗi hệ thống như `InitializationError`, `MigrationError`.

### 2.3. Frontend Application & UI Shell
- `src/main.tsx`: Entrypoint của React. Trước khi render React UI, gọi tiến trình khởi tạo bất đồng bộ:
  - Tạo thư mục dữ liệu (thông qua Tauri commands).
  - Kết nối DB và chạy migration.
  - Nếu thành công, render `App`. Nếu thất bại, render giao diện lỗi khởi tạo (`InitializationFailureScreen`).
- `src/app/router/index.tsx`: Thiết lập router cơ bản cho ứng dụng.
- `src/app/shell/AppShell.tsx`: Giao diện Layout chính của ứng dụng chứa Sidebar, Header và Main Layout. Đảm bảo hiển thị tốt từ kích thước `1366x768`.
- `src/app/shell/ErrorBoundary.tsx`: Bắt lỗi React UI runtime và hiển thị giao diện fallback.
- `src/features/status/HealthScreen.tsx`: Màn hình kiểm tra trạng thái sức khỏe của app (phiên bản database, đường dẫn thư mục lưu trữ, trạng thái kết nối DB, logs).

### 2.4. Build & Đóng gói (Release & NSIS Bắt buộc; Portable ZIP/MSI Optional)
- `scripts/build-portable.js` (Optional): Script node chạy tự động sau khi build Tauri thành công để đóng gói bản release:
  - Tạo thư mục zip chứa file `.exe` standalone từ `src-tauri/target/release/bundle/nsis/` (hoặc build target trực tiếp).
  - Kèm theo file tài liệu hướng dẫn cài đặt và vận hành nhanh `README_PORTABLE.txt`.
  - Nén toàn bộ thành file `.zip`.
- `README.md` (cập nhật hướng dẫn cài đặt cho dev).

---

## 3. Migration đầu tiên (`0001_initial.sql`)

Nội dung của file migration đầu tiên sẽ tạo bảng quản lý migration và các bảng tối thiểu phục vụ cho việc khởi tạo dự án:

```sql
-- Tạo bảng quản lý migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at INTEGER NOT NULL -- Unix epoch milliseconds UTC
);

-- Tạo bảng cấu hình hệ thống cơ bản
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
```

---

## 4. Các test cần viết (Vitest)

Do `@tauri-apps/plugin-sql` chạy thông qua Tauri IPC (chỉ có trong runtime Tauri), chúng ta sẽ thực hiện mock Tauri API trong môi trường Vitest (chạy trên Node.js) để kiểm tra tính đúng đắn của logic.

1. **`shared/dates/dates.test.ts`**:
   - Kiểm tra chuyển đổi từ Date sang Epoch Milliseconds UTC hoạt động chính xác.
   - Kiểm tra định dạng ngày `YYYY-MM-DD`.
   - Kiểm tra việc chuyển đổi múi giờ sang IANA Timezone.
2. **`infrastructure/database/migrator.test.ts`**:
   - Mock cơ sở dữ liệu Tauri SQL để giả lập trạng thái DB.
   - Kiểm tra `migrator.ts` tự động tạo bảng `schema_migrations` khi chưa có.
   - Kiểm tra việc chạy migration theo đúng thứ tự tăng dần của phiên bản.
   - Kiểm tra việc phát hiện lỗi và quăng `MigrationError` khi checksum của một migration đã chạy bị thay đổi (checksum mismatch).
   - Kiểm tra việc không chạy lại các migration đã áp dụng.
3. **`app/shell/ErrorBoundary.test.tsx`**:
   - Kiểm tra ErrorBoundary bắt được lỗi UI và hiển thị giao diện thông báo lỗi thích hợp thay vì crash trắng trang.

---

## 5. Tiêu chí hoàn thành (Definition of Done) cho Sprint 0

Sẽ không tuyên bố Sprint 0 kết thúc nếu chưa chạy và vượt qua các điều kiện sau:

### Lệnh xác thực
```bash
# 1. Kiểm tra mã nguồn tĩnh không có lỗi
npm run lint

# 2. Kiểm tra kiểu dữ liệu TypeScript không có lỗi
npm run typecheck

# 3. Chạy toàn bộ các test suite thành công
npm run test

# 4. Build bản thử nghiệm Frontend thành công
npm run build

# 5. Build ứng dụng Tauri v2 thành công (tạo executable và NSIS installer - Bắt buộc)
npm run tauri build

# 6. Tạo file nén Portable ZIP thành công (Optional)
npm run build:portable
```

### Các hạng mục kiểm thử thực tế cần xác minh:
- [ ] **Chạy lần đầu:** Khởi động ứng dụng lần đầu tự động tạo thư mục app data tại địa phương (`database/`, `images/`, `backups/`, `imports/`, `logs/`).
- [ ] **Chạy lần hai:** Tắt ứng dụng rồi mở lại, kiểm tra file log để đảm bảo không chạy lại các migration đã áp dụng.
- [ ] **Kiểm tra Checksum Mismatch:** Thay đổi thủ công một file migration đã được áp dụng, mở app và xác nhận hệ thống quăng lỗi `MigrationError` và dừng khởi chạy.
- [ ] **Bật Foreign Keys:** Chạy thử truy vấn SQL kiểm chứng SQLite foreign keys thực sự được kích hoạt (`PRAGMA foreign_keys`).
- [ ] **Initialization Failure UI:** Giả lập lỗi kết nối database lúc start-up, đảm bảo ứng dụng hiển thị giao diện báo lỗi chi tiết thay vì màn hình trắng.
- [ ] **Đầu ra đóng gói:** File Release executable và NSIS installer `.exe` hoạt động tốt (Bắt buộc); file Portable `.zip` tồn tại (Optional).
- [ ] **Tài liệu hướng dẫn:** Cập nhật `README.md` phản ánh chính xác cấu trúc thực tế và cách cài đặt dự án cho lập trình viên mới.
