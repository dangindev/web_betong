"use client";

import { useEffect, useMemo, useState } from "react";

import { apiDispatchApproval, apiListResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

export default function DispatchInboxPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [assignedPumpId, setAssignedPumpId] = useState("");
  const [targetRhythm, setTargetRhythm] = useState("30");
  const [rows, setRows] = useState<GenericRow[]>([]);
  const [dispatchOrders, setDispatchOrders] = useState<GenericRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [pourResponse, orderResponse] = await Promise.all([
        apiListResource<GenericRow>("pour_requests", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("dispatch_orders", accessToken, { skip: 0, limit: 500 })
      ]);
      setRows(pourResponse.items);
      setDispatchOrders(orderResponse.items);

      if (!organizationId) {
        const firstOrg = String(pourResponse.items[0]?.organization_id ?? orderResponse.items[0]?.organization_id ?? "");
        if (firstOrg) setOrganizationId(firstOrg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dispatcher inbox.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  const orderByPourRequest = useMemo(() => {
    const mapping = new Map<string, GenericRow>();
    dispatchOrders.forEach((item) => {
      const key = String(item.pour_request_id ?? "");
      if (key) mapping.set(key, item);
    });
    return mapping;
  }, [dispatchOrders]);

  async function handleDecision(pourRequestId: string, action: "approve" | "reject" | "request-more-info") {
    if (!accessToken) {
      setError("Bạn cần đăng nhập để thao tác.");
      return;
    }
    if (!organizationId) {
      setError("Thiếu organization_id.");
      return;
    }

    setBusyId(pourRequestId);
    setError(null);
    setMessage(null);
    try {
      await apiDispatchApproval(
        pourRequestId,
        {
          organization_id: organizationId,
          action,
          assigned_plant_id: assignedPlantId || undefined,
          assigned_pump_id: assignedPumpId || undefined,
          target_truck_rhythm_minutes: Number(targetRhythm || "30"),
          note: `Action từ dispatcher inbox: ${action}`
        },
        accessToken
      );
      setMessage(`Đã xử lý ${action} cho pour request ${pourRequestId}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xử lý duyệt đơn thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để sử dụng dispatch inbox.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Dispatcher Inbox</h2>
        <p className="text-sm text-slate-600">Duyệt pour request, gán plant/pump, và tạo dispatch order cho scheduler.</p>
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
          placeholder="assigned_plant_id"
          value={assignedPlantId}
          onChange={(event) => setAssignedPlantId(event.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="assigned_pump_id"
          value={assignedPumpId}
          onChange={(event) => setAssignedPumpId(event.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="target truck rhythm"
          value={targetRhythm}
          onChange={(event) => setTargetRhythm(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={() => void load()}>
          {loading ? "Loading..." : "Refresh"}
        </button>
        {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
        {error ? <span className="text-sm text-rose-700">{error}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Request</th>
              <th className="px-3 py-2">Customer/Site</th>
              <th className="px-3 py-2">Volume</th>
              <th className="px-3 py-2">Requested Window</th>
              <th className="px-3 py-2">Dispatch Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pourRequestId = String(row.id ?? "");
              const order = orderByPourRequest.get(pourRequestId);
              const rowBusy = busyId === pourRequestId;
              return (
                <tr key={pourRequestId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{String(row.request_no ?? pourRequestId)}</div>
                    <div className="text-xs text-slate-500">{pourRequestId}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{String(row.customer_id ?? "-")}</div>
                    <div className="text-xs text-slate-500">site {String(row.site_id ?? "-")}</div>
                  </td>
                  <td className="px-3 py-2">{String(row.requested_volume_m3 ?? "-")}</td>
                  <td className="px-3 py-2">
                    <div>{String(row.requested_start_at ?? row.requested_date ?? "-")}</div>
                    <div className="text-xs text-slate-500">→ {String(row.requested_end_at ?? "-")}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{String(order?.approval_status ?? row.status ?? "pending")}</div>
                    <div className="text-xs text-slate-500">dispatch {String(order?.id ?? "(chưa tạo)")}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={rowBusy}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                        onClick={() => void handleDecision(pourRequestId, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        disabled={rowBusy}
                        className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-500 disabled:opacity-60"
                        onClick={() => void handleDecision(pourRequestId, "request-more-info")}
                      >
                        Request info
                      </button>
                      <button
                        disabled={rowBusy}
                        className="rounded bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-500 disabled:opacity-60"
                        onClick={() => void handleDecision(pourRequestId, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Chưa có pour request nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
