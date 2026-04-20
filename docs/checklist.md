# CHECKLIST TRIỂN KHAI CHI TIẾT HỆ THỐNG WEB_BETONG
> Phiên bản: 1.0 - nguồn: `docs/solution-spec.md`
> Phạm vi: Phase 1 (Dispatch + Scheduling), Phase 2 (Costing).
> Quy ước nhãn:
> - `[Spec]` nội dung bám trực tiếp từ `solution-spec.md`.
> - `[Suy luận]` đề xuất triển khai bổ sung do spec chưa mô tả hết.
> - `[Chưa xác minh]` cần xác nhận với stakeholder trước khi code.
---
## MỤC LỤC
1. Tổng quan bài toán và mục tiêu
2. Kiến trúc hệ thống đầy đủ
3. Technology stack chi tiết
4. Thiết kế database đầy đủ
5. Đặc tả chức năng đầy đủ (FR-01 → FR-18)
6. UI/UX design system và component library
7. Import/Export, bulk operation và thao tác bảng biểu
8. Checklist triển khai chi tiết theo phase
9. Chiến lược test đầy đủ
10. Yêu cầu phi chức năng (NFR)
11. Triển khai và vận hành
12. Điểm cần chốt trước khi code
13. Tiêu chí nghiệm thu tổng thể
---
## 1. TỔNG QUAN BÀI TOÁN VÀ MỤC TIÊU
### 1.1 Bài toán `[Spec]`
Xây dựng nền tảng điều hành toàn chuỗi bê tông gồm 2 khối lớn:
1. **Dispatch + Scheduling**: điều phối đơn đổ bê tông tươi, lập lịch 24 xe trộn, 03 cần bơm, nhiều trạm.
2. **Costing**: tính giá thành từ khai thác đá → nghiền → tồn kho → phối trộn → giao hàng → giá vốn → biên lợi nhuận.

### 1.2 Mục tiêu cốt lõi `[Spec]`
- Gom nhu cầu từ 08 đầu mối sale về 01 hệ thống thống nhất.
- Tự động gợi ý lịch cho 24 xe + 03 cần bơm.
- Giảm trùng lịch, thiếu xe, thiếu cần, trễ giờ, nghẽn trạm.
- Giảm km rỗng, tăng vòng quay xe.
- Chuẩn hóa giá bán theo công thức cấu hình được (không hard-code).
- Chuẩn hóa dữ liệu chi phí, tính giá thành theo kỳ/sản phẩm.
- Kết nối doanh thu - giá vốn - biên lợi nhuận theo đơn và công trình.

### 1.3 KPI đề xuất `[Spec]`
- On-time delivery ≥ 90% giai đoạn đầu.
- Xung đột sau auto schedule < 5%.
- Km rỗng giảm 10-20% sau 3-6 tháng.
- Dữ liệu actual đầy đủ ≥ 95%.
- 100% báo giá sinh từ bảng giá cấu hình.
- Có báo cáo unit cost đá/bê tông theo kỳ.

### 1.4 Vai trò người dùng `[Spec]`
- **System Admin** - quản trị nền tảng.
- **Sales** - khách hàng, công trình, báo giá, yêu cầu đổ.
- **Sales Manager** - duyệt discount/override giá.
- **Dispatcher** - duyệt đơn, chốt trạm, chốt cần, lập lịch, override.
- **Plant Operator** - queue, load start/end, batch ticket.
- **Driver** - nhận chuyến, check-in/out, ghi event.
- **Pump Crew** - setup, start/end pump, m3 thực tế.
- **Ops Manager** - dashboard, KPI, duyệt thay đổi lớn.
- **Cost Accountant** - kỳ giá thành, allocation, costing.
- **Director/Finance** - báo cáo margin, unit cost.

---
## 2. KIẾN TRÚC HỆ THỐNG ĐẦY ĐỦ
### 2.1 Sơ đồ container (logic services)
- **Web App (Next.js)**: admin, sales, dispatcher, ops, finance.
- **Mobile Web/PWA**: driver, pump crew (offline-first).
- **API Gateway (Nginx/Traefik)**: reverse proxy, TLS termination, rate limit.
- **Backend API (FastAPI)**: REST + WebSocket/SSE cho realtime.
- **Worker (Celery/RQ)**: scheduler, notification, costing, KPI aggregation.
- **Realtime broker (Redis Pub/Sub)**: push dispatch board updates.
- **PostgreSQL 16 + PostGIS**: OLTP transactional.
- **Redis**: cache, session, queue, pub/sub.
- **MinIO/S3**: file attachment (ảnh hiện trường, PDF, phiếu batch).
- **Observability stack**: Prometheus + Grafana + Sentry + Loki.

### 2.2 Kiến trúc tầng `[Spec]` + `[Suy luận]`
- **Presentation Layer**: Next.js 15 App Router, mobile web, print templates.
- **API Layer**: auth middleware, validation (Pydantic), serialization, versioning `/api/v1`.
- **Application Layer**: use cases - CreateRequest, CalculatePrice, RunScheduler, CloseCostPeriod.
- **Domain Layer**: aggregates của pricing, dispatch, inventory, costing; invariants, policies.
- **Infrastructure Layer**: ORM (SQLAlchemy 2.x), map adapter, notification adapter, storage adapter, email adapter.
- **Worker Layer**: optimizer job, notification fanout, aggregates, costing job, kpi job.
- **Reporting Layer**: materialized views, denormalized read models cho dashboard.

### 2.3 Kiến trúc dữ liệu cho tốc độ cao `[Spec]`
- OLTP chuẩn hóa, Redis cho hot cache + realtime summary.
- Materialized views cho dashboard nặng.
- Partition theo thời gian cho `trip_events`, `audit_logs`, `inventory_transactions`, `location_logs`.
- PostGIS cho geospatial queries.
- CQRS-lite: ghi vào bảng giao dịch, đọc từ view/read-model khi cần.

### 2.4 Nguyên tắc API `[Suy luận]`
- REST với versioning `/api/v1/...`, JSON snake_case.
- Chuẩn pagination: `page`, `page_size`, `sort`, `filter[key]=value`.
- Chuẩn response: `{data, meta: {pagination, request_id}, errors}`.
- Idempotency key cho POST ghi event quan trọng (trip event, pump event, inventory movement).
- Tất cả mutation quan trọng trả về resource sau khi thay đổi.
- WebSocket/SSE endpoint `/ws/dispatch` cho dispatch board.

### 2.5 Kiến trúc bảo mật `[Spec]` + `[Suy luận]`
- TLS everywhere (HSTS, TLS ≥ 1.2).
- Password Argon2id.
- JWT access 10-15 phút + refresh rotation, refresh hash trong DB, revoke qua `user_sessions`.
- RBAC theo role + scope (plant_id, business_unit_id).
- Rate limit theo IP + theo user cho API public/mobile.
- Signed URL cho file attachments (hết hạn 10-30 phút).
- Secrets qua env/secret manager, không commit.
- CSRF protection cho web forms.
- CSP, X-Frame-Options, X-Content-Type-Options.
- Audit log toàn bộ thay đổi giá, lịch, quyền, cost period.

### 2.6 Observability `[Suy luận]`
- Structured logs JSON có `request_id`, `user_id`, `tenant_id`.
- Prometheus metrics: request latency, error rate, scheduler job duration, queue depth.
- Sentry cho exception + release tracking.
- Healthchecks: `/healthz` (liveness), `/readyz` (readiness).
- Tracing (OpenTelemetry) cho các worker job dài.
- SLO dashboard: availability, scheduler p95, API p95.

### 2.7 Quy tắc code `[Suy luận]`
- Python: `ruff`, `black`, `mypy --strict`, `pytest` với `pytest-cov`.
- TypeScript: `eslint`, `prettier`, `tsc --noEmit`, `vitest`/`jest`, `playwright`.
- Commit convention: Conventional Commits.
- Nhánh: `main` (prod), `develop` (staging), `feature/*`, `fix/*`.
- PR bắt buộc review, CI xanh, coverage không giảm.

---
## 3. TECHNOLOGY STACK CHI TIẾT
### 3.1 Frontend `[Spec]` + `[Suy luận]`
- Next.js 15+, TypeScript strict mode, App Router, RSC nơi phù hợp.
- TanStack Query (cache, invalidation, optimistic updates).
- Zustand (client state nhẹ, stable); cân nhắc Redux Toolkit nếu state rất phức tạp.
- UI framework: **shadcn/ui + Tailwind CSS + Radix UI** (template chuẩn, nhanh, accessible).
- Data grid: **TanStack Table v8** + virtualization `@tanstack/react-virtual`.
- Form: **React Hook Form + Zod** (validation đồng bộ với Pydantic schema bên backend qua OpenAPI codegen).
- Chart: **Recharts** hoặc **Apache ECharts** cho dashboard; ECharts cho Gantt-friendly/heatmap.
- Gantt: **gantt-schedule-timeline-calendar** hoặc **Bryntum Gantt** (trial) hoặc tự build trên `@dnd-kit` + virtualization `[Chưa xác minh]`.
- Map: **MapLibre GL** + PostGIS tile server.
- Date/time: **date-fns** + **date-fns-tz** (UTC, hiển thị Asia/Ho_Chi_Minh).
- Toast/notification: **Sonner**.
- Command palette: **cmdk**.
- WebSocket/SSE: native EventSource + fallback polling.
- i18n: **next-intl** (vi-VN mặc định, en-US phòng mở rộng).
- Icon: **lucide-react**.
- Testing: **Vitest** unit, **Playwright** e2e, **Testing Library**.

