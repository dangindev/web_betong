"use client";

import { useEffect, useMemo, useState } from "react";

import { apiDispatchApproval, apiListResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function entityLabel(entity: GenericRow | undefined, id: unknown, nameKey: "name" | "site_name" = "name"): string {
  const idText = String(id ?? "").trim();
  if (!idText) return "-";
  const code = String(entity?.code ?? "").trim();
  const name = String(entity?.[nameKey] ?? entity?.name ?? "").trim();
  if (code && name) return `${code} - ${name}`;
  if (name) return name;
  if (code) return code;
  return toShortId(idText);
}

export default function DispatchInboxPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [assignedPumpId, setAssignedPumpId] = useState("");
  const [targetRhythm, setTargetRhythm] = useState("30");

  const [rows, setRows] = useState<GenericRow[]>([]);
  const [dispatchOrders, setDispatchOrders] = useState<GenericRow[]>([]);
  const [customers, setCustomers] = useState<GenericRow[]>([]);
  const [sites, setSites] = useState<GenericRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [pourResponse, orderResponse, customerResponse, siteResponse] = await Promise.all([
        apiListResource<GenericRow>("pour_requests", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("dispatch_orders", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("customers", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("project_sites", accessToken, { skip: 0, limit: 500 })
      ]);
      setRows(pourResponse.items);
      setDispatchOrders(orderResponse.items);
      setCustomers(customerResponse.items);
      setSites(siteResponse.items);

      if (!organizationId) {
        const firstOrg = String(
          pourResponse.items[0]?.organization_id ??
            orderResponse.items[0]?.organization_id ??
            customerResponse.items[0]?.organization_id ??
            ""
        );
        if (firstOrg) setOrganizationId(firstOrg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được hộp chờ điều phối.");
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
    sites.forEach((item) => {
      const id = String(item.id ?? "");
      if (id) map.set(id, item);
    });
    return map;
  }, [sites]);

  async function handleDecision(pourRequestId: string, action: "approve" | "reject" | "request-more-info") {
    if (!accessToken) {
      setError("Bạn cần đăng nhập để thao tác.");
      return;
    }
    if (!organizationId) {
      setError("Thiếu mã tổ chức (organization_id).");
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
          note: `Thao tác từ hộp chờ điều phối: ${action === "approve" ? "duyệt" : action === "reject" ? "từ chối" : "yêu cầu bổ sung"}`
        },
        accessToken
      );
      setMessage(`Đã ${action === "approve" ? "duyệt" : action === "reject" ? "từ chối" : "gửi yêu cầu bổ sung"} yêu cầu ${toShortId(pourRequestId)}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xử lý duyệt đơn thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để sử dụng hộp chờ điều phối.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Hộp chờ điều phối</h2>
        <p className="text-sm text-slate-600">Duyệt yêu cầu đổ, gán trạm/cần bơm và tạo lệnh điều phối cho bộ lập lịch.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Mã tổ chức (organization_id)"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Mã trạm gán (assigned_plant_id)"
          value={assignedPlantId}
          onChange={(event) => setAssignedPlantId(event.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Mã bơm gán (assigned_pump_id)"
          value={assignedPumpId}
          onChange={(event) => setAssignedPumpId(event.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nhịp xe mục tiêu (phút)"
          value={targetRhythm}
          onChange={(event) => setTargetRhythm(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={() => void load()}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
        {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
        {error ? <span className="text-sm text-rose-700">{error}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Yêu cầu</th>
              <th className="px-3 py-2">Khách hàng / công trình</th>
              <th className="px-3 py-2">Khối lượng</th>
              <th className="px-3 py-2">Khung giờ yêu cầu</th>
              <th className="px-3 py-2">Trạng thái điều phối</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pourRequestId = String(row.id ?? "");
              const order = orderByPourRequest.get(pourRequestId);
              const rowBusy = busyId === pourRequestId;
              const customerLabel = entityLabel(customerById.get(String(row.customer_id ?? "")), row.customer_id, "name");
              const siteLabel = entityLabel(siteById.get(String(row.site_id ?? "")), row.site_id, "site_name");

              return (
                <tr key={pourRequestId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{String(row.request_no ?? toShortId(pourRequestId))}</div>
                    <div className="text-xs text-slate-500">{toShortId(pourRequestId)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{customerLabel}</div>
                    <div className="text-xs text-slate-500">{siteLabel}</div>
                  </td>
                  <td className="px-3 py-2">{String(row.requested_volume_m3 ?? "-")} m³</td>
                  <td className="px-3 py-2">
                    <div>{String(row.requested_start_at ?? row.requested_date ?? "-")}</div>
                    <div className="text-xs text-slate-500">→ {String(row.requested_end_at ?? "-")}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{String(order?.approval_status ?? row.status ?? "pending")}</div>
                    <div className="text-xs text-slate-500">lệnh: {order?.id ? toShortId(order.id) : "(chưa tạo)"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={rowBusy}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                        onClick={() => void handleDecision(pourRequestId, "approve")}
                      >
                        Duyệt
                      </button>
                      <button
                        disabled={rowBusy}
                        className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-500 disabled:opacity-60"
                        onClick={() => void handleDecision(pourRequestId, "request-more-info")}
                      >
                        Yêu cầu bổ sung
                      </button>
                      <button
                        disabled={rowBusy}
                        className="rounded bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-500 disabled:opacity-60"
                        onClick={() => void handleDecision(pourRequestId, "reject")}
                      >
                        Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Chưa có yêu cầu đổ nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
