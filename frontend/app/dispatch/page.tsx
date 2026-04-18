import Link from "next/link";

const links = [
  { href: "/dispatch/inbox", label: "Dispatcher inbox" },
  { href: "/dispatch/board", label: "Dispatch board (Gantt MVP)" },
  { href: "/dispatch/station-queue", label: "Station queue board" },
  { href: "/dispatch/reconciliation", label: "Reconciliation" },
  { href: "/dispatch/kpi", label: "KPI dashboard" },
  { href: "/mobile/driver", label: "Driver mobile PWA" },
  { href: "/mobile/pump", label: "Pump crew mobile PWA" }
];

export default function DispatchHomePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Dispatch Phase 3 Workspace</h2>
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
