"use client";

import { useEffect, useMemo, useState } from "react";

import {
  apiCompareSchedulerKpis,
  apiCreateScheduleRun,
  apiDispatchRealtimeUrl,
  apiGetScheduleRunConflicts,
  apiListResource,
  apiOverrideScheduledTrip
} from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

type RealtimeSnapshot = {
  timestamp: string;
  pending_dispatch_orders: number;
  active_trips: number;
};

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function formatMetric(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return String(Math.round(value * 1000) / 1000);
  }
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value);
}

export default function DispatchBoardPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [schedulerMode, setSchedulerMode] = useState<"v1" | "v2">("v1");
  const [runs, setRuns] = useState<GenericRow[]>([]);
  const [trips, setTrips] = useState<GenericRow[]>([]);
  const [conflicts, setConflicts] = useState<GenericRow[]>([]);
  const [overrideVehicle, setOverrideVehicle] = useState<Record<string, string>>({});
  const [overridePump, setOverridePump] = useState<Record<string, string>>({});
  const [live, setLive] = useState<RealtimeSnapshot | null>(null);
  const [kpiCompare, setKpiCompare] = useState<GenericRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadResources() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [runRes, tripRes] = await Promise.all([
        apiListResource<GenericRow>("schedule_runs", accessToken, { skip: 0, limit: 200 }),
        apiListResource<GenericRow>("scheduled_trips", accessToken, { skip: 0, limit: 1000 })
      ]);
      setRuns(runRes.items);
      setTrips(tripRes.items);
      if (!organizationId) {
        const firstOrg = String(runRes.items[0]?.organization_id ?? tripRes.items[0]?.organization_id ?? "");
        if (firstOrg) setOrganizationId(firstOrg);
      }
      if (!selectedRunId && runRes.items[0]?.id) {
        setSelectedRunId(String(runRes.items[0].id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được bảng điều phối.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadResources();
  }, [accessToken]);

  async function loadRealtime() {
    if (!accessToken || !organizationId) return;
    try {
      const response = await fetch(apiDispatchRealtimeUrl(organizationId), {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!response.ok) return;
      const text = await response.text();
      const dataLine = text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("data:"));
      if (!dataLine) return;
      const payloadText = dataLine.replace(/^data:\s*/, "");
      const payload = JSON.parse(payloadText) as RealtimeSnapshot;
      setLive(payload);
    } catch {
      // Bỏ qua lỗi realtime polling để không chặn thao tác điều phối
    }
  }

  useEffect(() => {
    void loadRealtime();
    const timer = window.setInterval(() => {
      void loadRealtime();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [accessToken, organizationId]);

  const filteredTrips = useMemo(() => {
    if (!selectedRunId) return trips;
    return trips.filter((item) => String(item.schedule_run_id ?? "") === selectedRunId);
  }, [trips, selectedRunId]);

  const compareDeltaEntries = useMemo(() => {
    const comparePayload = asRecord(kpiCompare);
    const delta = comparePayload ? asRecord(comparePayload.delta) : null;
    if (!delta) return [] as Array<[string, unknown]>;
    return Object.entries(delta);
  }, [kpiCompare]);

  const compareRunLabels = useMemo(() => {
    const comparePayload = asRecord(kpiCompare);
    const runV1 = comparePayload ? asRecord(comparePayload.run_v1) : null;
    const runV2 = comparePayload ? asRecord(comparePayload.run_v2) : null;
    return {
      v1: toShortId(runV1?.run_id),
      v2: toShortId(runV2?.run_id)
    };
  }, [kpiCompare]);

  async function handleRunScheduler() {
    if (!accessToken || !organizationId) {
      setError("Thiếu phiên đăng nhập hoặc mã tổ chức (organization_id).");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const result = await apiCreateScheduleRun(
        {
          organization_id: organizationId,
          scheduler_mode: schedulerMode
        },
        accessToken
      );
      const run = result.schedule_run as Record<string, unknown> | undefined;
      if (run?.id) {
        setSelectedRunId(String(run.id));
        setMessage(`Đã chạy scheduler ${schedulerMode.toUpperCase()}: ${toShortId(run.id)}`);
      } else {
        setMessage(`Đã chạy scheduler ${schedulerMode.toUpperCase()}.`);
      }
      await loadResources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chạy bộ lập lịch thất bại.");
    }
  }

  async function handleLoadConflicts() {
    if (!accessToken || !selectedRunId) return;
    setError(null);
    try {
      const response = await apiGetScheduleRunConflicts(selectedRunId, accessToken);
      const items = (response.items as GenericRow[]) ?? [];
      setConflicts(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách xung đột.");
    }
  }

  async function handleCompareKpis() {
    if (!accessToken || !organizationId) return;
    setError(null);
    try {
      const payload = await apiCompareSchedulerKpis(organizationId, accessToken);
      setKpiCompare(payload);
      setMessage("Đã tải so sánh KPI giữa scheduler v1 và v2.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu so sánh KPI.");
    }
  }

  async function handleOverride(scheduledTripId: string) {
    if (!accessToken) return;
    setError(null);
    try {
      await apiOverrideScheduledTrip(
        scheduledTripId,
        {
          override_type: "manual_reassign",
          override_payload: {
            assigned_vehicle_id: overrideVehicle[scheduledTripId] || undefined,
            assigned_pump_id: overridePump[scheduledTripId] || undefined,
            is_locked: true,
            lock_reason: "Điều chỉnh thủ công từ bảng điều phối"
          },
          note: "Điều chỉnh thủ công từ bảng điều phối"
        },
        accessToken
      );
      setMessage(`Đã ghi đè chuyến ${toShortId(scheduledTripId)}.`);
      await loadResources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ghi đè thủ công thất bại.");
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để dùng bảng điều phối.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Bảng điều phối (Gantt MVP)</h2>
        <p className="text-sm text-slate-600">
          Chạy scheduler v1/v2, theo dõi xung đột, ghi đè thủ công và so sánh KPI giữa hai phiên bản lập lịch.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="ta-input"
          placeholder="Mã tổ chức (organization_id)"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <select
          className="ta-input"
          value={selectedRunId}
          onChange={(event) => setSelectedRunId(event.target.value)}
        >
          <option value="">Tất cả lần chạy</option>
          {runs.map((run) => (
            <option key={String(run.id)} value={String(run.id)}>
              {String(run.run_code ?? run.id)}
            </option>
          ))}
        </select>
        <select
          className="ta-input"
          value={schedulerMode}
          onChange={(event) => setSchedulerMode(event.target.value as "v1" | "v2")}
        >
          <option value="v1">Scheduler v1</option>
          <option value="v2">Scheduler v2</option>
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <button className="ta-button" onClick={() => void handleRunScheduler()}>
            Chạy bộ lập lịch
          </button>
          <button className="ta-button" onClick={() => void handleLoadConflicts()}>
            Xem xung đột
          </button>
          <button className="ta-button-secondary" onClick={() => void handleCompareKpis()}>
            So sánh KPI
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button className="ta-button h-8 px-3 text-xs" onClick={() => void loadResources()}>
          {loading ? "Đang tải..." : "Làm mới bảng"}
        </button>
        {live ? (
          <span className="text-slate-600">
            Thời gian thực: lệnh chờ {live.pending_dispatch_orders} · chuyến đang chạy {live.active_trips}
          </span>
        ) : null}
        {message ? <span className="text-emerald-700">{message}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>

      {kpiCompare ? (
        <div className="rounded border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold">So sánh KPI scheduler</h3>
          <p className="mt-1 text-xs text-slate-500">
            Run v1: {compareRunLabels.v1} · Run v2: {compareRunLabels.v2}
          </p>
          {compareDeltaEntries.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Không có KPI để so sánh.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">KPI</th>
                    <th className="px-3 py-2">Delta (v2 - v1)</th>
                  </tr>
                </thead>
                <tbody>
                  {compareDeltaEntries.map(([key, value]) => {
                    const deltaValue = typeof value === "number" ? value : null;
                    const deltaClass =
                      deltaValue === null
                        ? "text-slate-500"
                        : deltaValue < 0
                          ? "text-emerald-700"
                          : deltaValue > 0
                            ? "text-rose-700"
                            : "text-slate-600";
                    return (
                      <tr key={key} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{key}</td>
                        <td className={`px-3 py-2 ${deltaClass}`}>{formatMetric(value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Chuyến</th>
              <th className="px-3 py-2">Lệnh điều phối</th>
              <th className="px-3 py-2">Tài nguyên</th>
              <th className="px-3 py-2">Thời gian kế hoạch</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Ghi đè thủ công</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrips.map((trip) => {
              const tripId = String(trip.id ?? "");
              return (
                <tr key={tripId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">#{String(trip.trip_no ?? "-")}</div>
                    <div className="text-xs text-slate-500">{toShortId(tripId)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{toShortId(trip.dispatch_order_id)}</div>
                    <div className="text-xs text-slate-500">lần chạy {toShortId(trip.schedule_run_id)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>xe: {toShortId(trip.assigned_vehicle_id)}</div>
                    <div>cần bơm: {toShortId(trip.assigned_pump_id)}</div>
                    <div>trạm: {toShortId(trip.assigned_plant_id)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>nạp: {String(trip.planned_load_start_at ?? "-")} → {String(trip.planned_load_end_at ?? "-")}</div>
                    <div>đổ: {String(trip.planned_pour_start_at ?? "-")} → {String(trip.planned_pour_end_at ?? "-")}</div>
                    <div>về trạm: {String(trip.planned_return_at ?? "-")}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{String(trip.status ?? "-")}</div>
                    <div className="text-xs text-slate-500">khóa: {String(trip.is_locked ?? false)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      <input
                        className="ta-input h-8 w-full text-xs"
                        placeholder="Mã xe mới (vehicle_id)"
                        value={overrideVehicle[tripId] ?? ""}
                        onChange={(event) => setOverrideVehicle((prev) => ({ ...prev, [tripId]: event.target.value }))}
                      />
                      <input
                        className="ta-input h-8 w-full text-xs"
                        placeholder="Mã bơm mới (pump_id)"
                        value={overridePump[tripId] ?? ""}
                        onChange={(event) => setOverridePump((prev) => ({ ...prev, [tripId]: event.target.value }))}
                      />
                      <button
                        className="ta-button-secondary h-8 px-3 text-xs"
                        onClick={() => void handleOverride(tripId)}
                      >
                        Ghi đè và khóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredTrips.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Chưa có chuyến được lập lịch. Hãy chạy bộ lập lịch.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold">Xung đột lập lịch</h3>
        {conflicts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa có xung đột hoặc bạn chưa tải danh sách.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {conflicts.map((item) => (
              <li key={String(item.id)} className="rounded border border-amber-200 bg-amber-50 px-2 py-1">
                <div className="font-medium">{String(item.conflict_type ?? "conflict")}</div>
                <div>{String(item.message ?? "-")}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
