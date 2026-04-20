"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ImportResult, apiImportResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

const options = [
  { value: "customers", label: "Khách hàng" },
  { value: "project_sites", label: "Công trình" },
  { value: "vehicles", label: "Xe" },
  { value: "materials", label: "Vật tư" }
] as const;

function rowsToColumns(rows: Array<Record<string, unknown>>): string[] {
  const columnSet = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((column) => columnSet.add(column));
  }
  return Array.from(columnSet);
}

export default function ImportPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [resource, setResource] = useState<(typeof options)[number]["value"]>(options[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [busyPreview, setBusyPreview] = useState(false);
  const [busyImport, setBusyImport] = useState(false);
  const [error, setError] = useState<string>("");

  const previewColumns = useMemo(() => rowsToColumns(preview?.preview ?? []), [preview?.preview]);

  async function handlePreview() {
    if (!accessToken || !file) return;

    setBusyPreview(true);
    setError("");
    setImported(null);

    try {
      const response = await apiImportResource(resource, file, accessToken, { dryRun: true });
      setPreview(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xem trước thất bại");
    } finally {
      setBusyPreview(false);
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !file) return;

    setBusyImport(true);
    setError("");

    try {
      const response = await apiImportResource(resource, file, accessToken, { dryRun: false });
      setImported(response);
      if (!preview) {
        setPreview(response);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nhập dữ liệu thất bại");
    } finally {
      setBusyImport(false);
    }
  }

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để nhập dữ liệu.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Nhập dữ liệu Excel/CSV</h2>

      <form className="space-y-3 rounded border border-slate-200 bg-white p-4" onSubmit={handleImport}>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="ta-input"
            onChange={(event) => {
              setResource(event.target.value as (typeof options)[number]["value"]);
              setPreview(null);
              setImported(null);
            }}
            value={resource}
          >
            {options.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <input
            accept=".csv,.xlsx,.xlsm"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setImported(null);
            }}
            type="file"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={!file || busyPreview || busyImport}>
            {busyPreview ? "Đang xem trước..." : "Xem trước dữ liệu"}
          </Button>
          <Button type="submit" disabled={!file || busyImport}>
            {busyImport ? "Đang nhập dữ liệu..." : "Nhập các dòng hợp lệ"}
          </Button>
        </div>
      </form>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {preview ? (
        <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold">Xem trước</h3>
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded bg-slate-50 p-3">Tổng số dòng: {preview.total_rows}</div>
            <div className="rounded bg-green-50 p-3 text-green-700">Dòng hợp lệ: {preview.valid_rows}</div>
            <div className="rounded bg-red-50 p-3 text-red-700">Dòng lỗi: {preview.invalid_rows}</div>
            <div className="rounded bg-blue-50 p-3 text-blue-700">Tài nguyên: {preview.resource}</div>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Các dòng hợp lệ (tối đa 20):</p>
            {preview.preview.length === 0 ? (
              <p className="text-sm text-slate-500">Không có dòng hợp lệ.</p>
            ) : (
              <div className="overflow-auto rounded border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      {previewColumns.map((column) => (
                        <th key={column} className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, idx) => (
                      <tr key={idx} className="odd:bg-white even:bg-slate-50">
                        {previewColumns.map((column) => (
                          <td key={column} className="border-b border-slate-100 px-3 py-2">
                            {String(row[column] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-medium">Các dòng lỗi:</p>
            {preview.errors.length === 0 ? (
              <p className="text-sm text-slate-500">Không có lỗi.</p>
            ) : (
              <div className="overflow-auto rounded border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Số dòng</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Lỗi</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Dữ liệu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((item) => (
                      <tr key={`${item.row_number}-${item.error}`} className="odd:bg-white even:bg-slate-50">
                        <td className="border-b border-slate-100 px-3 py-2">{item.row_number}</td>
                        <td className="border-b border-slate-100 px-3 py-2 text-red-700">{item.error}</td>
                        <td className="border-b border-slate-100 px-3 py-2">
                          <code className="text-xs">{JSON.stringify(item.row)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {imported ? (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Đã nhập xong: tạo mới={imported.created}, bỏ qua={imported.skipped}, hợp lệ={imported.valid_rows}, lỗi={imported.invalid_rows}
        </div>
      ) : null}
    </div>
  );
}
