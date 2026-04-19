export type PourRequestLike = {
  requested_start_at?: string | null;
  requested_end_at?: string | null;
  assigned_plant_id?: string | null;
  site_contact_name?: string | null;
  site_contact_phone?: string | null;
  requested_volume_m3?: number | null;
};

export function getPourRequestWarnings(item: PourRequestLike): string[] {
  const warnings: string[] = [];

  if (!item.assigned_plant_id) {
    warnings.push("Chưa gán trạm cấp");
  }
  if (!item.requested_start_at || !item.requested_end_at) {
    warnings.push("Thiếu khung giờ chuẩn");
  }
  if (!item.site_contact_name || !item.site_contact_phone) {
    warnings.push("Thiếu liên hệ công trình");
  }
  if (!item.requested_volume_m3 || Number(item.requested_volume_m3) <= 0) {
    warnings.push("Khối lượng chưa hợp lệ");
  }

  return warnings;
}
