"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiCreateResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

type WizardStep = 1 | 2 | 3 | 4;

function buildRequestNo() {
  const now = new Date();
  return `PR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function SalesPourRequestsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [step, setStep] = useState<WizardStep>(1);
  const [organizationId, setOrganizationId] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [requestNo, setRequestNo] = useState(buildRequestNo());
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [concreteProductId, setConcreteProductId] = useState("");
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [requestedVolumeM3, setRequestedVolumeM3] = useState("10");
  const [requestedDate, setRequestedDate] = useState("");
  const [windowStartAt, setWindowStartAt] = useState("");
  const [windowEndAt, setWindowEndAt] = useState("");
  const [pourMethod, setPourMethod] = useState("pump");
  const [requiresPump, setRequiresPump] = useState(true);
  const [expectedPumpType, setExpectedPumpType] = useState("boom");
  const [difficultyLevel, setDifficultyLevel] = useState("normal");
  const [siteContactName, setSiteContactName] = useState("");
  const [siteContactPhone, setSiteContactPhone] = useState("");
  const [constraintsJson, setConstraintsJson] = useState("{}\n");

  const [quickRequestNo, setQuickRequestNo] = useState(buildRequestNo());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để thao tác dữ liệu.</p>;
  }

  const token = accessToken;

  async function createPourRequest(payload: Record<string, unknown>) {
    const created = await apiCreateResource<Record<string, unknown>>("pour_requests", payload, token);
    const pourRequestId = String(created.id);

    if (windowStartAt && windowEndAt) {
      await apiCreateResource(
        "pour_request_time_windows",
        {
          pour_request_id: pourRequestId,
          window_start_at: windowStartAt,
          window_end_at: windowEndAt,
          priority: 1
        },
        token
      );
    }

    return pourRequestId;
  }

  async function handleQuickCreate() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const pourRequestId = await createPourRequest({
        organization_id: organizationId,
        request_no: quickRequestNo,
        customer_id: customerId,
        site_id: siteId,
        concrete_product_id: concreteProductId,
        assigned_plant_id: assignedPlantId || null,
        requested_volume_m3: Number(requestedVolumeM3 || "0"),
        requested_date: requestedDate || null,
        requested_start_at: windowStartAt || null,
        requested_end_at: windowEndAt || null,
        pour_method: pourMethod,
        requires_pump: requiresPump,
        expected_pump_type: expectedPumpType || null,
        difficulty_level: difficultyLevel || null,
        site_contact_name: siteContactName || null,
        site_contact_phone: siteContactPhone || null,
        special_constraints_json: {},
        status: "new"
      });

      setMessage(`Quick create thành công: ${pourRequestId}`);
      setQuickRequestNo(buildRequestNo());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quick create thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitWizard() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const parsedConstraints = JSON.parse(constraintsJson || "{}");
      const pourRequestId = await createPourRequest({
        organization_id: organizationId,
        sales_order_id: salesOrderId || null,
        request_no: requestNo,
        customer_id: customerId,
        site_id: siteId,
        concrete_product_id: concreteProductId,
        assigned_plant_id: assignedPlantId || null,
        requested_volume_m3: Number(requestedVolumeM3 || "0"),
        requested_date: requestedDate || null,
        requested_start_at: windowStartAt || null,
        requested_end_at: windowEndAt || null,
        pour_method: pourMethod,
        requires_pump: requiresPump,
        expected_pump_type: expectedPumpType || null,
        difficulty_level: difficultyLevel || null,
        site_contact_name: siteContactName || null,
        site_contact_phone: siteContactPhone || null,
        special_constraints_json: parsedConstraints,
        status: "new"
      });

      setMessage(`Đã tạo pour request ${requestNo} (${pourRequestId}).`);
      setRequestNo(buildRequestNo());
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo pour request thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Pour Request Wizard (4 bước + Quick Create)</h2>

      <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="font-semibold">Quick Create</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="organization_id *" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="request_no *" value={quickRequestNo} onChange={(e) => setQuickRequestNo(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="customer_id *" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="site_id *" value={siteId} onChange={(e) => setSiteId(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="concrete_product_id *" value={concreteProductId} onChange={(e) => setConcreteProductId(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="requested_volume_m3" value={requestedVolumeM3} onChange={(e) => setRequestedVolumeM3(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="requested_start_at (ISO)" value={windowStartAt} onChange={(e) => setWindowStartAt(e.target.value)} />
          <input className="rounded border border-slate-300 px-3 py-2" placeholder="requested_end_at (ISO)" value={windowEndAt} onChange={(e) => setWindowEndAt(e.target.value)} />
        </div>
        <Button type="button" onClick={handleQuickCreate} disabled={busy}>Quick create</Button>
      </div>

      <div className="grid gap-2 rounded border border-slate-200 bg-white p-4 md:grid-cols-4 text-sm">
        {[1, 2, 3, 4].map((raw) => {
          const wizardStep = raw as WizardStep;
          return (
            <button
              key={raw}
              type="button"
              className={`rounded border px-3 py-2 text-left ${step === wizardStep ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}
              onClick={() => setStep(wizardStep)}
            >
              <div className="font-semibold">Step {wizardStep}</div>
              <div>
                {wizardStep === 1 && "Thông tin đơn"}
                {wizardStep === 2 && "Khối lượng & thời gian"}
                {wizardStep === 3 && "Điều kiện công trình"}
                {wizardStep === 4 && "Xác nhận"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
        {step === 1 ? (
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="request_no" value={requestNo} onChange={(e) => setRequestNo(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="sales_order_id" value={salesOrderId} onChange={(e) => setSalesOrderId(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="assigned_plant_id" value={assignedPlantId} onChange={(e) => setAssignedPlantId(e.target.value)} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="requested_volume_m3" value={requestedVolumeM3} onChange={(e) => setRequestedVolumeM3(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="requested_date (YYYY-MM-DD)" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="pour_method" value={pourMethod} onChange={(e) => setPourMethod(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="window_start_at (ISO)" value={windowStartAt} onChange={(e) => setWindowStartAt(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="window_end_at (ISO)" value={windowEndAt} onChange={(e) => setWindowEndAt(e.target.value)} />
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresPump} onChange={(e) => setRequiresPump(e.target.checked)} />
              requires_pump
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="expected_pump_type" value={expectedPumpType} onChange={(e) => setExpectedPumpType(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="difficulty_level" value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="site_contact_name" value={siteContactName} onChange={(e) => setSiteContactName(e.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="site_contact_phone" value={siteContactPhone} onChange={(e) => setSiteContactPhone(e.target.value)} />
            <textarea className="rounded border border-slate-300 px-3 py-2 md:col-span-2 h-28" placeholder="special_constraints_json" value={constraintsJson} onChange={(e) => setConstraintsJson(e.target.value)} />
          </div>
        ) : null}

        {step === 4 ? (
          <pre className="overflow-auto rounded bg-slate-100 p-3 text-xs">
            {JSON.stringify(
              {
                organization_id: organizationId,
                sales_order_id: salesOrderId,
                request_no: requestNo,
                customer_id: customerId,
                site_id: siteId,
                concrete_product_id: concreteProductId,
                requested_volume_m3: requestedVolumeM3,
                requested_date: requestedDate,
                requested_start_at: windowStartAt,
                requested_end_at: windowEndAt,
                requires_pump: requiresPump,
                expected_pump_type: expectedPumpType,
                difficulty_level: difficultyLevel,
                site_contact_name: siteContactName,
                site_contact_phone: siteContactPhone,
                assigned_plant_id: assignedPlantId
              },
              null,
              2
            )}
          </pre>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setStep((Math.max(1, step - 1) as WizardStep))}>Quay lại</Button>
          {step < 4 ? (
            <Button type="button" onClick={() => setStep((Math.min(4, step + 1) as WizardStep))}>Tiếp theo</Button>
          ) : (
            <Button type="button" onClick={handleSubmitWizard} disabled={busy}>{busy ? "Đang tạo..." : "Tạo pour request"}</Button>
          )}
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
    </div>
  );
}