### 3.2 Backend `[Spec]` + `[Suy luận]`
- Python 3.12, FastAPI, Uvicorn/Gunicorn.
- Pydantic v2 schemas.
- SQLAlchemy 2.x (typed, async), Alembic migrations.
- Celery + Redis broker hoặc RQ.
- OR-Tools (Phase 5) cho optimizer v2.
- Auth: `passlib` (Argon2), `pyjwt`.
- Excel/CSV: **openpyxl**, **pandas** (chỉ trong job nặng) hoặc **polars**.
- PDF: **WeasyPrint** hoặc **ReportLab**.
- HTTP client: **httpx** (async).
- Geospatial: **shapely**, **geoalchemy2**.
- Validation import: Pydantic + custom row validator.

### 3.3 Database & Storage
- PostgreSQL 16 + PostGIS 3.x.
- Redis 7.x.
- MinIO (local) / AWS S3 (prod) - lifecycle rule cho file cũ.

### 3.4 Infrastructure
- Docker + docker-compose cho dev.
- Kubernetes (tùy chọn) hoặc Docker Swarm cho prod `[Chưa xác minh]`.
- Nginx/Traefik reverse proxy, Let's Encrypt.
- GitHub Actions / GitLab CI.

### 3.5 Monitoring
- Prometheus + Grafana.
- Sentry.
- Loki (hoặc ELK) cho log aggregation.
- Uptime Kuma cho external ping.

---
## 4. THIẾT KẾ DATABASE ĐẦY ĐỦ
### 4.1 Nguyên tắc thiết kế `[Spec]`
- PostgreSQL 16 + PostGIS.
- Primary key UUID v7 (time-ordered) hoặc v4.
- Tiền: `DECIMAL(18,2)`. Số lượng/m3/tấn: `DECIMAL(18,3)`.
- Thời gian `TIMESTAMPTZ` UTC; hiển thị Asia/Ho_Chi_Minh.
- Rule linh hoạt dùng `JSONB`, có index GIN.
- Bảng log lớn partition theo tháng.
- Transactional data append-only, ưu tiên snapshot thay vì update in-place.
- Mỗi bảng có: `created_at`, `updated_at`, `created_by`, `updated_by`, `version` (optimistic locking).
- Soft delete: `deleted_at NULL` cho master data; không dùng soft delete cho transaction ledger.

### 4.2 Nhóm IAM & Organization `[Spec]`
- `organizations` (id, code, name, legal_name, tax_code, timezone, base_currency, status, settings_json).
- `business_units` (id, organization_id, parent_id, code, name, unit_type, address, status).
- `users` (id, organization_id, employee_id, username, email, phone, password_hash, full_name, status, last_login_at, locale, timezone).
- `roles` (id, organization_id, code, name, description, is_system).
- `permissions` (id, module_code, action_code, description).
- `role_permissions` (id, role_id, permission_id).
- `user_roles` (id, user_id, role_id, business_unit_id, is_primary).
- `employees` (id, organization_id, employee_no, full_name, department, position, employment_type, hire_date, status, default_shift_group).
- `user_sessions` (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at, revoked_at).

### 4.3 Nhóm master data `[Spec]`
- `customers` (id, organization_id, code, customer_type, name, tax_code, billing_address, payment_terms_days, credit_limit, status).
- `customer_contacts` (id, customer_id, full_name, phone, email, position, is_primary).
- `site_access_profiles` (id, organization_id, code, name, difficulty_level, narrow_alley, restricted_hours_json, max_vehicle_weight_ton, bad_road_level, high_floor_level, requires_pump, preferred_pump_type, extra_setup_minutes, extra_risk_score, notes).
- `project_sites` (id, organization_id, customer_id, code, site_name, site_type, address_line, ward, district, city, latitude, longitude, geom, access_profile_id, default_contact_id, default_plant_id, status).
- `plants` (id, organization_id, business_unit_id, code, name, address, latitude, longitude, geom, max_output_m3_per_hour, loading_bays_count, default_load_minutes, default_wash_minutes, status).
- `plant_loading_bays` (id, plant_id, bay_code, sequence_no, max_concurrent_trucks, status).
- `vehicle_types` (id, organization_id, code, name, default_capacity_m3, notes).
- `vehicles` (id, organization_id, vehicle_type_id, home_plant_id, plate_no, capacity_m3, effective_capacity_m3, status, current_odometer_km, driver_employee_id, gps_device_code, last_maintenance_at, next_maintenance_due_at).
- `pumps` (id, organization_id, home_plant_id, code, pump_type, boom_length_m, capacity_m3_per_hour, default_setup_minutes, default_teardown_minutes, status).
- `assets` (id, organization_id, cost_center_id, asset_code, asset_name, asset_type, serial_no, commissioned_at, status).
- `materials` (id, organization_id, code, name, material_type, uom, density, default_cost_method, status).
- `concrete_products` (id, organization_id, code, name, grade_code, slump, strength_mpa, is_pumpable, base_uom, status).
- `mix_designs` (id, organization_id, concrete_product_id, code, effective_from, effective_to, yield_m3, status, notes).
- `mix_design_components` (id, mix_design_id, material_id, quantity_per_batch, quantity_per_m3, loss_factor_pct).

### 4.4 Nhóm pricing & sales `[Spec]`
- `price_books` (id, organization_id, code, name, region_scope, customer_scope, effective_from, effective_to, status, priority).
- `price_rules` (id, price_book_id, rule_type, rule_name, condition_json, formula_json, priority, is_active).
- `quotations` (id, organization_id, customer_id, site_id, quotation_no, price_book_id, valid_from, valid_to, status, notes).
- `quotation_items` (id, quotation_id, concrete_product_id, quoted_volume_m3, base_price, distance_fee, difficulty_fee, pump_fee, surcharge_fee, discount_fee, final_unit_price, pricing_snapshot_json).
- `sales_orders` (id, organization_id, customer_id, site_id, quotation_id, order_no, contract_no, ordered_by_user_id, payment_terms_days, status, notes).
- `pour_requests` (id, organization_id, sales_order_id, request_no, customer_id, site_id, concrete_product_id, requested_volume_m3, requested_date, requested_start_at, requested_end_at, pour_method, requires_pump, expected_pump_type, difficulty_level, site_contact_name, site_contact_phone, special_constraints_json, status).
- `pour_request_time_windows` (id, pour_request_id, window_start_at, window_end_at, priority).
- `price_calculation_snapshots` (id, organization_id, source_type, source_id, price_book_id, input_snapshot_json, result_snapshot_json, final_unit_price, calculated_at, calculated_by).

### 4.5 Nhóm dispatch & scheduling `[Suy luận]`
- `operational_shifts` (id, organization_id, plant_id, shift_code, start_at, end_at, status, notes).
- `vehicle_availabilities` (id, vehicle_id, shift_id, available_from, available_to, status, reason).
- `pump_availabilities` (id, pump_id, shift_id, available_from, available_to, status, reason).
- `resource_locks` (id, resource_type, resource_id, lock_from, lock_to, reason, locked_by, locked_at).
- `plant_capacity_slots` (id, plant_id, slot_start, slot_end, max_m3, max_trucks, remaining_m3, remaining_trucks).
- `travel_estimates` (id, origin_plant_id, destination_site_id, time_bucket, duration_minutes, distance_km, source, updated_at) - partition theo tháng.
- `schedule_runs` (id, organization_id, run_no, run_type, triggered_by, input_snapshot_json, status, started_at, finished_at, score_total, explanation_json).
- `dispatch_orders` (id, pour_request_id, assigned_plant_id, assigned_pump_id, target_truck_rhythm_minutes, locked_fields_json, status, approved_by, approved_at, notes).
- `scheduled_trips` (id, dispatch_order_id, schedule_run_id, sequence_no, vehicle_id, planned_load_at, planned_depart_at, planned_arrive_at, planned_unload_start_at, planned_unload_end_at, planned_return_at, volume_m3, status, is_locked, locked_by, locked_at, version).
- `schedule_conflicts` (id, schedule_run_id, conflict_type, severity, entity_type, entity_id, message, suggestion).
- `schedule_versions` (id, schedule_run_id, version_no, snapshot_json, created_at, created_by).
- `manual_overrides` (id, scheduled_trip_id, before_snapshot_json, after_snapshot_json, reason, overridden_by, overridden_at).

### 4.6 Nhóm trip execution & actuals `[Suy luận]`
- `trips` (id, scheduled_trip_id, dispatch_order_id, vehicle_id, driver_employee_id, plant_id, site_id, planned_volume_m3, actual_volume_m3, status, started_at, finished_at).
- `trip_events` (id, trip_id, event_type, event_time, location_geom, meta_json, recorded_by, device_id, idempotency_key, created_at) - partition theo tháng; event_type ∈ {assigned, accepted, check_in_plant, load_start, load_end, depart_plant, arrive_site, pour_start, pour_end, leave_site, return_plant, cancelled}.
- `pump_sessions` (id, dispatch_order_id, pump_id, crew_employee_id, status, setup_start_at, setup_end_at, pour_start_at, pour_end_at, teardown_start_at, teardown_end_at, actual_m3, notes).
- `pump_events` (id, pump_session_id, event_type, event_time, meta_json, recorded_by, idempotency_key) - partition theo tháng.
- `attachments` (id, entity_type, entity_id, file_key, file_name, content_type, size_bytes, uploaded_by, uploaded_at).
- `gps_pings` (id, vehicle_id, captured_at, geom, speed_kmh, heading, accuracy_m) - partition theo ngày.
- `notifications` (id, organization_id, topic, recipient_user_id, channel, payload_json, status, sent_at, delivered_at, error).
- `offline_sync_queue` (id, device_id, user_id, action_type, payload_json, created_at, synced_at, status).
- `batch_tickets` (id, plant_id, scheduled_trip_id, ticket_no, mix_design_id, planned_volume_m3, actual_volume_m3, issued_at, status, batched_by) - batch ticket trạm trộn.
- `batch_ticket_components` (id, batch_ticket_id, material_id, planned_qty, actual_qty, variance_qty).

