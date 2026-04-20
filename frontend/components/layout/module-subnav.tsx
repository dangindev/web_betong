"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type ModuleSubnavItem = {
  href: string;
  label: string;
  description?: string;
};

export type ModuleSubnavSection = {
  id?: string;
  label: string;
  description?: string;
  items: ModuleSubnavItem[];
};

type ModuleSubnavProps = {
  title: string;
  description?: string;
  items?: ModuleSubnavItem[];
  sections?: ModuleSubnavSection[];
};

export function ModuleSubnav({ title, description, items, sections }: ModuleSubnavProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const resolvedSections = sections && sections.length > 0
    ? sections
    : items && items.length > 0
      ? [{ id: "default", label: "", items }]
      : [];

  return (
    <section className="ta-card space-y-4 p-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
      </div>

      <div className="space-y-3">
        {resolvedSections.map((section, index) => {
          const sectionKey = section.id ?? `${section.label}-${index}`;
          return (
            <div key={sectionKey} className="space-y-2">
              {section.label ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>
                  {section.description ? <p className="mt-1 text-xs text-slate-500">{section.description}</p> : null}
                </div>
              ) : null}

              <div className="ta-link-list">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "ta-link-list-item",
                        active && "bg-brand-50 text-brand-700"
                      )}
                    >
                      <span>
                        <span className="block font-medium">{item.label}</span>
                        {item.description ? <span className="mt-0.5 block text-xs text-gray-500">{item.description}</span> : null}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
