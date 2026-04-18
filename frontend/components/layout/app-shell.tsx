"use client";

import { Database, LayoutDashboard, LogIn, LogOut, Settings, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useMemo } from "react";

import { apiLogout } from "@/lib/api/client";
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
  { href: "/admin/users", label: "Admin", icon: ShieldCheck, roles: ["SYS_ADMIN"] },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, refreshToken, user, clearAuth } = useAuthStore();

  const isLoginPage = pathname === "/login";

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
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="border-r border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-primary">web_betong</h1>
        <p className="mt-1 text-xs text-slate-500">Phase 1 Foundation</p>

        <nav className="mt-6 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href) && item.href !== "/" ? true : pathname === item.href;

            return (
              <Link
                key={item.href}
                className={cn(
                  "flex items-center gap-2 rounded px-3 py-2 text-sm",
                  active ? "bg-blue-50 text-primary" : "text-slate-700 hover:bg-slate-100"
                )}
                href={item.href}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 space-y-2 border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-500">{user ? `${user.full_name} (${user.username})` : "Not logged in"}</div>
          {!accessToken ? (
            <Link className="inline-flex items-center gap-2 text-sm text-primary" href="/login">
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          ) : (
            <Button className="w-full justify-start" variant="secondary" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </aside>

      <main>
        <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between">
          <span className="text-sm text-slate-600">{pathname}</span>
          <LocaleSwitcher />
        </header>
        <section className="p-4">{children}</section>
      </main>
    </div>
  );
}