### 4.7 Nhóm inventory `[Suy luận]`
- `warehouses` (id, organization_id, plant_id, code, name, type, status).
- `warehouse_locations` (id, warehouse_id, code, name, status).
- `inventory_balances` (id, warehouse_id, location_id, material_id, period_id, opening_qty, receipts_qty, issues_qty, transfer_in_qty, transfer_out_qty, adjustment_qty, waste_qty, closing_qty, avg_cost, total_value).
- `inventory_transactions` (id, transaction_no, transaction_type, transaction_time, warehouse_id, location_id, material_id, qty, unit_cost, total_value, source_type, source_id, reason, notes, created_by, created_at) - partition theo tháng; transaction_type ∈ {receipt, issue, transfer_in, transfer_out, adjustment, waste, count_variance, production_in, production_out}.
- `goods_receipts` (id, receipt_no, warehouse_id, supplier, receipt_date, status, total_value, notes, created_by).
- `goods_receipt_lines` (id, receipt_id, material_id, qty, unit_cost, total_value, lot_no).
- `goods_issues` (id, issue_no, warehouse_id, issue_type, issue_date, status, total_value, reference_type, reference_id, notes).
- `goods_issue_lines` (id, issue_id, material_id, qty, unit_cost, total_value).
- `stock_transfers` (id, transfer_no, from_warehouse_id, to_warehouse_id, transfer_date, status).
- `stock_transfer_lines` (id, transfer_id, material_id, qty, unit_cost).
- `stock_adjustments` (id, adjustment_no, warehouse_id, adjustment_date, reason_code, status, total_value).
- `stock_adjustment_lines` (id, adjustment_id, material_id, qty_delta, unit_cost).
- `stock_takes` (id, stock_take_no, warehouse_id, period_id, status, started_at, finished_at).
- `stock_take_lines` (id, stock_take_id, material_id, system_qty, counted_qty, variance_qty, notes).

### 4.8 Nhóm production `[Suy luận]`
- `crushing_lines` (id, plant_id, code, name, capacity_tph, status).
- `crushing_shifts` (id, crushing_line_id, shift_code, start_at, end_at, supervisor_employee_id, status).
- `crushing_runs` (id, crushing_shift_id, input_material_id, output_material_id, start_at, end_at, input_qty_ton, output_qty_ton, runtime_minutes, downtime_minutes, electricity_kwh, notes).
- `crushing_downtimes` (id, crushing_run_id, reason_code, start_at, end_at, duration_minutes, notes).
- `concrete_batches` (id, plant_id, shift_id, batch_no, mix_design_id, planned_volume_m3, actual_volume_m3, batched_at, quality_note, status) - tương quan với `batch_tickets` cho các lô tự dùng/không thuộc trip.
- `electricity_readings` (id, plant_id, meter_code, reading_at, reading_kwh, source).
- `labor_timesheets` (id, employee_id, cost_center_id, work_date, hours, overtime_hours, shift_code, notes).
- `maintenance_logs` (id, asset_id, cost_center_id, maintenance_date, type, description, cost, status).
- `depreciation_schedules` (id, asset_id, cost_center_id, period_id, depreciation_amount, method, notes).

### 4.9 Nhóm costing `[Suy luận]`
- `cost_centers` (id, organization_id, code, name, type, parent_id, status).
- `cost_objects` (id, organization_id, code, name, object_type, reference_type, reference_id, status).
- `cost_periods` (id, organization_id, period_code, period_type, start_date, end_date, status, closed_at, closed_by).
- `cost_pools` (id, period_id, cost_center_id, pool_type, total_amount).
- `cost_pool_lines` (id, cost_pool_id, source_type, source_id, amount, notes).
- `allocation_rules` (id, organization_id, code, name, source_cost_center_id, basis, target_scope_json, formula_json, priority, status).
- `allocation_runs` (id, period_id, status, triggered_by, started_at, finished_at, summary_json).
- `allocation_results` (id, allocation_run_id, rule_id, source_cost_center_id, target_cost_object_id, allocated_amount, basis_qty, notes).
- `unit_cost_snapshots` (id, period_id, cost_object_id, output_qty, direct_material, direct_labor, utilities, maintenance, depreciation, allocated_overhead, byproduct_credit, unit_cost, total_cost, snapshot_at).
- `margin_snapshots` (id, period_id, sales_order_id, pour_request_id, revenue, cost_of_goods_sold, gross_margin, gross_margin_pct, snapshot_at).

### 4.10 Nhóm reporting & BI `[Suy luận]`
- Materialized view `mv_daily_operation_kpi` (organization_id, date, plant_id, trips_count, m3_delivered, on_time_pct, avg_cycle_minutes, empty_km).
- Materialized view `mv_vehicle_utilization` (organization_id, date, vehicle_id, trips_count, utilization_pct, empty_km).
- Materialized view `mv_pump_utilization` (organization_id, date, pump_id, sessions_count, utilization_pct, total_m3).
- Materialized view `mv_margin_by_order` (period_id, sales_order_id, revenue, cogs, margin, margin_pct).
- Refresh schedule: daily 00:30 + on-demand sau close period.

### 4.11 Nhóm system - config, audit, notification `[Suy luận]`
- `system_settings` (id, organization_id, key, value_json, description, updated_by, updated_at) - lưu travel speed mặc định, load/unload time, buffer time (FR-11).
- `feature_flags` (id, organization_id, flag_code, enabled, scope_json, notes).
- `audit_logs` (id, organization_id, user_id, entity_type, entity_id, action, before_json, after_json, ip_address, user_agent, request_id, logged_at) - partition theo tháng.
- `notification_templates` (id, organization_id, code, channel, subject, body_template, variables_json, status).
- `webhook_endpoints` (id, organization_id, code, url, secret_hash, events_json, status).
- `api_tokens` (id, organization_id, name, token_hash, scope_json, expires_at, created_by) - cho tích hợp ngoài.

### 4.12 Indexing & partitioning `[Suy luận]`
- Index B-Tree trên FK, code, status thường xuyên filter.
- Index GIN trên `*_json` trường query.
- Index GIST trên `geom` (PostGIS).
- Index hỗ trợ scheduler: `(plant_id, shift_id)` trên availability, `(vehicle_id, planned_depart_at)` trên scheduled_trips.
- Partition theo tháng: `trip_events`, `pump_events`, `audit_logs`, `inventory_transactions`, `travel_estimates`. Partition theo ngày: `gps_pings`.
- Primary read path trên materialized views cho dashboard.

---
## 5. ĐẶC TẢ CHỨC NĂNG ĐẦY ĐỦ (FR-01 → FR-18)
> Mỗi FR gồm: mục tiêu, dữ liệu/API, business rules, UI/UX bắt buộc, validation, import/export, edge cases.

### 5.1 FR-01 - Quản lý khách hàng, công trình `[Spec]` + `[Suy luận]` về UI
**Mục tiêu**: chuẩn hóa đầu vào cho sales và dispatch.
**API/Dữ liệu**: CRUD `customers`, `customer_contacts`, `project_sites`, `site_access_profiles` + lookup address geocode.
**Business rules**:
- Mỗi công trình phải có địa chỉ hợp lệ.
- Geocode trước khi đưa vào auto scheduling.
- Điều kiện công trình phải mở rộng được (JSONB).
**UI/UX**:
- Trang list customer/site dùng data grid có server-side pagination, multi-filter, sort cột, quick search.
- Side drawer form tạo/sửa với bước wizard (Info → Address → Contacts → Access profile).
- Map picker MapLibre, click để chọn tọa độ, search địa chỉ bằng geocode adapter.
- Upload ảnh hiện trường, bản vẽ (drag-drop, preview, resize trước upload).
- Trường `access_profile` dạng form động (difficulty_level, narrow_alley, restricted_hours, v.v.).
- Hover row xem nhanh info, click mở detail.
**Validation**:
- Tọa độ trong range hợp lệ; nếu không geocode được, cảnh báo nhưng vẫn cho lưu với flag `needs_review`.
- Số điện thoại định dạng VN; email RFC.
**Import/Export**:
- Import Excel/CSV cho `customers` và `project_sites` (template đi kèm, preview trước khi commit, report lỗi từng dòng).
- Export danh sách filter hiện tại ra Excel/CSV.

### 5.2 FR-02 - Bảng giá, báo giá, pricing engine `[Spec]` + `[Suy luận]`
**Mục tiêu**: chuẩn hóa giá bán, cấu hình được theo hiệu lực.
**Rule types**: `BasePrice`, `DistanceFee`, `DifficultyFee`, `PumpFee`, `Surcharge`, `Discount`.
**API**: `POST /api/v1/pricing/preview` (input: product, site, volume, pump_type, pour_time) trả về `FinalUnitPrice` + breakdown.
**Business rules**:
- Không hard-code công thức; engine đọc rule từ DB.
- Rule versioned theo thời gian hiệu lực.
- Snapshot pricing khi chốt quotation.
**UI/UX**:
- Price book editor: dạng bảng với hàng rule, cột (rule_type, condition, formula, priority, effective, active).
- Inline edit, drag để sắp priority, preview test case ngay bên phải.
- JSON condition có syntax highlight (Monaco editor) + validation schema.
- Quotation builder: form chọn customer → site → product → volume, click "Tính giá" hiển thị breakdown dạng bảng; cho phép manual override discount với lý do và approval.
- PDF preview báo giá theo template chuẩn.
**Validation**:
- `effective_from < effective_to`.
- Formula parse được, không divide-by-zero.
- Rule không trùng priority trong cùng scope.
**Import/Export**:
- Import bảng giá từ Excel (mỗi sheet một rule_type).
- Export báo giá PDF/Excel gửi khách.

