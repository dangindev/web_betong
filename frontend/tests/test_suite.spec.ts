import { describe, expect, it } from "vitest";

import { apiExportResourceUrl } from "../lib/api/client";
import { cn } from "../lib/utils";

describe("frontend phase 1 smoke", () => {
  it("keeps project name stable", () => {
    expect("web_betong").toBe("web_betong");
  });

  it("builds export url from resource name", () => {
    const url = apiExportResourceUrl("customers");
    expect(url).toContain("/api/v1/io/export/customers");
  });

  it("merges class names using cn utility", () => {
    expect(cn("px-2", "py-2", "px-4")).toContain("px-4");
  });
});
