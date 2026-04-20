import { ResourceDetailPage } from "@/components/resources/resource-detail-page";

type SalesPriceBookDetailPageProps = {
  params: Promise<{ itemId: string }>;
};

export default async function SalesPriceBookDetailPage({ params }: SalesPriceBookDetailPageProps) {
  const { itemId } = await params;

  return (
    <ResourceDetailPage
      resource="price_books"
      itemId={itemId}
      title="Chi tiết bảng giá"
      backHref="/kinh-doanh/bang-gia/danh-sach"
      backLabel="Quay lại danh sách bảng giá"
    />
  );
}
