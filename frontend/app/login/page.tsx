"use client";

import { Factory, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiLogin } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

import { Button } from "@/components/ui/button";

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
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-8 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden rounded-3xl border border-white/15 bg-white/5 p-8 text-slate-100 backdrop-blur lg:block">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-lg">
              <Factory className="h-6 w-6 text-cyan-200" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/80">ReadyMix OS</p>
              <h1 className="text-2xl font-semibold tracking-tight">web_betong</h1>
            </div>
          </div>

          <h2 className="mt-8 text-3xl font-semibold leading-tight">Điều phối bê tông hiện đại, realtime và an toàn phiên đăng nhập.</h2>
          <p className="mt-3 text-sm text-slate-300">
            Nền tảng đã hỗ trợ luồng end-to-end từ Sales → Dispatch → Mobile Execution, đồng thời tự làm mới phiên khi token cũ hết hạn.
          </p>

          <div className="mt-8 grid gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-white">Dispatch Board Realtime</p>
              <p className="mt-1 text-slate-300">Theo dõi lịch xe/cần bơm theo phiên vận hành trực tiếp.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-white">Execution Mobile</p>
              <p className="mt-1 text-slate-300">Driver và Pump Crew cập nhật sự kiện tại hiện trường.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-white">Ops KPI</p>
              <p className="mt-1 text-slate-300">Đối soát cuối ca và snapshot KPI vận hành tức thì.</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <form
            className="w-full max-w-md space-y-5 rounded-3xl border border-white/20 bg-white/95 p-7 shadow-2xl shadow-black/30 backdrop-blur"
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Secure Session
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">Đăng nhập</h2>
              <p className="text-sm text-slate-500">Tài khoản seed mặc định: admin / Admin@123</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                onChange={(event) => setUsername(event.target.value)}
                value={username}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </div>
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</div> : null}

            <Button className="w-full rounded-xl py-2.5 text-sm font-medium shadow-lg shadow-primary/20" disabled={submitting} type="submit">
              {submitting ? "Đang đăng nhập..." : "Đăng nhập vào hệ thống"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
