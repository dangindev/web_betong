"use client";

import { Activity, BarChart3, CalendarClock, Truck } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuthStore } from "@/lib/store/auth-store";

const metricCards = [
  {
    title: "Điều phối thời gian thực",
    value: "Trực tuyến",
    description: "Theo dõi trạng thái xe/cần bơm theo chuyến ngay trên board.",
    icon: Truck,
    tone: "bg-brand-50 text-brand-700"
  },
  {
    title: "Nhật ký thực thi",
    value: "Theo dõi",
    description: "Chuỗi trạng thái trip/pump được ghi nhận từ plant đến site.",
    icon: CalendarClock,
    tone: "bg-success-50 text-success-700"
  },
  {
    title: "Ảnh chụp KPI",
    value: "Hằng ngày",
    description: "Snapshot hiệu suất vận hành và reconciliation cuối ca.",
    icon: BarChart3,
    tone: "bg-violet-50 text-violet-700"
  }
] as const;

export default function HomePage() {
  const t = useTranslations();
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      <section className="ta-card overflow-hidden">
        <div className="bg-gradient-to-r from-brand-500 to-brand-700 p-6 text-white">
          <p className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/90">
            <Activity className="h-3.5 w-3.5" />
            Tổng quan vận hành
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{t("app.welcome")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-blue-100">
            {user
              ? `Xin chào ${user.full_name}. Nền tảng đang sẵn sàng cho Kinh doanh, Điều phối, vận hành hiện trường và KPI.`
              : "Bạn chưa đăng nhập. Vui lòng vào /dang-nhap để bắt đầu phiên làm việc."}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metricCards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="ta-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">{item.title}</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{item.value}</p>
                </div>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">{item.description}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
