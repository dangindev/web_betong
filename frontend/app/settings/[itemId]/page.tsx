import { ResourceDetailPage } from "@/components/resources/resource-detail-page";

type SettingsDetailPageProps = {
  params: Promise<{ itemId: string }>;
};

export default async function SettingsDetailPage({ params }: SettingsDetailPageProps) {
  const { itemId } = await params;

  return (
    <ResourceDetailPage
      resource="system_settings"
      itemId={itemId}
      title="Chi tiết cấu hình hệ thống"
      backHref="/cau-hinh-he-thong"
      backLabel="Quay lại cấu hình hệ thống"
    />
  );
}
