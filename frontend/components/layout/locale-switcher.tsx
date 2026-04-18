"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setLocale(nextLocale: "vi" | "en") {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale })
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <select
      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
      disabled={pending}
      value={locale}
      onChange={(event) => setLocale(event.target.value as "vi" | "en")}
    >
      <option value="vi">VI</option>
      <option value="en">EN</option>
    </select>
  );
}
