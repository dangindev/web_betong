"use client";

import { useEffect, useState } from "react";

import { apiListResource, apiPostReconciliation } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
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
  const [records, setRecords] = useState<GenericRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setError(null);
    try {
      const [pourRes, recRes] = await Promise.all([
        apiListResource<GenericRow>("pour_requests", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("reconciliation_records", accessToken, { skip: 0, limit: 500 })
      ]);
      setPourRequests(pourRes.items);
      setRecords(recRes.items);
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
  }, [accessToken]);

  async function handleReconcile() {
    if (!accessToken || !organizationId || !pourRequestId) {
      setError("Thiếu phiên đăng nhập, mã tổ chức (organization_id) hoặc mã yêu cầu đổ (pour_request_id).");
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
      setMessage(`Đã chốt đối soát cho yêu cầu ${toShortId(pourRequestId)}.`);
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
        <p className="text-sm text-slate-600">Chốt khối lượng/chuyến thực tế và mã lý do cuối ca.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <input
          className="ta-input"
          placeholder="Mã tổ chức (organization_id)"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <select
          className="ta-input"
          value={pourRequestId}
          onChange={(event) => setPourRequestId(event.target.value)}
        >
          <option value="">Chọn mã yêu cầu đổ (pour_request_id)</option>
          {pourRequests.map((item) => (
            <option key={String(item.id)} value={String(item.id)}>
              {String(item.request_no ?? item.id)}
            </option>
          ))}
        </select>
        <button className="ta-button" onClick={() => void load()}>
          Làm mới
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="ta-input"
          placeholder="Khối lượng thực tế (actual_volume_m3)"
          value={actualVolume}
          onChange={(event) => setActualVolume(event.target.value)}
        />
        <input
          className="ta-input"
          placeholder="Số chuyến thực tế (actual_trip_count)"
          value={actualTrips}
          onChange={(event) => setActualTrips(event.target.value)}
        />
        <input
          className="ta-input"
          placeholder="Mã lý do (reason_code)"
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
        />
        <input
          className="ta-input"
          placeholder="Ghi chú"
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
            </tr>
          </thead>
          <tbody>
            {records.map((row) => (
              <tr key={String(row.id)} className="border-t border-slate-100">
                <td className="px-3 py-2">{toShortId(row.pour_request_id)}</td>
                <td className="px-3 py-2">
                  {String(row.planned_volume_m3 ?? "-")} m3 / {String(row.planned_trip_count ?? "-")} chuyến
                </td>
                <td className="px-3 py-2">
                  {String(row.actual_volume_m3 ?? "-")} m3 / {String(row.actual_trip_count ?? "-")} chuyến
                </td>
                <td className="px-3 py-2">
                  {String(row.variance_volume_m3 ?? "-")} m3 / {String(row.variance_trip_count ?? "-")} chuyến
                </td>
                <td className="px-3 py-2">{String(row.reason_code ?? "-")}</td>
              </tr>
            ))}
            {records.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
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
