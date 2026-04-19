"use client";

import { ArrowRight, Factory, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiLogin } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await apiLogin({ username, password });
      setAuth({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        user: response.user
      });
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-8 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-sky-200/45 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-5xl gap-6 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-theme-xl backdrop-blur md:grid-cols-2 md:p-6">
        <section className="hidden rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-800 md:block">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white shadow-theme-sm">
              <Factory className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-brand-600">Giao diện TailAdmin</p>
              <h1 className="text-2xl font-semibold text-slate-900">BetonFlow</h1>
            </div>
          </div>

          <h2 className="mt-8 text-3xl font-semibold leading-tight text-slate-900">Điều phối bê tông với giao diện bảng điều hành hiện đại.</h2>
          <p className="mt-3 text-sm text-slate-600">
            Đăng nhập để truy cập Kinh doanh, Điều phối, Vận hành hiện trường và KPI vận hành theo thời gian thực.
          </p>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Quản lý phiên an toàn
            </div>
            <p className="mt-2 text-xs text-slate-600">Phiên đăng nhập tự động refresh token khi cần để tránh gián đoạn thao tác.</p>
          </div>
        </section>

        <section className="ta-card p-6 md:p-7">
          <h2 className="text-2xl font-semibold text-gray-900">Đăng nhập hệ thống</h2>
          <p className="mt-1 text-sm text-gray-500">Tài khoản mặc định: admin / Admin@123</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="username">
                Tên đăng nhập
              </label>
              <input
                id="username"
                className="ta-input"
                onChange={(event) => setUsername(event.target.value)}
                value={username}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="password">
                Mật khẩu
              </label>
              <input
                id="password"
                className="ta-input"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>

            {error ? <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">{error}</div> : null}

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-70"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
