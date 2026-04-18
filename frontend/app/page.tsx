"use client";

import { useTranslations } from "next-intl";

import { useAuthStore } from "@/lib/store/auth-store";

export default function HomePage() {
  const t = useTranslations();
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{t("app.welcome")}</h2>
      <p className="text-slate-600">
        {user
          ? `Xin chào ${user.full_name}. Hệ thống Phase 1 đã sẵn sàng cho CRUD nền tảng.`
          : "Bạn chưa đăng nhập. Vào trang /login để bắt đầu."}
      </p>
    </div>
  );
}
