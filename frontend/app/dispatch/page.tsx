import Link from "next/link";

const links = [
  { href: "/dieu-phoi/hop-cho", label: "Hộp chờ điều phối" },
  { href: "/dieu-phoi/bang-dieu-phoi", label: "Bảng điều phối (Gantt MVP)" },
  { href: "/dieu-phoi/hang-cho-tram", label: "Bảng hàng chờ trạm" },
  { href: "/dieu-phoi/doi-soat", label: "Đối soát" },
  { href: "/dieu-phoi/kpi", label: "Bảng KPI" },
  { href: "/di-dong/tai-xe", label: "PWA tài xế" },
  { href: "/di-dong/doi-bom", label: "PWA đội bơm" }
];

export default function DispatchHomePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Không gian điều phối - Giai đoạn 3</h2>
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
