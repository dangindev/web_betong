import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/login", destination: "/dang-nhap", permanent: false },
      { source: "/master/customers", destination: "/danh-muc/khach-hang", permanent: false },
      { source: "/master/project-sites", destination: "/danh-muc/cong-trinh", permanent: false },
      { source: "/inventory", destination: "/kho-gia-thanh", permanent: false },
      { source: "/sales", destination: "/kinh-doanh", permanent: false },
      { source: "/sales/orders", destination: "/kinh-doanh/don-hang", permanent: false },
      { source: "/sales/price-books", destination: "/kinh-doanh/bang-gia", permanent: false },
      { source: "/sales/quotations", destination: "/kinh-doanh/bao-gia", permanent: false },
      { source: "/sales/pour-requests", destination: "/kinh-doanh/yeu-cau-do", permanent: false },
      { source: "/dispatch", destination: "/dieu-phoi", permanent: false },
      { source: "/dispatch/inbox", destination: "/dieu-phoi/hop-cho", permanent: false },
      { source: "/dispatch/board", destination: "/dieu-phoi/bang-dieu-phoi", permanent: false },
      { source: "/dispatch/station-queue", destination: "/dieu-phoi/hang-cho-tram", permanent: false },
      { source: "/dispatch/reconciliation", destination: "/dieu-phoi/doi-soat", permanent: false },
      { source: "/dispatch/kpi", destination: "/dieu-phoi/kpi", permanent: false },
      { source: "/mobile/driver", destination: "/di-dong/tai-xe", permanent: false },
      { source: "/mobile/pump", destination: "/di-dong/doi-bom", permanent: false },
      { source: "/admin/users", destination: "/quan-tri/tai-khoan", permanent: false },
      { source: "/admin/roles", destination: "/quan-tri/vai-tro", permanent: false },
      { source: "/admin/permissions", destination: "/quan-tri/quyen", permanent: false },
      { source: "/admin/role_permissions", destination: "/quan-tri/phan-quyen-vai-tro", permanent: false },
      { source: "/admin/user_roles", destination: "/quan-tri/gan-vai-tro-nguoi-dung", permanent: false },
      { source: "/import", destination: "/nhap-du-lieu", permanent: false },
      { source: "/settings", destination: "/cau-hinh-he-thong", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/dang-nhap", destination: "/login" },
      { source: "/danh-muc/khach-hang", destination: "/master/customers" },
      { source: "/danh-muc/cong-trinh", destination: "/master/project-sites" },
      { source: "/kho-gia-thanh", destination: "/inventory" },
      { source: "/kinh-doanh", destination: "/sales" },
      { source: "/kinh-doanh/don-hang", destination: "/sales/orders" },
      { source: "/kinh-doanh/bang-gia", destination: "/sales/price-books" },
      { source: "/kinh-doanh/bao-gia", destination: "/sales/quotations" },
      { source: "/kinh-doanh/yeu-cau-do", destination: "/sales/pour-requests" },
      { source: "/dieu-phoi", destination: "/dispatch" },
      { source: "/dieu-phoi/hop-cho", destination: "/dispatch/inbox" },
      { source: "/dieu-phoi/bang-dieu-phoi", destination: "/dispatch/board" },
      { source: "/dieu-phoi/hang-cho-tram", destination: "/dispatch/station-queue" },
      { source: "/dieu-phoi/doi-soat", destination: "/dispatch/reconciliation" },
      { source: "/dieu-phoi/kpi", destination: "/dispatch/kpi" },
      { source: "/di-dong/tai-xe", destination: "/mobile/driver" },
      { source: "/di-dong/doi-bom", destination: "/mobile/pump" },
      { source: "/quan-tri/tai-khoan", destination: "/admin/users" },
      { source: "/quan-tri/vai-tro", destination: "/admin/roles" },
      { source: "/quan-tri/quyen", destination: "/admin/permissions" },
      { source: "/quan-tri/phan-quyen-vai-tro", destination: "/admin/role_permissions" },
      { source: "/quan-tri/gan-vai-tro-nguoi-dung", destination: "/admin/user_roles" },
      { source: "/nhap-du-lieu", destination: "/import" },
      { source: "/cau-hinh-he-thong", destination: "/settings" },
    ];
  },
};

export default withNextIntl(nextConfig);
