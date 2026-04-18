"use client";

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <form className="w-full max-w-md rounded border border-slate-200 bg-white p-6 space-y-4" onSubmit={handleSubmit}>
        <h1 className="text-xl font-semibold">Đăng nhập</h1>
        <p className="text-sm text-slate-500">Tài khoản seed mặc định: admin / Admin@123</p>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="w-full rounded border border-slate-300 px-3 py-2"
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="w-full rounded border border-slate-300 px-3 py-2"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </div>

        {error ? <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>
    </div>
  );
}
