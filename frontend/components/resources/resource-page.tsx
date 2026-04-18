"use client";

import { Download, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiCreateResource, apiDeleteResource, apiListResource } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

import { Button } from "../ui/button";

type ResourcePageProps = {
  resource: string;
  title?: string;
};

type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function serializeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ResourcePage({ resource, title }: ResourcePageProps) {
  const { accessToken } = useAuthStore();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState("{}\n");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const columns = useMemo(() => {
    const columnSet = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((column) => columnSet.add(column));
    }
    const ordered = Array.from(columnSet);
    ordered.sort();
    return ordered;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    let result = rows;

    if (keyword) {
      result = rows.filter((row) =>
        columns.some((column) => serializeCellValue(row[column]).toLowerCase().includes(keyword))
      );
    }

    if (columns.includes(sortBy)) {
      result = [...result].sort((left, right) => {
        const leftValue = serializeCellValue(left[sortBy]).toLowerCase();
        const rightValue = serializeCellValue(right[sortBy]).toLowerCase();

        if (leftValue < rightValue) return sortDirection === "asc" ? -1 : 1;
        if (leftValue > rightValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [columns, rows, searchKeyword, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedRows = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safePageIndex]);

  async function reload() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiListResource<Record<string, unknown>>(resource, accessToken, {
        skip: 0,
        limit: 500
      });
      setRows(response.items);
      setPageIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!accessToken) return;
    try {
      const payload = JSON.parse(jsonInput) as Record<string, unknown>;
      await apiCreateResource(resource, payload, accessToken);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create record");
    }
  }

  async function handleDelete(itemId: string) {
    if (!accessToken) return;
    const confirmed = window.confirm("Bạn có chắc muốn xóa bản ghi này?");
    if (!confirmed) return;

    try {
      await apiDeleteResource(resource, itemId, accessToken);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete record");
    }
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  function exportVisibleRowsToCsv() {
    if (filteredRows.length === 0 || columns.length === 0) return;

    const csvHeader = columns.join(",");
    const csvBody = filteredRows
      .map((row) =>
        columns
          .map((column) => {
            const raw = serializeCellValue(row[column]).replaceAll('"', '""');
            return `"${raw}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([`${csvHeader}\n${csvBody}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${resource}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, accessToken]);

  if (!accessToken) {
    return <p className="text-sm text-slate-600">Bạn cần đăng nhập để thao tác dữ liệu.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title ?? resource}</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={reload}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="secondary" onClick={exportVisibleRowsToCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold">Quick Create (JSON)</h3>
        <textarea
          className="h-32 w-full rounded border border-slate-300 p-2 font-mono text-xs"
          value={jsonInput}
          onChange={(event) => setJsonInput(event.target.value)}
        />
        <Button onClick={handleCreate}>Create</Button>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tìm kiếm toàn bảng..."
            value={searchKeyword}
            onChange={(event) => {
              setSearchKeyword(event.target.value);
              setPageIndex(0);
            }}
          />
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            {columns.map((column) => (
              <option key={column} value={column}>
                Sort: {column}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPageIndex(0);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} rows / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded border border-slate-200 bg-white overflow-auto">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No data</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">#</th>
                {columns.map((column) => (
                  <th key={column} className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    <button className="inline-flex items-center gap-1" onClick={() => handleSort(column)} type="button">
                      {column}
                      {sortBy === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                    </button>
                  </th>
                ))}
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, idx) => {
                const itemId = serializeCellValue(row.id);

                return (
                  <tr key={`${itemId}-${idx}`} className="odd:bg-white even:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2 align-top">
                      {safePageIndex * pageSize + idx + 1}
                    </td>
                    {columns.map((column) => (
                      <td key={column} className="border-b border-slate-100 px-3 py-2 align-top">
                        <span className="break-all">{serializeCellValue(row[column])}</span>
                      </td>
                    ))}
                    <td className="border-b border-slate-100 px-3 py-2 align-top">
                      {itemId ? (
                        <Button variant="secondary" onClick={() => handleDelete(itemId)}>
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Showing {paginatedRows.length} / {filteredRows.length} rows (total loaded: {rows.length})
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            disabled={safePageIndex <= 0}
          >
            Prev
          </Button>
          <span>
            Page {safePageIndex + 1} / {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
            disabled={safePageIndex + 1 >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
