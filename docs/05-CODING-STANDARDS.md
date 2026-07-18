# 05. Coding Standards

## 1. TypeScript

- Bật strict mode.
- Không dùng `any` nếu có thể mô hình hóa kiểu.
- Dùng discriminated union cho trạng thái import, trade và review.
- Dùng branded type hoặc wrapper cho ID khi hợp lý.
- Tên hàm thể hiện hành động nghiệp vụ.

Ví dụ tốt:

- `calculateResultR`
- `normalizePositionDeals`
- `createSetupVersion`
- `lockTradeReview`

## 2. Naming

- File: kebab-case.
- React component: PascalCase.
- Function, variable: camelCase.
- Database table và column: snake_case.
- Enum: UPPER_SNAKE_CASE hoặc string literal rõ nghĩa.
- ID luôn có hậu tố `_id` ở database.

## 3. Function design

- Hàm domain ưu tiên pure function.
- Hàm không quá nhiều trách nhiệm.
- Side effect nằm ở application hoặc infrastructure layer.
- Không swallow exception.
- Error phải có context.

## 4. React

- Component trình bày không chứa query phức tạp.
- Form schema tách riêng.
- List lớn phải chuẩn bị cho pagination hoặc virtualization.
- Không dùng effect để đồng bộ state có thể tính trực tiếp.
- Không lưu derived state nếu có thể tính từ nguồn.

## 5. Database

- Query có parameter binding.
- Transaction cho import, replace backup và thao tác nhiều bảng.
- Index cho:
  - account_id
  - external_deal_id
  - position_id
  - open_time
  - setup_version_id
  - review_status
- Không dùng cascade delete bừa bãi.

## 6. Logging

Không log:

- Password.
- API key.
- Toàn bộ file backup.
- Dữ liệu nhạy cảm không cần thiết.

Nên log:

- Import batch ID.
- Parser version.
- Số dòng thành công/lỗi.
- Migration version.
- Lỗi file path đã chuẩn hóa.

## 7. Commit

Format gợi ý:

```text
feat(import): add MT5 CSV preview
fix(trades): preserve partial close ordering
refactor(analytics): extract expectancy calculator
test(setups): cover disqualifier checklist
docs(architecture): update image storage rules
```

Một commit không nên trộn feature, refactor lớn và formatting toàn repo.
