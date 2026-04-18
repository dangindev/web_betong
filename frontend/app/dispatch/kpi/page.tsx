"use client";

import { useEffect, useMemo, useState } from "react";

import { apiDispatchReportUrl, apiListResource, apiPostKpiSnapshot } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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
      setError(e instanceof Error ? e.message : "Không tải được KPI snapshots.");
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
      setError("Thiếu access token hoặc organization_id.");
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
      setMessage("Đã tạo KPI snapshot.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo KPI snapshot thất bại.");
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để dùng KPI dashboard.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">KPI Dashboard (Ops Manager)</h2>
        <p className="text-sm text-slate-600">Theo dõi on-time, cycle time, utilization, trips/day, volume, và xuất báo cáo.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="organization_id"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          type="date"
          value={snapshotDate}
          onChange={(event) => setSnapshotDate(event.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="plant_id (optional)"
          value={plantId}
          onChange={(event) => setPlantId(event.target.value)}
        />
        <button className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500" onClick={() => void handleGenerateSnapshot()}>
          Generate snapshot
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <button className="rounded bg-slate-200 px-3 py-2 hover:bg-slate-300" onClick={() => void load()}>
          Refresh
        </button>
        {organizationId ? (
          <>
            <a
              className="rounded border border-slate-300 px-3 py-2 hover:bg-slate-50"
              href={apiDispatchReportUrl(organizationId, "csv")}
              target="_blank"
              rel="noreferrer"
            >
              Export operations CSV
            </a>
            <a
              className="rounded border border-slate-300 px-3 py-2 hover:bg-slate-50"
              href={apiDispatchReportUrl(organizationId, "pdf")}
              target="_blank"
              rel="noreferrer"
            >
              Export operations PDF
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
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Plant</th>
              <th className="px-3 py-2">On-time %</th>
              <th className="px-3 py-2">Avg cycle</th>
              <th className="px-3 py-2">Vehicle util %</th>
              <th className="px-3 py-2">Pump util %</th>
              <th className="px-3 py-2">Trips</th>
              <th className="px-3 py-2">Volume (m3)</th>
              <th className="px-3 py-2">Empty km</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={String(row.id)} className="border-t border-slate-100">
                <td className="px-3 py-2">{String(row.snapshot_date ?? "-")}</td>
                <td className="px-3 py-2">{String(row.plant_id ?? "-")}</td>
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
                  Chưa có KPI snapshot.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
