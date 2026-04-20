"use client";

import { useEffect, useMemo, useState } from "react";

import { apiDispatchReportUrl, apiListResource, apiPostKpiSnapshot } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

export default function DispatchKpiPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(todayIsoDate());
  const [plantId, setPlantId] = useState("");
  const [rows, setRows] = useState<GenericRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setError(null);
    try {
      const response = await apiListResource<GenericRow>("daily_kpi_snapshots", accessToken, { skip: 0, limit: 500 });
      setRows(response.items);
      if (!organizationId) {
        const firstOrg = String(response.items[0]?.organization_id ?? "");
        if (firstOrg) setOrganizationId(firstOrg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được ảnh chụp KPI.");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (organizationId && String(row.organization_id ?? "") !== organizationId) return false;
      if (plantId && String(row.plant_id ?? "") !== plantId) return false;
      return true;
    });
  }, [rows, organizationId, plantId]);

  async function handleGenerateSnapshot() {
    if (!accessToken || !organizationId) {
      setError("Thiếu phiên đăng nhập hoặc mã tổ chức (organization_id).");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await apiPostKpiSnapshot(
        {
          organization_id: organizationId,
          snapshot_date: snapshotDate || undefined,
          plant_id: plantId || undefined
        },
        accessToken
      );
      setMessage("Đã tạo ảnh chụp KPI.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo ảnh chụp KPI thất bại.");
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để dùng bảng KPI.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Bảng KPI vận hành</h2>
        <p className="text-sm text-slate-600">Theo dõi đúng giờ, vòng quay, mức sử dụng tài nguyên, số chuyến/ngày, sản lượng và xuất báo cáo.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="ta-input"
          placeholder="Mã tổ chức (organization_id)"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <input
          className="ta-input"
          type="date"
          value={snapshotDate}
          onChange={(event) => setSnapshotDate(event.target.value)}
        />
        <input
          className="ta-input"
          placeholder="Mã trạm (plant_id, tuỳ chọn)"
          value={plantId}
          onChange={(event) => setPlantId(event.target.value)}
        />
        <button className="ta-button-primary" onClick={() => void handleGenerateSnapshot()}>
          Tạo ảnh chụp
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <button className="ta-button" onClick={() => void load()}>
          Làm mới
        </button>
        {organizationId ? (
          <>
            <a
              className="rounded border border-slate-300 px-3 py-2 hover:bg-slate-50"
              href={apiDispatchReportUrl(organizationId, "csv")}
              target="_blank"
              rel="noreferrer"
            >
              Xuất báo cáo CSV
            </a>
            <a
              className="rounded border border-slate-300 px-3 py-2 hover:bg-slate-50"
              href={apiDispatchReportUrl(organizationId, "pdf")}
              target="_blank"
              rel="noreferrer"
            >
              Xuất báo cáo PDF
            </a>
          </>
        ) : null}
      </div>

      <div className="text-sm">
        {message ? <span className="text-emerald-700">{message}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Trạm</th>
              <th className="px-3 py-2">Đúng giờ %</th>
              <th className="px-3 py-2">Vòng quay TB</th>
              <th className="px-3 py-2">Hiệu suất xe %</th>
              <th className="px-3 py-2">Hiệu suất bơm %</th>
              <th className="px-3 py-2">Số chuyến</th>
              <th className="px-3 py-2">Sản lượng (m3)</th>
              <th className="px-3 py-2">Km rỗng</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={String(row.id)} className="border-t border-slate-100">
                <td className="px-3 py-2">{String(row.snapshot_date ?? "-")}</td>
                <td className="px-3 py-2">{toShortId(row.plant_id)}</td>
                <td className="px-3 py-2">{String(row.on_time_pct ?? "-")}</td>
                <td className="px-3 py-2">{String(row.avg_cycle_minutes ?? "-")}</td>
                <td className="px-3 py-2">{String(row.vehicle_utilization_pct ?? "-")}</td>
                <td className="px-3 py-2">{String(row.pump_utilization_pct ?? "-")}</td>
                <td className="px-3 py-2">{String(row.trips_count ?? "-")}</td>
                <td className="px-3 py-2">{String(row.volume_m3 ?? "-")}</td>
                <td className="px-3 py-2">{String(row.empty_km ?? "-")}</td>
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Chưa có ảnh chụp KPI.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
