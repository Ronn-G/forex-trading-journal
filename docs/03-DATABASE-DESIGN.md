# 03. Database Design

## 1. Công nghệ

- SQLite.
- @tauri-apps/plugin-sql.
- Migrations lưu trong repository.
- Foreign keys bật bắt buộc.
- WAL mode nếu phù hợp với môi trường desktop.

## 2. Các bảng lõi

### accounts

- id
- name
- broker
- server
- login_masked
- account_currency
- account_type
- timezone
- is_demo
- created_at
- updated_at

### import_batches

- id
- account_id
- source_type
- source_filename
- source_sha256
- parser_version
- status
- total_rows
- imported_rows
- skipped_rows
- error_rows
- started_at
- completed_at

Unique:
- `(account_id, source_sha256)`

### raw_mt5_records

- id
- import_batch_id
- account_id
- record_type
- external_id
- raw_json
- row_number
- created_at

Unique:
- `(account_id, record_type, external_id)`

### mt5_orders

- id
- account_id
- external_order_id
- position_id
- symbol
- order_type
- volume_initial
- volume_current
- open_price
- stop_loss
- take_profit
- placed_at
- closed_at
- comment
- magic_number
- raw_record_id

### mt5_deals

- id
- account_id
- external_deal_id
- external_order_id
- position_id
- symbol
- side
- entry_type
- volume
- price
- commission
- swap
- profit
- executed_at
- comment
- magic_number
- raw_record_id

Unique:
- `(account_id, external_deal_id)`

### trades

- id
- account_id
- position_key
- symbol
- direction
- status
- open_time
- close_time
- entry_price
- exit_price
- total_volume
- gross_profit
- commission
- swap
- net_profit
- initial_stop_loss
- initial_take_profit
- planned_risk_money
- planned_risk_percent
- planned_rr
- result_r
- setup_version_id
- compliance_status
- decision_quality
- execution_grade
- review_status
- normalization_version
- created_at
- updated_at

### trade_deals

- trade_id
- deal_id
- role
- sort_order

Unique:
- `(trade_id, deal_id)`

### trade_groups

- id
- account_id
- title
- thesis
- created_at
- updated_at

### trade_group_members

- trade_group_id
- trade_id
- sort_order

### setups

- id
- name
- code
- description
- status
- created_at
- updated_at

### setup_versions

- id
- setup_id
- version_number
- description
- valid_from
- valid_to
- minimum_rr
- allowed_symbols_json
- allowed_sessions_json
- is_current
- created_at

Unique:
- `(setup_id, version_number)`

### setup_rules

- id
- setup_version_id
- name
- description
- rule_type
- is_required
- weight
- sort_order

### trade_setup_checks

- id
- trade_id
- setup_rule_id
- setup_version_id
- result
- note
- evaluated_at

### trade_images

- id
- trade_id
- image_type
- storage_key
- original_filename
- mime_type
- width
- height
- file_size
- sha256
- timeframe
- caption
- sort_order
- created_at

### trade_links

- id
- trade_id
- link_type
- url
- title
- timeframe
- note
- created_at

### mistake_types

- id
- code
- name
- description
- is_active

### trade_mistakes

- id
- trade_id
- mistake_type_id
- severity
- estimated_cost_r
- note
- created_at

### emotions

- id
- code
- name
- phase
- is_active

### trade_emotions

- id
- trade_id
- emotion_id
- intensity
- note

### trade_reviews

- id
- trade_id
- did_well
- did_wrong
- lesson
- future_action
- decision_quality
- execution_score
- setup_score
- review_duration_seconds
- reviewed_at
- locked_at

### tags
- id
- name

### trade_tags
- trade_id
- tag_id

### backup_receipts

- id
- backup_id
- backup_sha256
- format_version
- imported_at
- mode

## 3. Quy tắc database

- Timestamps lưu ISO UTC.
- Boolean lưu integer 0/1.
- Enum được kiểm soát ở domain layer và database check constraint khi phù hợp.
- Dữ liệu JSON chỉ dùng cho phần khó normalize hoặc snapshot; không dùng thay thế toàn bộ model quan hệ.
- Mọi bảng người dùng sửa được phải có `created_at` và `updated_at`.
- Hard delete bị hạn chế với setup, trade và import.
- Ảnh không lưu blob trực tiếp trong SQLite; chỉ lưu metadata và storage key.