### 5.3 FR-03 - Tạo yêu cầu đổ bê tông `[Spec]` + `[Suy luận]`
**Mục tiêu**: chuẩn hóa đơn vận hành.
**Dữ liệu bắt buộc**: mã, khách hàng, công trình, mác, m3, time window, pour_method, độ khó, contact.
**API**: CRUD `sales_orders`, `pour_requests`, `pour_request_time_windows`; `POST /api/v1/pour-requests/{id}/calc-price`.
**Business rules**:
- Một sales order có nhiều pour request.
- Đính kèm file hiện trường.
- Cảnh báo nếu thiếu dữ liệu (geocode, access profile) làm scheduler hoạt động kém.
**UI/UX**:
- Wizard 4 bước: Customer/Site → Product/Volume → Time window → Constraints/Files.
- Quick create: modal 1 trang cho đơn đơn giản.
- Bên phải form có panel "Pricing preview" tự tính lại mỗi khi input đổi.
- Badge cảnh báo dữ liệu thiếu (geocode, access profile) và gợi ý fix nhanh.
- Nhiều time window: repeater row, drag để sắp priority.
**Validation**:
- `requested_volume_m3 > 0`.
- Time window không chồng nhau.
- Nếu `requires_pump = true` thì phải chọn expected_pump_type.
**Import/Export**:
- Nhập hàng loạt pour request qua Excel cho dự án lớn.
- Export danh sách đơn theo filter.

### 5.4 FR-04 - Duyệt điều phối `[Spec]` + `[Suy luận]`
**Mục tiêu**: biến đơn sale thành đơn dispatch khả thi.
**API**: `POST /pour-requests/{id}/approve|reject|request-info`; `PATCH /dispatch-orders/{id}` để assign plant/pump/lock field.
**UI/UX**:
- Inbox dispatcher với tab "Chờ duyệt / Đã duyệt / Từ chối / Cần bổ sung".
- Modal duyệt có checklist validation, dropdown trạm, dropdown pump, input target_rhythm, toggle lock field (plant, pump, window).
- Preview nhanh Gantt mini trong modal để xem tác động.
**Business rules**:
- Đơn chưa duyệt không phát hành.
- Scheduler tôn trọng locked_fields.
- Thay đổi sau publish phải ghi audit before/after.

### 5.5 FR-05 - Máy lập lịch tự động `[Spec]`
**Mục tiêu**: gợi ý lịch khả thi, giảm xung đột, giảm km rỗng.
**Input**: pour request đã duyệt, plant capacity, xe/pump availability, ETA, tham số load/unload/setup/wash, locks.
**Output**: scheduled trips, conflict list, explanation score.
**Thuật toán v1 heuristic**:
1. Normalize input.
2. Chọn candidate plant.
3. Tính ETA, cycle time (`load + outbound + wait_site + unload_or_pump + cleanup + return`).
4. `required_trip_count = ceil(volume / effective_capacity)`.
5. `required_concurrent_trucks = ceil((pump_rate * cycle / 60) / effective_capacity)`.
6. Sắp đơn theo ưu tiên: time window chặt → có pump → volume lớn → khó.
7. Greedy assign: plant gần, xe home plant, giữ nhịp đều, giảm queue/empty km.
8. Sinh conflict list.
9. Trả explanation (lý do chọn plant, vehicle, v.v.).
**UI/UX**:
- Button "Chạy scheduler" trên dispatch board, modal progress + cancel.
- Panel bên phải hiển thị conflict list với severity và gợi ý fix (click để áp dụng).
- Nút "Xem giải thích" cho từng trip.
**v2 OR-Tools**: VRPTW + plant capacity + resource constraints; objective: khả thi → đúng giờ → giảm empty km → giảm nghẽn → cân bằng utilization.

### 5.6 FR-06 - Gantt board & manual override `[Spec]` + `[Suy luận]`
**UI/UX**:
- Gantt theo tài nguyên (rows: vehicle/pump, columns: thời gian) và Gantt theo đơn (rows: pour request).
- Zoom: 15ph/1h/4h/1 ngày/1 tuần.
- Drag-drop đổi thời gian/tài nguyên; hiển thị snap lines.
- Color code theo status: planned (xám), released (xanh), in-progress (vàng), done (xanh lá), conflict (đỏ).
- Click trip mở side panel chi tiết (event log, override history).
- Nút khóa chuyến/đơn với lý do bắt buộc; icon ổ khóa hiển thị.
- Realtime conflict detection sau mỗi drag: chạy checker, highlight đỏ, toast thông báo.
- Version history: timeline slider để xem snapshot trước/sau.
**Business rules**:
- Manual override thắng auto.
- Trip locked không re-optimize trừ khi có quyền.
- Thay đổi ảnh hưởng hiện trường → push realtime notification.

### 5.7 FR-07 - Station queue & phát hành lệnh chạy `[Spec]` + `[Suy luận]`
**UI/UX**:
- Màn hình live cho plant operator: swimlane theo loading bay, card trip tới trạm, status (chờ, đang load, done).
- Thao tác "Confirm Load Start / Load End" từ tablet/PC.
- Chỉ báo số xe đang chờ ở plant, cảnh báo nếu vượt loading bays.
- Batch ticket auto-sinh khi load start (dùng mix_design hiện hành), editable before commit.
**Business rules**:
- Tổng volume slot không vượt năng lực; vượt → conflict.
- Plant unavailable tạm thời → scheduler tránh cấp mới.

### 5.8 FR-08 - App tài xế `[Spec]` + `[Suy luận]`
**UI/UX**:
- Mobile web/PWA, tối ưu tap target ≥ 44px, font ≥ 16px.
- Home: danh sách chuyến hôm nay, card lớn với thông tin quan trọng (plant, site, volume, giờ).
- Nút to "Nhận chuyến → Check-in → Load Start → Load End → Depart → Arrive → Pour Start → Pour End → Leave → Return" - flow theo state machine.
- Camera để chụp ảnh phiếu/chứng từ.
- Input ghi chú phát sinh.
- Banner đỏ khi offline; queue pending event hiển thị.
- Auto GPS ping mỗi 30-60s khi trip active.
**Business rules**:
- Event log append-only, idempotent theo `idempotency_key`.
- Offline sync: queue IndexedDB, retry với exponential backoff.

### 5.9 FR-09 - App tổ bơm `[Spec]` + `[Suy luận]`
**UI/UX**:
- Giao diện tương tự driver, focus vào pump session.
- Timeline setup → pour → teardown.
- Nhập m3 actual bơm theo lô (nhiều trip về cùng site).
- Ghi phát sinh độ khó/chờ/phụ phí với dropdown lý do chuẩn.
- Đính kèm biên bản ký điện tử (checkbox + chữ ký số nội bộ).

### 5.10 FR-10 - Chốt actual, đối soát, KPI `[Spec]` + `[Suy luận]`
**UI/UX**:
- Màn reconciliation cuối ca: bảng so sánh kế hoạch vs thực tế theo đơn.
- Highlight sai lệch volume, trip count, timing.
- Dropdown lý do lệch (ví dụ: xe hỏng, tắc đường, khách chậm).
- Dashboard KPI Ops Manager:
  - On-time delivery %.
  - Conflict rate.
  - Avg cycle time.
  - Truck utilization.
  - Pump utilization.
  - Trips/day.
  - Volume theo site/customer.
  - Empty km (nếu có GPS).
- Drill-down từ chart → trip → event log.
**API**: `POST /trips/{id}/close-actual`, `GET /kpi/daily?date=...`.

### 5.11 FR-11 - Cấu hình hệ thống `[Spec]` + `[Suy luận]`
**UI/UX**:
- Trang Settings chia tab: General, Operational Defaults, Scheduler Parameters, Integrations, Notifications.
- Form cấu hình: tốc độ di chuyển theo vùng/khung giờ, load/unload time theo plant, setup/teardown theo pump type, effective capacity theo vehicle type, buffer time.
- Mỗi thay đổi ghi audit + diff view.
- Sandbox test: nhập một test case, xem scheduler preview output với setting mới.

### 5.12 FR-12 - Tích hợp map, thông báo, webhook `[Spec]` + `[Suy luận]`
**Adapter**:
- Map: primary + fallback provider (Google Maps, OSRM, Mapbox). Interface `IMapAdapter` với `geocode`, `reverseGeocode`, `route`, `eta`.
- Notification: Zalo OA, SMS (Twilio/local), Email (SMTP/SES).
- Webhook: outbound với HMAC signature.
- Export Excel/PDF qua worker (queue).
**UI/UX**:
- Trang quản lý provider, test connection nút.
- Log tích hợp (success/fail, latency).

### 5.13 FR-13 - Cost center, period, object `[Spec]` + `[Suy luận]`
**UI/UX**:
- Tree view cho cost center.
- Danh sách cost object có filter theo loại.
- Period calendar: chọn kỳ (day/week/month), trạng thái open/closed.
- Workflow close period: checklist bắt buộc (đủ chứng từ, đủ sản lượng, allocation run xanh).

