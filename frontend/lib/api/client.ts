const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:18000";

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

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? JSON.stringify(await response.json())
      : await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
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
