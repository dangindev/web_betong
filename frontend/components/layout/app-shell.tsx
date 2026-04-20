"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Circle,
  Database,
  Factory,
  LayoutDashboard,
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

type IconType = React.ComponentType<{ className?: string }>;

type NavNode = {
  id: string;
  label: string;
  href?: string;
  icon?: IconType;
  roles?: string[];
  children?: NavNode[];
};

type NavGroup = {
  id: string;
  label: string;
  icon: IconType;
  href?: string;
  roles?: string[];
  children?: NavNode[];
};

const navGroups: NavGroup[] = [
  { id: "overview", href: "/", label: "Tổng quan", icon: LayoutDashboard },
  {
    id: "master",
    label: "Danh mục nền",
    icon: Database,
    children: [
      { id: "master-customers", href: "/danh-muc/khach-hang", label: "Khách hàng" },
      { id: "master-sites", href: "/danh-muc/cong-trinh", label: "Công trình" }
    ]
  },
  {
    id: "inventory-costing",
    label: "Kho & giá thành",
    icon: Package,
    children: [
      { id: "inventory-home", href: "/kho-gia-thanh", label: "Tổng quan kho & kỳ" },
      { id: "costing-advanced", href: "/gia-thanh-nang-cao", label: "Sản xuất & biên lợi nhuận" }
    ]
  },
  {
    id: "sales",
    label: "Điều hành kinh doanh",
    icon: BookOpen,
    children: [
      { id: "sales-home", href: "/kinh-doanh", label: "Tổng quan module" },
      {
        id: "sales-pricing",
        label: "Định giá & báo giá",
        children: [
          { id: "sales-price-books", href: "/kinh-doanh/bang-gia/danh-sach", label: "Bảng giá" },
          { id: "sales-price-rules", href: "/kinh-doanh/bang-gia/quy-tac", label: "Quy tắc giá" },
          { id: "sales-quotations", href: "/kinh-doanh/bao-gia", label: "Báo giá" }
        ]
      },
      {
        id: "sales-order-flow",
        label: "Đơn hàng & nhu cầu đổ",
        children: [
          { id: "sales-pour-requests", href: "/kinh-doanh/yeu-cau-do", label: "Yêu cầu đổ" },
          { id: "sales-orders", href: "/kinh-doanh/don-hang", label: "Đơn hàng" }
        ]
      }
    ]
  },
  {
    id: "dispatch",
    label: "Điều phối",
    icon: Truck,
    children: [
      { id: "dispatch-home", href: "/dieu-phoi", label: "Tổng quan module" },
      {
        id: "dispatch-planning",
        label: "Lập lịch điều phối",
        children: [
          { id: "dispatch-inbox", href: "/dieu-phoi/hop-cho", label: "Hộp chờ" },
          { id: "dispatch-board", href: "/dieu-phoi/bang-dieu-phoi", label: "Bảng điều phối" }
        ]
      },
      {
        id: "dispatch-station",
        label: "Hàng chờ trạm",
        children: [
          { id: "dispatch-queue", href: "/dieu-phoi/hang-cho-tram", label: "Danh sách chuyến chờ" },
          {
            id: "dispatch-station-capacity",
            href: "/dieu-phoi/hang-cho-tram/khung-nang-luc-tram",
            label: "Khung năng lực trạm"
          }
        ]
      },
      {
        id: "dispatch-performance",
        label: "Đối soát & KPI",
        children: [
          { id: "dispatch-reconciliation", href: "/dieu-phoi/doi-soat", label: "Đối soát" },
          { id: "dispatch-kpi", href: "/dieu-phoi/kpi", label: "KPI vận hành" }
        ]
      }
    ]
  },
  {
    id: "mobile",
    label: "Vận hành di động",
    icon: Smartphone,
    children: [
      { id: "mobile-driver", href: "/di-dong/tai-xe", label: "PWA tài xế" },
      { id: "mobile-pump", href: "/di-dong/doi-bom", label: "PWA đội bơm" }
    ]
  },
  {
    id: "admin",
    label: "Quản trị",
    icon: ShieldCheck,
    roles: ["SYS_ADMIN"],
    children: [
      { id: "admin-users", href: "/quan-tri/tai-khoan", label: "Tài khoản", roles: ["SYS_ADMIN"] },
      { id: "admin-roles", href: "/quan-tri/vai-tro", label: "Vai trò", roles: ["SYS_ADMIN"] },
      { id: "admin-permissions", href: "/quan-tri/quyen", label: "Quyền", roles: ["SYS_ADMIN"] },
      {
        id: "admin-role-permissions",
        href: "/quan-tri/phan-quyen-vai-tro",
        label: "Phân quyền vai trò",
        roles: ["SYS_ADMIN"]
      },
      {
        id: "admin-user-roles",
        href: "/quan-tri/gan-vai-tro-nguoi-dung",
        label: "Gán vai trò người dùng",
        roles: ["SYS_ADMIN"]
      }
    ]
  },
  { id: "import", href: "/nhap-du-lieu", label: "Nhập dữ liệu", icon: Upload },
  { id: "settings", href: "/cau-hinh-he-thong", label: "Cấu hình", icon: Settings }
];

