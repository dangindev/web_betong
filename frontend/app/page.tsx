"use client";

import { Activity, BarChart3, CalendarClock, Truck } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuthStore } from "@/lib/store/auth-store";

const highlights = [
  {
    title: "Dispatch realtime",
    description: "Theo dõi trạng thái xe/cần bơm theo từng chuyến với độ trễ thấp.",
    icon: Truck,
    tone: "from-blue-500/15 to-cyan-500/15"
  },
  {
    title: "Execution timeline",
    description: "Bám sát tiến độ từ check-in trạm đến return plant với state machine rõ ràng.",
    icon: CalendarClock,
    tone: "from-emerald-500/15 to-teal-500/15"
  },
  {
    title: "KPI snapshot",
    description: "Tổng hợp hiệu suất vận hành, cycle time và utilization cuối ca.",
    icon: BarChart3,
    tone: "from-violet-500/15 to-indigo-500/15"
  }
] as const;

export default function HomePage() {
  const t = useTranslations();
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-300/30">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
            <Activity className="h-3.5 w-3.5" />
            Operations Pulse
          </p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">{t("app.welcome")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-blue-50 sm:text-base">
            {user
              ? `Xin chào ${user.full_name}. Hệ thống đang sẵn sàng cho dispatch, execution mobile và reconciliation.`
              : "Bạn chưa đăng nhập. Vào trang /login để bắt đầu quản trị điều phối vận hành."}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.tone} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <div className="relative">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
