"use client";

import {
  BookOpen,
  Database,
  Factory,
  LayoutDashboard,
  ListFilter,
  Loader2,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  Upload
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";

import { apiLogout, apiMe, apiRefresh, isAuthError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import { LocaleSwitcher } from "./locale-switcher";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/master/customers", label: "Master Data", icon: Database },
  { href: "/sales", label: "Sales Workspace", icon: BookOpen },
  { href: "/sales/orders", label: "Sales Lists", icon: ListFilter },
  { href: "/dispatch", label: "Dispatch", icon: Truck },
  { href: "/mobile/driver", label: "Mobile Ops", icon: Smartphone },
  { href: "/admin/users", label: "Admin", icon: ShieldCheck, roles: ["SYS_ADMIN"] },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, refreshToken, user, clearAuth, setAuth } = useAuthStore();
  const [authChecking, setAuthChecking] = useState(Boolean(accessToken));

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    let cancelled = false;

    async function validateAuth() {
      if (!accessToken) {
        if (!cancelled) {
          setAuthChecking(false);
        }
        return;
      }

      if (!cancelled) {
        setAuthChecking(true);
      }

      try {
        const profile = await apiMe(accessToken);
        if (!cancelled && !user && refreshToken) {
          setAuth({ accessToken, refreshToken, user: profile });
        }
      } catch (error) {
        if (!isAuthError(error)) {
          return;
        }

        if (!refreshToken) {
          if (!cancelled) {
            clearAuth();
            router.replace("/login");
          }
          return;
        }

        try {
          const refreshed = await apiRefresh(refreshToken);
          const profile = await apiMe(refreshed.access_token);
          if (!cancelled) {
            setAuth({
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
              user: profile
            });
          }
        } catch {
          if (!cancelled) {
            clearAuth();
            router.replace("/login");
          }
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    }

    void validateAuth();

    return () => {
      cancelled = true;
    };
  }, [accessToken, clearAuth, refreshToken, router, setAuth, user]);

  const visibleNavItems = useMemo(() => {
    const roles = new Set(user?.roles ?? []);
    return navItems.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.some((role) => roles.has(role));
    });
  }, [user?.roles]);

  async function handleLogout() {
    try {
      if (refreshToken) {
        await apiLogout(refreshToken);
      }
    } finally {
      clearAuth();
      router.push("/login");
    }
  }

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-950">{children}</div>;
  }

  if (authChecking) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Đang kiểm tra phiên đăng nhập...</span>
        </div>
      </div>
    );
  }

  const pathnameLabel = pathname === "/" ? "Dashboard" : pathname;

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-100 lg:grid-cols-[280px_1fr]">
      <aside className="relative overflow-hidden border-r border-slate-800 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100">
        <div className="pointer-events-none absolute -top-24 left-10 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative flex h-full flex-col p-5">
          <Link className="group flex items-center gap-3" href="/">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-lg transition-transform duration-300 group-hover:scale-105">
              <Factory className="h-6 w-6 text-cyan-200" />
            </span>
            <span>
              <span className="block text-[10px] uppercase tracking-[0.24em] text-cyan-200/80">ReadyMix OS</span>
              <span className="block text-lg font-semibold tracking-tight">web_betong</span>
            </span>
          </Link>

          <p className="mt-3 text-xs text-slate-300/90">Dispatch • Scheduler • Mobile Execution</p>

          <nav className="mt-6 space-y-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href) && item.href !== "/" ? true : pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                    active
                      ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20"
                      : "text-slate-200/85 hover:bg-white/10 hover:text-white"
                  )}
                  href={item.href}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 rounded-xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
            <div className="text-xs text-slate-300">{user ? `${user.full_name} (${user.username})` : "Not logged in"}</div>
            {!accessToken ? (
              <Link className="inline-flex items-center gap-2 text-sm text-cyan-200" href="/login">
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            ) : (
              <Button className="w-full justify-start bg-white/10 text-slate-100 hover:bg-white/20" variant="ghost" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Live
            </span>
            <span className="font-medium text-slate-700">{pathnameLabel}</span>
          </div>
          <LocaleSwitcher />
        </header>

        <section className="p-4 sm:p-6">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-xl shadow-slate-200/50 backdrop-blur sm:p-6">{children}</div>
        </section>
      </main>
    </div>
  );
}
