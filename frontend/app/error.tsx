"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
      <h2 className="text-lg font-semibold">Đã xảy ra lỗi</h2>
      <p className="text-sm">{error.message}</p>
      <button className="rounded bg-red-600 px-3 py-2 text-white" onClick={reset}>
        Thử lại
      </button>
    </div>
  );
}
