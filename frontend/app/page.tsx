"use client";

import { Activity, BarChart3, CalendarClock, Factory, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { apiListResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

type DashboardRows = {
  pourRequests: GenericRow[];
  dispatchOrders: GenericRow[];
  reconciliations: GenericRow[];
  kpis: GenericRow[];
};

const statusLabelMap: Record<string, string> = {
  new: "Mới",
  draft: "Nháp",
  pending: "Chờ xử lý",
  approved: "Đã duyệt",
  confirmed: "Đã xác nhận",
  closed: "Đã đóng",
  rejected: "Đã từ chối"
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "unknown").trim().toLowerCase() || "unknown";
}

function statusLabel(status: string): string {
  return statusLabelMap[status] ?? status.toUpperCase();
}

function toSortDate(row: GenericRow): number {
  const source =
    String(row.requested_start_at ?? "") || String(row.requested_date ?? "") || String(row.created_at ?? "") || "";
  const epoch = Date.parse(source);
  return Number.isFinite(epoch) ? epoch : 0;
}

export default function HomePage() {
  const t = useTranslations();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [rows, setRows] = useState<DashboardRows>({
    pourRequests: [],
    dispatchOrders: [],
    reconciliations: [],
    kpis: []
  });

  useEffect(() => {
    if (!accessToken) {
      setRows({
        pourRequests: [],
        dispatchOrders: [],
        reconciliations: [],
        kpis: []
      });
      setStatsError(null);
      return;
    }

    const token = accessToken;
    let cancelled = false;

    async function loadDashboardRows() {
      setLoadingStats(true);
      setStatsError(null);

      const [pourRes, dispatchRes, reconciliationRes, kpiRes] = await Promise.allSettled([
        apiListResource<GenericRow>("pour_requests", token, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("dispatch_orders", token, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("reconciliation_records", token, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("daily_kpi_snapshots", token, { skip: 0, limit: 500 })
      ]);

      if (cancelled) return;

      setRows({
        pourRequests: pourRes.status === "fulfilled" ? pourRes.value.items ?? [] : [],
        dispatchOrders: dispatchRes.status === "fulfilled" ? dispatchRes.value.items ?? [] : [],
        reconciliations: reconciliationRes.status === "fulfilled" ? reconciliationRes.value.items ?? [] : [],
        kpis: kpiRes.status === "fulfilled" ? kpiRes.value.items ?? [] : []
      });

      const hasFailure = [pourRes, dispatchRes, reconciliationRes, kpiRes].some((result) => result.status === "rejected");
      if (hasFailure) {
        setStatsError("Một số biểu đồ chưa lấy đủ dữ liệu, nhưng hệ thống vẫn hiển thị phần khả dụng.");
      }

      setLoadingStats(false);
    }

    void loadDashboardRows();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const summaryCards = useMemo(() => {
    const totalRequestedVolume = rows.pourRequests.reduce((sum, item) => sum + toNumber(item.requested_volume_m3), 0);
    const totalDispatchOrders = rows.dispatchOrders.length;
    const totalReconciliations = rows.reconciliations.length;

    const averageOnTimePct =
      rows.kpis.length > 0
        ? rows.kpis.reduce((sum, item) => sum + toNumber(item.on_time_pct), 0) / rows.kpis.length
        : 0;

    const averageVariance =
      rows.reconciliations.length > 0
        ? rows.reconciliations.reduce((sum, item) => sum + Math.abs(toNumber(item.variance_volume_m3)), 0) / rows.reconciliations.length
        : 0;

    return [
      {
        title: "Khối lượng yêu cầu",
        value: `${totalRequestedVolume.toFixed(1)} m³`,
        description: "Tổng khối lượng từ yêu cầu đổ hiện có.",
        icon: Truck,
        tone: "bg-brand-50 text-brand-700"
      },
      {
        title: "Lệnh điều phối",
        value: String(totalDispatchOrders),
        description: "Số lệnh điều phối đang quản lý trong hệ thống.",
        icon: CalendarClock,
        tone: "bg-violet-50 text-violet-700"
      },
      {
        title: "Bản ghi đối soát",
        value: String(totalReconciliations),
        description: `Sai lệch TB ${averageVariance.toFixed(2)} m³ / bản ghi.`,
        icon: BarChart3,
        tone: "bg-amber-50 text-amber-700"
      },
      {
        title: "Tỷ lệ đúng giờ (TB)",
        value: `${averageOnTimePct.toFixed(1)}%`,
        description: "Trung bình theo daily_kpi_snapshots.",
        icon: Factory,
        tone: "bg-emerald-50 text-emerald-700"
      }
    ] as const;
  }, [rows]);

  const statusChartData = useMemo(() => {
    const counter = new Map<string, number>();
    rows.pourRequests.forEach((item) => {
      const key = normalizeStatus(item.status);
      counter.set(key, (counter.get(key) ?? 0) + 1);
    });

    return Array.from(counter.entries())
      .map(([status, count]) => ({ status, label: statusLabel(status), count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8);
  }, [rows.pourRequests]);

  const statusMax = Math.max(1, ...statusChartData.map((item) => item.count));

  const volumeSeries = useMemo(() => {
    return [...rows.pourRequests]
      .sort((left, right) => toSortDate(right) - toSortDate(left))
      .slice(0, 8)
      .map((item) => ({
        label: String(item.request_no ?? item.id ?? "-"),
        value: toNumber(item.requested_volume_m3)
      }))
      .reverse();
  }, [rows.pourRequests]);

  const volumeMax = Math.max(1, ...volumeSeries.map((item) => item.value));

  return (
    <div className="space-y-6">
      <section className="ta-card overflow-hidden">
        <div className="bg-gradient-to-r from-brand-500 to-brand-700 p-6 text-white">
          <p className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/90">
            <Activity className="h-3.5 w-3.5" />
            Tổng quan vận hành
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{t("app.welcome")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-blue-100">
            {user
              ? `Xin chào ${user.full_name}. Nền tảng đang sẵn sàng cho Kinh doanh, Điều phối, vận hành hiện trường và KPI.`
              : "Bạn chưa đăng nhập. Vui lòng vào /dang-nhap để bắt đầu phiên làm việc."}
          </p>
        </div>
      </section>

      {statsError ? <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{statsError}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="ta-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">{item.title}</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{loadingStats ? "..." : item.value}</p>
                </div>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">{item.description}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="ta-card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Phân bố trạng thái yêu cầu đổ</h2>
          {statusChartData.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có dữ liệu yêu cầu đổ để trực quan hóa.</p>
          ) : (
            <div className="space-y-2">
              {statusChartData.map((item) => {
                const widthPercent = Math.max(8, Math.round((item.count / statusMax) * 100));
                return (
                  <div key={item.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span>{item.count}</span>
                    </div>
                    <div className="h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-brand-500" style={{ width: `${widthPercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="ta-card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Khối lượng 8 yêu cầu gần nhất</h2>
          {volumeSeries.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có dữ liệu khối lượng để hiển thị biểu đồ.</p>
          ) : (
            <div className="grid grid-cols-8 items-end gap-2">
              {volumeSeries.map((item) => {
                const heightPercent = Math.max(10, Math.round((item.value / volumeMax) * 100));
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex h-32 items-end rounded-md bg-slate-50 px-1 pb-1">
                      <div className="w-full rounded bg-violet-500" style={{ height: `${heightPercent}%` }} />
                    </div>
                    <p className="truncate text-center text-[11px] font-medium text-slate-600" title={item.label}>
                      {item.label}
                    </p>
                    <p className="text-center text-[11px] text-slate-500">{item.value.toFixed(1)} m³</p>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
