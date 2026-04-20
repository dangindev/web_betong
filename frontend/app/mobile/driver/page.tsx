"use client";

import { useEffect, useMemo, useState } from "react";

import { apiListResource, apiPostOfflineSync, apiPostTripEvent } from "@/lib/api/client";
import { isDispatchTripActive, nextTripEvent } from "@/lib/dispatch/state";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

type OfflineEvent = {
  channel: "trip_event";
  trip_id: string;
  event_type: string;
  event_time: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
};

const OFFLINE_QUEUE_KEY = "driver-offline-queue";

function loadOfflineQueue(): OfflineEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineEvent[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

const TRIP_EVENT_LABELS: Record<string, string> = {
  assigned: "Đã phân công",
  accepted: "Đã nhận chuyến",
  check_in_plant: "Đã vào trạm",
  load_start: "Bắt đầu nạp",
  load_end: "Kết thúc nạp",
  depart_plant: "Rời trạm",
  arrive_site: "Đến công trình",
  pour_start: "Bắt đầu đổ",
  pour_end: "Kết thúc đổ",
  leave_site: "Rời công trình",
  return_plant: "Về trạm"
};

function tripEventLabel(value: unknown): string {
  const key = String(value ?? "").trim();
  if (!key) return "-";
  return TRIP_EVENT_LABELS[key] ?? key;
}

export default function DriverMobilePage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [deviceId, setDeviceId] = useState("driver-device-01");
  const [trips, setTrips] = useState<GenericRow[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineEvent[]>([]);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setError(null);
    try {
      const response = await apiListResource<GenericRow>("trips", accessToken, { skip: 0, limit: 500 });
      setTrips(response.items);
      if (!organizationId) {
        const firstOrg = String(response.items[0]?.organization_id ?? "");
        if (firstOrg) setOrganizationId(firstOrg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách chuyến.");
    }
  }

  useEffect(() => {
    void load();
    setOfflineQueue(loadOfflineQueue());
  }, [accessToken]);

  const activeTrips = useMemo(() => trips.filter((trip) => isDispatchTripActive(String(trip.status ?? "assigned"))), [trips]);

  async function emitNextEvent(trip: GenericRow) {
    if (!accessToken || !organizationId) {
      setError("Thiếu phiên đăng nhập hoặc mã tổ chức (organization_id).");
      return;
    }

    const tripId = String(trip.id ?? "");
    const nextEvent = nextTripEvent(String(trip.status ?? "assigned"));
    if (!tripId || !nextEvent) {
      setError("Chuyến đã hoàn tất hoặc dữ liệu không hợp lệ.");
      return;
    }

    const queuedEvent: OfflineEvent = {
      channel: "trip_event",
      trip_id: tripId,
      event_type: nextEvent,
      event_time: new Date().toISOString(),
      idempotency_key: `${tripId}-${nextEvent}-${Date.now()}`,
      payload: {}
    };

    setBusyTripId(tripId);
    setError(null);
    setMessage(null);
    try {
      await apiPostTripEvent(
        tripId,
        {
          organization_id: organizationId,
          event_type: queuedEvent.event_type,
          event_time: queuedEvent.event_time,
          idempotency_key: queuedEvent.idempotency_key,
          payload: queuedEvent.payload,
          source: "mobile_driver"
        },
        accessToken
      );
      setMessage(`Đã gửi sự kiện ${tripEventLabel(queuedEvent.event_type)} cho chuyến ${toShortId(tripId)}.`);
      await load();
    } catch (e) {
      const queue = [...offlineQueue, queuedEvent];
      setOfflineQueue(queue);
      saveOfflineQueue(queue);
      setError(e instanceof Error ? `${e.message} (đã lưu offline)` : "Lỗi mạng, sự kiện đã lưu offline.");
    } finally {
      setBusyTripId(null);
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
      setMessage("Đã đồng bộ hàng đợi offline.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đồng bộ hàng đợi offline thất bại.");
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để dùng giao diện tài xế.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Giao diện tài xế (PWA MVP)</h2>
        <p className="text-sm text-slate-600">Nhận/chạy chuyến, gửi sự kiện vòng đời và đồng bộ offline khi có mạng.</p>
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

      <div className="flex items-center gap-2">
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={() => void load()}>
          Làm mới danh sách chuyến
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
        {activeTrips.length === 0 ? <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-500">Không có chuyến đang hoạt động.</div> : null}
        {activeTrips.map((trip) => {
          const tripId = String(trip.id ?? "");
          const status = String(trip.status ?? "assigned");
          const nextEvent = nextTripEvent(status);
          return (
            <div key={tripId} className="rounded border border-slate-200 bg-white p-3">
              <div className="font-medium">Chuyến {toShortId(tripId)}</div>
              <div className="text-sm text-slate-600">
                trạng thái {tripEventLabel(status)} · xe {toShortId(trip.vehicle_id)} · yêu cầu {toShortId(trip.pour_request_id)}
              </div>
              <div className="mt-2">
                {nextEvent ? (
                  <button
                    disabled={busyTripId === tripId}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                    onClick={() => void emitNextEvent(trip)}
                  >
                    Gửi sự kiện tiếp theo: {tripEventLabel(nextEvent)}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">Chuyến đã hoàn tất.</span>
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
