import { useAuthStore } from "../store/auth-store";

function getApiBaseUrl(): string {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) {
    if (typeof window !== "undefined") {
      try {
        const parsed = new URL(envBaseUrl);
        const currentHost = window.location.hostname;
        if (
          (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
          currentHost !== "localhost" &&
          currentHost !== "127.0.0.1"
        ) {
          parsed.hostname = currentHost;
          return parsed.toString().replace(/\/$/, "");
        }
      } catch {
        // fallback to env value below when URL parsing fails
      }
    }
    return envBaseUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:18000`;
  }

  return "http://localhost:18000";
}

const API_BASE_URL = getApiBaseUrl();

let refreshingAccessTokenPromise: Promise<string | null> | null = null;

function redirectToLogin(): void {
  if (typeof window !== "undefined" && window.location.pathname !== "/dang-nhap") {
    window.location.href = "/dang-nhap";
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshingAccessTokenPromise) {
    return refreshingAccessTokenPromise;
  }

  const { refreshToken, user, setAuth, clearAuth } = useAuthStore.getState();
  if (!refreshToken) {
    clearAuth();
    redirectToLogin();
    return null;
  }

  refreshingAccessTokenPromise = (async () => {
    try {
      const refreshed = await apiRefresh(refreshToken);
      let nextUser = user;
      try {
        nextUser = await apiMe(refreshed.access_token);
      } catch {
        nextUser = user;
      }

      setAuth({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        user: nextUser
      });

      return refreshed.access_token;
    } catch {
      clearAuth();
      redirectToLogin();
      return null;
    } finally {
      refreshingAccessTokenPromise = null;
    }
  })();

  return refreshingAccessTokenPromise;
}

function withAuthorizationHeader(headers: HeadersInit | undefined, accessToken: string): Headers {
  const merged = new Headers(headers ?? {});
  merged.set("Authorization", `Bearer ${accessToken}`);
  return merged;
}

async function fetchWithAccessTokenRetry(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const execute = (token: string) =>
    fetch(url, {
      ...init,
      headers: withAuthorizationHeader(init?.headers, token)
    });

  let response = await execute(accessToken);
  if (response.status !== 401) {
    return response;
  }

  const refreshedAccessToken = await refreshAccessToken();
  if (!refreshedAccessToken) {
    return response;
  }

  response = await execute(refreshedAccessToken);
  return response;
}

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    full_name: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
};

export type ImportErrorRow = {
  row_number: number;
  error: string;
  row: Record<string, unknown>;
};

export type ImportResult = {
  resource: string;
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  created: number;
  skipped: number;
  preview: Array<Record<string, unknown>>;
  errors: ImportErrorRow[];
};

export type PricingPreviewPayload = {
  organization_id: string;
  price_book_id?: string;
  customer_id?: string;
  site_id?: string;
  plant_id?: string;
  region_code?: string;
  concrete_product_id?: string;
  quoted_volume_m3?: number;
  distance_km?: number;
  difficulty_level?: string;
  requires_pump?: boolean;
  surcharge_amount?: number;
  discount_amount?: number;
  pricing_at?: string;
};

export type PricingPreviewResult = {
  price_book: {
    id: string;
    code: string;
    name: string;
    priority: number;
  };
  components: {
    base_price: number;
    distance_fee: number;
    difficulty_fee: number;
    pump_fee: number;
    surcharge_fee: number;
    discount_fee: number;
  };
  final_unit_price: number;
  quoted_volume_m3: number;
  total_amount: number;
  applied_rules: Array<{
    rule_id: string;
    rule_name: string;
    rule_type: string;
    amount: number;
    priority: number;
  }>;
};

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export class ApiError extends Error {
  status: number;
  detail: string | null;
  payload: unknown;

  constructor(status: number, message: string, detail: string | null, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.payload = payload;
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let payload: unknown = null;
    let detail: string | null = null;
    let message = `Request failed with ${response.status}`;

    if (contentType.includes("application/json")) {
      payload = await response.json();
      if (typeof payload === "object" && payload !== null && "detail" in payload) {
        detail = String((payload as { detail: unknown }).detail);
        message = detail;
      } else {
        message = JSON.stringify(payload);
      }
    } else {
      const bodyText = await response.text();
      payload = bodyText;
      if (bodyText) {
        message = bodyText;
      }
    }

    throw new ApiError(response.status, message, detail, payload);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return {} as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function apiLogin(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseResponse<LoginResponse>(response);
}

export async function apiRefresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  return parseResponse<{ access_token: string; refresh_token: string }>(response);
}

export async function apiMe(accessToken: string): Promise<LoginResponse["user"]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return parseResponse<LoginResponse["user"]>(response);
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
}

export async function apiListResource<T>(
  resource: string,
  accessToken: string,
  params?: { skip?: number; limit?: number }
): Promise<{ items: T[]; total: number }> {
  const response = await fetchWithAccessTokenRetry(
    buildUrl(`/api/v1/resources/${resource}`, {
      skip: params?.skip,
      limit: params?.limit
    }),
    accessToken
  );

  return parseResponse<{ items: T[]; total: number }>(response);
}

export async function apiCreateResource<T>(
  resource: string,
  payload: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/resources/${resource}`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<T>(response);
}

export async function apiUpdateResource<T>(
  resource: string,
  itemId: string,
  payload: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/resources/${resource}/${itemId}`, accessToken, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<T>(response);
}

export async function apiDeleteResource(resource: string, itemId: string, accessToken: string): Promise<void> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/resources/${resource}/${itemId}`, accessToken, {
    method: "DELETE"
  });

  await parseResponse<{ status: string }>(response);
}

