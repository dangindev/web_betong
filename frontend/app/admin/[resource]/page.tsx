import Link from "next/link";

import { ResourcePage } from "@/components/resources/resource-page";

type AdminResourcePageProps = {
  params: Promise<{ resource: string }>;
};

const ACCOUNT_ADMIN_ROUTES = [
  { resource: "users", href: "/quan-tri/tai-khoan", label: "Tài khoản" },
  { resource: "roles", href: "/quan-tri/vai-tro", label: "Vai trò" },
  { resource: "permissions", href: "/quan-tri/quyen", label: "Quyền" },
  { resource: "role_permissions", href: "/quan-tri/phan-quyen-vai-tro", label: "Phân quyền vai trò" },
  { resource: "user_roles", href: "/quan-tri/gan-vai-tro-nguoi-dung", label: "Gán vai trò người dùng" },
] as const;

export default async function AdminResourcePage({ params }: AdminResourcePageProps) {
  const { resource } = await params;
  const showAccountTabs = ACCOUNT_ADMIN_ROUTES.some((item) => item.resource === resource);

  return (
    <div className="space-y-4">
      {showAccountTabs ? (
        <section className="ta-card p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">Quản trị tài khoản và phân quyền</p>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_ADMIN_ROUTES.map((item) => {
              const active = item.resource === resource;
              return (
                <Link
                  key={item.resource}
                  href={item.href}
                  className={
                    active
                      ? "inline-flex items-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700"
                      : "inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <ResourcePage resource={resource} />
    </div>
  );
}