### 5.14 FR-14 - Inventory `[Spec]` + `[Suy luận]`
**UI/UX**:
- Trang warehouse list + tree location.
- Form nhập kho (receipt): chọn supplier, date, line items với autocomplete material.
- Form xuất kho (issue) tương tự.
- Transfer: from/to warehouse với validate qty khả dụng.
- Adjustment: reason code bắt buộc, attach tài liệu.
- Trang "Tồn kho hiện tại" data grid có cột (material, warehouse, location, on_hand, reserved, available, avg_cost, total_value).
- Drill-down tồn kho → lịch sử transaction.
- Stock take wizard: plan → count → review → post.
**Business rules**:
- Mỗi movement có source reference.
- Không sửa ending balance trực tiếp.
**Import/Export**:
- Import phiếu nhập từ Excel.
- Export snapshot tồn kho theo kỳ.

### 5.15 FR-15 - Sản xuất đá & bê tông `[Spec]` + `[Suy luận]`
**UI/UX**:
- Form ghi nhận ca nghiền: start/end, dây chuyền, input stone, output stone, runtime, downtime (multi-line lý do), electricity.
- Form batch ticket bê tông: tự fill từ trip (FR-07), cho phép điều chỉnh actual component.
- Cảnh báo khi actual vs mix design lệch quá ngưỡng.

### 5.16 FR-16 - Costing engine `[Spec]` + `[Suy luận]`
**Business logic**:
- Cost pool: Direct Material, Direct Labor, Utilities, Maintenance, Depreciation, Overhead.
- Allocation basis: sản lượng, runtime, tỷ lệ cấu hình.
- Công thức: `UnitCost = (DM + DL + Util + Maint + Dep + Overhead - ByproductCredit) / OutputQty`.
- Snapshot khi close period.
**UI/UX**:
- Trang "Close period" wizard: Gather → Allocate → Review → Close.
- Preview unit cost theo cost object trước khi close.
- So sánh kỳ này vs kỳ trước, variance highlight.
- Allocation rule editor: chọn source cost center, basis, target scope, formula.

### 5.17 FR-17 - Margin reporting `[Spec]` + `[Suy luận]`
**UI/UX**:
- Dashboard Finance với card KPI: total revenue, total COGS, gross margin, margin %.
- Bảng margin by order/customer/site/grade, sort, filter, drill-down.
- Chart so sánh báo giá vs giá bán thực tế vs giá vốn.
- Export Excel/PDF.

### 5.18 FR-18 - Bảo mật, phân quyền, audit `[Spec]` + `[Suy luận]`
**UI/UX**:
- Trang quản lý user: list với status, roles, last login, failed attempts.
- Role editor: checkbox matrix permission × module.
- Session management: danh sách session active, nút revoke.
- Audit log viewer: filter theo user/entity/date, diff view JSON.
- Password policy, 2FA (tùy chọn mở rộng).

---
## 6. UI/UX DESIGN SYSTEM & COMPONENT LIBRARY
### 6.1 Design principles
- **Clarity first**: mỗi màn một mục đích chính, tránh nhồi.
- **Speed**: perceived loading < 1s cho list phổ biến (skeleton + SWR).
- **Consistency**: dùng design token thống nhất cho toàn hệ.
- **Accessibility**: WCAG 2.1 AA; contrast ≥ 4.5:1, focus visible, keyboard nav.
- **Progressive disclosure**: filter chính ở trên, advanced filter trong collapsible panel.
- **Mobile-first cho app hiện trường**; desktop-first cho dispatcher/finance.

### 6.2 Template nền
- Dùng **shadcn/ui** làm bộ component base + Tailwind CSS.
- Layout template: **Shell với sidebar + topbar + breadcrumb + content**. Có biến thể "full-width" cho Gantt/Map.
- Theme: light + dark mode.
- Icon: `lucide-react`.
- Spacing scale 4px grid.

### 6.3 Design tokens `[Suy luận]`
- Colors primary `#2563EB` (blue-600), success `#16A34A`, warning `#F59E0B`, danger `#DC2626`, info `#0EA5E9`, neutrals gray scale Tailwind.
- Typography: heading `Inter`, body `Inter`, mono `JetBrains Mono`.
- Border radius: sm 4, md 6, lg 8, xl 12.
- Shadow: sm/md/lg/xl Tailwind default.
- Motion: transition 150-200ms ease-out.

### 6.4 Layout pattern
- **Desktop shell**: sidebar thu gọn (64px) / mở (240px), logo + search + user menu ở topbar, breadcrumb + toolbar sticky.
- **Dashboard**: grid 12 cột, card KPI hàng đầu, chart hàng giữa, bảng drill-down hàng dưới.
- **List page**: toolbar (search, filter, bulk action, export, create) → data grid → pagination.
- **Detail page**: header (tiêu đề, status, action) + tabs (Overview, Related, History) + side panel.
- **Gantt board**: full-screen, mini-map ở góc, timeline trục X cố định, toolbar timeline.
- **Mobile app**: bottom tab nav (Today, History, Profile), sticky action button, swipe gestures.

### 6.5 Component library `[Suy luận]`
- Button (variants: primary, secondary, ghost, destructive; sizes: sm/md/lg).
- Input, Textarea, Select (với search), Multi-select, Combobox, Autocomplete.
- Checkbox, Radio, Switch, Slider.
- Date picker, Date range, Time picker, Datetime picker (Asia/Ho_Chi_Minh).
- Tag/Chip, Badge, Avatar.
- Card, Panel, Accordion, Tabs, Stepper/Wizard.
- Dialog/Modal, Drawer, Tooltip, Popover, HoverCard.
- Toast (Sonner), Alert/Banner, Empty state, Loading skeleton, Error boundary.
- Breadcrumb, Pagination, Command palette (cmdk).
- Data grid (TanStack Table): server-side pagination, sticky header, resizable columns, column reorder, column visibility, multi-sort, filter per column (text, number range, date range, enum), row selection, virtualized rows, cell editor, expand row.
- Tree (cho cost center, warehouse location).
- Map (MapLibre).
- Gantt chart.
- Chart (bar, line, area, pie, heatmap).
- File uploader (drag-drop, multi, preview).
- Rich text editor (nếu cần cho ghi chú).
- Signature pad (cho biên bản điện tử).

### 6.6 Data grid patterns `[Suy luận]`
- **Must-have features**:
  - Server-side pagination (page, page_size).
  - Column sort (multi, với shift-click).
  - Column filter: text contains/equals, number eq/gt/lt/range, date range, enum select, boolean.
  - Quick search (debounce 300ms).
  - Saved filters / saved views theo user.
  - Column visibility toggle + reorder + resize, lưu preference local.
  - Row selection (single/multi) + bulk action bar.
  - Export current view Excel/CSV (serve từ backend để consistent với filter/sort).
  - Density toggle (compact/comfortable).
  - Sticky header + sticky first column khi cần.
  - Virtualized rows cho ≥ 1000 rows.
  - Inline edit cell cho field đơn giản (status, note).
  - Row actions dropdown.
- **Nice-to-have**:
  - Pivot view (client-side).
  - Conditional formatting theo rule.
  - Copy cell/row to clipboard.

### 6.7 Form patterns `[Suy luận]`
- Layout: 1 hoặc 2 cột, label trên input, helper text dưới, error text dưới input.
- Zod schema share với backend (OpenAPI → typescript types qua `openapi-typescript`).
- Auto-save draft cho form dài (Pour request, quotation).
- Debounce 500ms cho async validation (uniqueness code).
- Repeater row cho multi-item (pour_request_time_windows, quotation_items).
- Field group collapsible.
- Dirty state warning khi rời trang.
- Submit button disabled khi invalid, loading state khi submitting.

### 6.8 Gantt board patterns `[Suy luận]`
- Header timeline sticky, zoom buttons.
- Left panel: resource list (vehicle/pump), filter.
- Body: rows × columns, drag-drop trip card.
- Dependency line optional.
- Context menu right-click trên trip (Edit, Lock, Unlock, Delete, Duplicate, Move to...).
- Multi-select bằng Ctrl/Cmd hoặc rubber-band.
- Keyboard: arrow để di chuyển focus trip, Enter để mở detail.
- Mini-map navigator góc dưới trái.
- Conflict highlighting đỏ + tooltip.

### 6.9 Dashboard & KPI patterns
- Card KPI với sparkline, so sánh kỳ trước (+/- %).
- Chart có tooltip, legend toggleable, date range picker toàn trang.
- Drill-down: click segment → filter list tương ứng.
- Refresh button + auto-refresh (WebSocket/SSE cho live board).
- Export toàn dashboard thành PDF snapshot.

### 6.10 Mobile patterns (driver, pump crew)
- Font ≥ 16px, tap target ≥ 44×44px.
- Action bar cố định đáy.
- Camera qua `input[type=file][capture]` fallback + native API khi PWA.
- Offline indicator luôn hiển thị.
- Sync status: pending n items → toast khi sync xong.
- PWA manifest + service worker + IndexedDB cache.

### 6.11 Performance optimization
- Next.js Image tối ưu; lazy load chart/map.
- Code split theo route (App Router mặc định).
- React Server Components cho list read-only.
- Prefetch data trước khi navigate (TanStack Query `prefetchQuery`).
- Virtualize bảng lớn và Gantt.
- Avoid over-rendering (memo, selector).
- Use HTTP/2, gzip/brotli, CDN cho static assets.
- Pre-compute aggregation ở materialized view thay vì client.

