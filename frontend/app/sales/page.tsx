import Link from "next/link";

const links = [
  { href: "/kinh-doanh/bang-gia", label: "Biên tập bảng giá" },
  { href: "/kinh-doanh/bao-gia", label: "Lập báo giá" },
  { href: "/kinh-doanh/yeu-cau-do", label: "Trình hướng dẫn yêu cầu đổ" },
  { href: "/kinh-doanh/don-hang", label: "Danh sách đơn bán / yêu cầu đổ" }
];

export default function SalesHomePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Không gian làm việc Kinh doanh - Giai đoạn 2</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="rounded border border-slate-200 bg-white p-4 hover:bg-slate-50">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
