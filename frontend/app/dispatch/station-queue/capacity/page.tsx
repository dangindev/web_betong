"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiListResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

function toShortId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

export default function StationCapacityPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [plantFilter, setPlantFilter] = useState("");
  const [slots, setSlots] = useState<GenericRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const slotRes = await apiListResource<GenericRow>("plant_capacity_slots", accessToken, { skip: 0, limit: 500 });
      setSlots(slotRes.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu khung năng lực trạm.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  const filteredSlots = useMemo(() => {
    if (!plantFilter) return slots;
    return slots.filter((slot) => String(slot.plant_id ?? "").includes(plantFilter));
  }, [slots, plantFilter]);

  if (!accessToken) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Bạn cần đăng nhập để xem khung năng lực trạm.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Khung năng lực trạm</h2>
          <p className="text-sm text-slate-600">Theo dõi slot công suất theo từng trạm để hỗ trợ xử lý hàng chờ.</p>
        </div>
        <Link className="ta-button-secondary h-10 px-4 text-sm" href="/dieu-phoi/hang-cho-tram">
          Quay lại Hàng chờ trạm
        </Link>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
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

      <section className="rounded border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold">Danh sách slot công suất</h3>
        {loading ? <p className="mt-2 text-sm text-slate-500">Đang tải dữ liệu...</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

        {!loading && !error ? (
          <ul className="mt-2 space-y-2 text-sm">
            {filteredSlots.length === 0 ? <li className="text-slate-500">Chưa có khung năng lực.</li> : null}
            {filteredSlots.map((slot) => (
              <li key={String(slot.id)} className="rounded border border-slate-100 px-2 py-1">
                <div className="font-medium">trạm {toShortId(slot.plant_id)}</div>
                <div>
                  {String(slot.slot_start_at ?? "-")} → {String(slot.slot_end_at ?? "-")}
                </div>
                <div className="text-xs text-slate-500">
                  đã dùng {String(slot.used_loads ?? 0)} / {String(slot.max_loads ?? 0)}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
