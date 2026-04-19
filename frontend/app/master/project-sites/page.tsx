"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiCreateResource, apiGeocode, apiUpdateResource, apiUploadAttachment } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

const DynamicMapPicker = dynamic(
  () => import("@/components/maps/map-picker").then((module) => module.MapPicker),
  {
    ssr: false,
    loading: () => <div className="h-72 rounded border border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">Đang tải bản đồ...</div>
  }
);

type WizardStep = 1 | 2 | 3 | 4;

type SiteFormState = {
  existing_site_id: string;
  organization_id: string;
  customer_id: string;
  code: string;
  site_name: string;
  site_type: string;
  address_line: string;
  ward: string;
  district: string;
  city: string;
  latitude: string;
  longitude: string;
  access_profile_id: string;
  default_plant_id: string;
  notes: string;
};

const STEP_TITLES: Record<WizardStep, string> = {
  1: "Thông tin cơ bản",
  2: "Địa chỉ & chọn điểm trên bản đồ",
  3: "Hồ sơ tiếp cận & bản vẽ/ảnh",
  4: "Xác nhận & tạo công trình"
};

function toNumberOrUndefined(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function ProjectSitesPage() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<SiteFormState>({
    existing_site_id: "",
    organization_id: "",
    customer_id: "",
    code: "",
    site_name: "",
    site_type: "",
    address_line: "",
    ward: "",
    district: "",
    city: "",
    latitude: "10.7769",
    longitude: "106.7009",
    access_profile_id: "",
    default_plant_id: "",
    notes: ""
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>("");

  const coordinatePair = useMemo(() => {
    const latitude = toNumberOrUndefined(form.latitude) ?? 10.7769;
    const longitude = toNumberOrUndefined(form.longitude) ?? 106.7009;
    return { latitude, longitude };
  }, [form.latitude, form.longitude]);

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để thao tác dữ liệu.</p>;
  }

  const token = accessToken;

  function updateForm<K extends keyof SiteFormState>(key: K, value: SiteFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep(targetStep: WizardStep): boolean {
    if (targetStep >= 2) {
      if (!form.organization_id || !form.customer_id || !form.code || !form.site_name) {
        setError("Bước 1 chưa đủ dữ liệu bắt buộc: organization_id, customer_id, code, site_name.");
        return false;
      }
    }

    if (targetStep >= 3) {
      if (!form.address_line || toNumberOrUndefined(form.latitude) === undefined || toNumberOrUndefined(form.longitude) === undefined) {
        setError("Bước 2 chưa hợp lệ: cần address_line và tọa độ latitude/longitude hợp lệ.");
        return false;
      }
    }

    setError("");
    return true;
  }

  async function handleGeocode() {
    if (!form.address_line.trim()) {
      setError("Vui lòng nhập địa chỉ trước khi lấy tọa độ.");
      return;
    }

    setGeocoding(true);
    setError("");
    try {
      const geo = await apiGeocode(form.address_line, token);
      updateForm("latitude", String(geo.latitude));
      updateForm("longitude", String(geo.longitude));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lấy tọa độ từ địa chỉ.");
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSubmit() {
    if (!validateStep(4)) return;

    setBusy(true);
    setError("");
    setResult("");

    try {
      const payload: Record<string, unknown> = {
        organization_id: form.organization_id,
        customer_id: form.customer_id,
        code: form.code,
        site_name: form.site_name,
        site_type: form.site_type || null,
        address_line: form.address_line,
        ward: form.ward || null,
        district: form.district || null,
        city: form.city || null,
        latitude: toNumberOrUndefined(form.latitude),
        longitude: toNumberOrUndefined(form.longitude),
        access_profile_id: form.access_profile_id || null,
        default_plant_id: form.default_plant_id || null,
        status: "active"
      };

      const targetSiteId = form.existing_site_id.trim();
      const projectSite = targetSiteId
        ? await apiUpdateResource<Record<string, unknown>>("project_sites", targetSiteId, payload, token)
        : await apiCreateResource<Record<string, unknown>>("project_sites", payload, token);
      const projectSiteId = String(projectSite.id ?? targetSiteId);

      let uploadedCount = 0;
      for (const file of files) {
        await apiUploadAttachment({
          entityType: "project_sites",
          entityId: projectSiteId,
          file,
          accessToken: token
        });
        uploadedCount += 1;
      }

      setResult(
        `${form.existing_site_id.trim() ? "Đã cập nhật" : "Đã tạo"} công trình ${projectSiteId}${uploadedCount > 0 ? ` và upload ${uploadedCount} file ảnh/bản vẽ.` : "."}`
      );
      setStep(1);
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo công trình thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const mapHref = `https://www.openstreetmap.org/?mlat=${coordinatePair.latitude}&mlon=${coordinatePair.longitude}`;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Wizard công trình</h2>

      <div className="grid gap-2 rounded border border-slate-200 bg-white p-4 md:grid-cols-4">
        {([1, 2, 3, 4] as WizardStep[]).map((numericStep) => {
          const active = step === numericStep;

          return (
            <button
              key={numericStep}
              type="button"
              className={`rounded border px-3 py-2 text-left text-sm ${
                active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700"
              }`}
              onClick={() => {
                if (validateStep(numericStep)) {
                  setStep(numericStep);
                }
              }}
            >
              <div className="font-semibold">Bước {numericStep}</div>
              <div>{STEP_TITLES[numericStep]}</div>
            </button>
          );
        })}
      </div>

      <div className="space-y-4 rounded border border-slate-200 bg-white p-4">
        {step === 1 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Mã tổ chức (organization_id) *"
              value={form.organization_id}
              onChange={(event) => updateForm("organization_id", event.target.value)}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Mã khách hàng (customer_id) *"
              value={form.customer_id}
              onChange={(event) => updateForm("customer_id", event.target.value)}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Mã công trình (site_id, điền để cập nhật thay vì tạo mới)"
              value={form.existing_site_id}
              onChange={(event) => updateForm("existing_site_id", event.target.value)}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Mã nội bộ công trình (code) *"
              value={form.code}
              onChange={(event) => updateForm("code", event.target.value)}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Tên công trình (site_name) *"
              value={form.site_name}
              onChange={(event) => updateForm("site_name", event.target.value)}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
              placeholder="Loại công trình (site_type)"
              value={form.site_type}
              onChange={(event) => updateForm("site_type", event.target.value)}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <textarea
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Địa chỉ chi tiết (address_line) *"
              value={form.address_line}
              onChange={(event) => updateForm("address_line", event.target.value)}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="rounded border border-slate-300 px-3 py-2"
                placeholder="Phường/Xã (ward)"
                value={form.ward}
                onChange={(event) => updateForm("ward", event.target.value)}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2"
                placeholder="Quận/Huyện (district)"
                value={form.district}
                onChange={(event) => updateForm("district", event.target.value)}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2"
                placeholder="Tỉnh/Thành phố (city)"
                value={form.city}
                onChange={(event) => updateForm("city", event.target.value)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                className="rounded border border-slate-300 px-3 py-2"
                placeholder="Vĩ độ (latitude)"
                value={form.latitude}
                onChange={(event) => updateForm("latitude", event.target.value)}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2"
                placeholder="Kinh độ (longitude)"
                value={form.longitude}
                onChange={(event) => updateForm("longitude", event.target.value)}
              />
              <Button type="button" variant="secondary" onClick={handleGeocode} disabled={geocoding}>
                {geocoding ? "Đang lấy tọa độ..." : "Lấy tọa độ"}
              </Button>
            </div>

            <DynamicMapPicker
              latitude={coordinatePair.latitude}
              longitude={coordinatePair.longitude}
              onChange={(latitude, longitude) => {
                updateForm("latitude", latitude.toFixed(7));
                updateForm("longitude", longitude.toFixed(7));
              }}
            />

            <a className="inline-flex items-center text-sm text-blue-700 underline" href={mapHref} target="_blank" rel="noreferrer">
              Mở bản đồ OpenStreetMap
            </a>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded border border-slate-300 px-3 py-2"
                placeholder="Mã hồ sơ tiếp cận (access_profile_id)"
                value={form.access_profile_id}
                onChange={(event) => updateForm("access_profile_id", event.target.value)}
              />
              <input
                className="rounded border border-slate-300 px-3 py-2"
                placeholder="Mã trạm mặc định (default_plant_id)"
                value={form.default_plant_id}
                onChange={(event) => updateForm("default_plant_id", event.target.value)}
              />
            </div>

            <textarea
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder="ghi_chu"
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
            />

            <div className="rounded border border-dashed border-slate-300 p-3">
              <p className="mb-2 text-sm font-medium">Tải lên ảnh công trình / bản vẽ</p>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.dwg,.dxf"
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                {files.length === 0 ? <li>Chưa chọn file</li> : files.map((file) => <li key={file.name}>{file.name}</li>)}
              </ul>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold">Kiểm tra lại trước khi tạo:</p>
            <pre className="overflow-auto rounded bg-white p-3 text-xs">{JSON.stringify({ ...form, file_count: files.length }, null, 2)}</pre>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setStep((current) => (Math.max(1, current - 1) as WizardStep))}>
            Quay lại
          </Button>
          {step < 4 ? (
            <Button
              type="button"
              onClick={() => {
                const nextStep = (Math.min(4, step + 1) as WizardStep);
                if (validateStep(nextStep)) {
                  setStep(nextStep);
                }
              }}
            >
              Tiếp theo
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={busy}>
              {busy ? "Đang tạo..." : "Tạo công trình"}
            </Button>
          )}
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {result ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{result}</div> : null}
    </div>
  );
}
