"use client";

import { AlertTriangle, ClipboardList, Filter, RefreshCw, Search, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiListResource, isAuthError } from "@/lib/api/client";
import { getPourRequestWarnings } from "@/lib/sales/warnings";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

const STATUS_LABELS: Record<string, string> = {
  new: "Mới",
  draft: "Nháp",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  confirmed: "Đã chốt",
  assigned: "Đã phân công",
  closed: "Đã đóng",
  open: "Đang mở",
  pending: "Chờ xử lý"
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function toDisplayDate(value: unknown): string {
  if (!value) return "-";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("vi-VN", { hour12: false });
}

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function formatEntityLabel(entity: GenericRow | undefined, id: unknown, primaryNameKey: "name" | "site_name" = "name"): string {
  const idText = String(id ?? "").trim();
  if (!idText) return "-";

  const code = String(entity?.code ?? "").trim();
  const name = String(entity?.[primaryNameKey] ?? entity?.name ?? "").trim();

  if (code && name) return `${code} - ${name}`;
  if (name) return name;
  if (code) return code;
  return toShortId(idText);
}

function formatStatus(value: unknown): string {
  const key = normalizeText(value);
  if (!key) return "-";
  return STATUS_LABELS[key] ?? String(value);
}

export default function SalesOrdersPage() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [salesOrders, setSalesOrders] = useState<GenericRow[]>([]);
  const [pourRequests, setPourRequests] = useState<GenericRow[]>([]);
  const [customers, setCustomers] = useState<GenericRow[]>([]);
  const [projectSites, setProjectSites] = useState<GenericRow[]>([]);
  const [plants, setPlants] = useState<GenericRow[]>([]);

  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!accessToken) {
      setError("Không có phiên đăng nhập hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [ordersRes, requestsRes, customersRes, sitesRes, plantsRes] = await Promise.all([
        apiListResource<GenericRow>("sales_orders", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("pour_requests", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("customers", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("project_sites", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("plants", accessToken, { skip: 0, limit: 500 })
      ]);

      setSalesOrders(ordersRes.items ?? []);
      setPourRequests(requestsRes.items ?? []);
      setCustomers(customersRes.items ?? []);
      setProjectSites(sitesRes.items ?? []);
      setPlants(plantsRes.items ?? []);
    } catch (e) {
      if (isAuthError(e)) {
        setError("Phiên đăng nhập hết hạn. Hệ thống đang chuyển bạn về trang đăng nhập.");
      } else {
        setError(e instanceof Error ? e.message : "Không tải được danh sách đơn bán và yêu cầu đổ.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (accessToken) {
      void reload();
    }
  }, [accessToken]);

  const customerById = useMemo(() => {
    const map = new Map<string, GenericRow>();
    customers.forEach((item) => {
      const id = String(item.id ?? "");
      if (id) map.set(id, item);
    });
    return map;
  }, [customers]);

  const siteById = useMemo(() => {
    const map = new Map<string, GenericRow>();
    projectSites.forEach((item) => {
      const id = String(item.id ?? "");
      if (id) map.set(id, item);
    });
    return map;
  }, [projectSites]);

  const plantById = useMemo(() => {
    const map = new Map<string, GenericRow>();
    plants.forEach((item) => {
      const id = String(item.id ?? "");
      if (id) map.set(id, item);
    });
    return map;
  }, [plants]);

  const filters = {
    status: normalizeText(statusFilter),
    customer: normalizeText(customerFilter),
    plant: normalizeText(plantFilter),
    date: normalizeText(dateFilter)
  };

  const filteredOrders = useMemo(() => {
    return salesOrders.filter((row) => {
      const status = normalizeText(row.status);
      const customerLabel = normalizeText(
        formatEntityLabel(customerById.get(String(row.customer_id ?? "")), row.customer_id, "name")
      );
      const siteLabel = normalizeText(formatEntityLabel(siteById.get(String(row.site_id ?? "")), row.site_id, "site_name"));
      const date = normalizeText(row.created_at ?? row.order_date);

      if (filters.status && !status.includes(filters.status)) return false;
      if (filters.customer && !`${customerLabel} ${siteLabel}`.includes(filters.customer)) return false;
      if (filters.date && !date.includes(filters.date)) return false;
      return true;
    });
  }, [customerById, filters.customer, filters.date, filters.status, salesOrders, siteById]);

  const filteredRequests = useMemo(() => {
    return pourRequests.filter((row) => {
      const status = normalizeText(row.status);
      const customerLabel = normalizeText(
        formatEntityLabel(customerById.get(String(row.customer_id ?? "")), row.customer_id, "name")
      );
      const plantLabel = normalizeText(
        formatEntityLabel(plantById.get(String(row.assigned_plant_id ?? "")), row.assigned_plant_id, "name")
      );
      const date = normalizeText(row.requested_date ?? row.requested_start_at);

      if (filters.status && !status.includes(filters.status)) return false;
      if (filters.customer && !customerLabel.includes(filters.customer)) return false;
      if (filters.plant && !plantLabel.includes(filters.plant)) return false;
      if (filters.date && !date.includes(filters.date)) return false;
      return true;
    });
  }, [customerById, filters.customer, filters.date, filters.plant, filters.status, plantById, pourRequests]);

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Không tìm thấy phiên đăng nhập. Vui lòng quay lại trang `/dang-nhap`.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-600 to-cyan-500 p-5 text-white shadow-lg shadow-blue-300/30">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Không gian Kinh doanh</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Đơn bán & Yêu cầu đổ bê tông</h1>
        <p className="mt-2 text-sm text-blue-50">Theo dõi danh sách đơn theo dữ liệu nghiệp vụ dễ đọc, lọc nhanh theo trạng thái/khách hàng/trạm.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Đơn bán</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredOrders.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Yêu cầu đổ</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredRequests.length}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Filter className="h-4 w-4" />
          Bộ lọc
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Lọc trạng thái"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            />
          </label>

          <input
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Lọc khách hàng/công trình"
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
          />

          <input
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Lọc trạm cấp"
            value={plantFilter}
            onChange={(event) => setPlantFilter(event.target.value)}
          />

          <input
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Lọc ngày (YYYY-MM-DD)"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />

          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            type="button"
            disabled={loading}
            onClick={() => void reload()}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Đơn bán ({filteredOrders.length})</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Mã đơn</th>
                <th className="px-4 py-2">Khách hàng</th>
                <th className="px-4 py-2">Công trình</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Thời điểm tạo</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((row) => {
                const customerLabel = formatEntityLabel(customerById.get(String(row.customer_id ?? "")), row.customer_id, "name");
                const siteLabel = formatEntityLabel(siteById.get(String(row.site_id ?? "")), row.site_id, "site_name");

                return (
                  <tr key={String(row.id ?? `${row.order_no}-${row.created_at}`)} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40">
                    <td className="px-4 py-2 font-medium text-slate-900">{String(row.order_no ?? "") || "-"}</td>
                    <td className="px-4 py-2 text-slate-600">{customerLabel}</td>
                    <td className="px-4 py-2 text-slate-600">{siteLabel}</td>
                    <td className="px-4 py-2 text-slate-600">{formatStatus(row.status)}</td>
                    <td className="px-4 py-2 text-slate-600">{toDisplayDate(row.created_at ?? row.order_date)}</td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                    Chưa có đơn bán phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Yêu cầu đổ ({filteredRequests.length})</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Mã yêu cầu</th>
                <th className="px-4 py-2">Khách hàng</th>
                <th className="px-4 py-2">Trạm cấp</th>
                <th className="px-4 py-2">Ngày yêu cầu</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Cảnh báo dữ liệu</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((row) => {
                const warnings = getPourRequestWarnings({
                  assigned_plant_id: row.assigned_plant_id ? String(row.assigned_plant_id) : null,
                  requested_start_at: row.requested_start_at ? String(row.requested_start_at) : null,
                  requested_end_at: row.requested_end_at ? String(row.requested_end_at) : null,
                  site_contact_name: row.site_contact_name ? String(row.site_contact_name) : null,
                  site_contact_phone: row.site_contact_phone ? String(row.site_contact_phone) : null,
                  requested_volume_m3:
                    row.requested_volume_m3 === null || row.requested_volume_m3 === undefined
                      ? null
                      : Number(row.requested_volume_m3)
                });

                const customerLabel = formatEntityLabel(customerById.get(String(row.customer_id ?? "")), row.customer_id, "name");
                const plantLabel = formatEntityLabel(
                  plantById.get(String(row.assigned_plant_id ?? "")),
                  row.assigned_plant_id,
                  "name"
                );

                return (
                  <tr key={String(row.id ?? `${row.request_no}-${row.requested_date}`)} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40">
                    <td className="px-4 py-2 font-medium text-slate-900">{String(row.request_no ?? "") || "-"}</td>
                    <td className="px-4 py-2 text-slate-600">{customerLabel}</td>
                    <td className="px-4 py-2 text-slate-600">{plantLabel}</td>
                    <td className="px-4 py-2 text-slate-600">{toDisplayDate(row.requested_date ?? row.requested_start_at)}</td>
                    <td className="px-4 py-2 text-slate-600">{formatStatus(row.status)}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {warnings.length > 0 ? (
                        <ul className="list-disc pl-5 text-xs text-amber-700">
                          {warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Sẵn sàng
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRequests.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    Chưa có yêu cầu đổ phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