function hasRoleAccess(itemRoles: string[] | undefined, userRoles: Set<string>): boolean {
  if (!itemRoles || itemRoles.length === 0) return true;
  return itemRoles.some((role) => userRoles.has(role));
}

function filterNavNodeByRole(node: NavNode, roles: Set<string>): NavNode | null {
  if (!hasRoleAccess(node.roles, roles)) return null;

  const visibleChildren = (node.children ?? [])
    .map((child) => filterNavNodeByRole(child, roles))
    .filter((child): child is NavNode => child !== null);

  if (!node.href && visibleChildren.length === 0) return null;

  return {
    ...node,
    children: visibleChildren
  };
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, refreshToken, user, clearAuth, setAuth } = useAuthStore();

  const [authChecking, setAuthChecking] = useState(Boolean(accessToken));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isLoginPage = pathname === "/login" || pathname === "/dang-nhap";

  function isPathActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function isNodeActive(node: NavNode): boolean {
    if (node.href && isPathActive(node.href)) return true;
    return (node.children ?? []).some((child) => isNodeActive(child));
  }

  function findActiveLabel(nodes: Array<NavNode | NavGroup>): string | null {
    for (const node of nodes) {
      const childLabel = findActiveLabel(node.children ?? []);
      if (childLabel) return childLabel;
      if (node.href && isPathActive(node.href)) return node.label;
    }
    return null;
  }

  function collectExpandedNodeIds(nodes: NavNode[], ids: Set<string>) {
    nodes.forEach((node) => {
      const children = node.children ?? [];
      if (children.length > 0) {
        if (children.some((child) => isNodeActive(child))) {
          ids.add(node.id);
        }
        collectExpandedNodeIds(children, ids);
      }
    });
  }

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

  const visibleNavGroups = useMemo(() => {
    const roles = new Set(user?.roles ?? []);

    return navGroups
      .map<NavGroup | null>((group) => {
        if (!hasRoleAccess(group.roles, roles)) return null;

        const visibleChildren = (group.children ?? [])
          .map((child) => filterNavNodeByRole(child, roles))
          .filter((child): child is NavNode => child !== null);

        if (!group.href && visibleChildren.length === 0) return null;

        return {
          ...group,
          children: visibleChildren
        };
      })
      .filter((group): group is NavGroup => group !== null);
  }, [user?.roles]);

  const activeLabel = useMemo(() => {
    const label = findActiveLabel(visibleNavGroups);
    return label ?? (pathname === "/" ? "Tổng quan" : pathname);
  }, [pathname, visibleNavGroups]);

  const defaultExpandedGroupIds = useMemo(() => {
    const ids = new Set<string>();
    visibleNavGroups.forEach((group) => {
      const children = group.children ?? [];
      if (children.some((child) => isNodeActive(child))) {
        ids.add(group.id);
      }
      collectExpandedNodeIds(children, ids);
    });
    return ids;
  }, [pathname, visibleNavGroups]);

  function isGroupExpanded(groupId: string): boolean {
    return openGroups[groupId] ?? defaultExpandedGroupIds.has(groupId);
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => {
      const currentValue = current[groupId] ?? defaultExpandedGroupIds.has(groupId);
      return { ...current, [groupId]: !currentValue };
    });
  }

  function renderNestedNode(node: NavNode, depth: number): React.ReactNode {
    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    const expanded = isGroupExpanded(node.id);
    const nodeActive = isNodeActive(node);
    const indentClass = depth === 1 ? "ml-6" : depth === 2 ? "ml-10" : "ml-14";
    const NodeIcon = node.icon;

    if (!hasChildren && node.href) {
      return (
        <Link
          key={node.id}
          className={cn(
            "ta-menu-subitem",
            indentClass,
            nodeActive ? "ta-menu-subitem-active" : "ta-menu-subitem-inactive"
          )}
          href={node.href}
          onClick={() => setSidebarOpen(false)}
        >
          {NodeIcon ? <NodeIcon className="h-4 w-4" /> : <Circle className="h-2.5 w-2.5" />}
          <span>{node.label}</span>
        </Link>
      );
    }

    return (
      <div key={node.id} className={cn("space-y-1", indentClass)}>
        <button
          className={cn(
            "ta-menu-subitem w-full justify-between",
            nodeActive ? "ta-menu-subitem-active" : "ta-menu-subitem-inactive"
          )}
          onClick={() => toggleGroup(node.id)}
          type="button"
        >
          <span className="flex items-center gap-2">
            {NodeIcon ? <NodeIcon className="h-4 w-4" /> : <Circle className="h-2.5 w-2.5" />}
            <span>{node.label}</span>
          </span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {expanded ? <div className="space-y-1">{children.map((child) => renderNestedNode(child, depth + 1))}</div> : null}
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gray-100">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col border-r border-gray-200 bg-white px-4 py-5 shadow-theme-md transition-transform duration-300 lg:translate-x-0 lg:shadow-none",
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
          {visibleNavGroups.map((group) => {
            const GroupIcon = group.icon;
            const children = group.children ?? [];
            const hasChildren = children.length > 0;
            const expanded = isGroupExpanded(group.id);
            const groupActive =
              (group.href ? isPathActive(group.href) : false) || children.some((child) => isNodeActive(child));

            if (!hasChildren && group.href) {
              return (
                <Link
                  key={group.id}
                  className={cn("ta-menu-item", groupActive ? "ta-menu-item-active" : "ta-menu-item-inactive")}
                  href={group.href}
                  onClick={() => setSidebarOpen(false)}
                >
                  <GroupIcon className="h-4 w-4" />
                  <span>{group.label}</span>
                </Link>
              );
            }

            return (
              <div key={group.id} className="space-y-1">
                <button
                  className={cn(
                    "ta-menu-item w-full justify-between",
                    groupActive ? "ta-menu-item-active" : "ta-menu-item-inactive"
                  )}
                  onClick={() => toggleGroup(group.id)}
                  type="button"
                >
                  <span className="flex items-center gap-3">
                    <GroupIcon className="h-4 w-4" />
                    <span>{group.label}</span>
                  </span>
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {expanded ? <div className="space-y-1">{children.map((child) => renderNestedNode(child, 1))}</div> : null}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto ta-card p-3">
          <p className="text-xs text-gray-500">Đang đăng nhập</p>
          <p className="mt-1 truncate text-sm font-medium text-gray-900">{user ? `${user.full_name} (${user.username})` : "Khách"}</p>
          {accessToken ? (
            <button className="ta-button mt-3 w-full" onClick={handleLogout} type="button">
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          ) : (
            <Link className="ta-button-primary mt-3 w-full" href="/dang-nhap">
              <LogIn className="h-4 w-4" />
              Đăng nhập
            </Link>
          )}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          aria-label="Đóng lớp phủ thanh bên"
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div className="min-h-screen lg:ml-[300px]">
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
              <input className="ta-input w-[320px] pl-9" placeholder="Tìm nhanh trong hệ thống..." />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 md:inline-flex">{activeLabel}</span>
            <LocaleSwitcher />
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