### 6.12 Accessibility
- Semantic HTML, ARIA roles.
- Keyboard navigation toàn bộ.
- Screen reader labels, skip-to-content link.
- Focus trap trong modal.
- Color not sole indicator (kết hợp icon).

### 6.13 i18n & định dạng
- vi-VN mặc định; strings trong JSON `messages/vi.json`.
- Số: dấu chấm ngàn, phẩy thập phân; tiền: VND mặc định.
- Ngày: `dd/MM/yyyy`, giờ 24h, hiển thị timezone.
- Đơn vị: m3, tấn, kg, km, phút.

### 6.14 Error, empty, loading states
- Skeleton card/row khi loading.
- Empty state với icon + CTA (ví dụ "Chưa có pour request - Tạo đơn đầu tiên").
- Error page có retry, hiển thị request_id để support.
- Toast ngắn cho success/info/error.

---
## 7. IMPORT/EXPORT, BULK OPERATION & THAO TÁC BẢNG BIỂU
### 7.1 Import Excel/CSV `[Suy luận]`
**Quy trình chuẩn**:
1. Tải template có header chuẩn + mô tả cột + ví dụ ở sheet Instructions.
2. Upload file (drag-drop).
3. Backend parse (openpyxl/polars), validate từng dòng với Pydantic schema.
4. Trả preview: bảng hiển thị dòng OK, dòng warning, dòng error.
5. User chỉnh sửa trực tiếp trên bảng preview hoặc sửa trong Excel và re-upload.
6. Click "Import" để commit; job chạy nền (Celery) với progress bar.
7. Kết quả import: báo cáo số dòng thành công, số dòng lỗi, link export error rows.
**Entities hỗ trợ import**:
- customers, project_sites, site_access_profiles.
- vehicles, pumps, plants, loading_bays.
- materials, concrete_products, mix_designs.
- price_books + price_rules (mỗi rule_type một sheet).
- pour_requests hàng loạt cho dự án lớn.
- inventory receipt/issue.
- electricity_readings, labor_timesheets.
**Quy tắc**:
- Mọi import chạy trong transaction + audit.
- Reference field dùng code tự nhiên (ví dụ `customer_code`) thay vì UUID.
- Chunk upload nếu file > 5000 row.

### 7.2 Export `[Suy luận]`
- Export Excel có header, freeze row, column width tự fit.
- Export CSV UTF-8-BOM cho Excel Vietnam.
- Export PDF qua template WeasyPrint (báo giá, biên bản, batch ticket, báo cáo ops).
- Queue export khi file > 10MB, email link khi xong.

### 7.3 Bulk operations `[Suy luận]`
- Multi-select row → action bar: archive, change status, assign plant, export, delete.
- Confirm dialog với số row ảnh hưởng và diff preview.
- Soft operations có thể undo trong 5s (toast).

### 7.4 Print templates
- Báo giá (PDF A4, logo, footer, chữ ký).
- Phiếu giao hàng / batch ticket (khổ nhỏ cho máy in nhiệt khi cần).
- Biên bản bơm.
- Báo cáo KPI ngày/tuần/tháng.
- Hỗ trợ print-preview và tải về.

### 7.5 Thao tác bảng biểu nâng cao `[Suy luận]`
- Sort, filter đã nói ở mục 6.6.
- "Group by" client-side cho bảng nhỏ (ví dụ group trip theo plant).
- "Pin column" trái/phải.
- Copy giá trị cell/row.
- Resize row height (cho comment dài).
- Keyboard navigation: arrow, Tab, Enter để edit.
- Tính toán inline: tổng/đếm/avg ở footer cột số.

---
## 8. CHECKLIST TRIỂN KHAI CHI TIẾT THEO PHASE
> Thứ tự bắt buộc: Phase 0 → 1 → 2 → 3 → 4 → 5 → Hardening.
> Mỗi phase kết thúc khi: lint + type-check + test xanh, CI build xanh, acceptance criteria được nghiệm thu.

### 8.1 Phase 0 - Foundation & nền tảng phát triển
**Mục tiêu**: khung dự án chạy được, CI/CD sẵn, dev onboard nhanh.
**Checklist backend**:
- [x] Khởi tạo FastAPI skeleton với `app/` chia `api/`, `core/`, `domain/`, `application/`, `infrastructure/`, `workers/`.
- [x] Thiết lập `pyproject.toml` với ruff, black, mypy, pytest.
- [x] Settings theo môi trường (dev/staging/prod) qua `pydantic-settings`.
- [x] Logging JSON structured.
- [x] Error handler chuẩn (request_id, trace).
- [x] Alembic migration env + seed CLI.
- [x] `/healthz`, `/readyz`.
- [x] Auth skeleton (chưa có user) + middleware request_id.
- [x] OpenAPI schema + Swagger UI.
**Checklist frontend**:
- [x] Khởi tạo Next.js 15 App Router, TS strict.
- [x] Tailwind + shadcn/ui cài đặt, theme token.
- [x] Layout shell skeleton (sidebar, topbar).
- [x] TanStack Query provider, Zustand store skeleton.
- [x] `openapi-typescript` pipeline để sync types từ backend.
- [x] i18n next-intl setup vi/en.
- [x] Error boundary, 404/500 pages, loading skeleton.
- [x] PWA manifest + service worker stub cho mobile.
**Infra**:
- [x] `docker-compose.yml` cho Postgres+PostGIS, Redis, MinIO, backend, frontend, traefik.
- [x] `Makefile` với `make up`, `make migrate`, `make seed`, `make test`.
- [x] GitHub Actions workflows: `backend-ci.yml`, `frontend-ci.yml`, `e2e.yml`.
- [x] Pre-commit hook lint + format.
- [x] Sentry DSN wiring (optional for dev).
**Test tối thiểu**:
- [x] Smoke `/healthz` backend, frontend `/`.
- [x] Build docker image xanh.
- [x] Migration dry-run xanh.
- [x] CI pipeline xanh trên nhánh chính.
**Acceptance**:
- [x] `docker compose up` xong truy cập được cả 2 app.
- [x] CI xanh toàn bộ (backend-ci run 24612261096, frontend-ci run 24612261116).

### 8.2 Phase 1 - Foundation + master data + phân quyền
**Scope**: FR-01, FR-11 phần nền, FR-18 phần auth.
**Checklist backend**:
- [x] Migration nhóm IAM (4.2).
- [x] Migration nhóm master data (4.3).
- [x] Migration `system_settings`, `audit_logs`, `attachments` (4.11).
- [x] Auth service: Argon2id, JWT access 10-15 phút, refresh rotation, revoke.
- [x] RBAC service: load role/permission, scope check theo plant/BU.
- [x] API CRUD cho: organizations, business_units, users, roles, permissions, customers, customer_contacts, project_sites, site_access_profiles, plants, plant_loading_bays, vehicle_types, vehicles, pumps, materials, concrete_products, mix_designs, mix_design_components, assets.
- [x] Import Excel cho customers, project_sites, vehicles, materials.
- [x] Export Excel cho các bảng trên.
- [x] Geocode adapter interface + stub provider.
- [x] Audit log middleware cho tất cả mutation.
- [x] Seed data demo (1 org, 1 BU, 2 plants, 24 vehicles, 3 pumps, các sản phẩm).
**Checklist frontend**:
- [x] Login / logout / refresh flow.
- [x] Menu sidebar theo role.
- [x] Trang admin: Users, Roles, Permissions, Audit Log.
- [x] Trang master data với data grid chuẩn (mục 6.6): customers, sites, plants, vehicles, pumps, materials, concrete_products, mix_designs.
- [x] Form tạo/sửa với wizard cho site (mục 5.1).
- [x] Map picker cho project_sites.
- [x] Upload ảnh công trình, bản vẽ.
- [x] Trang Settings với cấu hình operational defaults.
- [x] Chuẩn hóa CRUD generic theo form thao tác trực quan, không tạo/sửa bằng JSON thô.
- [x] Bổ sung ẩn/hiện cột và Việt hóa nhãn cột/placeholder trên các trang resource chính.
- [x] Light theme toàn bộ giao diện, bao gồm trang đăng nhập.
- [x] Điều hướng chính dùng slug tiếng Việt, có redirect từ slug tiếng Anh cũ.
- [x] Import Excel UI (preview + error rows).
**Test**:
- Unit: password hashing, token rotation, RBAC policy, geocode adapter stub.
- Integration: login/refresh/logout/revoke, CRUD từng entity + audit.
- Contract: schema response master data APIs.
- Import regression với file mẫu có dòng lỗi.
- E2E smoke: admin tạo user, sales tạo customer+site.
**Acceptance**:
- Admin tạo được user/role/permission và phân scope.
- Sales/Dispatcher CRUD được master data.
- Import Excel hoạt động cho ít nhất 3 entity lớn.
- Audit log ghi đầy đủ trước/sau.

