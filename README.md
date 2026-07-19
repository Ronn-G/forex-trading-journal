# Forex Trading Journal

Ứng dụng nhật ký giao dịch ngoại hối (**Forex Trading Journal**) được phát triển dưới dạng Desktop App hoạt động ngoại tuyến (**local-first**), bảo vệ dữ liệu người dùng tối đa.

Sprint 1 hỗ trợ quản lý account, preview/nhập Vantage MT5 Trade History CSV tiếng Anh và xem
closed trades đã normalize. Dữ liệu nằm cục bộ trong app config tại `database/journal.db`; report
thật, login đầy đủ và database không được commit.

Giới hạn hiện tại: không hỗ trợ HTML; Story 7 đã được bỏ qua; Orders/Deals chưa reconstruct trade;
OPEN positions chưa trở thành completed trades. Timestamp CSV được diễn giải theo IANA timezone của
account. Khi lỗi startup, thử lại hoặc đóng/mở app; không sửa migration/database thủ công.

## 1. Stack công nghệ sử dụng
*   **Core:** React 19 + TypeScript + Vite.
*   **Desktop Runtime:** Tauri v2 (Rust backend).
*   **Database:** SQLite.
*   **Database Client:** `@tauri-apps/plugin-sql` (Thực thi các lệnh SQL trực tiếp qua Tauri IPC).
*   **ORM/Repository:** Không sử dụng ORM. Sử dụng **Typed Repository** thuần viết bằng TypeScript phối hợp với truy vấn SQL có tham số (**parameterized queries**) và thư viện **Zod** để ánh xạ/validate kiểu dữ liệu của các dòng database sang domain model.
*   **Kiểm thử:** Vitest.
*   **Cấu hình mã nguồn tĩnh:** ESLint + Prettier + TypeScript Compiler (`tsc`).
*   **Đóng gói (Packaging):** Windows Release Executable & NSIS Installer (.exe) là sản phẩm bắt buộc; Portable ZIP (.zip) & MSI installer là các sản phẩm tùy chọn (Optional).

## 2. Cấu trúc thư mục dự án
```text
forex-trading-journal/
├── .vscode/               # Cấu hình IDE VS Code khuyên dùng
├── docs/                  # Tài liệu thiết kế hệ thống và nghiệp vụ (Sprint 0 - 7)
├── scripts/               # Các script node phục vụ build & đóng gói
│   └── build-portable.js  # Script đóng gói Portable ZIP
├── src-tauri/             # Mã nguồn Rust Backend (Tauri v2 core)
│   ├── capabilities/      # Khai báo quyền/hạn chế của ứng dụng
│   ├── src/               # File backend chính (lib.rs, main.rs)
│   └── tauri.conf.json    # Cấu hình biên dịch Tauri
├── src/                   # Mã nguồn Frontend (React + TypeScript)
│   ├── app/               # Shell, Router, ErrorBoundary và Providers
│   ├── assets/            # Tài nguyên tĩnh
│   ├── features/          # Các màn hình nghiệp vụ (HealthScreen, v.v.)
│   ├── infrastructure/    # Kết nối DB SQLite, Migrator, Repositories
│   ├── shared/            # Tiện ích dùng chung (dates, errors, validation)
│   └── main.tsx           # React Entrypoint
├── index.html
├── package.json           # Khai báo dependencies dự án
├── tsconfig.json          # Cấu hình TypeScript compiler
├── vite.config.ts         # Cấu hình Vite bundler
└── vitest.config.ts       # Cấu hình chạy test Vitest
```

## 3. Khởi tạo Database & Migration
Dữ liệu SQLite được lưu trữ cục bộ tại thư mục App Data của hệ thống (ví dụ: `%APPDATA%/Local/com.forex.journal/database/journal.db`).

Ứng dụng sử dụng một bộ chạy migration tự động được viết trong [src/infrastructure/database/migrator.ts](file:///C:/dev/forex-trading-journal/src/infrastructure/database/migrator.ts):
1.  Đảm bảo bảng `schema_migrations` tồn tại.
2.  Đọc danh sách các tệp migration dạng file SQL thuần tĩnh trong [src/infrastructure/database/migrations/](file:///C:/dev/forex-trading-journal/src/infrastructure/database/migrations/).
3.  Tính toán SHA-256 checksum của từng tệp migration (chuẩn hóa CRLF -> LF để đảm bảo checksum không lệch trên Windows/Unix).
4.  Đối chiếu checksum với database, nếu có bất kỳ sự thay đổi (mismatch) nào của file migration cũ đã áp dụng, ứng dụng sẽ quăng lỗi và dừng khởi chạy.
5.  Thực thi các migration mới trong một transaction duy nhất.

## 4. Hướng dẫn thiết lập và phát triển cho Developer

### Yêu cầu hệ thống
*   Node.js v20 trở lên.
*   Rust toolchain (rustup) cài đặt sẵn trên máy Windows.
*   WebView2 Runtime (thường đi kèm sẵn trên Windows 10/11 mới).

### Cài đặt và Chạy Development
```bash
# 1. Cài đặt dependencies
npm install

# 2. Chạy ứng dụng trong môi trường dev (với giao diện Tauri)
npm run tauri dev

# 3. Chạy dev server của riêng Frontend (trong trình duyệt - Không kết nối được SQLite qua Tauri IPC)
npm run dev
```

### Các lệnh kiểm tra chất lượng (Definition of Done)
Trước khi commit bất kỳ thay đổi nào, bạn bắt buộc phải chạy và pass qua các lệnh sau:
```bash
# 1. Kiểm tra lỗi cú pháp và code style tĩnh
npm run lint

# 2. Kiểm tra lỗi kiểu TypeScript
npm run typecheck

# 3. Chạy toàn bộ unit/integration tests
npm run test

# 4. Build bản thử nghiệm Frontend
npm run build

# 5. Build bản release đóng gói Tauri (Tạo EXE & NSIS installer)
npm run tauri build

# 6. Đóng gói bản Portable ZIP (Optional)
npm run build:portable
```

Các gate Rust:

```bash
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

CI chạy các gate frontend/Rust trên push và pull request. Release executable và NSIS installer được
xác minh cục bộ trên Windows; CI không upload database, report hoặc installer.

## 5. Tài liệu đặc tả hệ thống
Toàn bộ các tài liệu đặc tả nghiệp vụ, kiến trúc dữ liệu và quy trình nghiệp vụ được đặt tại thư mục `docs/`.
Lưu ý quan trọng:
*   [00-PROJECT-CONSTITUTION.md](file:///C:/dev/forex-trading-journal/docs/00-PROJECT-CONSTITUTION.md) chứa các nguyên tắc bất biến và tối cao của dự án. Không được vi phạm.
*   [GEMINI.md](file:///C:/dev/forex-trading-journal/GEMINI.md) chứa các hướng dẫn bắt buộc cho AI coding agents.
