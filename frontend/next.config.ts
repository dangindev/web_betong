import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const internalApiBaseUrl = (process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' http: https: ws: wss:",
      "frame-ancestors 'none'"
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ];
  },
  async redirects() {
    return [
      { source: "/login", destination: "/dang-nhap", permanent: false },
      { source: "/guide", destination: "/huong-dan-su-dung", permanent: false },
      { source: "/master/customers", destination: "/danh-muc/khach-hang", permanent: false },
      { source: "/master/customers/:itemId", destination: "/danh-muc/khach-hang/:itemId", permanent: false },
      { source: "/master/business_units", destination: "/danh-muc/don-vi-kinh-doanh", permanent: false },
      { source: "/master/business_units/:itemId", destination: "/danh-muc/don-vi-kinh-doanh/:itemId", permanent: false },
      { source: "/master/project-sites", destination: "/danh-muc/cong-trinh", permanent: false },
      { source: "/master/project-sites/:itemId", destination: "/danh-muc/cong-trinh/:itemId", permanent: false },
      { source: "/inventory", destination: "/kho-gia-thanh", permanent: false },
      { source: "/costing", destination: "/gia-thanh-nang-cao", permanent: false },
      { source: "/sales", destination: "/kinh-doanh", permanent: false },
      { source: "/sales/orders", destination: "/kinh-doanh/don-hang", permanent: false },
      { source: "/sales/price-books", destination: "/kinh-doanh/bang-gia", permanent: false },
      { source: "/sales/price-books/books", destination: "/kinh-doanh/bang-gia/danh-sach", permanent: false },
      { source: "/sales/price-books/books/:itemId", destination: "/kinh-doanh/bang-gia/danh-sach/:itemId", permanent: false },
      { source: "/sales/price-books/rules", destination: "/kinh-doanh/bang-gia/quy-tac", permanent: false },
      { source: "/sales/price-books/rules/:itemId", destination: "/kinh-doanh/bang-gia/quy-tac/:itemId", permanent: false },
      { source: "/sales/quotations", destination: "/kinh-doanh/bao-gia", permanent: false },
      { source: "/sales/pour-requests", destination: "/kinh-doanh/yeu-cau-do", permanent: false },
      { source: "/dispatch", destination: "/dieu-phoi", permanent: false },
      { source: "/dispatch/inbox", destination: "/dieu-phoi/hop-cho", permanent: false },
      { source: "/dispatch/board", destination: "/dieu-phoi/bang-dieu-phoi", permanent: false },
      { source: "/dispatch/station-queue", destination: "/dieu-phoi/hang-cho-tram", permanent: false },
      {
        source: "/dispatch/station-queue/capacity",
        destination: "/dieu-phoi/hang-cho-tram/khung-nang-luc-tram",
        permanent: false
      },
      { source: "/dispatch/reconciliation", destination: "/dieu-phoi/doi-soat", permanent: false },
      { source: "/dispatch/kpi", destination: "/dieu-phoi/kpi", permanent: false },
      { source: "/mobile/driver", destination: "/di-dong/tai-xe", permanent: false },
      { source: "/mobile/pump", destination: "/di-dong/doi-bom", permanent: false },
      { source: "/admin/users", destination: "/quan-tri/tai-khoan", permanent: false },
      { source: "/admin/users/:itemId", destination: "/quan-tri/tai-khoan/:itemId", permanent: false },
      { source: "/admin/roles", destination: "/quan-tri/vai-tro", permanent: false },
      { source: "/admin/roles/:itemId", destination: "/quan-tri/vai-tro/:itemId", permanent: false },
      { source: "/admin/permissions", destination: "/quan-tri/quyen", permanent: false },
      { source: "/admin/permissions/:itemId", destination: "/quan-tri/quyen/:itemId", permanent: false },
      { source: "/admin/role_permissions", destination: "/quan-tri/phan-quyen-vai-tro", permanent: false },
      {
        source: "/admin/role_permissions/:itemId",
        destination: "/quan-tri/phan-quyen-vai-tro/:itemId",
        permanent: false
      },
      { source: "/admin/user_roles", destination: "/quan-tri/gan-vai-tro-nguoi-dung", permanent: false },
      {
        source: "/admin/user_roles/:itemId",
        destination: "/quan-tri/gan-vai-tro-nguoi-dung/:itemId",
        permanent: false
      },
      { source: "/import", destination: "/nhap-du-lieu", permanent: false },
      { source: "/settings", destination: "/cau-hinh-he-thong", permanent: false },
      { source: "/settings/:itemId", destination: "/cau-hinh-he-thong/:itemId", permanent: false }
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${internalApiBaseUrl}/api/:path*` },
      { source: "/healthz", destination: `${internalApiBaseUrl}/healthz` },
      { source: "/readyz", destination: `${internalApiBaseUrl}/readyz` },
      { source: "/dang-nhap", destination: "/login" },
      { source: "/huong-dan-su-dung", destination: "/guide" },
      { source: "/danh-muc/khach-hang/:itemId", destination: "/master/customers/:itemId" },
      { source: "/danh-muc/khach-hang", destination: "/master/customers" },
      { source: "/danh-muc/don-vi-kinh-doanh/:itemId", destination: "/master/business_units/:itemId" },
      { source: "/danh-muc/don-vi-kinh-doanh", destination: "/master/business_units" },
      { source: "/danh-muc/cong-trinh/:itemId", destination: "/master/project-sites/:itemId" },
      { source: "/danh-muc/cong-trinh", destination: "/master/project-sites" },
      { source: "/kho-gia-thanh", destination: "/inventory" },
      { source: "/gia-thanh-nang-cao", destination: "/costing" },
      { source: "/kinh-doanh", destination: "/sales" },
      { source: "/kinh-doanh/don-hang", destination: "/sales/orders" },
      { source: "/kinh-doanh/bang-gia/danh-sach/:itemId", destination: "/sales/price-books/books/:itemId" },
      { source: "/kinh-doanh/bang-gia/danh-sach", destination: "/sales/price-books/books" },
      { source: "/kinh-doanh/bang-gia/quy-tac/:itemId", destination: "/sales/price-books/rules/:itemId" },
      { source: "/kinh-doanh/bang-gia/quy-tac", destination: "/sales/price-books/rules" },
      { source: "/kinh-doanh/bang-gia", destination: "/sales/price-books" },
      { source: "/kinh-doanh/bao-gia", destination: "/sales/quotations" },
      { source: "/kinh-doanh/yeu-cau-do", destination: "/sales/pour-requests" },
      { source: "/dieu-phoi", destination: "/dispatch" },
      { source: "/dieu-phoi/hop-cho", destination: "/dispatch/inbox" },
      { source: "/dieu-phoi/bang-dieu-phoi", destination: "/dispatch/board" },
      { source: "/dieu-phoi/hang-cho-tram/khung-nang-luc-tram", destination: "/dispatch/station-queue/capacity" },
      { source: "/dieu-phoi/hang-cho-tram", destination: "/dispatch/station-queue" },
      { source: "/dieu-phoi/doi-soat", destination: "/dispatch/reconciliation" },
      { source: "/dieu-phoi/kpi", destination: "/dispatch/kpi" },
      { source: "/di-dong/tai-xe", destination: "/mobile/driver" },
      { source: "/di-dong/doi-bom", destination: "/mobile/pump" },
      { source: "/quan-tri/tai-khoan/:itemId", destination: "/admin/users/:itemId" },
      { source: "/quan-tri/tai-khoan", destination: "/admin/users" },
      { source: "/quan-tri/vai-tro/:itemId", destination: "/admin/roles/:itemId" },
      { source: "/quan-tri/vai-tro", destination: "/admin/roles" },
      { source: "/quan-tri/quyen/:itemId", destination: "/admin/permissions/:itemId" },
      { source: "/quan-tri/quyen", destination: "/admin/permissions" },
      { source: "/quan-tri/phan-quyen-vai-tro/:itemId", destination: "/admin/role_permissions/:itemId" },
      { source: "/quan-tri/phan-quyen-vai-tro", destination: "/admin/role_permissions" },
      { source: "/quan-tri/gan-vai-tro-nguoi-dung/:itemId", destination: "/admin/user_roles/:itemId" },
      { source: "/quan-tri/gan-vai-tro-nguoi-dung", destination: "/admin/user_roles" },
      { source: "/nhap-du-lieu", destination: "/import" },
      { source: "/cau-hinh-he-thong/:itemId", destination: "/settings/:itemId" },
      { source: "/cau-hinh-he-thong", destination: "/settings" }
    ];
  }
};

export default withNextIntl(nextConfig);