export async function apiImportResource(
  resource: string,
  file: File,
  accessToken: string,
  options?: { dryRun?: boolean }
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithAccessTokenRetry(
    buildUrl(`/api/v1/io/import/${resource}`, { dry_run: options?.dryRun ?? false }),
    accessToken,
    {
      method: "POST",
      body: formData
    }
  );

  return parseResponse<ImportResult>(response);
}

export function apiExportResourceUrl(resource: string): string {
  return `${API_BASE_URL}/api/v1/io/export/${resource}`;
}

export async function apiUploadAttachment(params: {
  entityType: string;
  entityId: string;
  file: File;
  accessToken: string;
}): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("entity_type", params.entityType);
  formData.append("entity_id", params.entityId);
  formData.append("file", params.file);

  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/attachments/upload`, params.accessToken, {
    method: "POST",
    body: formData
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiGeocode(
  address: string,
  accessToken: string
): Promise<{ address: string; latitude: number; longitude: number; source: string }> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/geocode`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ address })
  });

  return parseResponse<{ address: string; latitude: number; longitude: number; source: string }>(response);
}

export async function apiPricingPreview(
  payload: PricingPreviewPayload,
  accessToken: string
): Promise<PricingPreviewResult> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/pricing/preview`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<PricingPreviewResult>(response);
}

export async function apiConfirmQuotation(
  quotationId: string,
  payload: {
    price_book_id?: string;
    plant_id?: string;
    region_code?: string;
    surcharge_amount?: number;
    discount_amount?: number;
    final_status?: string;
  },
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/pricing/quotations/${quotationId}/confirm`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiSetQuotationApproval(
  quotationId: string,
  payload: {
    action: "approved" | "rejected";
    note?: string;
    discount_override_pct?: number;
    discount_override_amount?: number;
  },
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/pricing/quotations/${quotationId}/approval`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export function apiQuotationPdfUrl(quotationId: string): string {
  return `${API_BASE_URL}/api/v1/pricing/quotations/${quotationId}/pdf`;
}


export type DispatchApprovalPayload = {
  organization_id: string;
  action: "approve" | "reject" | "request-more-info";
  assigned_plant_id?: string;
  assigned_pump_id?: string;
  target_truck_rhythm_minutes?: number;
  dispatch_lock?: boolean;
  locked_fields_json?: Record<string, unknown> | Array<unknown>;
  note?: string;
};

export type DispatchScheduleRunPayload = {
  organization_id: string;
  run_date?: string;
  dispatch_order_ids?: string[];
};

export type DispatchEventPayload = {
  organization_id: string;
  event_type: string;
  event_time?: string;
  payload?: Record<string, unknown>;
  idempotency_key?: string;
  source?: string;
};

export async function apiDispatchApproval(
  pourRequestId: string,
  payload: DispatchApprovalPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/pour-requests/${pourRequestId}/approval`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiCreateScheduleRun(
  payload: DispatchScheduleRunPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/schedule-runs`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiGetScheduleRun(
  scheduleRunId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/schedule-runs/${scheduleRunId}`, accessToken);

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiGetScheduleRunConflicts(
  scheduleRunId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(
    `${API_BASE_URL}/api/v1/dispatch/schedule-runs/${scheduleRunId}/conflicts`,
    accessToken
  );

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiOverrideScheduledTrip(
  scheduledTripId: string,
  payload: {
    override_type?: string;
    override_payload: Record<string, unknown>;
    note?: string;
  },
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/scheduled-trips/${scheduledTripId}/override`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiPostTripEvent(
  tripId: string,
  payload: DispatchEventPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/trips/${tripId}/events`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiPostPumpEvent(
  pumpSessionId: string,
  payload: DispatchEventPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/pump-sessions/${pumpSessionId}/events`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiPostOfflineSync(
  payload: {
    organization_id: string;
    device_id?: string;
    events: Array<Record<string, unknown>>;
  },
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/offline-sync`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiPostReconciliation(
  pourRequestId: string,
  payload: {
    organization_id: string;
    actual_volume_m3?: number;
    actual_trip_count?: number;
    reason_code?: string;
    note?: string;
  },
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/reconciliation/${pourRequestId}`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiPostKpiSnapshot(
  payload: {
    organization_id: string;
    snapshot_date?: string;
    plant_id?: string;
  },
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/dispatch/kpi/snapshot`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export function apiDispatchRealtimeUrl(organizationId: string): string {
  return `${API_BASE_URL}/api/v1/dispatch/realtime?organization_id=${encodeURIComponent(organizationId)}`;
}

export function apiDispatchReportUrl(organizationId: string, format: "csv" | "pdf" = "csv"): string {
  return `${API_BASE_URL}/api/v1/dispatch/reports/operations?organization_id=${encodeURIComponent(organizationId)}&report_format=${format}`;
}

export type InventoryMovementPayload = {
  organization_id: string;
  movement_type: "receipt" | "issue" | "transfer" | "adjustment" | "waste";
  warehouse_id: string;
  destination_warehouse_id?: string;
  material_id: string;
  quantity?: number;
  quantity_delta?: number;
  unit_cost?: number;
  reference_no?: string;
  source_document_type?: string;
  source_document_id?: string;
  note?: string;
  transaction_at?: string;
  period_id?: string;
};

export type InventoryStockTakePayload = {
  organization_id: string;
  warehouse_id: string;
  material_id: string;
  counted_qty: number;
  unit_cost?: number;
  note?: string;
  stock_take_date?: string;
  period_id?: string;
};

export type CostPeriodCreatePayload = {
  organization_id: string;
  period_code: string;
  start_date: string;
  end_date: string;
  note?: string;
};

export async function apiInventoryMovement(
  payload: InventoryMovementPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/inventory/movements`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiInventoryStockTake(
  payload: InventoryStockTakePayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/inventory/stock-takes`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiInventoryBalances(
  organizationId: string,
  accessToken: string,
  params?: { warehouse_id?: string; material_id?: string }
): Promise<{ items: Array<Record<string, unknown>> }> {
  const response = await fetchWithAccessTokenRetry(
    buildUrl("/api/v1/inventory/balances", {
      organization_id: organizationId,
      warehouse_id: params?.warehouse_id,
      material_id: params?.material_id
    }),
    accessToken
  );

  return parseResponse<{ items: Array<Record<string, unknown>> }>(response);
}

export async function apiInventoryImportReceipts(
  organizationId: string,
  file: File,
  accessToken: string,
  options?: { dryRun?: boolean }
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithAccessTokenRetry(
    buildUrl("/api/v1/inventory/import-receipts", {
      organization_id: organizationId,
      dry_run: options?.dryRun ?? false
    }),
    accessToken,
    {
      method: "POST",
      body: formData
    }
  );

  return parseResponse<ImportResult>(response);
}

export function apiInventorySnapshotUrl(organizationId: string): string {
  return `${API_BASE_URL}/api/v1/inventory/export-snapshot?organization_id=${encodeURIComponent(organizationId)}`;
}

export async function apiCreateCostPeriod(
  payload: CostPeriodCreatePayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/costing/periods`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiCostPeriodAction(
  periodId: string,
  action: "open" | "close" | "reopen",
  payload: { organization_id: string; note?: string },
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/costing/periods/${periodId}/${action}`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiCostPeriodPrecloseChecklist(
  periodId: string,
  organizationId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(
    buildUrl(`/api/v1/costing/periods/${periodId}/preclose-checklist`, {
      organization_id: organizationId
    }),
    accessToken
  );

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiUnitCostVariancePreview(
  organizationId: string,
  periodId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(
    buildUrl("/api/v1/costing/unit-cost-variance-preview", {
      organization_id: organizationId,
      period_id: periodId
    }),
    accessToken
  );

  return parseResponse<Record<string, unknown>>(response);
}

export type Phase5ProductionLogPayload = {
  organization_id: string;
  period_id?: string;
  plant_id?: string;
  shift_date?: string;
  log_type?: "crushing" | "batching" | "production";
  production_line?: string;
  material_id?: string;
  concrete_product_id?: string;
  input_qty?: number;
  output_qty?: number;
  runtime_minutes?: number;
  downtime_minutes?: number;
  electricity_kwh?: number;
  labor_hours?: number;
  maintenance_cost?: number;
  note?: string;
};

export type Phase5CostPoolPayload = {
  organization_id: string;
  period_id: string;
  pool_code: string;
  pool_name: string;
  cost_type?: string;
  amount: number;
  source_reference?: string;
  note?: string;
};

export type Phase5AllocationRulePayload = {
  organization_id: string;
  period_id: string;
  pool_id: string;
  cost_center_id?: string;
  cost_object_id?: string;
  basis_type?: "manual_ratio" | "volume_m3" | "runtime_minutes";
  ratio_value?: number;
  priority?: number;
  note?: string;
};

export type Phase5RunAllocationPayload = {
  organization_id: string;
  period_id: string;
  note?: string;
};

export type Phase5UnitCostSnapshotPayload = {
  organization_id: string;
  period_id: string;
  concrete_product_id?: string;
  source_run_id?: string;
  output_volume_m3?: number;
  total_cost?: number;
  note?: string;
};

export type Phase5MarginSnapshotPayload = {
  organization_id: string;
  period_id: string;
  sales_order_id?: string;
  concrete_product_id?: string;
  delivered_volume_m3?: number;
  revenue_amount?: number;
  cost_amount?: number;
  note?: string;
};

export async function apiCreateProductionLog(
  payload: Phase5ProductionLogPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/costing/production-logs`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiListProductionLogs(
  organizationId: string,
  accessToken: string,
  options?: { period_id?: string; plant_id?: string; skip?: number; limit?: number }
): Promise<{ items: Array<Record<string, unknown>> }> {
  const response = await fetchWithAccessTokenRetry(
    buildUrl("/api/v1/costing/production-logs", {
      organization_id: organizationId,
      period_id: options?.period_id,
      plant_id: options?.plant_id,
      skip: options?.skip ?? 0,
      limit: options?.limit ?? 100
    }),
    accessToken
  );

  return parseResponse<{ items: Array<Record<string, unknown>> }>(response);
}

export async function apiCreateCostPool(
  payload: Phase5CostPoolPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/costing/cost-pools`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiCreateAllocationRule(
  payload: Phase5AllocationRulePayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/costing/allocation-rules`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiRunAllocation(
  payload: Phase5RunAllocationPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/costing/allocation-runs`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiGetAllocationRun(
  allocationRunId: string,
  organizationId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(
    buildUrl(`/api/v1/costing/allocation-runs/${allocationRunId}`, {
      organization_id: organizationId
    }),
    accessToken
  );

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiCreateUnitCostSnapshot(
  payload: Phase5UnitCostSnapshotPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/costing/unit-cost-snapshots`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiListUnitCostSnapshots(
  organizationId: string,
  accessToken: string,
  options?: { period_id?: string; skip?: number; limit?: number }
): Promise<{ items: Array<Record<string, unknown>> }> {
  const response = await fetchWithAccessTokenRetry(
    buildUrl("/api/v1/costing/unit-cost-snapshots", {
      organization_id: organizationId,
      period_id: options?.period_id,
      skip: options?.skip ?? 0,
      limit: options?.limit ?? 100
    }),
    accessToken
  );

  return parseResponse<{ items: Array<Record<string, unknown>> }>(response);
}

export async function apiCreateMarginSnapshot(
  payload: Phase5MarginSnapshotPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetchWithAccessTokenRetry(`${API_BASE_URL}/api/v1/costing/margin-snapshots`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiListMarginSnapshots(
  organizationId: string,
  accessToken: string,
  options?: { period_id?: string; skip?: number; limit?: number }
): Promise<{ items: Array<Record<string, unknown>> }> {
  const response = await fetchWithAccessTokenRetry(
    buildUrl("/api/v1/costing/margin-snapshots", {
      organization_id: organizationId,
      period_id: options?.period_id,
      skip: options?.skip ?? 0,
      limit: options?.limit ?? 100
    }),
    accessToken
  );

  return parseResponse<{ items: Array<Record<string, unknown>> }>(response);
}
