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
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Truck,
  Upload,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";

import { apiLogout, apiMe, apiRefresh, isAuthError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

import { LocaleSwitcher } from "./locale-switcher";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

const navItems: NavItem[] = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/danh-muc/khach-hang", label: "Danh mục nền", icon: Database },
  { href: "/kho-gia-thanh", label: "Kho & giá thành", icon: Package },
  { href: "/kinh-doanh", label: "Điều hành kinh doanh", icon: BookOpen },
  { href: "/kinh-doanh/don-hang", label: "Danh sách đơn hàng", icon: ListFilter },
  { href: "/dieu-phoi", label: "Điều phối", icon: Truck },
  { href: "/di-dong/tai-xe", label: "Vận hành di động", icon: Smartphone },
  { href: "/quan-tri/tai-khoan", label: "Quản trị", icon: ShieldCheck, roles: ["SYS_ADMIN"] },
  { href: "/nhap-du-lieu", label: "Nhập dữ liệu", icon: Upload },
  { href: "/cau-hinh-he-thong", label: "Cấu hình", icon: Settings }
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, refreshToken, user, clearAuth, setAuth } = useAuthStore();

  const [authChecking, setAuthChecking] = useState(Boolean(accessToken));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLoginPage = pathname === "/login" || pathname === "/dang-nhap";

  useEffect(() => {
    let cancelled = false;

    async function validateAuth() {
      if (!accessToken) {
        if (!cancelled) setAuthChecking(false);
        return;
      }

      if (!cancelled) setAuthChecking(true);

      try {
        const profile = await apiMe(accessToken);
        if (!cancelled && refreshToken && (!user || user.id !== profile.id)) {
          setAuth({ accessToken, refreshToken, user: profile });
        }
      } catch (error) {
        if (!isAuthError(error)) {
          if (!cancelled) setAuthChecking(false);
          return;
        }

        if (!refreshToken) {
          if (!cancelled) {
            clearAuth();
            router.replace("/dang-nhap");
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
            router.replace("/dang-nhap");
          }
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    void validateAuth();

    return () => {
      cancelled = true;
    };
  }, [accessToken, clearAuth, refreshToken, router, setAuth, user]);

  useEffect(() => {
    if (!isLoginPage && !authChecking && !accessToken) {
      router.replace("/dang-nhap");
    }
  }, [accessToken, authChecking, isLoginPage, router]);

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
      router.push("/dang-nhap");
    }
  }

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-100">{children}</div>;
  }

  if (authChecking) {
    return (
      <div className="grid min-h-screen place-items-center bg-gray-100">
        <div className="ta-card flex items-center gap-3 px-4 py-3 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
          <span>Đang kiểm tra phiên đăng nhập...</span>
        </div>
      </div>
    );
  }

  const pathnameLabel = pathname === "/" ? "Tổng quan" : pathname;

  return (
    <div className="min-h-screen bg-gray-100">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-gray-200 bg-white px-4 py-5 shadow-theme-md transition-transform duration-300 lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <Link className="flex items-center gap-3" href="/">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-theme-sm">
              <Factory className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.24em] text-brand-500">Giao diện quản trị</span>
              <span className="block text-lg font-semibold text-gray-900">BetonFlow</span>
            </span>
          </Link>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Điều hướng</div>
        <nav className="mt-3 space-y-1.5 overflow-y-auto pb-4">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href) && item.href !== "/" ? true : pathname === item.href;

            return (
              <Link
                key={item.href}
                className={cn("ta-menu-item", active ? "ta-menu-item-active" : "ta-menu-item-inactive")}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto ta-card p-3">
          <p className="text-xs text-gray-500">Đang đăng nhập</p>
          <p className="mt-1 truncate text-sm font-medium text-gray-900">{user ? `${user.full_name} (${user.username})` : "Khách"}</p>
          {accessToken ? (
            <button
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              onClick={handleLogout}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          ) : (
            <Link
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600"
              href="/dang-nhap"
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập
            </Link>
          )}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
          aria-label="Đóng lớp phủ thanh bên"
        />
      ) : null}

      <div className="min-h-screen lg:ml-[290px]">
        <header className="sticky top-0 z-30 flex h-[74px] items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className="ta-input w-[300px] pl-9" placeholder="Tìm nhanh trong hệ thống..." />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 md:inline-flex">{pathnameLabel}</span>
            <LocaleSwitcher />
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