### 8.3 Phase 2 - Sales request + pricing + scheduling MVP input
**Scope**: FR-02, FR-03.
**Checklist backend**:
- [x] Migration nhóm pricing & sales (4.4).
- [x] PricingEngine: rule types BasePrice, DistanceFee, DifficultyFee, PumpFee, Surcharge, Discount.
- [x] Rule condition+formula schema (JSONB) với evaluator an toàn (không eval tùy ý code).
- [x] Priority resolution, scope resolution theo region/customer/plant.
- [x] Snapshot `price_calculation_snapshots` khi chốt.
- [x] API `POST /pricing/preview`, CRUD price_books, price_rules, quotations, sales_orders, pour_requests, time_windows.
- [x] Approval workflow discount/manual override.
- [x] Import Excel price rules, pour_requests hàng loạt.
- [x] Export PDF báo giá (WeasyPrint template).
**Checklist frontend**:
- [x] Price book editor (mục 5.2).
- [x] Quotation builder với pricing preview realtime.
- [x] Pour request wizard 4 bước + quick create.
- [x] Trang list sales order / pour request có filter theo trạng thái, customer, plant, ngày.
- [x] Badge cảnh báo dữ liệu thiếu.
- [x] PDF preview báo giá.
**Test**:
- Unit cho từng rule type + tổng hợp FinalUnitPrice.
- Property-based: random input hợp lệ không crash engine.
- Integration: quotation → snapshot → sales order → pour request.
- Regression: đổi ruleset mới không thay đổi snapshot cũ.
- E2E: sales flow tạo báo giá, chốt đơn.
**Acceptance**:
- 100% báo giá sinh từ engine.
- Sales tạo được quotation và pour request hợp lệ.
- Dispatcher thấy đơn mới ở inbox.

### 8.4 Phase 3 - Dispatch approval + scheduler v1 + Gantt + execution mobile
**Scope**: FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-12.
**Checklist backend - planning**:
- [x] Migration nhóm dispatch & scheduling (4.5).
- [x] Migration nhóm trip execution & actuals (4.6).
- [x] API duyệt đơn: approve/reject/request-info + dispatch_orders CRUD.
- [x] Vehicle/pump availability service, resource_locks.
- [x] Plant capacity slot service.
- [x] Travel estimates adapter + cache 30 phút.
- [x] Scheduler v1 heuristic (mục 5.5 công thức + mục 9.5 spec).
- [x] Scheduler API: `POST /schedule-runs`, `GET /schedule-runs/{id}`, `GET /schedule-runs/{id}/conflicts`.
- [x] Schedule version history khi chỉnh tay.
- [x] Manual override API + audit before/after.
- [x] WebSocket/SSE cho dispatch board realtime.
**Checklist backend - execution**:
- [x] Trip state machine (assigned → accepted → check_in_plant → load_start → load_end → depart_plant → arrive_site → pour_start → pour_end → leave_site → return_plant).
- [x] Event intake API idempotent theo `idempotency_key`.
- [x] Pump session state machine.
- [x] Batch ticket sinh khi load_start.
- [x] GPS ping intake (rate limit per vehicle).
- [x] Offline sync endpoint (batch apply).
- [x] Reconciliation API: chốt actual volume/trip count, reason code.
- [x] KPI worker: on-time, cycle time, utilization, empty km, trips/day.
- [x] Notification adapter (Zalo/SMS/Email) + templates.
- [x] Export báo cáo vận hành Excel/PDF.
**Checklist frontend**:
- [x] Dispatcher inbox (mục 5.4).
- [x] Dispatch board Gantt (mục 5.6, 6.8).
- [x] Station queue board cho plant operator (mục 5.7).
- [x] Driver mobile PWA (mục 5.8) với offline sync.
- [x] Pump crew mobile PWA (mục 5.9) với signature pad.
- [x] Reconciliation screen cuối ca.
- [x] KPI dashboard ops manager (mục 5.10).
- [x] Live updates WebSocket/SSE.
**Test**:
- Unit scheduler: trip count, cycle time, concurrent trucks, conflict detect, priority ordering, respect lock.
- Golden test scheduler với bộ dữ liệu cố định (repeatable output).
- Integration: approve → run scheduler → publish → override manual.
- E2E dispatcher flow trên Gantt (Playwright).
- Unit trip state machine + idempotent event.
- Integration driver/pump event flow + offline sync replay.
- E2E full: quotation → pour → approve → schedule → mobile actuals → close → KPI.
- Performance scheduler: 50 pour requests × 24 xe × 3 pump < 2 phút.
- Security: quyền truy cập giá, lịch, override.
- [x] Smoke API full dispatch-to-execution (2026-04-18): login → tạo sales_order/pour_request → approval → schedule → trip/pump events → offline sync → GPS → reconciliation → KPI → realtime + report CSV/PDF đều 200; evidence: schedule_run_id=7e61bb9b-7d13-4de4-a5d7-4b4bc7829582, trip_id=a6558e5c-c326-4ab3-8729-c6edd922409c, reconciliation_id=c68ff065-5211-4942-a099-26b0019f4fad, kpi_snapshot_id=2f899da9-426e-467b-8119-99ef34d09904.
**Acceptance**:
- Dispatcher điều phối được ngày vận hành end-to-end.
- Driver/Pump Crew gửi actuals đầy đủ (kể cả offline).
- Ops manager thấy dashboard KPI cập nhật.
- Notification hoạt động ≥ 1 channel.

### 8.5 Phase 4 - Inventory + costing foundation
**Scope**: FR-13, FR-14; nền cho FR-15/16.
**Checklist backend**:
- [x] Migration nhóm inventory (4.7).
- [x] Migration cost_centers, cost_objects, cost_periods (4.9).
- [x] Inventory ledger service append-only, balance calculation.
- [x] Nghiệp vụ: receipt, issue, transfer, adjustment, waste, stock take.
- [x] Validate qty khả dụng trước khi xuất/chuyển.
- [x] Period open/close/reopen workflow.
- [x] Pre-close checklist (chứng từ đủ, production đủ).
**Checklist frontend**:
- [x] Warehouse management (mục 5.14).
- [x] Form nhập, xuất, transfer, adjustment, stock take.
- [x] Trang tồn kho hiện tại + drill-down transaction.
- [x] Trang cost center (tree view), cost object, period calendar.
- [x] Import phiếu nhập từ Excel.
- [x] Export snapshot tồn kho.
**Test**:
- [x] Unit/integration inventory ledger + balance (test_phase4_inventory_and_cost_period_workflow).
- [x] Integration nhập/xuất/chuyển/adjust/stock take.
- [x] Regression: không thể sửa ending balance.
- [x] Integration open/close/reopen period (đã có); audit vẫn theo middleware chuẩn hệ thống.
**Acceptance**:
- Cost Accountant mở/đóng kỳ và kiểm tra dữ liệu đầu vào được.
- Có dữ liệu tồn kho đáng tin cậy cho costing.

### 8.6 Phase 5 - Production + costing engine + margin + optimization nâng cao
**Scope**: FR-15, FR-16, FR-17 + scheduler v2 + learning loop.
**Checklist backend**:
- [x] Migration nhóm production (4.8).
- [x] Migration cost pools, allocation, unit cost snapshot, margin (4.9).
- [x] Ghi nhận crushing/batching (input, output, runtime, downtime, electricity).
- [ ] Ghi nhận batch ticket actual vs mix design.
- [ ] CostingEngine: direct_material, direct_labor, utilities, maintenance, depreciation, overhead allocation.
- [x] Allocation rule engine (basis: sản lượng, runtime, tỷ lệ).
- [x] Close period: run allocation → snapshot unit cost → freeze.
- [x] Margin snapshot theo đơn.
- [ ] OR-Tools scheduler v2 (VRPTW + capacity + resource).
- [ ] Learning loop: so sánh estimated vs actual, cập nhật travel_estimates và score weights.
- [ ] Materialized views BI (mục 4.10) + refresh job.
**Checklist frontend**:
- [x] Form ghi nhận sản xuất đá/bê tông (mục 5.15).
- [x] Close period wizard (mục 5.16).
- [x] Preview unit cost + variance kỳ trước.
- [x] Allocation rule editor.
- [x] Dashboard Finance margin (mục 5.17) ở mức MVP bằng snapshot list.
- [ ] Toggle giữa scheduler v1/v2 + so sánh KPI.
**Test**:
- Unit costing formulas + allocation methods.
- Golden test với bộ dữ liệu mẫu tính tay → đối chiếu unit cost.
- Integration close period → snapshot → margin.
- E2E từ đơn → margin report cuối.
- Benchmark scheduler v1 vs v2 (KPI: on-time, empty km, cost).
- [x] Smoke API phase 5 (2026-04-19): production log -> cost pool -> allocation rule -> allocation run -> unit cost snapshot -> margin snapshot đều 200 trong test suite.
- [x] Close period workflow + variance preview (2026-04-19): close endpoint tự chạy allocation + freeze unit cost snapshot; endpoint preview variance trả dữ liệu current/previous snapshot trong test suite và smoke 401 khi chưa đăng nhập.
**Acceptance**:
- Tính được unit cost đá/bê tông theo kỳ.
- Margin report hiển thị đúng theo đơn/khách/site/grade.
- Scheduler v2 chạy và output tốt hơn v1 trên benchmark.

### 8.7 Hardening & UAT cuối
**Checklist**:
- [ ] Rà soát NFR hiệu năng, scalability, availability, security.
- [ ] Tối ưu index, query plan, partition.
- [ ] Redis caching cho hot path.
- [ ] Rate limit, CSP, signed URL.
- [ ] Backup/restore drill (PITR Postgres).
- [ ] Runbook vận hành, tài liệu kỹ thuật, tài liệu user theo role.
- [ ] UAT theo luồng spec mục 5.1, 5.2 + ngoại lệ 5.3.
- [ ] Load test API list phổ biến (< 2s với dataset 100k rows).
- [ ] Realtime test Gantt board (< 3s độ trễ).
- [ ] Security regression (auth, RBAC, audit, signed URL).
- [ ] Chaos test scheduler worker.
**Acceptance**:
- NFR chính đạt mục tiêu.
- UAT xanh cho Sales, Dispatcher, Plant Operator, Driver, Pump Crew, Cost Accountant, Finance.

