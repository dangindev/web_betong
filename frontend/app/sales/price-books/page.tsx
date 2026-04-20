import { ResourcePage } from "@/components/resources/resource-page";

export default function SalesPriceBooksPage() {
  return (
    <div className="space-y-8">
      <ResourcePage resource="price_books" title="Biên tập bảng giá" />
      <ResourcePage resource="price_rules" title="Biên tập quy tắc giá" />
    </div>
  );
}
