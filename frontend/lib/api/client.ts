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
  const response = await fetch(
    buildUrl(`/api/v1/resources/${resource}`, {
      skip: params?.skip,
      limit: params?.limit
    }),
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  return parseResponse<{ items: T[]; total: number }>(response);
}

export async function apiCreateResource<T>(
  resource: string,
  payload: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resources/${resource}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/resources/${resource}/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<T>(response);
}

export async function apiDeleteResource(resource: string, itemId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resources/${resource}/${itemId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
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

  const response = await fetch(
    buildUrl(`/api/v1/io/import/${resource}`, { dry_run: options?.dryRun ?? false }),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
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

  const response = await fetch(`${API_BASE_URL}/api/v1/attachments/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`
    },
    body: formData
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiGeocode(
  address: string,
  accessToken: string
): Promise<{ address: string; latitude: number; longitude: number; source: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/geocode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ address })
  });

  return parseResponse<{ address: string; latitude: number; longitude: number; source: string }>(response);
}

export async function apiPricingPreview(
  payload: PricingPreviewPayload,
  accessToken: string
): Promise<PricingPreviewResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/pricing/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/pricing/quotations/${quotationId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/pricing/quotations/${quotationId}/approval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/pour-requests/${pourRequestId}/approval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiCreateScheduleRun(
  payload: DispatchScheduleRunPayload,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/schedule-runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiGetScheduleRun(
  scheduleRunId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/schedule-runs/${scheduleRunId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return parseResponse<Record<string, unknown>>(response);
}

export async function apiGetScheduleRunConflicts(
  scheduleRunId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/schedule-runs/${scheduleRunId}/conflicts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

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
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/scheduled-trips/${scheduledTripId}/override`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/trips/${tripId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/pump-sessions/${pumpSessionId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/offline-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/reconciliation/${pourRequestId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
  const response = await fetch(`${API_BASE_URL}/api/v1/dispatch/kpi/snapshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
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
