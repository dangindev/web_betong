"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  apiCostPeriodAction,
  apiCostPeriodPrecloseChecklist,
  apiCreateCostPeriod,
  apiCreateResource,
  apiInventoryBalances,
  apiInventoryImportReceipts,
  apiInventoryMovement,
  apiInventorySnapshotUrl,
  apiInventoryStockTake,
  apiListResource
} from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type GenericRow = Record<string, unknown>;

type CostCenterNode = {
  center: GenericRow;
  children: CostCenterNode[];
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  receipt: "Nhập kho",
  issue: "Xuất kho",
  transfer: "Điều chuyển",
  transfer_out: "Chuyển ra",
  transfer_in: "Nhận chuyển",
  adjustment: "Điều chỉnh",
  adjustment_gain: "Điều chỉnh tăng",
  adjustment_loss: "Điều chỉnh giảm",
  waste: "Hao hụt",
  stock_take_gain: "Kiểm kê tăng",
  stock_take_loss: "Kiểm kê giảm"
};

function toNumber(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function formatPeriodStatus(value: unknown): string {
  const status = toText(value).toLowerCase();
  if (status === "draft") return "nháp";
  if (status === "open") return "đang mở";
  if (status === "closed") return "đã đóng";
  return status || "-";
}

function formatDateTime(value: unknown): string {
  const raw = toText(value);
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("vi-VN", { hour12: false });
}

function formatDateOnly(value: unknown): string {
  const raw = toText(value);
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("vi-VN");
}

function formatQuantity(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return toText(value) || "-";
  return parsed.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function getMonthInputValue(baseDate: Date): string {
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function resolveMonthRange(monthValue: string): { start: Date; end: Date } {
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
    };
  }
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0)
  };
}

function overlapsSelectedMonth(startDateRaw: unknown, endDateRaw: unknown, monthValue: string): boolean {
  const { start: monthStart, end: monthEnd } = resolveMonthRange(monthValue);
  const periodStart = new Date(toText(startDateRaw));
  const periodEnd = new Date(toText(endDateRaw));
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return false;
  }
  return periodStart <= monthEnd && periodEnd >= monthStart;
}

