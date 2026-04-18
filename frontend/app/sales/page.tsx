import Link from "next/link";

const links = [
  { href: "/sales/price-books", label: "Price book editor" },
  { href: "/sales/quotations", label: "Quotation builder" },
  { href: "/sales/pour-requests", label: "Pour request wizard" },
  { href: "/sales/orders", label: "Sales order / pour request list" }
];

export default function SalesHomePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sales Phase 2 Workspace</h2>
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
