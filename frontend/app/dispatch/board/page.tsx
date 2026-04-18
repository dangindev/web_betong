"use client";

import { useEffect, useMemo, useState } from "react";

import {
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

export default function DispatchBoardPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runs, setRuns] = useState<GenericRow[]>([]);
  const [trips, setTrips] = useState<GenericRow[]>([]);
  const [conflicts, setConflicts] = useState<GenericRow[]>([]);
  const [overrideVehicle, setOverrideVehicle] = useState<Record<string, string>>({});
  const [overridePump, setOverridePump] = useState<Record<string, string>>({});
  const [live, setLive] = useState<RealtimeSnapshot | null>(null);
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
      setError(e instanceof Error ? e.message : "Không tải được dispatch board.");
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
      // ignore realtime poll errors to avoid interrupting board usage
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

  async function handleRunScheduler() {
    if (!accessToken || !organizationId) {
      setError("Thiếu access token hoặc organization_id.");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const result = await apiCreateScheduleRun({ organization_id: organizationId }, accessToken);
      const run = result.schedule_run as Record<string, unknown> | undefined;
      if (run?.id) {
        setSelectedRunId(String(run.id));
        setMessage(`Đã chạy scheduler: ${String(run.id)}`);
      } else {
        setMessage("Đã chạy scheduler.");
      }
      await loadResources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chạy scheduler thất bại.");
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
      setError(e instanceof Error ? e.message : "Không tải được conflicts.");
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
            lock_reason: "manual override from dispatch board"
          },
          note: "Manual override from dispatch board"
        },
        accessToken
      );
      setMessage(`Đã override trip ${scheduledTripId}.`);
      await loadResources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Manual override thất bại.");
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để dùng dispatch board.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Dispatch Board (Gantt MVP)</h2>
        <p className="text-sm text-slate-600">Scheduler v1, conflict list, manual override, và live snapshot qua SSE polling.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="organization_id"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={selectedRunId}
          onChange={(event) => setSelectedRunId(event.target.value)}
        >
          <option value="">All runs</option>
          {runs.map((run) => (
            <option key={String(run.id)} value={String(run.id)}>
              {String(run.run_code ?? run.id)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={() => void handleRunScheduler()}>
            Run scheduler
          </button>
          <button className="rounded bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300" onClick={() => void handleLoadConflicts()}>
            View conflicts
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button className="rounded bg-slate-200 px-3 py-1.5 hover:bg-slate-300" onClick={() => void loadResources()}>
          {loading ? "Loading..." : "Refresh board"}
        </button>
        {live ? (
          <span className="text-slate-600">
            Live: pending orders {live.pending_dispatch_orders} · active trips {live.active_trips}
          </span>
        ) : null}
        {message ? <span className="text-emerald-700">{message}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Trip</th>
              <th className="px-3 py-2">Dispatch</th>
              <th className="px-3 py-2">Resource</th>
              <th className="px-3 py-2">Planned timeline</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Manual override</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrips.map((trip) => {
              const tripId = String(trip.id ?? "");
              return (
                <tr key={tripId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">#{String(trip.trip_no ?? "-")}</div>
                    <div className="text-xs text-slate-500">{tripId}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{String(trip.dispatch_order_id ?? "-")}</div>
                    <div className="text-xs text-slate-500">run {String(trip.schedule_run_id ?? "-")}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>vehicle {String(trip.assigned_vehicle_id ?? "-")}</div>
                    <div>pump {String(trip.assigned_pump_id ?? "-")}</div>
                    <div>plant {String(trip.assigned_plant_id ?? "-")}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>load {String(trip.planned_load_start_at ?? "-")} → {String(trip.planned_load_end_at ?? "-")}</div>
                    <div>pour {String(trip.planned_pour_start_at ?? "-")} → {String(trip.planned_pour_end_at ?? "-")}</div>
                    <div>return {String(trip.planned_return_at ?? "-")}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{String(trip.status ?? "-")}</div>
                    <div className="text-xs text-slate-500">lock {String(trip.is_locked ?? false)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        placeholder="new vehicle_id"
                        value={overrideVehicle[tripId] ?? ""}
                        onChange={(event) => setOverrideVehicle((prev) => ({ ...prev, [tripId]: event.target.value }))}
                      />
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        placeholder="new pump_id"
                        value={overridePump[tripId] ?? ""}
                        onChange={(event) => setOverridePump((prev) => ({ ...prev, [tripId]: event.target.value }))}
                      />
                      <button
                        className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500"
                        onClick={() => void handleOverride(tripId)}
                      >
                        Override + lock
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredTrips.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Chưa có scheduled trip. Hãy chạy scheduler.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold">Conflicts</h3>
        {conflicts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa có conflict hoặc chưa load.</p>
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
