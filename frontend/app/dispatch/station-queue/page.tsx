"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiListResource, apiPostTripEvent } from "@/lib/api/client";
import { nextTripEvent } from "@/lib/dispatch/state";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

export default function StationQueueBoardPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [organizationId, setOrganizationId] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [scheduledTrips, setScheduledTrips] = useState<GenericRow[]>([]);
  const [trips, setTrips] = useState<GenericRow[]>([]);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setError(null);
    try {
      const [scheduledRes, tripRes] = await Promise.all([
        apiListResource<GenericRow>("scheduled_trips", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("trips", accessToken, { skip: 0, limit: 500 })
      ]);
      setScheduledTrips(scheduledRes.items);
      setTrips(tripRes.items);

      if (!organizationId) {
        const firstOrg = String(
          scheduledRes.items[0]?.organization_id ?? tripRes.items[0]?.organization_id ?? ""
        );
        if (firstOrg) setOrganizationId(firstOrg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được bảng hàng chờ trạm.");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  const tripByScheduledTripId = useMemo(() => {
    const mapping = new Map<string, GenericRow>();
    trips.forEach((trip) => {
      const key = String(trip.scheduled_trip_id ?? "");
      if (key) mapping.set(key, trip);
    });
    return mapping;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    return scheduledTrips.filter((trip) => {
      if (!plantFilter) return true;
      return String(trip.assigned_plant_id ?? "").includes(plantFilter);
    });
  }, [scheduledTrips, plantFilter]);

  async function emitTripEvent(tripId: string, eventType: string) {
    if (!accessToken || !organizationId) {
      setError("Thiếu phiên đăng nhập hoặc mã tổ chức (organization_id).");
      return;
    }

    setBusyTripId(tripId);
    setMessage(null);
    setError(null);
    try {
      await apiPostTripEvent(
        tripId,
        {
          organization_id: organizationId,
          event_type: eventType,
          event_time: new Date().toISOString(),
          idempotency_key: `${tripId}-${eventType}-${Date.now()}`,
          payload: {}
        },
        accessToken
      );
      setMessage(`Đã ghi nhận sự kiện ${eventType} cho chuyến ${toShortId(tripId)}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ghi nhận sự kiện thất bại.");
    } finally {
      setBusyTripId(null);
    }
  }

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để dùng bảng hàng chờ trạm.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Bảng hàng chờ trạm</h2>
          <p className="text-sm text-slate-600">Nhân sự trạm phát hành mốc bắt đầu nạp/kết thúc nạp và theo dõi hàng chờ theo từng trạm.</p>
        </div>
        <Link className="ta-button-secondary h-10 px-4 text-sm" href="/dieu-phoi/hang-cho-tram/khung-nang-luc-tram">
          Mở trang Khung năng lực trạm
        </Link>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <input
          className="ta-input"
          placeholder="Mã tổ chức (organization_id)"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
        <input
          className="ta-input"
          placeholder="Lọc mã trạm (plant_id)"
          value={plantFilter}
          onChange={(event) => setPlantFilter(event.target.value)}
        />
        <button className="ta-button" onClick={() => void load()}>
          Làm mới
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold">Khung năng lực trạm</h3>
          <p className="mt-1 text-xs text-slate-600">
            Khung năng lực trạm đã tách thành trang riêng để đúng phân cấp điều hướng và có thể bấm trực tiếp.
          </p>
          <Link className="ta-button-secondary mt-3 inline-flex h-9 items-center px-3 text-xs" href="/dieu-phoi/hang-cho-tram/khung-nang-luc-tram">
            Đi tới Khung năng lực trạm
          </Link>
        </section>

        <section className="rounded border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold">Danh sách chuyến chờ</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {filteredTrips.length === 0 ? <li className="text-slate-500">Chưa có chuyến được lập lịch.</li> : null}
            {filteredTrips.map((scheduledTrip) => {
              const scheduledTripId = String(scheduledTrip.id ?? "");
              const trip = tripByScheduledTripId.get(scheduledTripId);
              const tripId = String(trip?.id ?? "");
              const status = String(trip?.status ?? "assigned");
              const nextEvent = nextTripEvent(status);
              const busy = Boolean(tripId) && busyTripId === tripId;

              return (
                <li key={scheduledTripId} className="rounded border border-slate-100 px-2 py-2">
                  <div className="font-medium">
                    Chuyến #{String(scheduledTrip.trip_no ?? "-")} · trạm {toShortId(scheduledTrip.assigned_plant_id)}
                  </div>
                  <div className="text-xs text-slate-500">scheduled_trip_id: {toShortId(scheduledTripId)}</div>
                  <div className="text-xs text-slate-500">trip_id: {tripId ? toShortId(tripId) : "(chưa tạo)"}</div>
                  <div className="mt-1">Trạng thái: {status}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tripId ? (
                      <>
                        <button
                          disabled={busy}
                          className="ta-button-secondary h-8 px-3 text-xs"
                          onClick={() => void emitTripEvent(tripId, "load_start")}
                        >
                          Bắt đầu nạp
                        </button>
                        <button
                          disabled={busy}
                          className="ta-button-secondary h-8 px-3 text-xs"
                          onClick={() => void emitTripEvent(tripId, "load_end")}
                        >
                          Kết thúc nạp
                        </button>
                        {nextEvent ? (
                          <button
                            disabled={busy}
                            className="ta-button-secondary h-8 px-3 text-xs"
                            onClick={() => void emitTripEvent(tripId, nextEvent)}
                          >
                            Sự kiện tiếp theo: {nextEvent}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-amber-700">Bản ghi chuyến chưa được sinh.</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="text-sm">
        {message ? <span className="text-emerald-700">{message}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
