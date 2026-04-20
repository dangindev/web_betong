"use client";

import { useEffect, useMemo, useState } from "react";

import { apiListResource, apiPostOfflineSync, apiPostPumpEvent } from "@/lib/api/client";
import { nextPumpEvent } from "@/lib/dispatch/state";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

type OfflinePumpEvent = {
  channel: "pump_event";
  pump_session_id: string;
  event_type: string;
  event_time: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
};

const OFFLINE_QUEUE_KEY = "pump-offline-queue";

function loadOfflineQueue(): OfflinePumpEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflinePumpEvent[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflinePumpEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

const PUMP_EVENT_LABELS: Record<string, string> = {
  assigned: "Đã phân công",
  moving: "Đang di chuyển",
  setup_start: "Bắt đầu lắp đặt",
  pump_start: "Bắt đầu bơm",
  pump_end: "Kết thúc bơm",
  teardown_end: "Hoàn tất tháo dỡ"
};

function pumpEventLabel(value: unknown): string {
  const key = String(value ?? "").trim();
  if (!key) return "-";
  return PUMP_EVENT_LABELS[key] ?? key;
}

export default function PumpCrewMobilePage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [deviceId, setDeviceId] = useState("pump-device-01");
  const [signature, setSignature] = useState("");
  const [sessions, setSessions] = useState<GenericRow[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflinePumpEvent[]>([]);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setError(null);
    try {
      const response = await apiListResource<GenericRow>("pump_sessions", accessToken, { skip: 0, limit: 500 });
      setSessions(response.items);
      if (!organizationId) {
        const firstOrg = String(response.items[0]?.organization_id ?? "");
        if (firstOrg) setOrganizationId(firstOrg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được phiên bơm.");
    }
  }

  useEffect(() => {
    void load();
    setOfflineQueue(loadOfflineQueue());
  }, [accessToken]);

  const activeSessions = useMemo(
    () => sessions.filter((item) => String(item.session_status ?? "assigned") !== "teardown_end"),
    [sessions]
  );

  async function emitNextEvent(session: GenericRow) {
    if (!accessToken || !organizationId) {
      setError("Thiếu phiên đăng nhập hoặc mã tổ chức (organization_id).");
      return;
    }

    const sessionId = String(session.id ?? "");
    const currentStatus = String(session.session_status ?? "assigned");
    const nextEvent = nextPumpEvent(currentStatus);
    if (!sessionId || !nextEvent) {
      setError("Phiên bơm đã hoàn tất hoặc dữ liệu không hợp lệ.");
      return;
    }

    const payload = {
      signature,
      actual_volume_m3: nextEvent === "pump_end" ? Number(session.actual_volume_m3 ?? 0) || 0 : undefined
    };

    const queuedEvent: OfflinePumpEvent = {
      channel: "pump_event",
      pump_session_id: sessionId,
      event_type: nextEvent,
      event_time: new Date().toISOString(),
      idempotency_key: `${sessionId}-${nextEvent}-${Date.now()}`,
      payload
    };

    setBusySessionId(sessionId);
    setError(null);
    setMessage(null);
    try {
      await apiPostPumpEvent(
        sessionId,
        {
          organization_id: organizationId,
          event_type: queuedEvent.event_type,
          event_time: queuedEvent.event_time,
          idempotency_key: queuedEvent.idempotency_key,
          payload: queuedEvent.payload,
          source: "mobile_pump"
        },
        accessToken
      );
      setMessage(`Đã gửi sự kiện ${pumpEventLabel(queuedEvent.event_type)} cho phiên bơm ${toShortId(sessionId)}.`);
      await load();
    } catch (e) {
      const queue = [...offlineQueue, queuedEvent];
      setOfflineQueue(queue);
      saveOfflineQueue(queue);
      setError(e instanceof Error ? `${e.message} (đã lưu offline)` : "Lỗi mạng, sự kiện đã lưu offline.");
    } finally {
      setBusySessionId(null);
    }
  }

  async function syncOfflineQueue() {
    if (!accessToken || !organizationId || offlineQueue.length === 0) return;
    setError(null);
    setMessage(null);
    try {
      await apiPostOfflineSync(
        {
          organization_id: organizationId,
          device_id: deviceId,
          events: offlineQueue as unknown as Array<Record<string, unknown>>
        },
        accessToken
      );
      setOfflineQueue([]);
      saveOfflineQueue([]);
      setMessage("Đã đồng bộ hàng đợi offline cho đội bơm.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đồng bộ hàng đợi offline thất bại.");
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để dùng giao diện đội bơm.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Giao diện đội bơm (PWA MVP)</h2>
        <p className="text-sm text-slate-600">Theo dõi phiên bơm, xác nhận lắp đặt/bơm/tháo dỡ, chữ ký văn bản và đồng bộ offline.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Mã tổ chức (organization_id)"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Mã thiết bị (device_id)"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
        />
      </div>

      <input
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        placeholder="Chữ ký (tên/văn bản)"
        value={signature}
        onChange={(event) => setSignature(event.target.value)}
      />

      <div className="flex items-center gap-2">
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={() => void load()}>
          Làm mới phiên bơm
        </button>
        <button
          className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-60"
          disabled={offlineQueue.length === 0}
          onClick={() => void syncOfflineQueue()}
        >
          Đồng bộ offline ({offlineQueue.length})
        </button>
      </div>

      <div className="space-y-2">
        {activeSessions.length === 0 ? (
          <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-500">Không có phiên bơm đang hoạt động.</div>
        ) : null}
        {activeSessions.map((session) => {
          const sessionId = String(session.id ?? "");
          const currentStatus = String(session.session_status ?? "assigned");
          const nextEvent = nextPumpEvent(currentStatus);
          return (
            <div key={sessionId} className="rounded border border-slate-200 bg-white p-3">
              <div className="font-medium">Phiên bơm {toShortId(sessionId)}</div>
              <div className="text-sm text-slate-600">
                trạng thái {pumpEventLabel(currentStatus)} · cần bơm {toShortId(session.pump_id)} · chuyến {toShortId(session.trip_id)}
              </div>
              <div className="mt-2">
                {nextEvent ? (
                  <button
                    disabled={busySessionId === sessionId}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                    onClick={() => void emitNextEvent(session)}
                  >
                    Gửi sự kiện tiếp theo: {pumpEventLabel(nextEvent)}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">Phiên bơm đã hoàn tất.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm">
        {message ? <span className="text-emerald-700">{message}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
