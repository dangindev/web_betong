"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PricingPreviewPayload,
  PricingPreviewResult,
  apiConfirmQuotation,
  apiCreateResource,
  apiPricingPreview,
  apiQuotationPdfUrl,
  apiSetQuotationApproval
} from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

function buildQuotationNo() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `QT-${now.getFullYear()}${mm}${dd}-${hh}${mi}`;
}

export default function SalesQuotationsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [organizationId, setOrganizationId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [priceBookId, setPriceBookId] = useState("");
  const [concreteProductId, setConcreteProductId] = useState("");
  const [quotationNo, setQuotationNo] = useState(buildQuotationNo());
  const [quotedVolumeM3, setQuotedVolumeM3] = useState("10");
  const [distanceKm, setDistanceKm] = useState("12");
  const [difficultyLevel, setDifficultyLevel] = useState("normal");
  const [requiresPump, setRequiresPump] = useState(true);
  const [regionCode, setRegionCode] = useState("");
  const [surchargeAmount, setSurchargeAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [autoPreview, setAutoPreview] = useState(true);

  const [preview, setPreview] = useState<PricingPreviewResult | null>(null);
  const [createdQuotationId, setCreatedQuotationId] = useState("");
  const [busyPreview, setBusyPreview] = useState(false);
  const [busySubmit, setBusySubmit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const payload = useMemo<PricingPreviewPayload>(
    () => ({
      organization_id: organizationId,
      customer_id: customerId || undefined,
      site_id: siteId || undefined,
      plant_id: undefined,
      region_code: regionCode || undefined,
      concrete_product_id: concreteProductId || undefined,
      price_book_id: priceBookId || undefined,
      quoted_volume_m3: Number(quotedVolumeM3 || "0"),
      distance_km: Number(distanceKm || "0"),
      difficulty_level: difficultyLevel || undefined,
      requires_pump: requiresPump,
      surcharge_amount: Number(surchargeAmount || "0"),
      discount_amount: Number(discountAmount || "0")
    }),
    [
      concreteProductId,
      customerId,
      difficultyLevel,
      discountAmount,
      distanceKm,
      organizationId,
      priceBookId,
      quotedVolumeM3,
      regionCode,
      requiresPump,
      siteId,
      surchargeAmount
    ]
  );

  async function runPreview() {
    if (!accessToken) return;
    if (!organizationId) {
      setError("organization_id là bắt buộc để preview giá.");
      return;
    }

    setBusyPreview(true);
    setError("");

    try {
      const result = await apiPricingPreview(payload, accessToken);
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không preview được giá.");
    } finally {
      setBusyPreview(false);
    }
  }

  useEffect(() => {
    if (!autoPreview || !accessToken || !organizationId) return;

    const timer = setTimeout(() => {
      runPreview();
    }, 450);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPreview, accessToken, payload, organizationId]);

  async function handleCreateAndConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;

    setBusySubmit(true);
    setError("");
    setMessage("");

    try {
      const pricing = preview ?? (await apiPricingPreview(payload, accessToken));

      const quotation = await apiCreateResource<Record<string, unknown>>(
        "quotations",
        {
          organization_id: organizationId,
          customer_id: customerId,
          site_id: siteId || null,
          quotation_no: quotationNo,
          price_book_id: pricing.price_book.id,
          status: "draft"
        },
        accessToken
      );

      const quotationId = String(quotation.id);
      setCreatedQuotationId(quotationId);

      await apiCreateResource(
        "quotation_items",
        {
          quotation_id: quotationId,
          concrete_product_id: concreteProductId,
          quoted_volume_m3: Number(quotedVolumeM3 || "0"),
          distance_km: Number(distanceKm || "0"),
          difficulty_level: difficultyLevel,
          requires_pump: requiresPump,
          base_price: pricing.components.base_price,
          distance_fee: pricing.components.distance_fee,
          difficulty_fee: pricing.components.difficulty_fee,
          pump_fee: pricing.components.pump_fee,
          surcharge_fee: pricing.components.surcharge_fee,
          discount_fee: pricing.components.discount_fee,
          final_unit_price: pricing.final_unit_price,
          total_amount: pricing.total_amount,
          pricing_snapshot_json: {
            price_book: pricing.price_book,
            applied_rules: pricing.applied_rules,
            final_unit_price: pricing.final_unit_price,
            total_amount: pricing.total_amount
          }
        },
        accessToken
      );

      await apiConfirmQuotation(
        quotationId,
        {
          price_book_id: pricing.price_book.id,
          region_code: regionCode || undefined,
          surcharge_amount: Number(surchargeAmount || "0"),
          discount_amount: Number(discountAmount || "0"),
          final_status: "confirmed"
        },
        accessToken
      );

      setMessage(`Đã tạo và chốt báo giá ${quotationNo} (${quotationId}).`);
      setQuotationNo(buildQuotationNo());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo báo giá thất bại.");
    } finally {
      setBusySubmit(false);
    }
  }

  async function handleApproval(action: "approved" | "rejected") {
    if (!accessToken || !createdQuotationId) return;

    try {
      await apiSetQuotationApproval(
        createdQuotationId,
        {
          action,
          note: action === "approved" ? "Approved by sales manager" : "Rejected by sales manager",
          discount_override_amount: Number(discountAmount || "0")
        },
        accessToken
      );
      setMessage(action === "approved" ? "Đã duyệt manual override/discount." : "Đã từ chối báo giá.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được trạng thái approval.");
    }
  }

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để thao tác dữ liệu.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Quotation Builder (Realtime Pricing Preview)</h2>

      <form className="space-y-3 rounded border border-slate-200 bg-white p-4" onSubmit={handleCreateAndConfirm}>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="organization_id *"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="customer_id *"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="site_id"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="price_book_id (optional)"
            value={priceBookId}
            onChange={(event) => setPriceBookId(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="concrete_product_id *"
            value={concreteProductId}
            onChange={(event) => setConcreteProductId(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="quotation_no"
            value={quotationNo}
            onChange={(event) => setQuotationNo(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="quoted_volume_m3"
            value={quotedVolumeM3}
            onChange={(event) => setQuotedVolumeM3(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="distance_km"
            value={distanceKm}
            onChange={(event) => setDistanceKm(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="difficulty_level"
            value={difficultyLevel}
            onChange={(event) => setDifficultyLevel(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="region_code"
            value={regionCode}
            onChange={(event) => setRegionCode(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="surcharge_amount"
            value={surchargeAmount}
            onChange={(event) => setSurchargeAmount(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="discount_amount"
            value={discountAmount}
            onChange={(event) => setDiscountAmount(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requiresPump} onChange={(event) => setRequiresPump(event.target.checked)} />
            requires_pump
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPreview} onChange={(event) => setAutoPreview(event.target.checked)} />
            auto preview realtime
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={runPreview} disabled={busyPreview}>
            {busyPreview ? "Đang preview..." : "Preview giá"}
          </Button>
          <Button type="submit" disabled={busySubmit}>
            {busySubmit ? "Đang tạo..." : "Tạo + chốt báo giá"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleApproval("approved")} disabled={!createdQuotationId}>
            Approve discount/manual override
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleApproval("rejected")} disabled={!createdQuotationId}>
            Reject quotation
          </Button>
          {createdQuotationId ? (
            <a
              className="inline-flex items-center rounded border border-slate-300 px-3 py-2 text-sm"
              href={apiQuotationPdfUrl(createdQuotationId)}
              target="_blank"
              rel="noreferrer"
            >
              PDF preview báo giá
            </a>
          ) : null}
        </div>
      </form>

      {preview ? (
        <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold">Pricing preview</h3>
          <div className="grid gap-2 md:grid-cols-4 text-sm">
            <div className="rounded bg-slate-50 p-2">Price Book: {preview.price_book.code}</div>
            <div className="rounded bg-slate-50 p-2">Final Unit Price: {preview.final_unit_price}</div>
            <div className="rounded bg-slate-50 p-2">Quoted Volume: {preview.quoted_volume_m3}</div>
            <div className="rounded bg-slate-50 p-2">Total Amount: {preview.total_amount}</div>
          </div>
          <pre className="overflow-auto rounded bg-slate-100 p-3 text-xs">{JSON.stringify(preview.components, null, 2)}</pre>
        </div>
      ) : null}

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
    </div>
  );
}
