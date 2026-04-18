"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiListResource } from "@/lib/api/client";
import { getPourRequestWarnings } from "@/lib/sales/warnings";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export default function SalesOrdersPage() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [salesOrders, setSalesOrders] = useState<GenericRow[]>([]);
  const [pourRequests, setPourRequests] = useState<GenericRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    if (!accessToken) return;

    setLoading(true);
    setError("");
    try {
      const [ordersRes, requestsRes] = await Promise.all([
        apiListResource<GenericRow>("sales_orders", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("pour_requests", accessToken, { skip: 0, limit: 500 })
      ]);
      setSalesOrders(ordersRes.items);
      setPourRequests(requestsRes.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách sales/pour requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const filteredOrders = useMemo(() => {
    return salesOrders.filter((row) => {
      const statusOk = !statusFilter || valueText(row.status).toLowerCase().includes(statusFilter.toLowerCase());
      const customerOk = !customerFilter || valueText(row.customer_id).toLowerCase().includes(customerFilter.toLowerCase());
      const dateOk = !dateFilter || valueText(row.created_at).includes(dateFilter);
      return statusOk && customerOk && dateOk;
    });
  }, [customerFilter, dateFilter, salesOrders, statusFilter]);

  const filteredRequests = useMemo(() => {
    return pourRequests.filter((row) => {
      const statusOk = !statusFilter || valueText(row.status).toLowerCase().includes(statusFilter.toLowerCase());
      const customerOk = !customerFilter || valueText(row.customer_id).toLowerCase().includes(customerFilter.toLowerCase());
      const plantOk = !plantFilter || valueText(row.assigned_plant_id).toLowerCase().includes(plantFilter.toLowerCase());
      const dateOk = !dateFilter || valueText(row.requested_date).includes(dateFilter) || valueText(row.created_at).includes(dateFilter);
      return statusOk && customerOk && plantOk && dateOk;
    });
  }, [customerFilter, dateFilter, plantFilter, pourRequests, statusFilter]);

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để thao tác dữ liệu.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sales Orders & Pour Requests</h2>

      <div className="rounded border border-slate-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-5">
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="Filter customer_id" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="Filter plant_id" value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="Filter date (YYYY-MM-DD)" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          <Button type="button" variant="secondary" onClick={reload} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded border border-slate-200 bg-white p-3 space-y-2">
        <h3 className="font-semibold">Sales Orders ({filteredOrders.length})</h3>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">order_no</th>
                <th className="px-3 py-2 text-left">customer_id</th>
                <th className="px-3 py-2 text-left">site_id</th>
                <th className="px-3 py-2 text-left">status</th>
                <th className="px-3 py-2 text-left">created_at</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((row) => (
                <tr key={valueText(row.id)} className="border-b border-slate-100">
                  <td className="px-3 py-2">{valueText(row.order_no)}</td>
                  <td className="px-3 py-2">{valueText(row.customer_id)}</td>
                  <td className="px-3 py-2">{valueText(row.site_id)}</td>
                  <td className="px-3 py-2">{valueText(row.status)}</td>
                  <td className="px-3 py-2">{valueText(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 space-y-2">
        <h3 className="font-semibold">Pour Requests ({filteredRequests.length})</h3>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">request_no</th>
                <th className="px-3 py-2 text-left">customer_id</th>
                <th className="px-3 py-2 text-left">assigned_plant_id</th>
                <th className="px-3 py-2 text-left">requested_date</th>
                <th className="px-3 py-2 text-left">status</th>
                <th className="px-3 py-2 text-left">Data Warnings</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((row) => {
                const warnings = getPourRequestWarnings({
                  assigned_plant_id: valueText(row.assigned_plant_id) || null,
                  requested_start_at: valueText(row.requested_start_at) || null,
                  requested_end_at: valueText(row.requested_end_at) || null,
                  site_contact_name: valueText(row.site_contact_name) || null,
                  site_contact_phone: valueText(row.site_contact_phone) || null,
                  requested_volume_m3: Number(valueText(row.requested_volume_m3) || "0")
                });

                return (
                  <tr key={valueText(row.id)} className="border-b border-slate-100">
                    <td className="px-3 py-2">{valueText(row.request_no)}</td>
                    <td className="px-3 py-2">{valueText(row.customer_id)}</td>
                    <td className="px-3 py-2">{valueText(row.assigned_plant_id)}</td>
                    <td className="px-3 py-2">{valueText(row.requested_date)}</td>
                    <td className="px-3 py-2">{valueText(row.status)}</td>
                    <td className="px-3 py-2">
                      {warnings.length === 0 ? (
                        <span className="inline-flex rounded bg-green-100 px-2 py-1 text-xs text-green-700">Ready</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {warnings.map((warning) => (
                            <span key={warning} className="inline-flex rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                              {warning}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
