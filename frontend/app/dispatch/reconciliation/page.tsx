"use client";

import { useEffect, useMemo, useState } from "react";

import { apiListResource, apiPostReconciliation } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

const REASON_OPTIONS = [
  { value: "normal", label: "Bình thường" },
  { value: "traffic", label: "Kẹt xe" },
  { value: "weather", label: "Thời tiết" },
  { value: "technical", label: "Sự cố kỹ thuật" },
  { value: "customer", label: "Yêu cầu phía công trình" }
] as const;

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function formatDateTime(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", { hour12: false });
}

export default function DispatchReconciliationPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [pourRequestId, setPourRequestId] = useState("");
  const [actualVolume, setActualVolume] = useState("");
  const [actualTrips, setActualTrips] = useState("");
  const [reasonCode, setReasonCode] = useState("normal");
  const [note, setNote] = useState("");
  const [pourRequests, setPourRequests] = useState<GenericRow[]>([]);
  const [sites, setSites] = useState<GenericRow[]>([]);
  const [records, setRecords] = useState<GenericRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const siteNameById = useMemo(() => {
    const mapping = new Map<string, string>();
    sites.forEach((site) => {
      const siteId = String(site.id ?? "").trim();
      if (!siteId) return;
      const siteName = String(site.site_name ?? site.name ?? site.code ?? "").trim();
      if (siteName) {
        mapping.set(siteId, siteName);
      }
    });
    return mapping;
  }, [sites]);

  const pourRequestById = useMemo(() => {
    const mapping = new Map<string, GenericRow>();
    pourRequests.forEach((request) => {
      const requestId = String(request.id ?? "").trim();
      if (!requestId) return;
      mapping.set(requestId, request);
    });
    return mapping;
  }, [pourRequests]);

  function formatPourRequestLabel(requestId: unknown): string {
    const id = String(requestId ?? "").trim();
    if (!id) return "-";

    const request = pourRequestById.get(id);
    if (!request) return toShortId(id);

    const requestNo = String(request.request_no ?? "").trim() || toShortId(id);
    const siteId = String(request.site_id ?? "").trim();
    const siteName = siteNameById.get(siteId);

    return siteName ? `${requestNo} • ${siteName}` : requestNo;
  }

  async function load() {
    if (!accessToken) return;
    setError(null);
    try {
      const [pourRes, recRes, siteRes] = await Promise.all([
        apiListResource<GenericRow>("pour_requests", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("reconciliation_records", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("project_sites", accessToken, { skip: 0, limit: 500 })
      ]);
      setPourRequests(pourRes.items);
      setRecords(recRes.items);
      setSites(siteRes.items);
      if (!organizationId) {
        const firstOrg = String(pourRes.items[0]?.organization_id ?? recRes.items[0]?.organization_id ?? "");
        if (firstOrg) setOrganizationId(firstOrg);
      }
      if (!pourRequestId && pourRes.items[0]?.id) {
        setPourRequestId(String(pourRes.items[0].id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu đối soát.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function handleReconcile() {
    if (!accessToken || !organizationId || !pourRequestId) {
      setError("Thiếu thông tin đăng nhập, tổ chức hoặc yêu cầu đổ.");
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await apiPostReconciliation(
        pourRequestId,
        {
          organization_id: organizationId,
          actual_volume_m3: actualVolume ? Number(actualVolume) : undefined,
          actual_trip_count: actualTrips ? Number(actualTrips) : undefined,
          reason_code: reasonCode || undefined,
          note: note || undefined
        },
        accessToken
      );
      setMessage(`Đã chốt đối soát cho ${formatPourRequestLabel(pourRequestId)}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chốt đối soát thất bại.");
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để dùng màn hình đối soát.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Màn hình đối soát</h2>
        <p className="text-sm text-slate-600">Chốt khối lượng/chuyến thực tế và nguyên nhân chênh lệch cuối ca.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <input
          className="ta-input"
          placeholder="Mã tổ chức"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <select
          className="ta-input"
          value={pourRequestId}
          onChange={(event) => setPourRequestId(event.target.value)}
        >
          <option value="">Chọn yêu cầu đổ</option>
          {pourRequests.map((item) => {
            const itemId = String(item.id ?? "");
            return (
              <option key={itemId} value={itemId}>
                {formatPourRequestLabel(itemId)}
              </option>
            );
          })}
        </select>
        <button className="ta-button" onClick={() => void load()}>
          Làm mới
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="ta-input"
          type="number"
          min="0"
          step="0.1"
          placeholder="Khối lượng thực tế (m³)"
          value={actualVolume}
          onChange={(event) => setActualVolume(event.target.value)}
        />
        <input
          className="ta-input"
          type="number"
          min="0"
          step="1"
          placeholder="Số chuyến thực tế"
          value={actualTrips}
          onChange={(event) => setActualTrips(event.target.value)}
        />
        <select className="ta-input" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
          {REASON_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          className="ta-input"
          placeholder="Ghi chú đối soát"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <button className="ta-button-primary" onClick={() => void handleReconcile()}>
        Chốt đối soát
      </button>

      <div className="text-sm">
        {message ? <span className="text-emerald-700">{message}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Yêu cầu đổ</th>
              <th className="px-3 py-2">Kế hoạch</th>
              <th className="px-3 py-2">Thực tế</th>
              <th className="px-3 py-2">Chênh lệch</th>
              <th className="px-3 py-2">Lý do</th>
              <th className="px-3 py-2">Thời điểm chốt</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row) => {
              const requestId = String(row.pour_request_id ?? "");
              return (
                <tr key={String(row.id)} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{formatPourRequestLabel(requestId)}</div>
                    <div className="text-xs text-slate-500">ID: {toShortId(requestId)}</div>
                  </td>
                  <td className="px-3 py-2">
                    {String(row.planned_volume_m3 ?? "-")} m³ / {String(row.planned_trip_count ?? "-")} chuyến
                  </td>
                  <td className="px-3 py-2">
                    {String(row.actual_volume_m3 ?? "-")} m³ / {String(row.actual_trip_count ?? "-")} chuyến
                  </td>
                  <td className="px-3 py-2">
                    {String(row.variance_volume_m3 ?? "-")} m³ / {String(row.variance_trip_count ?? "-")} chuyến
                  </td>
                  <td className="px-3 py-2">{String(row.reason_code ?? "-")}</td>
                  <td className="px-3 py-2">{formatDateTime(row.reconciled_at)}</td>
                </tr>
              );
            })}
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Chưa có dữ liệu đối soát.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
