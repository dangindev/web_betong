"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  apiCreateAllocationRule,
  apiCreateCostPool,
  apiCreateMarginSnapshot,
  apiCreateProductionLog,
  apiCreateUnitCostSnapshot,
  apiListMarginSnapshots,
  apiListProductionLogs,
  apiListResource,
  apiListUnitCostSnapshots,
  apiRunAllocation
} from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value: unknown): string {
  const raw = toText(value);
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("vi-VN", { hour12: false });
}

export default function CostingPhase5Page() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [organizationId, setOrganizationId] = useState("");
  const [periods, setPeriods] = useState<GenericRow[]>([]);
  const [plants, setPlants] = useState<GenericRow[]>([]);
  const [costPools, setCostPools] = useState<GenericRow[]>([]);
  const [costObjects, setCostObjects] = useState<GenericRow[]>([]);
  const [allocationRules, setAllocationRules] = useState<GenericRow[]>([]);

  const [productionLogs, setProductionLogs] = useState<GenericRow[]>([]);
  const [unitCostSnapshots, setUnitCostSnapshots] = useState<GenericRow[]>([]);
  const [marginSnapshots, setMarginSnapshots] = useState<GenericRow[]>([]);

  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [productionLogType, setProductionLogType] = useState<"crushing" | "batching" | "production">("batching");
  const [productionPlantId, setProductionPlantId] = useState("");
  const [productionShiftDate, setProductionShiftDate] = useState("");
  const [productionOutputQty, setProductionOutputQty] = useState("0");
  const [productionRuntime, setProductionRuntime] = useState("0");
  const [productionElectricity, setProductionElectricity] = useState("0");

  const [poolCode, setPoolCode] = useState("");
  const [poolName, setPoolName] = useState("");
  const [poolType, setPoolType] = useState("overhead");
  const [poolAmount, setPoolAmount] = useState("0");

  const [rulePoolId, setRulePoolId] = useState("");
  const [ruleCostObjectId, setRuleCostObjectId] = useState("");
  const [ruleBasisType, setRuleBasisType] = useState<"manual_ratio" | "volume_m3" | "runtime_minutes">("manual_ratio");
  const [ruleRatio, setRuleRatio] = useState("1");

  const [unitCostVolume, setUnitCostVolume] = useState("");
  const [unitCostTotal, setUnitCostTotal] = useState("");

  const [marginSalesOrderId, setMarginSalesOrderId] = useState("");
  const [marginRevenue, setMarginRevenue] = useState("");
  const [marginCost, setMarginCost] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastAllocationRun, setLastAllocationRun] = useState<GenericRow | null>(null);

  async function loadReferenceData() {
    if (!accessToken) return;

    try {
      const [periodRes, plantRes, poolRes, objectRes, ruleRes] = await Promise.all([
        apiListResource<GenericRow>("cost_periods", accessToken, { skip: 0, limit: 200 }),
        apiListResource<GenericRow>("plants", accessToken, { skip: 0, limit: 200 }),
        apiListResource<GenericRow>("cost_pools", accessToken, { skip: 0, limit: 200 }),
        apiListResource<GenericRow>("cost_objects", accessToken, { skip: 0, limit: 200 }),
        apiListResource<GenericRow>("allocation_rules", accessToken, { skip: 0, limit: 300 })
      ]);

      setPeriods(periodRes.items);
      setPlants(plantRes.items);
      setCostPools(poolRes.items);
      setCostObjects(objectRes.items);
      setAllocationRules(ruleRes.items);

      const firstOrg = toText(
        periodRes.items[0]?.organization_id ??
          plantRes.items[0]?.organization_id ??
          poolRes.items[0]?.organization_id
      );
      if (!organizationId && firstOrg) setOrganizationId(firstOrg);

      const firstPeriod = toText(periodRes.items[0]?.id);
      if (!selectedPeriodId && firstPeriod) setSelectedPeriodId(firstPeriod);

      const firstPool = toText(poolRes.items[0]?.id);
      if (!rulePoolId && firstPool) setRulePoolId(firstPool);

      const firstObject = toText(objectRes.items[0]?.id);
      if (!ruleCostObjectId && firstObject) setRuleCostObjectId(firstObject);

      const firstPlant = toText(plantRes.items[0]?.id);
      if (!productionPlantId && firstPlant) setProductionPlantId(firstPlant);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu tham chiếu phase 5.");
    }
  }

  async function loadPhase5Data() {
    if (!accessToken || !organizationId) return;

    try {
      const [logsRes, unitRes, marginRes] = await Promise.all([
        apiListProductionLogs(organizationId, accessToken, {
          period_id: selectedPeriodId || undefined,
          skip: 0,
          limit: 200
        }),
        apiListUnitCostSnapshots(organizationId, accessToken, {
          period_id: selectedPeriodId || undefined,
          skip: 0,
          limit: 100
        }),
        apiListMarginSnapshots(organizationId, accessToken, {
          period_id: selectedPeriodId || undefined,
          skip: 0,
          limit: 100
        })
      ]);

      setProductionLogs(logsRes.items ?? []);
      setUnitCostSnapshots(unitRes.items ?? []);
      setMarginSnapshots(marginRes.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu phase 5.");
    }
  }

  useEffect(() => {
    void loadReferenceData();
  }, [accessToken]);

  useEffect(() => {
    void loadPhase5Data();
  }, [accessToken, organizationId, selectedPeriodId]);

  async function handleCreateProductionLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId || !selectedPeriodId) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await apiCreateProductionLog(
        {
          organization_id: organizationId,
          period_id: selectedPeriodId,
          plant_id: productionPlantId || undefined,
          shift_date: productionShiftDate || undefined,
          log_type: productionLogType,
          output_qty: toNumber(productionOutputQty),
          runtime_minutes: toNumber(productionRuntime),
          electricity_kwh: toNumber(productionElectricity),
          note: "Nhập từ màn hình phase 5"
        },
        accessToken
      );
      setMessage("Đã ghi nhận nhật ký sản xuất.");
      await loadPhase5Data();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ghi nhận nhật ký sản xuất thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId || !selectedPeriodId) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await apiCreateCostPool(
        {
          organization_id: organizationId,
          period_id: selectedPeriodId,
          pool_code: poolCode,
          pool_name: poolName,
          cost_type: poolType,
          amount: toNumber(poolAmount)
        },
        accessToken
      );
      setMessage("Đã tạo cost pool.");
      setPoolCode("");
      setPoolName("");
      await loadReferenceData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo cost pool thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId || !selectedPeriodId || !rulePoolId) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await apiCreateAllocationRule(
        {
          organization_id: organizationId,
          period_id: selectedPeriodId,
          pool_id: rulePoolId,
          cost_object_id: ruleCostObjectId || undefined,
          basis_type: ruleBasisType,
          ratio_value: ruleBasisType === "manual_ratio" ? toNumber(ruleRatio) : undefined,
          priority: 100
        },
        accessToken
      );
      setMessage("Đã tạo allocation rule.");
      await loadReferenceData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo allocation rule thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRunAllocation() {
    if (!accessToken || !organizationId || !selectedPeriodId) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRunAllocation(
        {
          organization_id: organizationId,
          period_id: selectedPeriodId,
          note: "Chạy phân bổ từ UI phase 5"
        },
        accessToken
      );
      setLastAllocationRun((response.allocation_run as GenericRow) ?? null);
      setMessage("Đã chạy allocation run phase 5.");
      await loadPhase5Data();
      await loadReferenceData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chạy allocation run thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateUnitCostSnapshot() {
    if (!accessToken || !organizationId || !selectedPeriodId) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await apiCreateUnitCostSnapshot(
        {
          organization_id: organizationId,
          period_id: selectedPeriodId,
          output_volume_m3: unitCostVolume ? toNumber(unitCostVolume) : undefined,
          total_cost: unitCostTotal ? toNumber(unitCostTotal) : undefined,
          note: "Snapshot unit cost từ UI phase 5"
        },
        accessToken
      );
      setMessage("Đã tạo unit cost snapshot.");
      await loadPhase5Data();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo unit cost snapshot thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMarginSnapshot() {
    if (!accessToken || !organizationId || !selectedPeriodId) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await apiCreateMarginSnapshot(
        {
          organization_id: organizationId,
          period_id: selectedPeriodId,
          sales_order_id: marginSalesOrderId || undefined,
          revenue_amount: marginRevenue ? toNumber(marginRevenue) : undefined,
          cost_amount: marginCost ? toNumber(marginCost) : undefined,
          note: "Snapshot biên lợi nhuận từ UI phase 5"
        },
        accessToken
      );
      setMessage("Đã tạo margin snapshot.");
      await loadPhase5Data();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo margin snapshot thất bại.");
    } finally {
      setBusy(false);
    }
  }

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để thao tác phase 5.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="ta-card p-4">
        <h1 className="text-2xl font-semibold text-gray-900">Phase 5 - Sản xuất, Giá thành & Biên lợi nhuận</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ghi nhận sản xuất, tạo cost pool/rule, chạy allocation và snapshot unit cost/margin.
        </p>
      </section>

      <section className="ta-card p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="period-select">
          Kỳ giá thành làm việc
        </label>
        <select id="period-select" className="ta-input" value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)}>
          <option value="">Chọn kỳ giá thành</option>
          {periods.map((item) => (
            <option key={toText(item.id)} value={toText(item.id)}>
              {toText(item.period_code)} - {toText(item.status)}
            </option>
          ))}
        </select>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <form className="ta-card space-y-3 p-4" onSubmit={handleCreateProductionLog}>
          <h2 className="text-lg font-semibold text-gray-900">Nhật ký sản xuất</h2>
          <select className="ta-input" value={productionLogType} onChange={(event) => setProductionLogType(event.target.value as typeof productionLogType)}>
            <option value="batching">Batching</option>
            <option value="crushing">Crushing</option>
            <option value="production">Production</option>
          </select>
          <select className="ta-input" value={productionPlantId} onChange={(event) => setProductionPlantId(event.target.value)}>
            <option value="">Chọn trạm</option>
            {plants.map((item) => (
              <option key={toText(item.id)} value={toText(item.id)}>
                {toText(item.code)} - {toText(item.name)}
              </option>
            ))}
          </select>
          <input className="ta-input" type="date" value={productionShiftDate} onChange={(event) => setProductionShiftDate(event.target.value)} />
          <input className="ta-input" placeholder="Sản lượng output (m3)" value={productionOutputQty} onChange={(event) => setProductionOutputQty(event.target.value)} />
          <input className="ta-input" placeholder="Runtime (phút)" value={productionRuntime} onChange={(event) => setProductionRuntime(event.target.value)} />
          <input className="ta-input" placeholder="Điện năng (kWh)" value={productionElectricity} onChange={(event) => setProductionElectricity(event.target.value)} />
          <button className="ta-button-primary" type="submit" disabled={busy || !selectedPeriodId}>
            Ghi nhận sản xuất
          </button>
        </form>

        <form className="ta-card space-y-3 p-4" onSubmit={handleCreatePool}>
          <h2 className="text-lg font-semibold text-gray-900">Cost pool</h2>
          <input className="ta-input" placeholder="Mã pool" value={poolCode} onChange={(event) => setPoolCode(event.target.value)} />
          <input className="ta-input" placeholder="Tên pool" value={poolName} onChange={(event) => setPoolName(event.target.value)} />
          <input className="ta-input" placeholder="Loại chi phí" value={poolType} onChange={(event) => setPoolType(event.target.value)} />
          <input className="ta-input" placeholder="Giá trị pool" value={poolAmount} onChange={(event) => setPoolAmount(event.target.value)} />
          <button className="ta-button-primary" type="submit" disabled={busy || !selectedPeriodId}>
            Tạo cost pool
          </button>
        </form>

        <form className="ta-card space-y-3 p-4" onSubmit={handleCreateRule}>
          <h2 className="text-lg font-semibold text-gray-900">Allocation rule</h2>
          <select className="ta-input" value={rulePoolId} onChange={(event) => setRulePoolId(event.target.value)}>
            <option value="">Chọn cost pool</option>
            {costPools.map((item) => (
              <option key={toText(item.id)} value={toText(item.id)}>
                {toText(item.pool_code)} - {toText(item.pool_name)}
              </option>
            ))}
          </select>
          <select className="ta-input" value={ruleCostObjectId} onChange={(event) => setRuleCostObjectId(event.target.value)}>
            <option value="">Không gán cost object</option>
            {costObjects.map((item) => (
              <option key={toText(item.id)} value={toText(item.id)}>
                {toText(item.code)} - {toText(item.name)}
              </option>
            ))}
          </select>
          <select className="ta-input" value={ruleBasisType} onChange={(event) => setRuleBasisType(event.target.value as typeof ruleBasisType)}>
            <option value="manual_ratio">manual_ratio</option>
            <option value="volume_m3">volume_m3</option>
            <option value="runtime_minutes">runtime_minutes</option>
          </select>
          {ruleBasisType === "manual_ratio" ? (
            <input className="ta-input" placeholder="Tỷ lệ manual" value={ruleRatio} onChange={(event) => setRuleRatio(event.target.value)} />
          ) : null}
          <button className="ta-button-primary" type="submit" disabled={busy || !selectedPeriodId || !rulePoolId}>
            Tạo rule
          </button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="ta-card space-y-3 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Run allocation</h2>
          <button className="ta-button-primary" type="button" disabled={busy || !selectedPeriodId} onClick={() => void handleRunAllocation()}>
            Chạy allocation
          </button>
          {lastAllocationRun ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
              <p>Mã run: {toText(lastAllocationRun.run_code)}</p>
              <p>Trạng thái: {toText(lastAllocationRun.status)}</p>
            </div>
          ) : null}
        </article>

        <article className="ta-card space-y-3 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Unit cost snapshot</h2>
          <input className="ta-input" placeholder="Output volume (m3, tuỳ chọn)" value={unitCostVolume} onChange={(event) => setUnitCostVolume(event.target.value)} />
          <input className="ta-input" placeholder="Total cost (tuỳ chọn)" value={unitCostTotal} onChange={(event) => setUnitCostTotal(event.target.value)} />
          <button className="ta-button-primary" type="button" disabled={busy || !selectedPeriodId} onClick={() => void handleCreateUnitCostSnapshot()}>
            Tạo unit cost snapshot
          </button>
        </article>

        <article className="ta-card space-y-3 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Margin snapshot</h2>
          <input className="ta-input" placeholder="Sales order id (tuỳ chọn)" value={marginSalesOrderId} onChange={(event) => setMarginSalesOrderId(event.target.value)} />
          <input className="ta-input" placeholder="Revenue (tuỳ chọn)" value={marginRevenue} onChange={(event) => setMarginRevenue(event.target.value)} />
          <input className="ta-input" placeholder="Cost (tuỳ chọn)" value={marginCost} onChange={(event) => setMarginCost(event.target.value)} />
          <button className="ta-button-primary" type="button" disabled={busy || !selectedPeriodId} onClick={() => void handleCreateMarginSnapshot()}>
            Tạo margin snapshot
          </button>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="ta-card p-4">
          <h3 className="mb-2 text-base font-semibold text-gray-900">Nhật ký sản xuất mới nhất</h3>
          <div className="space-y-2 text-sm">
            {productionLogs.slice(0, 8).map((item) => (
              <div key={toText(item.id)} className="rounded border border-gray-200 bg-gray-50 p-2">
                <p className="font-medium">{toText(item.log_type)} · {formatDate(item.shift_date)}</p>
                <p>Output: {toText(item.output_qty) || "0"} · Runtime: {toText(item.runtime_minutes) || "0"} phút</p>
              </div>
            ))}
            {productionLogs.length === 0 ? <p className="text-gray-500">Chưa có dữ liệu.</p> : null}
          </div>
        </article>

        <article className="ta-card p-4">
          <h3 className="mb-2 text-base font-semibold text-gray-900">Unit cost snapshots</h3>
          <div className="space-y-2 text-sm">
            {unitCostSnapshots.slice(0, 8).map((item) => (
              <div key={toText(item.id)} className="rounded border border-gray-200 bg-gray-50 p-2">
                <p className="font-medium">{toText(item.snapshot_code)}</p>
                <p>Unit cost: {toText(item.unit_cost)} · Volume: {toText(item.output_volume_m3)}</p>
              </div>
            ))}
            {unitCostSnapshots.length === 0 ? <p className="text-gray-500">Chưa có snapshot.</p> : null}
          </div>
        </article>

        <article className="ta-card p-4">
          <h3 className="mb-2 text-base font-semibold text-gray-900">Margin snapshots</h3>
          <div className="space-y-2 text-sm">
            {marginSnapshots.slice(0, 8).map((item) => (
              <div key={toText(item.id)} className="rounded border border-gray-200 bg-gray-50 p-2">
                <p className="font-medium">{toText(item.snapshot_code)}</p>
                <p>Doanh thu: {toText(item.revenue_amount)} · Giá vốn: {toText(item.cost_amount)}</p>
                <p>Biên lợi nhuận: {toText(item.margin_amount)} ({toText(item.margin_pct)}%)</p>
              </div>
            ))}
            {marginSnapshots.length === 0 ? <p className="text-gray-500">Chưa có snapshot.</p> : null}
          </div>
        </article>
      </section>

      <section className="ta-card p-4">
        <h2 className="text-base font-semibold text-gray-900">Tổng quan cấu hình phase 5 hiện tại</h2>
        <p className="mt-1 text-sm text-gray-600">
          Cost pool: {costPools.length} · Allocation rule: {allocationRules.length} · Kỳ làm việc: {selectedPeriodId || "chưa chọn"}
        </p>
      </section>

      <section className="text-sm">
        {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
