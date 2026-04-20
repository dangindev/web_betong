import { ResourceDetailPage } from "@/components/resources/resource-detail-page";

type SalesPriceRuleDetailPageProps = {
  params: Promise<{ itemId: string }>;
};

export default async function SalesPriceRuleDetailPage({ params }: SalesPriceRuleDetailPageProps) {
  const { itemId } = await params;

  return (
    <ResourceDetailPage
      resource="price_rules"
      itemId={itemId}
      title="Chi tiết quy tắc giá"
      backHref="/kinh-doanh/bang-gia/quy-tac"
      backLabel="Quay lại danh sách quy tắc giá"
    />
  );
}
