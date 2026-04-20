"use client";

import { ArrowLeft, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiGetResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

import { Button } from "../ui/button";

type GenericRow = Record<string, unknown>;

type ResourceDetailPageProps = {
  resource: string;
  itemId: string;
  title?: string;
  backHref: string;
  backLabel?: string;
};

const RESOURCE_LABELS: Record<string, string> = {
  users: "Tài khoản người dùng",
  roles: "Vai trò",
  permissions: "Quyền thao tác",
  role_permissions: "Gán quyền cho vai trò",
  user_roles: "Gán vai trò cho người dùng",
  system_settings: "Cấu hình hệ thống",
  customers: "Khách hàng",
  project_sites: "Công trình",
  price_books: "Bảng giá",
  price_rules: "Quy tắc giá"
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
  created_at: "Ngày tạo",
  updated_at: "Ngày cập nhật"
};

function serializeRaw(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function shortId(value: string): string {
  if (!value) return "-";
  return value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function formatFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function isDateTimeField(field: string): boolean {
  return field.endsWith("_at") || field.endsWith("_date");
}

function renderValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400">-</span>;
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

  if (typeof value === "object") {
    return <code className="block whitespace-pre-wrap break-words text-xs">{JSON.stringify(value, null, 2)}</code>;
  }

  const raw = serializeRaw(value);
  if (field === "id" || field.endsWith("_id")) {
    return (
      <span className="font-mono text-xs" title={raw}>
        {shortId(raw)}
      </span>
    );
  }

  return <span className="break-words">{raw}</span>;
}

export function ResourceDetailPage({ resource, itemId, title, backHref, backLabel = "Quay lại danh sách" }: ResourceDetailPageProps) {
  const { accessToken } = useAuthStore();
  const [row, setRow] = useState<GenericRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedTitle = title ?? RESOURCE_LABELS[resource] ?? `Chi tiết dữ liệu: ${resource}`;

  const orderedFields = useMemo(() => {
    if (!row) return [];
    const fields = Object.keys(row);
    const priority: Record<string, number> = {
      id: 1,
      code: 2,
      key: 3,
      name: 4,
      full_name: 5,
      status: 6,
      created_at: 90,
      updated_at: 91
    };

    return fields.sort((left, right) => {
      const leftPriority = priority[left] ?? 50;
      const rightPriority = priority[right] ?? 50;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return left.localeCompare(right);
    });
  }, [row]);

  async function load() {
    if (!accessToken) return;

    setLoading(true);
    setError(null);
    try {
      const detail = await apiGetResource<GenericRow>(resource, itemId, accessToken);
      setRow(detail ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được chi tiết bản ghi.");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken, itemId, resource]);

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để xem chi tiết dữ liệu.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
          <h2 className="text-xl font-semibold">{resolvedTitle}</h2>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Làm mới
        </Button>
      </div>

      <section className="ta-card p-4">
        <p className="text-sm text-slate-600">
          Bản ghi: <span className="font-mono">{shortId(itemId)}</span>
        </p>
      </section>

      {loading ? (
        <section className="ta-card p-4 text-sm text-slate-500">Đang tải chi tiết bản ghi...</section>
      ) : null}

      {error ? <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error && row ? (
        <section className="ta-card p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orderedFields.map((field) => (
              <article key={field} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{formatFieldLabel(field)}</p>
                <div className="mt-1 text-sm text-gray-800">{renderValue(field, row[field])}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && !row ? (
        <section className="ta-card p-4 text-sm text-slate-500">Không tìm thấy bản ghi.</section>
      ) : null}
    </div>
  );
}
