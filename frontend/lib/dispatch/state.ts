export const tripEventSequence = [
  "assigned",
  "accepted",
  "check_in_plant",
  "load_start",
  "load_end",
  "depart_plant",
  "arrive_site",
  "pour_start",
  "pour_end",
  "leave_site",
  "return_plant"
] as const;

export const pumpEventSequence = ["assigned", "moving", "setup_start", "pump_start", "pump_end", "teardown_end"] as const;

export type TripEventType = (typeof tripEventSequence)[number];
export type PumpEventType = (typeof pumpEventSequence)[number];

export function nextTripEvent(currentStatus: string | null | undefined): TripEventType | null {
  const normalized = (currentStatus ?? "assigned") as TripEventType;
  const currentIndex = tripEventSequence.indexOf(normalized);
  if (currentIndex < 0) return "accepted";
  if (currentIndex >= tripEventSequence.length - 1) return null;
  return tripEventSequence[currentIndex + 1];
}

export function nextPumpEvent(currentStatus: string | null | undefined): PumpEventType | null {
  const normalized = (currentStatus ?? "assigned") as PumpEventType;
  const currentIndex = pumpEventSequence.indexOf(normalized);
  if (currentIndex < 0) return "moving";
  if (currentIndex >= pumpEventSequence.length - 1) return null;
  return pumpEventSequence[currentIndex + 1];
}

export function isDispatchTripActive(status: string | null | undefined): boolean {
  if (!status) return true;
  return status !== "return_plant";
}
