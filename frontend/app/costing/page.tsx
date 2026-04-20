"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  apiCostPeriodAction,
  apiCostPeriodPrecloseChecklist,
  apiCreateAllocationRule,
  apiCreateCostPool,
  apiCreateMarginSnapshot,
  apiCreateProductionLog,
  apiCreateUnitCostSnapshot,
  apiListMarginSnapshots,
  apiListProductionLogs,
  apiListResource,
  apiListUnitCostSnapshots,
  apiRunAllocation,
  apiUnitCostVariancePreview
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

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = toText(value).toLowerCase();
  return normalized === "true" || normalized === "1";
}

function formatDate(value: unknown): string {
  const raw = toText(value);
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("vi-VN", { hour12: false });
}

function formatNumber(value: unknown, digits = 2): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return parsed.toLocaleString("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  });
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
  const [precloseChecklist, setPrecloseChecklist] = useState<GenericRow | null>(null);
  const [variancePreview, setVariancePreview] = useState<GenericRow | null>(null);
  const [workflowNote, setWorkflowNote] = useState("");

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

  const selectedPeriod = periods.find((item) => toText(item.id) === selectedPeriodId) ?? null;
  const selectedPeriodStatus = toText(selectedPeriod?.status).toLowerCase();

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

  async function loadCloseWorkflowData() {
    if (!accessToken || !organizationId || !selectedPeriodId) {
      setPrecloseChecklist(null);
      setVariancePreview(null);
      return;
    }

    try {
      const [checklistRes, varianceRes] = await Promise.all([
        apiCostPeriodPrecloseChecklist(selectedPeriodId, organizationId, accessToken),
        apiUnitCostVariancePreview(organizationId, selectedPeriodId, accessToken)
      ]);

      setPrecloseChecklist((checklistRes.checklist as GenericRow) ?? null);
      setVariancePreview(varianceRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu wizard chốt kỳ.");
    }
  }

  useEffect(() => {
    void loadReferenceData();
  }, [accessToken]);

  useEffect(() => {
    void loadPhase5Data();
  }, [accessToken, organizationId, selectedPeriodId]);

  useEffect(() => {
    void loadCloseWorkflowData();
  }, [accessToken, organizationId, selectedPeriodId]);

  async function handleCostPeriodAction(action: "open" | "close" | "reopen") {
    if (!accessToken || !organizationId || !selectedPeriodId) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiCostPeriodAction(
        selectedPeriodId,
        action,
        {
          organization_id: organizationId,
          note: workflowNote || undefined
        },
        accessToken
      );

      if (action === "close") {
        const run = (response.allocation_run as GenericRow | undefined) ?? null;
        const snapshot = (response.unit_cost_snapshot as GenericRow | undefined) ?? null;
        const runCode = toText(run?.run_code);
        const snapshotCode = toText(snapshot?.snapshot_code);
        if (runCode || snapshotCode) {
          setMessage(
            `Đã chốt kỳ và tự động chạy phân bổ${runCode ? ` (${runCode})` : ""}${snapshotCode ? `, khóa snapshot ${snapshotCode}` : ""}.`
          );
        } else {
          setMessage("Đã chốt kỳ giá thành.");
        }
      } else if (action === "open") {
        setMessage("Đã mở kỳ giá thành.");
      } else {
        setMessage("Đã mở lại kỳ giá thành.");
      }

      await loadReferenceData();
      await loadPhase5Data();
      await loadCloseWorkflowData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác kỳ giá thành thất bại.");
    } finally {
      setBusy(false);
    }
  }

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
      await loadCloseWorkflowData();
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
      await loadCloseWorkflowData();
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
      await loadCloseWorkflowData();
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
      await loadCloseWorkflowData();
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
      await loadCloseWorkflowData();
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

  const currentSnapshot = (variancePreview?.current_snapshot as GenericRow | undefined) ?? null;
  const previousSnapshot = (variancePreview?.previous_snapshot as GenericRow | undefined) ?? null;
  const previousPeriod = (variancePreview?.previous_period as GenericRow | undefined) ?? null;
  const variance = (variancePreview?.variance as GenericRow | undefined) ?? null;

  return (
    <div className="space-y-6">
      <section className="ta-card p-4">
        <h1 className="text-2xl font-semibold text-gray-900">Phase 5 - Sản xuất, Giá thành & Biên lợi nhuận</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ghi nhận sản xuất, tạo cost pool/rule, chạy allocation, snapshot đơn giá/biên lợi nhuận và chốt kỳ giá thành.
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

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="ta-card space-y-3 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Wizard chốt kỳ giá thành</h2>
          <p className="text-sm text-gray-600">
            Trạng thái hiện tại: <span className="font-medium">{toText(selectedPeriod?.status) || "chưa chọn kỳ"}</span>
          </p>
          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p>Bút toán kho trong kỳ: {formatNumber(precloseChecklist?.inventory_entries_in_period, 0)}</p>
            <p>Bút toán thiếu liên kết kỳ: {formatNumber(precloseChecklist?.entries_missing_period_link, 0)}</p>
            <p>Phiếu kiểm kê trong kỳ: {formatNumber(precloseChecklist?.stock_take_records_in_period, 0)}</p>
            <p>Phiếu kiểm kê chưa chốt: {formatNumber(precloseChecklist?.stock_take_pending, 0)}</p>
            <p className="mt-1 font-medium">Sẵn sàng chốt kỳ: {toBool(precloseChecklist?.ready_to_close) ? "Đạt" : "Chưa đạt"}</p>
          </div>
          <textarea
            className="ta-input min-h-20"
            placeholder="Ghi chú thao tác kỳ (tuỳ chọn)"
            value={workflowNote}
            onChange={(event) => setWorkflowNote(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="ta-button"
              type="button"
              disabled={busy || !selectedPeriodId || !(selectedPeriodStatus === "draft" || selectedPeriodStatus === "reopened")}
              onClick={() => void handleCostPeriodAction("open")}
            >
              Mở kỳ
            </button>
            <button
              className="ta-button-primary"
              type="button"
              disabled={busy || !selectedPeriodId || selectedPeriodStatus !== "open" || !toBool(precloseChecklist?.ready_to_close)}
              onClick={() => void handleCostPeriodAction("close")}
            >
              Chốt kỳ (tự chạy allocation + snapshot)
            </button>
            <button
              className="ta-button"
              type="button"
              disabled={busy || !selectedPeriodId || selectedPeriodStatus !== "closed"}
              onClick={() => void handleCostPeriodAction("reopen")}
            >
              Mở lại kỳ
            </button>
          </div>
        </article>

        <article className="ta-card space-y-3 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Preview đơn giá & variance kỳ trước</h2>
          <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p className="font-medium">Kỳ hiện tại</p>
            <p>Snapshot: {toText(currentSnapshot?.snapshot_code) || "-"}</p>
            <p>Đơn giá: {formatNumber(currentSnapshot?.unit_cost)} / m3</p>
            <p>Tổng chi phí: {formatNumber(currentSnapshot?.total_cost)}</p>
          </div>
          <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p className="font-medium">Kỳ trước ({toText(previousPeriod?.period_code) || "chưa có"})</p>
            <p>Snapshot: {toText(previousSnapshot?.snapshot_code) || "-"}</p>
            <p>Đơn giá: {formatNumber(previousSnapshot?.unit_cost)} / m3</p>
            <p>Tổng chi phí: {formatNumber(previousSnapshot?.total_cost)}</p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
            <p>
              Chênh lệch đơn giá: <span className="font-medium">{formatNumber(variance?.amount)}</span>
            </p>
            <p>
              Tỷ lệ chênh lệch: <span className="font-medium">{formatNumber(variance?.pct, 3)}%</span>
            </p>
            <p>Xu hướng: {toText(variance?.direction) || "n/a"}</p>
          </div>
        </article>
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
          <h2 className="text-lg font-semibold text-gray-900">Chạy phân bổ chi phí</h2>
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
          <h2 className="text-lg font-semibold text-gray-900">Snapshot đơn giá</h2>
          <input className="ta-input" placeholder="Output volume (m3, tuỳ chọn)" value={unitCostVolume} onChange={(event) => setUnitCostVolume(event.target.value)} />
          <input className="ta-input" placeholder="Total cost (tuỳ chọn)" value={unitCostTotal} onChange={(event) => setUnitCostTotal(event.target.value)} />
          <button className="ta-button-primary" type="button" disabled={busy || !selectedPeriodId} onClick={() => void handleCreateUnitCostSnapshot()}>
            Tạo unit cost snapshot
          </button>
        </article>

        <article className="ta-card space-y-3 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Snapshot biên lợi nhuận</h2>
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
                <p>Unit cost: {toText(item.unit_cost)} · Volume: {toText(item.output_volume_m3)} · Trạng thái: {toText(item.status)}</p>
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
