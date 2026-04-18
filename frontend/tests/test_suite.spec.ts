import { describe, expect, it } from "vitest";

import {
  ApiError,
  apiDispatchRealtimeUrl,
  apiDispatchReportUrl,
  apiExportResourceUrl,
  apiQuotationPdfUrl,
  isAuthError
} from "../lib/api/client";
import { isDispatchTripActive, nextPumpEvent, nextTripEvent } from "../lib/dispatch/state";
import { getPourRequestWarnings } from "../lib/sales/warnings";
import { cn } from "../lib/utils";

describe("frontend phase 2/3 smoke", () => {
  it("keeps project name stable", () => {
    expect("web_betong").toBe("web_betong");
  });

  it("builds export url from resource name", () => {
    const url = apiExportResourceUrl("customers");
    expect(url).toContain("/api/v1/io/export/customers");
  });

  it("builds quotation pdf url", () => {
    const url = apiQuotationPdfUrl("qt-001");
    expect(url).toContain("/api/v1/pricing/quotations/qt-001/pdf");
  });

  it("returns warnings for incomplete pour request", () => {
    const warnings = getPourRequestWarnings({
      requested_volume_m3: 0,
      assigned_plant_id: null,
      requested_start_at: null,
      requested_end_at: null,
      site_contact_name: null,
      site_contact_phone: null
    });

    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("returns no warning for complete pour request", () => {
    const warnings = getPourRequestWarnings({
      requested_volume_m3: 10,
      assigned_plant_id: "plant-a",
      requested_start_at: "2026-04-18T08:00:00Z",
      requested_end_at: "2026-04-18T10:00:00Z",
      site_contact_name: "Nguyen Van A",
      site_contact_phone: "0900000000"
    });

    expect(warnings).toEqual([]);
  });

  it("builds dispatch realtime url", () => {
    const url = apiDispatchRealtimeUrl("org-1");
    expect(url).toContain("/api/v1/dispatch/realtime");
    expect(url).toContain("organization_id=org-1");
  });

  it("builds dispatch report url", () => {
    const csv = apiDispatchReportUrl("org-1", "csv");
    const pdf = apiDispatchReportUrl("org-1", "pdf");
    expect(csv).toContain("report_format=csv");
    expect(pdf).toContain("report_format=pdf");
  });

  it("progresses trip state machine in expected order", () => {
    expect(nextTripEvent("assigned")).toBe("accepted");
    expect(nextTripEvent("load_end")).toBe("depart_plant");
    expect(nextTripEvent("return_plant")).toBeNull();
  });

  it("progresses pump state machine in expected order", () => {
    expect(nextPumpEvent("assigned")).toBe("moving");
    expect(nextPumpEvent("pump_start")).toBe("pump_end");
    expect(nextPumpEvent("teardown_end")).toBeNull();
  });

  it("detects active trip status", () => {
    expect(isDispatchTripActive("assigned")).toBe(true);
    expect(isDispatchTripActive("return_plant")).toBe(false);
  });

  it("merges class names using cn utility", () => {
    expect(cn("px-2", "py-2", "px-4")).toContain("px-4");
  });

  it("classifies auth errors from api client", () => {
    expect(isAuthError(new ApiError(401, "Invalid token", "Invalid token", { detail: "Invalid token" }))).toBe(true);
    expect(isAuthError(new ApiError(403, "User inactive", "User inactive", { detail: "User inactive" }))).toBe(true);
    expect(isAuthError(new ApiError(500, "Internal error", null, null))).toBe(false);
  });
});
