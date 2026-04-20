import { ResourceDetailPage } from "@/components/resources/resource-detail-page";

type MasterResourceDetailPageProps = {
  params: Promise<{ resource: string; itemId: string }>;
};

const RESOURCE_LIST_PATHS: Record<string, string> = {
  customers: "/danh-muc/khach-hang",
  project_sites: "/danh-muc/cong-trinh"
};

export default async function MasterResourceDetailPage({ params }: MasterResourceDetailPageProps) {
  const { resource, itemId } = await params;
  const backHref = RESOURCE_LIST_PATHS[resource] ?? "/danh-muc/khach-hang";

  return (
    <ResourceDetailPage
      resource={resource}
      itemId={itemId}
      backHref={backHref}
      backLabel="Quay lại danh sách danh mục"
    />
  );
}