---
## 9. CHIẾN LƯỢC TEST ĐẦY ĐỦ
### 9.1 Tổ chức file test
Theo rule dự án: **chỉ một file test mỗi phía**. Bên trong chia nhóm theo module.
- Backend: `backend/tests/test_suite.py` - dùng pytest class `TestAuth`, `TestMasterData`, `TestPricing`, `TestSales`, `TestScheduler`, `TestTripEvents`, `TestInventory`, `TestCosting`, `TestReporting`, `TestSecurity`, `TestPerformance`.
- Frontend: `frontend/tests/test_suite.ts` - dùng `describe()` nhóm: `Auth`, `MasterData`, `Pricing`, `Sales`, `Dispatch`, `Mobile`, `Inventory`, `Costing`, `Reporting`, `DataGrid`, `ImportExport`, `Accessibility`.
- Fixture/helpers chia ra `backend/tests/_fixtures/`, `frontend/tests/_fixtures/` (không phải file test).

### 9.2 Test pyramid
- **Unit (70%)**: domain logic thuần (pricing, scheduler algorithms, costing formulas, state machines, inventory ledger).
- **Integration (20%)**: API + DB + Redis + MinIO (test container).
- **E2E (10%)**: Playwright multi-browser.
- Property-based cho rule parser/evaluator, formula.
- Golden tests cho scheduler, pricing, costing.

### 9.3 Unit test bắt buộc
- Pricing: từng rule_type, priority resolution, scope resolution, snapshot isolation.
- Scheduler: trip count formula, cycle time, concurrent trucks, conflict detection, lock respect, explanation generation.
- Trip state machine: valid/invalid transitions, idempotency.
- Pump session state machine.
- Inventory ledger: receipt, issue, transfer, adjustment, waste, balance aggregation.
- Costing: allocation methods, unit cost formula, variance detection, period lock.
- Auth: password policy, token rotation, session revoke, RBAC policy.
- Excel import: row validation, preview generation, error reporting.

### 9.4 Integration test bắt buộc
- CRUD master data + audit.
- Quotation → sales order → pour request flow.
- Approve → schedule run → publish → override.
- Trip event flow: assigned → accepted → load → depart → arrive → pour → return.
- Offline sync replay.
- Inventory movement flow (receipt → issue → transfer → adjustment → stock take).
- Cost period: open → gather → allocate → close → reopen.
- Margin calculation across period.
- Notification delivery qua stub adapter.

### 9.5 Contract test
- Schema response tuân thủ OpenAPI.
- Backward compatibility: bản mới không phá field cũ.
- Consumer-driven contracts nếu có tích hợp bên thứ ba.

### 9.6 E2E test (Playwright)
- Auth flow (login/logout/refresh/expired).
- Sales flow (tạo báo giá, chốt đơn, xuất PDF).
- Dispatcher flow (duyệt đơn, chạy scheduler, kéo thả Gantt, publish).
- Plant operator flow (confirm load, sinh batch ticket).
- Driver flow trên mobile viewport (nhận chuyến, ghi event, offline → online sync).
- Pump crew flow.
- Ops manager flow (dashboard KPI, drill-down).
- Cost accountant flow (close period).
- Finance flow (margin report, export).

### 9.7 Performance test
- API list phổ biến < 2s p95 với 100k rows.
- Scheduler heuristic < 2 phút cho 1 ngày điển hình.
- Realtime dispatch board cập nhật < 3s.
- Import 5000 row Excel < 60s.
- DB query plan review cho top 20 endpoint.

### 9.8 Security test
- OWASP Top 10: SQL injection (SQLAlchemy param binding), XSS (React auto-escape + sanitize rich text), CSRF, auth bypass, IDOR (scope check).
- Rate limit effective.
- Signed URL expires.
- Secret scanning CI.
- Dependency vulnerability scan (pip-audit, npm audit).
- Pentest cơ bản trước go-live.

### 9.9 Accessibility test
- axe-core trong Playwright.
- Keyboard-only walkthrough top 10 flow.
- Color contrast automated check.

### 9.10 Observability/chaos
- Failure inject: Redis down, DB down, MinIO down, map provider timeout.
- Hệ thống phải degrade gracefully và report Sentry.

### 9.11 Coverage target
- Domain ≥ 90%.
- Application ≥ 80%.
- Tổng repo ≥ 75%.
- Coverage gate trong CI.

### 9.12 Test data
- Factory pattern (`factory_boy` backend, `faker` + factory frontend).
- Test container Postgres + PostGIS + Redis + MinIO qua `testcontainers-python`.
- Seed fixture cho golden test: `tests/_fixtures/scheduler_case_01.json`, v.v.

---
## 10. YÊU CẦU PHI CHỨC NĂNG (NFR) `[Spec]` + `[Suy luận]`
### 10.1 Hiệu năng
- Trang list phổ biến < 2s với filter/pagination chuẩn.
- Live dispatch board độ trễ mục tiêu < 3s.
- Scheduler heuristic 30s-2 phút tùy quy mô đơn.
- Dùng server-side pagination, index, virtualized rendering cho bảng lớn.

### 10.2 Khả năng mở rộng
- Scale từ 24 xe → 50-100 xe không viết lại core.
- Partition bảng event theo thời gian.
- Worker scale độc lập với API.
- Horizontal scale API qua load balancer.

### 10.3 Tính sẵn sàng
- Uptime mục tiêu ≥ 99.5%.
- Backup daily (PITR + snapshot).
- Retry queue cho external integration.
- Health check + auto-restart container.

### 10.4 Bảo mật
- TLS everywhere (HSTS, TLS 1.2+).
- Argon2 password hash.
- JWT access ngắn hạn + refresh rotation.
- Rate limit API public/mobile.
- Signed URL file attachment.
- Secrets qua env/secret manager.
- CSRF, CSP, secure headers.
- Audit log bắt buộc cho thay đổi giá/lịch/quyền/kỳ giá thành.

### 10.5 Bảo trì
- Code layered rõ ràng.
- Unit + integration + e2e cho luồng quan trọng.
- Alembic migrations + seed + feature flags.
- Runbook sự cố.

---
## 11. TRIỂN KHAI VÀ VẬN HÀNH
### 11.1 Môi trường
- **dev** (local docker-compose).
- **staging** (replica cấu hình prod, data scrubbed).
- **production**.

### 11.2 CI/CD pipeline `[Suy luận]`
- PR gate: lint, type-check, unit, integration, security scan, build image.
- Main merge: e2e full, deploy staging.
- Tag release: deploy production (manual approval).
- Rollback: redeploy previous image + migration down (nếu backward compatible).

### 11.3 Backup & restore
- Postgres PITR: WAL archive + base backup daily.
- MinIO bucket replication (prod).
- Test restore drill hàng tháng.

### 11.4 Monitoring & alerting
- Alert khi error rate > 1%, p95 > ngưỡng, queue backlog > ngưỡng.
- Alert khi scheduler job fail.
- Alert khi cost period close thất bại.

### 11.5 Runbook
- Sự cố DB down, Redis down, worker hang.
- Reset password admin.
- Rollback release.
- Replay offline event queue.

---
## 12. ĐIỂM CẦN CHỐT TRƯỚC KHI CODE `[Chưa xác minh]`
- Chốt provider map/routing: Google Maps / Mapbox / OSRM.
- Chốt provider thông báo: Zalo OA, SMS, Email.
- Chốt phạm vi mobile: PWA web hay native app (React Native / Flutter).
- Chốt môi trường triển khai (VPS, Kubernetes, Docker Swarm).
- Chốt kế toán/tài chính có tích hợp ERP nào không (MISA, Bravo, SAP).
- Chốt số lượng người dùng đồng thời mục tiêu để tính sizing.
- Chốt multi-tenant single-org hay single-tenant per customer.
- Chốt policy password, 2FA.
- Chốt đơn vị tiền tệ phụ (VND mặc định).
- Chốt SLA support sau go-live.
- Chốt các bảng bổ sung `[Suy luận]` ở mục 4.5-4.9 trước khi viết migration chính thức.

---
## 13. TIÊU CHÍ NGHIỆM THU TỔNG THỂ
### 13.1 Business
- End-to-end flow Phase 1 chạy được trên dữ liệu thật của 1 ngày vận hành.
- End-to-end flow Phase 2 close được 1 kỳ giá thành và có margin report.
- KPI mục tiêu đạt được:
  - On-time delivery ≥ 90%.
  - Xung đột sau auto schedule < 5%.
  - Dữ liệu actual đầy đủ ≥ 95%.
  - 100% báo giá sinh từ engine.
  - Có unit cost đá/bê tông theo kỳ.

### 13.2 Technical
- Lint, type-check, unit, integration, e2e đều xanh trong CI.
- Coverage domain ≥ 90%, application ≥ 80%, tổng ≥ 75%.
- NFR hiệu năng đạt.
- Security scan không issue critical/high.
- Backup/restore drill thành công.
- Tài liệu đầy đủ: API (OpenAPI), user manual theo role, runbook, architecture.

### 13.3 UX
- UAT xanh cho từng role.
- Accessibility check WCAG 2.1 AA pass trên top 10 flow.
- Mobile PWA cài được trên điện thoại driver/pump crew và hoạt động offline.

---
> Tài liệu này là checklist triển khai. Các phần `[Suy luận]` và `[Chưa xác minh]` cần được stakeholder review và chốt trước khi đưa vào backlog chính thức.
