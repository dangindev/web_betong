"use client";

import { Download, Eye, EyeOff, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiCreateResource, apiDeleteResource, apiListResource, apiUpdateResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

import { Button } from "../ui/button";

type ResourcePageProps = {
  resource: string;
  title?: string;
};

type SortDirection = "asc" | "desc";
type FieldType = "text" | "number" | "boolean" | "json" | "datetime";
type GenericRow = Record<string, unknown>;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const DEFAULT_HIDDEN_COLUMNS = new Set([
  "id",
  "organization_id",
  "created_at",
  "updated_at",
  "password_hash",
  "value_json",
  "settings_json",
  "formula_json",
  "condition_json",
  "input_snapshot_json",
  "result_snapshot_json",
  "special_constraints_json",
  "pricing_snapshot_json"
]);

const RESOURCE_LABELS: Record<string, string> = {
  users: "Tài khoản người dùng",
  roles: "Vai trò",
  permissions: "Quyền thao tác",
  role_permissions: "Gán quyền cho vai trò",
  user_roles: "Gán vai trò cho người dùng",
  system_settings: "Cấu hình hệ thống",
  organizations: "Tổ chức",
  business_units: "Đơn vị kinh doanh",
  customers: "Khách hàng",
  customer_contacts: "Liên hệ khách hàng",
  project_sites: "Công trình",
  plants: "Trạm trộn",
  vehicles: "Xe",
  pumps: "Cần bơm",
  materials: "Vật tư",
  concrete_products: "Sản phẩm bê tông",
  mix_designs: "Cấp phối",
  mix_design_components: "Thành phần cấp phối",
  price_books: "Bảng giá",
  price_rules: "Quy tắc giá",
  quotations: "Báo giá",
  quotation_items: "Dòng báo giá",
  sales_orders: "Đơn bán",
  pour_requests: "Yêu cầu đổ",
  dispatch_orders: "Lệnh điều phối",
  warehouses: "Kho",
  inventory_ledger_entries: "Sổ cái kho",
  inventory_stock_takes: "Phiếu kiểm kê",
  cost_centers: "Trung tâm chi phí",
  cost_objects: "Đối tượng chi phí",
  cost_periods: "Kỳ giá thành",
  audit_logs: "Nhật ký kiểm toán"
};

const FIELD_LABELS: Record<string, string> = {
  id: "Mã bản ghi",
  code: "Mã",
  key: "Khóa",
  name: "Tên",
  full_name: "Họ và tên",
  username: "Tên đăng nhập",
  email: "Email",
  phone: "Số điện thoại",
  status: "Trạng thái",
  description: "Mô tả",
  note: "Ghi chú",
  notes: "Ghi chú",
  module_code: "Mã phân hệ",
  action_code: "Mã thao tác",
  role_id: "Vai trò",
  permission_id: "Quyền",
  user_id: "Người dùng",
  business_unit_id: "Đơn vị kinh doanh",
  organization_id: "Tổ chức",
  customer_id: "Khách hàng",
  site_id: "Công trình",
  plant_id: "Trạm trộn",
  default_plant_id: "Trạm mặc định",
  home_plant_id: "Trạm gốc",
  warehouse_id: "Kho",
  material_id: "Vật tư",
  concrete_product_id: "Sản phẩm bê tông",
  quotation_id: "Báo giá",
  sales_order_id: "Đơn bán",
  dispatch_order_id: "Lệnh điều phối",
  trip_id: "Chuyến",
  pump_id: "Cần bơm",
  created_at: "Ngày tạo",
  updated_at: "Ngày cập nhật",
  opened_at: "Thời điểm mở",
  closed_at: "Thời điểm đóng",
  reopened_at: "Thời điểm mở lại",
  period_code: "Mã kỳ",
  start_date: "Ngày bắt đầu",
  end_date: "Ngày kết thúc",
  requested_date: "Ngày yêu cầu",
  requested_start_at: "Giờ bắt đầu yêu cầu",
  requested_end_at: "Giờ kết thúc yêu cầu",
  transaction_at: "Thời điểm giao dịch",
  stock_take_date: "Ngày kiểm kê",
  quantity: "Số lượng",
  counted_qty: "Số lượng kiểm kê",
  quantity_delta: "Lượng điều chỉnh",
  requested_volume_m3: "Khối lượng yêu cầu (m³)",
  actual_volume_m3: "Khối lượng thực tế (m³)",
  actual_trip_count: "Số chuyến thực tế",
  value_json: "Giá trị cấu hình",
  condition_json: "Điều kiện",
  formula_json: "Công thức",
  settings_json: "Cấu hình",
  special_constraints_json: "Ràng buộc đặc biệt",
  pricing_snapshot_json: "Ảnh chụp tính giá",
  input_snapshot_json: "Đầu vào",
  result_snapshot_json: "Kết quả",
  billing_address: "Địa chỉ thanh toán",
  customer_type: "Loại khách hàng",
  payment_terms_days: "Số ngày thanh toán",
  credit_limit: "Hạn mức tín dụng",
  tax_code: "Mã số thuế",
  is_system: "Vai trò hệ thống",
  is_primary: "Vai trò chính",
  password: "Mật khẩu"
};

const REFERENCE_RESOURCE_BY_FIELD: Record<string, string> = {
  organization_id: "organizations",
  business_unit_id: "business_units",
  user_id: "users",
  role_id: "roles",
  permission_id: "permissions",
  customer_id: "customers",
  site_id: "project_sites",
  plant_id: "plants",
  default_plant_id: "plants",
  home_plant_id: "plants",
  warehouse_id: "warehouses",
  material_id: "materials",
  concrete_product_id: "concrete_products",
  quotation_id: "quotations",
  sales_order_id: "sales_orders",
  dispatch_order_id: "dispatch_orders",
  pump_id: "pumps"
};

const RESOURCE_DEFAULT_FIELDS: Record<string, string[]> = {
  users: ["organization_id", "username", "full_name", "email", "phone", "status", "password"],
  roles: ["organization_id", "code", "name", "description", "is_system"],
  permissions: ["module_code", "action_code", "description"],
  role_permissions: ["role_id", "permission_id"],
  user_roles: ["user_id", "role_id", "business_unit_id", "is_primary"],
  system_settings: ["organization_id", "key", "description", "value_json"]
};

const BOOLEAN_FIELDS = new Set(["is_system", "is_primary", "requires_pump", "dispatch_lock", "is_locked"]);
const JSON_FIELDS = new Set([
  "value_json",
  "condition_json",
  "formula_json",
  "settings_json",
  "special_constraints_json",
  "pricing_snapshot_json",
  "input_snapshot_json",
  "result_snapshot_json"
]);
const DATETIME_FIELDS = new Set([
  "created_at",
  "updated_at",
  "opened_at",
  "closed_at",
  "reopened_at",
  "requested_start_at",
  "requested_end_at",
  "transaction_at"
]);

const STATUS_LABELS: Record<string, string> = {
  active: "Đang hoạt động",
  inactive: "Ngưng hoạt động",
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  deleted: "Đã xóa",
  new: "Mới",
  pending: "Chờ xử lý",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  confirmed: "Đã xác nhận"
};

function serializeRaw(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function shortId(value: string): string {
  if (!value) return "-";
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function toDateTimeLocalValue(value: unknown): string {
  const raw = serializeRaw(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isLikelyIdField(field: string): boolean {
  return field === "id" || field.endsWith("_id");
}

function isBooleanField(field: string, sample: unknown): boolean {
  return BOOLEAN_FIELDS.has(field) || typeof sample === "boolean";
}

function isJsonField(field: string, sample: unknown): boolean {
  return JSON_FIELDS.has(field) || field.endsWith("_json") || (!!sample && typeof sample === "object");
}

function isDateTimeField(field: string): boolean {
  return DATETIME_FIELDS.has(field) || field.endsWith("_at") || field.endsWith("_date");
}

function inferFieldType(field: string, sample: unknown): FieldType {
  if (isBooleanField(field, sample)) return "boolean";
  if (isJsonField(field, sample)) return "json";
  if (typeof sample === "number") return "number";
  if (isDateTimeField(field)) return "datetime";
  return "text";
}

function formatStatus(value: string): string {
  const key = value.trim().toLowerCase();
  return STATUS_LABELS[key] ?? value;
}

function formatFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatResourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? `Dữ liệu: ${resource}`;
}

function formatReferenceOption(item: GenericRow): string {
  const code = serializeRaw(item.code).trim();
  const name =
    serializeRaw(item.name).trim() ||
    serializeRaw(item.full_name).trim() ||
    serializeRaw(item.username).trim() ||
    serializeRaw(item.site_name).trim() ||
    serializeRaw(item.module_code).trim() ||
    serializeRaw(item.key).trim();

  if (code && name) return `${code} - ${name}`;
  if (name) return name;
  if (code) return code;
  return shortId(serializeRaw(item.id).trim());
}

function parseDraftValue(raw: string, field: string, fieldType: FieldType): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;

  if (fieldType === "boolean") {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    throw new Error(`Trường ${formatFieldLabel(field)} phải là Có/Không.`);
  }

  if (fieldType === "number") {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      throw new Error(`Trường ${formatFieldLabel(field)} phải là số hợp lệ.`);
    }
    return numeric;
  }

  if (fieldType === "json") {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error(`Trường ${formatFieldLabel(field)} phải là JSON hợp lệ.`);
    }
  }

  if (fieldType === "datetime") {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return trimmed;
    }
    return parsed.toISOString();
  }

  return trimmed;
}