function buildCostCenterTree(rows: GenericRow[]): CostCenterNode[] {
  const nodeById = new Map<string, CostCenterNode>();

  rows.forEach((item) => {
    const id = toText(item.id);
    if (!id) return;
    nodeById.set(id, { center: item, children: [] });
  });

  const roots: CostCenterNode[] = [];

  nodeById.forEach((node, id) => {
    const parentId = toText(node.center.parent_id);
    if (parentId && parentId !== id) {
      const parentNode = nodeById.get(parentId);
      if (parentNode) {
        parentNode.children.push(node);
        return;
      }
    }
    roots.push(node);
  });

  const sortNodes = (nodes: CostCenterNode[]) => {
    nodes.sort((a, b) => {
      const codeA = toText(a.center.code);
      const codeB = toText(b.center.code);
      if (codeA && codeB) return codeA.localeCompare(codeB, "vi");
      const nameA = toText(a.center.name);
      const nameB = toText(b.center.name);
      return nameA.localeCompare(nameB, "vi");
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function getBalanceKey(row: GenericRow): string {
  return `${toText(row.warehouse_id)}__${toText(row.material_id)}`;
}

export default function InventoryPage() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [organizationId, setOrganizationId] = useState("");

  const [warehouses, setWarehouses] = useState<GenericRow[]>([]);
  const [materials, setMaterials] = useState<GenericRow[]>([]);
  const [costCenters, setCostCenters] = useState<GenericRow[]>([]);
  const [costObjects, setCostObjects] = useState<GenericRow[]>([]);
  const [periods, setPeriods] = useState<GenericRow[]>([]);
  const [balances, setBalances] = useState<GenericRow[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<GenericRow[]>([]);

  const [movementType, setMovementType] = useState<"receipt" | "issue" | "transfer" | "adjustment" | "waste">("receipt");
  const [warehouseId, setWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [quantityDelta, setQuantityDelta] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [referenceNo, setReferenceNo] = useState("");
  const [movementNote, setMovementNote] = useState("");

  const [stockTakeWarehouseId, setStockTakeWarehouseId] = useState("");
  const [stockTakeMaterialId, setStockTakeMaterialId] = useState("");
  const [countedQty, setCountedQty] = useState("0");
  const [stockTakeNote, setStockTakeNote] = useState("");

  const [newWarehouseCode, setNewWarehouseCode] = useState("");
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehousePlantId, setNewWarehousePlantId] = useState("");

  const [newCenterCode, setNewCenterCode] = useState("");
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterParentId, setNewCenterParentId] = useState("");
  const [newObjectCode, setNewObjectCode] = useState("");
  const [newObjectName, setNewObjectName] = useState("");
  const [newObjectCenterId, setNewObjectCenterId] = useState("");

  const [periodCode, setPeriodCode] = useState("");
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(getMonthInputValue(new Date()));

  const [selectedBalanceKey, setSelectedBalanceKey] = useState("");

  const [importFile, setImportFile] = useState<File | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [precloseResult, setPrecloseResult] = useState<Record<string, unknown> | null>(null);

  const periodById = useMemo(
    () =>
      periods.reduce<Record<string, GenericRow>>((acc, item) => {
        const id = toText(item.id);
        if (id) acc[id] = item;
        return acc;
      }, {}),
    [periods]
  );

  const warehouseById = useMemo(
    () =>
      warehouses.reduce<Record<string, GenericRow>>((acc, item) => {
        const id = toText(item.id);
        if (id) acc[id] = item;
        return acc;
      }, {}),
    [warehouses]
  );

  const materialById = useMemo(
    () =>
      materials.reduce<Record<string, GenericRow>>((acc, item) => {
        const id = toText(item.id);
        if (id) acc[id] = item;
        return acc;
      }, {}),
    [materials]
  );

  const costCenterById = useMemo(
    () =>
      costCenters.reduce<Record<string, GenericRow>>((acc, item) => {
        const id = toText(item.id);
        if (id) acc[id] = item;
        return acc;
      }, {}),
    [costCenters]
  );

  const costCenterTree = useMemo(() => buildCostCenterTree(costCenters), [costCenters]);

  const costObjectsGroupedByCenter = useMemo(() => {
    const grouped = costObjects.reduce<Record<string, GenericRow[]>>((acc, item) => {
      const key = toText(item.cost_center_id) || "__khong_gan";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    Object.values(grouped).forEach((items) => {
      items.sort((a, b) => {
        const codeA = toText(a.code);
        const codeB = toText(b.code);
        if (codeA && codeB) return codeA.localeCompare(codeB, "vi");
        return toText(a.name).localeCompare(toText(b.name), "vi");
      });
    });

    return grouped;
  }, [costObjects]);

  const filteredCalendarPeriods = useMemo(() => {
    return periods
      .filter((item) => overlapsSelectedMonth(item.start_date, item.end_date, calendarMonth))
      .sort((a, b) => toText(a.start_date).localeCompare(toText(b.start_date), "vi"));
  }, [calendarMonth, periods]);

  const selectedBalanceRow = useMemo(
    () => balances.find((item) => getBalanceKey(item) === selectedBalanceKey) ?? null,
    [balances, selectedBalanceKey]
  );

  const selectedWarehouseId = toText(selectedBalanceRow?.warehouse_id);
  const selectedMaterialId = toText(selectedBalanceRow?.material_id);

  const selectedDrilldownEntries = useMemo(() => {
    if (!selectedWarehouseId || !selectedMaterialId) return [];

    return ledgerEntries
      .filter((item) => {
        const sameOrg = organizationId ? toText(item.organization_id) === organizationId : true;
        return (
          sameOrg &&
          toText(item.warehouse_id) === selectedWarehouseId &&
          toText(item.material_id) === selectedMaterialId
        );
      })
      .sort((a, b) => toText(b.transaction_at).localeCompare(toText(a.transaction_at), "vi"))
      .slice(0, 150);
  }, [ledgerEntries, organizationId, selectedMaterialId, selectedWarehouseId]);

  const selectedCenterLevel = useMemo(() => {
    if (!newCenterParentId) return 1;
    const parentLevel = Number(costCenterById[newCenterParentId]?.level_no ?? 0);
    return Number.isFinite(parentLevel) && parentLevel > 0 ? parentLevel + 1 : 2;
  }, [costCenterById, newCenterParentId]);

  async function loadAll() {
    if (!accessToken) return;
    setError(null);

    try {
      const [warehouseRes, materialRes, centerRes, objectRes, periodRes] = await Promise.all([
        apiListResource<GenericRow>("warehouses", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("materials", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("cost_centers", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("cost_objects", accessToken, { skip: 0, limit: 500 }),
        apiListResource<GenericRow>("cost_periods", accessToken, { skip: 0, limit: 500 })
      ]);

      setWarehouses(warehouseRes.items);
      setMaterials(materialRes.items);
      setCostCenters(centerRes.items);
      setCostObjects(objectRes.items);
      setPeriods(periodRes.items);

      const firstOrg = toText(
        warehouseRes.items[0]?.organization_id ??
          materialRes.items[0]?.organization_id ??
          centerRes.items[0]?.organization_id ??
          periodRes.items[0]?.organization_id
      );
      if (!organizationId && firstOrg) {
        setOrganizationId(firstOrg);
      }

      const firstWarehouseId = toText(warehouseRes.items[0]?.id);
      const firstMaterialId = toText(materialRes.items[0]?.id);
      const firstPeriodId = toText(periodRes.items[0]?.id);

      if (!warehouseId && firstWarehouseId) setWarehouseId(firstWarehouseId);
      if (!stockTakeWarehouseId && firstWarehouseId) setStockTakeWarehouseId(firstWarehouseId);
      if (!materialId && firstMaterialId) setMaterialId(firstMaterialId);
      if (!stockTakeMaterialId && firstMaterialId) setStockTakeMaterialId(firstMaterialId);
      if (!selectedPeriodId && firstPeriodId) setSelectedPeriodId(firstPeriodId);

      if (!newObjectCenterId && centerRes.items[0]?.id) {
        setNewObjectCenterId(toText(centerRes.items[0].id));
      }

      if (!organizationId && firstOrg) {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        setPeriodCode(`KY-${yearMonth}`);
        const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const lastDayText = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
        setPeriodStartDate(firstDay);
        setPeriodEndDate(lastDayText);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu kho và giá thành.");
    }
  }

  async function loadBalances() {
    if (!accessToken || !organizationId) return;
    try {
      const response = await apiInventoryBalances(organizationId, accessToken);
      setBalances(response.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được số dư tồn kho.");
    }
  }

  async function loadLedgerEntries() {
    if (!accessToken) return;
    try {
      const response = await apiListResource<GenericRow>("inventory_ledger_entries", accessToken, {
        skip: 0,
        limit: 1200
      });
      setLedgerEntries(response.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được nhật ký giao dịch kho.");
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    void loadAll();
    void loadLedgerEntries();
  }, [accessToken]);

  useEffect(() => {
    void loadBalances();
  }, [accessToken, organizationId]);

  useEffect(() => {
    if (balances.length === 0) {
      if (selectedBalanceKey) setSelectedBalanceKey("");
      return;
    }

    const exists = balances.some((item) => getBalanceKey(item) === selectedBalanceKey);
    if (!exists) {
      setSelectedBalanceKey(getBalanceKey(balances[0]));
    }
  }, [balances, selectedBalanceKey]);

  async function handleCreateWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId) return;
    setError(null);
    setMessage(null);

    try {
      await apiCreateResource(
        "warehouses",
        {
          organization_id: organizationId,
          plant_id: newWarehousePlantId || null,
          code: newWarehouseCode,
          name: newWarehouseName,
          status: "active"
        },
        accessToken
      );
      setMessage("Đã tạo kho mới.");
      setNewWarehouseCode("");
      setNewWarehouseName("");
      setNewWarehousePlantId("");
      await Promise.all([loadAll(), loadBalances()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo kho thất bại.");
    }
  }

  async function handleCreateCostCenter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId) return;
    setError(null);
    setMessage(null);

    try {
      await apiCreateResource(
        "cost_centers",
        {
          organization_id: organizationId,
          parent_id: newCenterParentId || null,
          code: newCenterCode,
          name: newCenterName,
          level_no: selectedCenterLevel,
          status: "active"
        },
        accessToken
      );
      setMessage("Đã tạo trung tâm chi phí.");
      setNewCenterCode("");
      setNewCenterName("");
      setNewCenterParentId("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo trung tâm chi phí thất bại.");
    }
  }

  async function handleCreateCostObject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId || !newObjectCenterId) return;
    setError(null);
    setMessage(null);

    try {
      await apiCreateResource(
        "cost_objects",
        {
          organization_id: organizationId,
          cost_center_id: newObjectCenterId,
          code: newObjectCode,
          name: newObjectName,
          object_type: "project",
          status: "active"
        },
        accessToken
      );
      setMessage("Đã tạo đối tượng chi phí.");
      setNewObjectCode("");
      setNewObjectName("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo đối tượng chi phí thất bại.");
    }
  }

  async function handleCreatePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId) return;
    setError(null);
    setMessage(null);

    try {
      const response = await apiCreateCostPeriod(
        {
          organization_id: organizationId,
          period_code: periodCode,
          start_date: periodStartDate,
          end_date: periodEndDate,
          note: "Kỳ tạo từ màn hình vận hành"
        },
        accessToken
      );
      const period = response.period as Record<string, unknown>;
      setSelectedPeriodId(toText(period.id));
      setMessage("Đã tạo kỳ giá thành.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo kỳ giá thành thất bại.");
    }
  }

  async function handlePeriodAction(action: "open" | "close" | "reopen") {
    if (!accessToken || !organizationId || !selectedPeriodId) return;
    setError(null);
    setMessage(null);

    try {
      await apiCostPeriodAction(
        selectedPeriodId,
        action,
        {
          organization_id: organizationId,
          note: "Cập nhật từ màn hình kho và giá thành"
        },
        accessToken
      );
      const actionLabel = action === "open" ? "mở" : action === "close" ? "đóng" : "mở lại";
      setMessage(`Đã ${actionLabel} kỳ giá thành.`);
      await Promise.all([loadAll(), loadBalances()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác kỳ giá thành thất bại.");
    }
  }

  async function handlePrecloseChecklist() {
    if (!accessToken || !organizationId || !selectedPeriodId) return;
    setError(null);
    setMessage(null);

    try {
      const response = await apiCostPeriodPrecloseChecklist(selectedPeriodId, organizationId, accessToken);
      setPrecloseResult(response);
      setMessage("Đã kiểm tra điều kiện đóng kỳ.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không kiểm tra được điều kiện đóng kỳ.");
    }
  }

  async function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId || !warehouseId || !materialId) return;
    setError(null);
    setMessage(null);

    try {
      await apiInventoryMovement(
        {
          organization_id: organizationId,
          movement_type: movementType,
          warehouse_id: warehouseId,
          destination_warehouse_id: destinationWarehouseId || undefined,
          material_id: materialId,
          quantity: movementType === "adjustment" ? undefined : toNumber(quantity),
          quantity_delta: movementType === "adjustment" ? toNumber(quantityDelta) : undefined,
          unit_cost: toNumber(unitCost),
          reference_no: referenceNo || undefined,
          note: movementNote || undefined,
          source_document_type: "ui_inventory"
        },
        accessToken
      );
      setMessage("Đã ghi nhận bút toán kho.");
      await Promise.all([loadBalances(), loadAll(), loadLedgerEntries()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ghi nhận bút toán kho thất bại.");
    }
  }

  async function handleStockTake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !organizationId || !stockTakeWarehouseId || !stockTakeMaterialId) return;
    setError(null);
    setMessage(null);

    try {
      await apiInventoryStockTake(
        {
          organization_id: organizationId,
          warehouse_id: stockTakeWarehouseId,
          material_id: stockTakeMaterialId,
          counted_qty: toNumber(countedQty),
          note: stockTakeNote || undefined
        },
        accessToken
      );
      setMessage("Đã chốt phiếu kiểm kê.");
      await Promise.all([loadBalances(), loadAll(), loadLedgerEntries()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chốt phiếu kiểm kê thất bại.");
    }
  }

  async function handleImportReceipts(dryRun: boolean) {
    if (!accessToken || !organizationId || !importFile) return;
    setError(null);
    setMessage(null);

    try {
      const response = await apiInventoryImportReceipts(organizationId, importFile, accessToken, { dryRun });
      setMessage(
        dryRun
          ? `Xem trước hoàn tất: hợp lệ ${response.valid_rows}, lỗi ${response.invalid_rows}.`
          : `Import hoàn tất: tạo ${response.created}, bỏ qua ${response.skipped}.`
      );
      if (!dryRun) {
        await Promise.all([loadBalances(), loadLedgerEntries()]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nhập phiếu nhập thất bại.");
    }
  }

  function renderCostCenterNodes(nodes: CostCenterNode[], depth = 0): JSX.Element[] {
    return nodes.flatMap((node) => {
      const id = toText(node.center.id);
      const code = toText(node.center.code) || "(chưa có mã)";
      const name = toText(node.center.name) || "(chưa có tên)";
      const level = Number(node.center.level_no ?? depth + 1);

      const line = (
        <div
          key={`center-${id}`}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
          style={{ marginLeft: `${depth * 16}px` }}
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{code} - {name}</p>
            <p className="text-xs text-gray-500">Cấp {Number.isFinite(level) ? level : depth + 1}</p>
          </div>
          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
            {costObjectsGroupedByCenter[id]?.length ?? 0} đối tượng
          </span>
        </div>
      );

      return [line, ...renderCostCenterNodes(node.children, depth + 1)];
    });
  }

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để thao tác dữ liệu.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="ta-card p-4">
        <h1 className="text-2xl font-semibold text-gray-900">Kho & Giá thành (Phase 4)</h1>
        <p className="mt-1 text-sm text-gray-600">
          Quản lý nhập/xuất/chuyển/điều chỉnh, kiểm kê, tồn kho hiện tại và quy trình mở/đóng kỳ giá thành.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <article className="ta-card p-4">
          <p className="text-sm text-gray-500">Số kho</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{warehouses.length}</p>
        </article>
        <article className="ta-card p-4">
          <p className="text-sm text-gray-500">Số vật tư</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{materials.length}</p>
        </article>
        <article className="ta-card p-4">
          <p className="text-sm text-gray-500">Số kỳ giá thành</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{periods.length}</p>
        </article>
        <article className="ta-card p-4">
          <p className="text-sm text-gray-500">Bút toán kho</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{ledgerEntries.length}</p>
        </article>
      </section>

      <section className="ta-card p-4">
        <h2 className="text-lg font-semibold text-gray-900">Tạo dữ liệu danh mục</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <form className="space-y-3 rounded-xl border border-gray-200 p-3" onSubmit={handleCreateWarehouse}>
            <p className="text-sm font-medium text-gray-800">Tạo kho</p>
            <input className="ta-input" placeholder="Mã kho" value={newWarehouseCode} onChange={(event) => setNewWarehouseCode(event.target.value)} />
            <input className="ta-input" placeholder="Tên kho" value={newWarehouseName} onChange={(event) => setNewWarehouseName(event.target.value)} />
            <input className="ta-input" placeholder="Mã trạm (plant_id, tuỳ chọn)" value={newWarehousePlantId} onChange={(event) => setNewWarehousePlantId(event.target.value)} />
            <button className="ta-button-primary" type="submit">Tạo kho</button>
          </form>

          <form className="space-y-3 rounded-xl border border-gray-200 p-3" onSubmit={handleCreateCostCenter}>
            <p className="text-sm font-medium text-gray-800">Tạo trung tâm chi phí</p>
            <select className="ta-input" value={newCenterParentId} onChange={(event) => setNewCenterParentId(event.target.value)}>
              <option value="">Không có trung tâm cha (cấp gốc)</option>
              {costCenters.map((item) => (
                <option key={toText(item.id)} value={toText(item.id)}>
                  {toText(item.code)} - {toText(item.name)}
                </option>
              ))}
            </select>
            <input className="ta-input" placeholder="Mã trung tâm" value={newCenterCode} onChange={(event) => setNewCenterCode(event.target.value)} />
            <input className="ta-input" placeholder="Tên trung tâm" value={newCenterName} onChange={(event) => setNewCenterName(event.target.value)} />
            <p className="text-xs text-gray-500">Cấp trung tâm sẽ lưu: {selectedCenterLevel}</p>
            <button className="ta-button-primary" type="submit">Tạo trung tâm</button>
          </form>

          <form className="space-y-3 rounded-xl border border-gray-200 p-3" onSubmit={handleCreateCostObject}>
            <p className="text-sm font-medium text-gray-800">Tạo đối tượng chi phí</p>
            <select className="ta-input" value={newObjectCenterId} onChange={(event) => setNewObjectCenterId(event.target.value)}>
              <option value="">Chọn trung tâm chi phí</option>
              {costCenters.map((item) => (
                <option key={toText(item.id)} value={toText(item.id)}>
                  {toText(item.code)} - {toText(item.name)}
                </option>
              ))}
            </select>
            <input className="ta-input" placeholder="Mã đối tượng" value={newObjectCode} onChange={(event) => setNewObjectCode(event.target.value)} />
            <input className="ta-input" placeholder="Tên đối tượng" value={newObjectName} onChange={(event) => setNewObjectName(event.target.value)} />
            <button className="ta-button-primary" type="submit">Tạo đối tượng</button>
          </form>
        </div>
      </section>

      <section className="ta-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Cây trung tâm chi phí & đối tượng chi phí</h2>
          <span className="text-sm text-gray-500">
            Trung tâm: {costCenters.length} · Đối tượng: {costObjects.length}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">Tree view trung tâm chi phí</p>
            {costCenterTree.length > 0 ? (
              <div className="space-y-2">{renderCostCenterNodes(costCenterTree)}</div>
            ) : (
              <p className="text-sm text-gray-500">Chưa có trung tâm chi phí.</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="mb-2 text-sm font-medium text-gray-700">Danh sách đối tượng chi phí theo trung tâm</p>
            <div className="max-h-[340px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Mã đối tượng</th>
                    <th className="px-3 py-2">Tên đối tượng</th>
                    <th className="px-3 py-2">Trung tâm</th>
                    <th className="px-3 py-2">Loại</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(costObjectsGroupedByCenter).flatMap(([centerId, items]) =>
                    items.map((item) => (
                      <tr key={toText(item.id)} className="border-t border-gray-100">
                        <td className="px-3 py-2">{toText(item.code) || "-"}</td>
                        <td className="px-3 py-2">{toText(item.name) || "-"}</td>
                        <td className="px-3 py-2">
                          {centerId === "__khong_gan"
                            ? "Chưa gán trung tâm"
                            : `${toText(costCenterById[centerId]?.code)} - ${toText(costCenterById[centerId]?.name)}`}
                        </td>
                        <td className="px-3 py-2">{toText(item.object_type) || "-"}</td>
                      </tr>
                    ))
                  )}
                  {costObjects.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-gray-500" colSpan={4}>
                        Chưa có đối tượng chi phí.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form className="ta-card space-y-3 p-4" onSubmit={handleMovement}>
          <h2 className="text-lg font-semibold text-gray-900">Nghiệp vụ kho</h2>
          <select className="ta-input" value={movementType} onChange={(event) => setMovementType(event.target.value as typeof movementType)}>
            <option value="receipt">Nhập kho</option>
            <option value="issue">Xuất kho</option>
            <option value="transfer">Chuyển kho</option>
            <option value="adjustment">Điều chỉnh</option>
            <option value="waste">Hao hụt</option>
          </select>

          <select className="ta-input" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            <option value="">Chọn kho nguồn</option>
            {warehouses.map((item) => (
              <option key={toText(item.id)} value={toText(item.id)}>
                {toText(item.code)} - {toText(item.name)}
              </option>
            ))}
          </select>

          {movementType === "transfer" ? (
            <select className="ta-input" value={destinationWarehouseId} onChange={(event) => setDestinationWarehouseId(event.target.value)}>
              <option value="">Chọn kho đích</option>
              {warehouses.map((item) => (
                <option key={toText(item.id)} value={toText(item.id)}>
                  {toText(item.code)} - {toText(item.name)}
                </option>
              ))}
            </select>
          ) : null}

          <select className="ta-input" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            <option value="">Chọn vật tư</option>
            {materials.map((item) => (
              <option key={toText(item.id)} value={toText(item.id)}>
                {toText(item.code)} - {toText(item.name)}
              </option>
            ))}
          </select>

          {movementType === "adjustment" ? (
            <input className="ta-input" placeholder="Số lượng điều chỉnh (+/-)" value={quantityDelta} onChange={(event) => setQuantityDelta(event.target.value)} />
          ) : (
            <input className="ta-input" placeholder="Số lượng" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          )}

          <input className="ta-input" placeholder="Đơn giá (tuỳ chọn)" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
          <input className="ta-input" placeholder="Số chứng từ tham chiếu" value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} />
          <input className="ta-input" placeholder="Ghi chú" value={movementNote} onChange={(event) => setMovementNote(event.target.value)} />

          <button className="ta-button-primary" type="submit">Ghi nhận nghiệp vụ</button>
        </form>

        <form className="ta-card space-y-3 p-4" onSubmit={handleStockTake}>
          <h2 className="text-lg font-semibold text-gray-900">Kiểm kê cuối ca</h2>

          <select className="ta-input" value={stockTakeWarehouseId} onChange={(event) => setStockTakeWarehouseId(event.target.value)}>
            <option value="">Chọn kho kiểm kê</option>
            {warehouses.map((item) => (
              <option key={toText(item.id)} value={toText(item.id)}>
                {toText(item.code)} - {toText(item.name)}
              </option>
            ))}
          </select>

          <select className="ta-input" value={stockTakeMaterialId} onChange={(event) => setStockTakeMaterialId(event.target.value)}>
            <option value="">Chọn vật tư kiểm kê</option>
            {materials.map((item) => (
              <option key={toText(item.id)} value={toText(item.id)}>
                {toText(item.code)} - {toText(item.name)}
              </option>
            ))}
          </select>

          <input className="ta-input" placeholder="Số lượng kiểm kê thực tế" value={countedQty} onChange={(event) => setCountedQty(event.target.value)} />
          <input className="ta-input" placeholder="Ghi chú kiểm kê" value={stockTakeNote} onChange={(event) => setStockTakeNote(event.target.value)} />

          <button className="ta-button-primary" type="submit">Chốt kiểm kê</button>
        </form>
      </section>

      <section className="ta-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Lịch kỳ giá thành</h2>
          <input
            className="ta-input w-[220px]"
            type="month"
            value={calendarMonth}
            onChange={(event) => setCalendarMonth(event.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredCalendarPeriods.map((period) => {
            const periodId = toText(period.id);
            const status = toText(period.status).toLowerCase();
            const isSelected = periodId && periodId === selectedPeriodId;
            const statusClass =
              status === "open"
                ? "bg-green-100 text-green-700"
                : status === "closed"
                  ? "bg-slate-200 text-slate-700"
                  : "bg-amber-100 text-amber-700";

            return (
              <button
                key={periodId}
                type="button"
                onClick={() => setSelectedPeriodId(periodId)}
                className={`rounded-xl border p-3 text-left transition ${
                  isSelected ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{toText(period.period_code) || "Kỳ chưa đặt mã"}</p>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${statusClass}`}>{formatPeriodStatus(status)}</span>
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  {formatDateOnly(period.start_date)} → {formatDateOnly(period.end_date)}
                </p>
              </button>
            );
          })}
        </div>

        {filteredCalendarPeriods.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Không có kỳ giá thành nào giao với tháng đã chọn.</p>
        ) : null}
      </section>

      <section className="ta-card p-4">
        <h2 className="text-lg font-semibold text-gray-900">Quản lý kỳ giá thành</h2>

        <form className="mt-3 grid gap-3 md:grid-cols-4" onSubmit={handleCreatePeriod}>
          <input className="ta-input" placeholder="Mã kỳ" value={periodCode} onChange={(event) => setPeriodCode(event.target.value)} />
          <input className="ta-input" type="date" value={periodStartDate} onChange={(event) => setPeriodStartDate(event.target.value)} />
          <input className="ta-input" type="date" value={periodEndDate} onChange={(event) => setPeriodEndDate(event.target.value)} />
          <button className="ta-button-primary" type="submit">Tạo kỳ</button>
        </form>

        <div className="mt-4 grid gap-3 md:grid-cols-[2fr,1fr,1fr,1fr,1fr]">
          <select className="ta-input" value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)}>
            <option value="">Chọn kỳ giá thành</option>
            {periods.map((item) => (
              <option key={toText(item.id)} value={toText(item.id)}>
                {toText(item.period_code)} - trạng thái {formatPeriodStatus(item.status)}
              </option>
            ))}
          </select>
          <button className="ta-button-secondary" type="button" onClick={() => void handlePeriodAction("open")}>Mở kỳ</button>
          <button className="ta-button-secondary" type="button" onClick={() => void handlePeriodAction("close")}>Đóng kỳ</button>
          <button className="ta-button-secondary" type="button" onClick={() => void handlePeriodAction("reopen")}>Mở lại kỳ</button>
          <button className="ta-button-secondary" type="button" onClick={() => void handlePrecloseChecklist()}>Kiểm tra trước đóng</button>
        </div>

        {precloseResult ? (
          <pre className="mt-3 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
            {JSON.stringify(precloseResult, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="ta-card p-4">
        <h2 className="text-lg font-semibold text-gray-900">Nhập phiếu nhập & xuất ảnh chụp tồn kho</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input accept=".csv,.xlsx,.xlsm" type="file" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
          <button className="ta-button-secondary" type="button" onClick={() => void handleImportReceipts(true)} disabled={!importFile}>
            Xem trước nhập phiếu nhập
          </button>
          <button className="ta-button-primary" type="button" onClick={() => void handleImportReceipts(false)} disabled={!importFile}>
            Nhập phiếu nhập
          </button>
          {organizationId ? (
            <a className="ta-button-secondary" href={apiInventorySnapshotUrl(organizationId)} target="_blank" rel="noreferrer">
              Xuất ảnh chụp tồn kho
            </a>
          ) : null}
        </div>
      </section>

      <section className="ta-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Tồn kho hiện tại</h2>
          <button className="ta-button-secondary" type="button" onClick={() => void loadBalances()}>
            Làm mới tồn kho
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Mã kho</th>
                <th className="px-3 py-2">Tên kho</th>
                <th className="px-3 py-2">Mã vật tư</th>
                <th className="px-3 py-2">Tên vật tư</th>
                <th className="px-3 py-2">Tồn khả dụng</th>
                <th className="px-3 py-2">Giao dịch gần nhất</th>
                <th className="px-3 py-2">Drill-down</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((item) => {
                const key = getBalanceKey(item);
                const selected = key === selectedBalanceKey;
                return (
                  <tr key={key} className={`border-t border-gray-100 ${selected ? "bg-brand-50/60" : ""}`}>
                    <td className="px-3 py-2">{toText(item.warehouse_code) || "-"}</td>
                    <td className="px-3 py-2">{toText(item.warehouse_name) || "-"}</td>
                    <td className="px-3 py-2">{toText(item.material_code) || "-"}</td>
                    <td className="px-3 py-2">{toText(item.material_name) || "-"}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900">{formatQuantity(item.available_qty)}</td>
                    <td className="px-3 py-2">{formatDateTime(item.last_transaction_at)}</td>
                    <td className="px-3 py-2">
                      <button
                        className="ta-button-secondary"
                        type="button"
                        onClick={() => setSelectedBalanceKey(key)}
                      >
                        Xem giao dịch
                      </button>
                    </td>
                  </tr>
                );
              })}
              {balances.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-center text-gray-500" colSpan={7}>
                    Chưa có dữ liệu tồn kho.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selectedBalanceRow ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900">Drill-down giao dịch kho</h3>
              <button className="ta-button-secondary" type="button" onClick={() => void loadLedgerEntries()}>
                Làm mới nhật ký
              </button>
            </div>

            <p className="mb-3 text-sm text-gray-600">
              Kho: {toText(warehouseById[selectedWarehouseId]?.code)} - {toText(warehouseById[selectedWarehouseId]?.name)} ·
              Vật tư: {toText(materialById[selectedMaterialId]?.code)} - {toText(materialById[selectedMaterialId]?.name)} ·
              Tồn hiện tại: {formatQuantity(selectedBalanceRow.available_qty)}
            </p>

            <div className="max-h-[340px] overflow-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Thời điểm</th>
                    <th className="px-3 py-2">Nghiệp vụ</th>
                    <th className="px-3 py-2">SL vào</th>
                    <th className="px-3 py-2">SL ra</th>
                    <th className="px-3 py-2">Tồn sau GD</th>
                    <th className="px-3 py-2">Đơn giá</th>
                    <th className="px-3 py-2">Chứng từ</th>
                    <th className="px-3 py-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDrilldownEntries.map((entry) => (
                    <tr key={toText(entry.id)} className="border-t border-gray-100">
                      <td className="px-3 py-2">{formatDateTime(entry.transaction_at)}</td>
                      <td className="px-3 py-2">{(MOVEMENT_TYPE_LABELS[toText(entry.movement_type)] ?? toText(entry.movement_type)) || "-"}</td>
                      <td className="px-3 py-2">{formatQuantity(entry.quantity_in)}</td>
                      <td className="px-3 py-2">{formatQuantity(entry.quantity_out)}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{formatQuantity(entry.balance_after_qty)}</td>
                      <td className="px-3 py-2">{formatQuantity(entry.unit_cost)}</td>
                      <td className="px-3 py-2">{toText(entry.reference_no) || "-"}</td>
                      <td className="px-3 py-2">{toText(entry.note) || "-"}</td>
                    </tr>
                  ))}
                  {selectedDrilldownEntries.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-gray-500" colSpan={8}>
                        Chưa có giao dịch chi tiết cho kho/vật tư đã chọn.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="text-sm">
        {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</p> : null}
      </section>

      <section className="ta-card p-4">
        <h2 className="text-base font-semibold text-gray-900">Danh mục tham chiếu nhanh</h2>
        <p className="mt-1 text-sm text-gray-600">
          Trung tâm chi phí: {costCenters.length} · Đối tượng chi phí: {costObjects.length} · Kỳ đang chọn:{" "}
          {selectedPeriodId ? toText(periodById[selectedPeriodId]?.period_code) || selectedPeriodId : "Chưa chọn"}
        </p>
      </section>
    </div>
  );
}
