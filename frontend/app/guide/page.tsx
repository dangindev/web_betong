"use client";

import { BookOpenText, Database, Route, Settings2, Workflow } from "lucide-react";

type FlowStep = {
  title: string;
  description: string;
};

const businessFlow: FlowStep[] = [
  {
    title: "1) Chuẩn hóa danh mục nền",
    description:
      "Khai báo tổ chức, đơn vị kinh doanh, khách hàng, công trình, trạm, xe, cần bơm, vật tư, sản phẩm bê tông để làm dữ liệu tham chiếu cho toàn hệ thống."
  },
  {
    title: "2) Kinh doanh tạo nhu cầu",
    description:
      "Lập bảng giá và quy tắc giá, sau đó tạo báo giá, đơn hàng và yêu cầu đổ theo từng công trình để chuyển qua điều phối."
  },
  {
    title: "3) Điều phối lập lịch và giám sát",
    description:
      "Tạo lệnh điều phối, quản lý hàng chờ trạm, theo dõi bảng điều phối theo thời gian thực và xử lý các điều chỉnh thủ công nếu phát sinh."
  },
  {
    title: "4) Đối soát và KPI vận hành",
    description:
      "Chốt khối lượng/chuyến thực tế, ghi nhận nguyên nhân chênh lệch, tạo snapshot KPI ngày để đánh giá chất lượng vận hành."
  },
  {
    title: "5) Kho và giá thành",
    description:
      "Ghi nhận nhập/xuất/chuyển kho, quản lý kỳ giá thành, chạy phân bổ chi phí và theo dõi báo cáo biên lợi nhuận."
  }
];

const moduleGuides = [
  {
    title: "Điều hành kinh doanh",
    items: [
      "Bảng giá: tạo chính sách giá theo thời gian hiệu lực và độ ưu tiên.",
      "Quy tắc giá: khai báo điều kiện, công thức, phụ phí, chiết khấu theo ngữ cảnh đơn hàng.",
      "Báo giá: dựng phương án thương mại cho khách hàng/công trình.",
      "Đơn hàng + yêu cầu đổ: phát sinh nhu cầu sản xuất và đầu vào cho điều phối."
    ]
  },
  {
    title: "Điều phối",
    items: [
      "Hộp chờ: tập trung yêu cầu đổ mới.",
      "Bảng điều phối: gán trạm, xe, cần bơm; theo dõi tiến độ từng chuyến.",
      "Hàng chờ trạm + khung năng lực: kiểm soát tải trạm và tắc nghẽn.",
      "Đối soát + KPI: chốt thực tế và theo dõi hiệu suất ngày/ca."
    ]
  },
  {
    title: "Kho & giá thành",
    items: [
      "Quản lý vật tư/kho, phiếu nhập xuất, kiểm kê và điều chỉnh tồn.",
      "Quản lý kỳ giá thành, trung tâm chi phí, đối tượng chi phí.",
      "Theo dõi báo cáo BI chi phí và biên lợi nhuận."
    ]
  },
  {
    title: "Quản trị hệ thống",
    items: [
      "Quản lý tài khoản, vai trò, quyền và gán vai trò người dùng.",
      "Quản lý cấu hình hệ thống và thông số scheduler mặc định.",
      "Nhập dữ liệu hàng loạt bằng file CSV và kiểm tra lỗi theo dòng."
    ]
  }
];

const dataModelNotes = [
  "Khối khách hàng/công trình: customers, project_sites, customer_contacts.",
  "Khối thương mại: price_books, price_rules, quotations, quotation_items, sales_orders, pour_requests.",
  "Khối điều phối: dispatch_orders, scheduled_trips, schedule_runs, schedule_conflicts, trips, trip_events, pump_sessions, reconciliation_records, daily_kpi_snapshots.",
  "Khối kho/giá thành: warehouses, inventory_ledger_entries, inventory_stock_takes, cost_centers, cost_objects, cost_periods.",
  "Khối quản trị: users, roles, permissions, user_roles, role_permissions, system_settings."
];

const apiHighlights = [
  {
    group: "Auth & User",
    endpoints: ["POST /api/v1/auth/login", "POST /api/v1/auth/refresh", "GET /api/v1/auth/me"]
  },
  {
    group: "CRUD tài nguyên",
    endpoints: [
      "GET /api/v1/resources/{resource}",
      "POST /api/v1/resources/{resource}",
      "PATCH /api/v1/resources/{resource}/{id}",
      "DELETE /api/v1/resources/{resource}/{id}"
    ]
  },
  {
    group: "Định giá",
    endpoints: ["POST /api/v1/pricing/preview", "POST /api/v1/pricing/snapshots"]
  },
  {
    group: "Điều phối",
    endpoints: [
      "POST /api/v1/dispatch/schedule-runs",
      "GET /api/v1/dispatch/scheduler-kpi-compare",
      "POST /api/v1/dispatch/reconciliation/{pour_request_id}",
      "POST /api/v1/dispatch/kpi/snapshot"
    ]
  },
  {
    group: "Kho & giá thành",
    endpoints: [
      "POST /api/v1/inventory/movements",
      "POST /api/v1/inventory/stock-takes",
      "POST /api/v1/costing/periods",
      "POST /api/v1/costing/close-period"
    ]
  }
];

export default function GuidePage() {
  return (
    <div className="space-y-6">
      <section className="ta-card p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <BookOpenText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Hướng dẫn sử dụng hệ thống BetonFlow</h1>
            <p className="mt-1 text-sm text-slate-600">
              Tài liệu thao tác tổng hợp cho Kinh doanh, Điều phối, Kho &amp; Giá thành, Quản trị hệ thống và vận hành dữ liệu.
            </p>
          </div>
        </div>
      </section>

      <section className="ta-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-brand-600" />
          <h2 className="text-lg font-semibold text-slate-900">Luồng nghiệp vụ tổng thể</h2>
        </div>
        <div className="space-y-3">
          {businessFlow.map((step) => (
            <article key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="ta-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Route className="h-4 w-4 text-violet-600" />
            <h2 className="text-lg font-semibold text-slate-900">Hướng dẫn theo phân hệ</h2>
          </div>
          <div className="space-y-4">
            {moduleGuides.map((module) => (
              <div key={module.title}>
                <h3 className="text-sm font-semibold text-slate-800">{module.title}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {module.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <article className="ta-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Thiết kế dữ liệu cốt lõi</h2>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            {dataModelNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Khuyến nghị: mọi dữ liệu nghiệp vụ nên có `organization_id`, `status`, dấu vết `created_at/updated_at` để đồng bộ kiểm soát phân quyền và truy vết.
          </p>
        </article>
      </section>

      <section className="ta-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-900">API thường dùng theo nghiệp vụ</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apiHighlights.map((entry) => (
            <article key={entry.group} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-800">{entry.group}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                {entry.endpoints.map((endpoint) => (
                  <li key={endpoint} className="break-all">
                    {endpoint}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