function toDraftValue(value: unknown, field: string, fieldType: FieldType): string {
  if (value === null || value === undefined) return "";
  if (fieldType === "json") return JSON.stringify(value, null, 2);
  if (fieldType === "datetime") return toDateTimeLocalValue(value);
  if (fieldType === "boolean") return String(Boolean(value));
  return serializeRaw(value);
}

export function ResourcePage({ resource, title }: ResourcePageProps) {
  const { accessToken } = useAuthStore();

  const [rows, setRows] = useState<GenericRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnConfig, setShowColumnConfig] = useState(false);

  const [createDraft, setCreateDraft] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});

  const [referenceRowsByResource, setReferenceRowsByResource] = useState<Record<string, GenericRow[]>>({});

  const columns = useMemo(() => {
    const columnSet = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((column) => columnSet.add(column));
    }

    const ordered = Array.from(columnSet);
    const priority: Record<string, number> = {
      code: 1,
      key: 2,
      name: 3,
      full_name: 4,
      status: 5,
      description: 6,
      created_at: 90,
      updated_at: 91,
      id: 99
    };

    ordered.sort((left, right) => {
      const leftPriority = priority[left] ?? 50;
      const rightPriority = priority[right] ?? 50;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return left.localeCompare(right);
    });

    return ordered;
  }, [rows]);

  const editableFields = useMemo(() => {
    const blocked = new Set(["id", "created_at", "updated_at", "password_hash"]);
    const fromRows = columns.filter((field) => !blocked.has(field));

    let result = fromRows.length > 0 ? fromRows : [...(RESOURCE_DEFAULT_FIELDS[resource] ?? [])];

    if (resource === "users" && !result.includes("password")) {
      result = [...result, "password"];
    }

    return result;
  }, [columns, resource]);

  const referenceResources = useMemo(() => {
    const resources = new Set<string>();
    editableFields.forEach((field) => {
      const mapped = REFERENCE_RESOURCE_BY_FIELD[field];
      if (mapped) resources.add(mapped);
    });
    return Array.from(resources);
  }, [editableFields]);

  const filteredRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    let result = rows;

    if (keyword) {
      result = rows.filter((row) =>
        columns.some((column) => serializeRaw(row[column]).toLowerCase().includes(keyword))
      );
    }

    if (columns.includes(sortBy)) {
      result = [...result].sort((left, right) => {
        const leftSample = left[sortBy];
        const rightSample = right[sortBy];

        if (typeof leftSample === "number" && typeof rightSample === "number") {
          return sortDirection === "asc" ? leftSample - rightSample : rightSample - leftSample;
        }

        const leftValue = serializeRaw(leftSample).toLowerCase();
        const rightValue = serializeRaw(rightSample).toLowerCase();

        if (leftValue < rightValue) return sortDirection === "asc" ? -1 : 1;
        if (leftValue > rightValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [columns, rows, searchKeyword, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);

  const visibleColumnList = useMemo(() => {
    const chosen = columns.filter((column) => visibleColumns.includes(column));
    return chosen.length > 0 ? chosen : columns;
  }, [columns, visibleColumns]);

  const paginatedRows = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safePageIndex]);

  async function reload() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiListResource<GenericRow>(resource, accessToken, {
        skip: 0,
        limit: 500
      });
      setRows(response.items ?? []);
      setPageIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  function buildPayload(draft: Record<string, string>, baseRow?: GenericRow): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    editableFields.forEach((field) => {
      if (field === "password" && resource !== "users") return;
      if (field === "password" && resource === "users" && !draft[field]?.trim()) return;

      const sample = baseRow?.[field] ?? rows.find((row) => row[field] !== undefined)?.[field];
      const fieldType = inferFieldType(field, sample);
      const parsed = parseDraftValue(draft[field] ?? "", field, fieldType);

      if (parsed !== undefined) {
        payload[field] = parsed;
      }
    });

    return payload;
  }

  async function handleCreate() {
    if (!accessToken) return;

    setCreating(true);
    setError(null);
    setMessage(null);

    try {
      if (resource === "users" && !String(createDraft.password ?? "").trim()) {
        throw new Error("Vui lòng nhập mật khẩu khi tạo tài khoản người dùng.");
      }

      const payload = buildPayload(createDraft);
      await apiCreateResource(resource, payload, accessToken);

      const resetDraft: Record<string, string> = {};
      editableFields.forEach((field) => {
        resetDraft[field] = "";
      });
      setCreateDraft(resetDraft);

      setMessage("Đã tạo bản ghi mới.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo bản ghi thất bại.");
    } finally {
      setCreating(false);
    }
  }

  function openEditor(row: GenericRow) {
    const itemId = serializeRaw(row.id).trim();
    if (!itemId) {
      setError("Bản ghi không có mã định danh để cập nhật.");
      return;
    }

    const nextDraft: Record<string, string> = {};
    editableFields.forEach((field) => {
      const sample = row[field] ?? rows.find((item) => item[field] !== undefined)?.[field];
      const fieldType = inferFieldType(field, sample);
      nextDraft[field] = field === "password" ? "" : toDraftValue(row[field], field, fieldType);
    });

    setEditingId(itemId);
    setEditDraft(nextDraft);
    setError(null);
    setMessage(null);
  }

  async function handleUpdate() {
    if (!accessToken || !editingId) return;

    setUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const baseRow = rows.find((item) => serializeRaw(item.id) === editingId);
      const payload = buildPayload(editDraft, baseRow);
      await apiUpdateResource(resource, editingId, payload, accessToken);
      setMessage("Đã cập nhật bản ghi.");
      setEditingId(null);
      setEditDraft({});
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật bản ghi thất bại.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!accessToken) return;
    const confirmed = window.confirm("Bạn có chắc muốn xóa bản ghi này?");
    if (!confirmed) return;

    try {
      await apiDeleteResource(resource, itemId, accessToken);
      setMessage("Đã xóa bản ghi.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xóa bản ghi thất bại.");
    }
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  function exportVisibleRowsToCsv() {
    if (filteredRows.length === 0 || visibleColumnList.length === 0) return;

    const csvHeader = visibleColumnList.join(",");
    const csvBody = filteredRows
      .map((row) =>
        visibleColumnList
          .map((column) => {
            const raw = serializeRaw(row[column]).replaceAll('"', '""');
            return `"${raw}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([`${csvHeader}\n${csvBody}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${resource}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function toggleColumn(column: string) {
    setVisibleColumns((current) => {
      if (current.includes(column)) {
        const remaining = current.filter((item) => item !== column);
        return remaining.length === 0 ? current : remaining;
      }
      return [...current, column];
    });
  }

  function resolveReferenceLabel(field: string, value: unknown): string | null {
    const referenceResource = REFERENCE_RESOURCE_BY_FIELD[field];
    if (!referenceResource) return null;

    const candidateId = serializeRaw(value).trim();
    if (!candidateId) return null;

    const options = referenceRowsByResource[referenceResource] ?? [];
    const matched = options.find((item) => serializeRaw(item.id).trim() === candidateId);
    if (!matched) return null;

    return formatReferenceOption(matched);
  }

  function renderCellValue(field: string, value: unknown) {
    if (value === null || value === undefined || value === "") {
      return <span className="text-slate-400">-</span>;
    }

    const resolvedReference = resolveReferenceLabel(field, value);
    if (resolvedReference) {
      return <span className="break-words">{resolvedReference}</span>;
    }

    if (typeof value === "boolean") {
      return value ? "Có" : "Không";
    }

    if (isDateTimeField(field)) {
      const date = new Date(serializeRaw(value));
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString("vi-VN", { hour12: false });
      }
    }

    if (field === "status") {
      return formatStatus(serializeRaw(value));
    }

    if (typeof value === "object") {
      return <code className="block max-w-[360px] whitespace-pre-wrap break-words text-xs">{JSON.stringify(value, null, 2)}</code>;
    }

    const raw = serializeRaw(value);
    if (isLikelyIdField(field)) {
      return (
        <span title={raw} className="font-mono text-xs">
          {shortId(raw)}
        </span>
      );
    }

    return <span className="break-words">{raw}</span>;
  }

  function renderFieldInput(
    field: string,
    draft: Record<string, string>,
    onChange: (fieldName: string, value: string) => void
  ) {
    const sample = rows.find((row) => row[field] !== undefined)?.[field];
    const fieldType = inferFieldType(field, sample);
    const value = draft[field] ?? "";

    const referenceResource = REFERENCE_RESOURCE_BY_FIELD[field];
    const referenceOptions = referenceResource ? referenceRowsByResource[referenceResource] ?? [] : [];
    const useReferenceSelect = referenceOptions.length > 0;

    const label = formatFieldLabel(field);
    const id = `field-${resource}-${field}`;

    if (fieldType === "json") {
      return (
        <div key={field} className="space-y-1 md:col-span-2">
          <label htmlFor={id} className="text-xs font-semibold text-slate-600">
            {label}
          </label>
          <textarea
            id={id}
            className="h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
            placeholder={`${label} (dạng JSON)`}
            value={value}
            onChange={(event) => onChange(field, event.target.value)}
          />
        </div>
      );
    }

    if (fieldType === "boolean") {
      return (
        <div key={field} className="space-y-1">
          <label htmlFor={id} className="text-xs font-semibold text-slate-600">
            {label}
          </label>
          <select
            id={id}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={value}
            onChange={(event) => onChange(field, event.target.value)}
          >
            <option value="">Chưa chọn</option>
            <option value="true">Có</option>
            <option value="false">Không</option>
          </select>
        </div>
      );
    }

    if (useReferenceSelect) {
      return (
        <div key={field} className="space-y-1">
          <label htmlFor={id} className="text-xs font-semibold text-slate-600">
            {label}
          </label>
          <select
            id={id}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={value}
            onChange={(event) => onChange(field, event.target.value)}
          >
            <option value="">Chưa chọn</option>
            {referenceOptions.map((item) => {
              const optionId = serializeRaw(item.id).trim();
              if (!optionId) return null;
              return (
                <option key={optionId} value={optionId}>
                  {formatReferenceOption(item)}
                </option>
              );
            })}
          </select>
        </div>
      );
    }

    const inputType = fieldType === "number" ? "number" : fieldType === "datetime" ? "datetime-local" : field === "password" ? "password" : "text";

    return (
      <div key={field} className="space-y-1">
        <label htmlFor={id} className="text-xs font-semibold text-slate-600">
          {label}
        </label>
        <input
          id={id}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          type={inputType}
          value={value}
          onChange={(event) => onChange(field, event.target.value)}
          placeholder={label}
        />
      </div>
    );
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, accessToken]);

  useEffect(() => {
    if (columns.length === 0) {
      setVisibleColumns([]);
      return;
    }

    setVisibleColumns((current) => {
      const stillValid = current.filter((column) => columns.includes(column));
      if (stillValid.length > 0) return stillValid;

      const fallback = columns.filter((column) => !DEFAULT_HIDDEN_COLUMNS.has(column));
      return fallback.length > 0 ? fallback : columns;
    });
  }, [columns]);

  useEffect(() => {
    if (columns.length === 0) {
      setSortBy("");
      return;
    }

    if (!columns.includes(sortBy)) {
      setSortBy(columns.includes("created_at") ? "created_at" : columns[0]);
    }
  }, [columns, sortBy]);

  useEffect(() => {
    const nextDraft: Record<string, string> = {};
    editableFields.forEach((field) => {
      nextDraft[field] = createDraft[field] ?? "";
    });
    setCreateDraft(nextDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableFields.join("|"), resource]);

  useEffect(() => {
    if (!accessToken || referenceResources.length === 0) {
      setReferenceRowsByResource({});
      return;
    }

    const token = accessToken;
    let cancelled = false;

    async function loadReferenceRows() {
      try {
        const entries = await Promise.all(
          referenceResources.map(async (referenceResource) => {
            const response = await apiListResource<GenericRow>(referenceResource, token, {
              skip: 0,
              limit: 500
            });
            return [referenceResource, response.items ?? []] as const;
          })
        );

        if (cancelled) return;

        const next: Record<string, GenericRow[]> = {};
        entries.forEach(([referenceResource, items]) => {
          next[referenceResource] = items;
        });
        setReferenceRowsByResource(next);
      } catch {
        if (!cancelled) {
          setReferenceRowsByResource({});
        }
      }
    }

    void loadReferenceRows();

    return () => {
      cancelled = true;
    };
  }, [accessToken, referenceResources]);

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để thao tác dữ liệu.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title ?? formatResourceLabel(resource)}</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={reload}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Làm mới
          </Button>
          <Button variant="secondary" onClick={exportVisibleRowsToCsv}>
            <Download className="mr-2 h-4 w-4" />
            Xuất CSV
          </Button>
        </div>
      </div>

      <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Biểu mẫu tạo mới</h3>
        <p className="text-xs text-slate-500">
          Thao tác trực tiếp theo từng trường dữ liệu. Không cần nhập JSON thô.
        </p>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {editableFields.map((field) =>
            renderFieldInput(field, createDraft, (fieldName, value) => setCreateDraft((prev) => ({ ...prev, [fieldName]: value })))
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Đang tạo..." : "Tạo bản ghi"}
          </Button>
        </div>
      </section>

      {editingId ? (
        <section className="space-y-3 rounded border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-indigo-900">Đang chỉnh sửa bản ghi: {shortId(editingId)}</h3>
            <Button variant="secondary" onClick={() => setEditingId(null)}>
              Hủy chỉnh sửa
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {editableFields.map((field) =>
              renderFieldInput(field, editDraft, (fieldName, value) => setEditDraft((prev) => ({ ...prev, [fieldName]: value })))
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tìm kiếm toàn bảng..."
            value={searchKeyword}
            onChange={(event) => {
              setSearchKeyword(event.target.value);
              setPageIndex(0);
            }}
          />

          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            {columns.map((column) => (
              <option key={column} value={column}>
                Sắp xếp theo: {formatFieldLabel(column)}
              </option>
            ))}
          </select>

          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPageIndex(0);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} dòng / trang
              </option>
            ))}
          </select>

          <Button variant="secondary" onClick={() => setShowColumnConfig((current) => !current)}>
            {showColumnConfig ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showColumnConfig ? "Thu gọn cột" : "Ẩn/hiện cột"}
          </Button>
        </div>

        {showColumnConfig ? (
          <div className="mt-3 grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((column) => {
              const checked = visibleColumnList.includes(column);
              return (
                <label key={column} className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input checked={checked} type="checkbox" onChange={() => toggleColumn(column)} />
                  {formatFieldLabel(column)}
                </label>
              );
            })}
          </div>
        ) : null}
      </section>

      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <section className="overflow-auto rounded border border-slate-200 bg-white">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Đang tải dữ liệu...</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">Chưa có dữ liệu.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">#</th>
                {visibleColumnList.map((column) => (
                  <th key={column} className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    <button className="inline-flex items-center gap-1" onClick={() => handleSort(column)} type="button">
                      {formatFieldLabel(column)}
                      {sortBy === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                    </button>
                  </th>
                ))}
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, idx) => {
                const itemId = serializeRaw(row.id).trim();

                return (
                  <tr key={`${itemId || "row"}-${idx}`} className="odd:bg-white even:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2 align-top">{safePageIndex * pageSize + idx + 1}</td>

                    {visibleColumnList.map((column) => (
                      <td key={column} className="border-b border-slate-100 px-3 py-2 align-top">
                        {renderCellValue(column, row[column])}
                      </td>
                    ))}

                    <td className="border-b border-slate-100 px-3 py-2 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        {itemId ? (
                          <>
                            <Button variant="secondary" onClick={() => openEditor(row)}>
                              <Pencil className="mr-1 h-4 w-4" />
                              Sửa
                            </Button>
                            <Button variant="secondary" onClick={() => void handleDelete(itemId)}>
                              <Trash2 className="mr-1 h-4 w-4" />
                              Xóa
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Không áp dụng</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Hiển thị {paginatedRows.length} / {filteredRows.length} dòng (tổng đã nạp: {rows.length})
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            disabled={safePageIndex <= 0}
          >
            Trước
          </Button>
          <span>
            Trang {safePageIndex + 1} / {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
            disabled={safePageIndex + 1 >= totalPages}
          >
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
}
