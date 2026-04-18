import { ResourcePage } from "@/components/resources/resource-page";

export default function SalesPriceBooksPage() {
  return (
    <div className="space-y-8">
      <ResourcePage resource="price_books" title="Price Book Editor" />
      <ResourcePage resource="price_rules" title="Price Rules Editor" />
    </div>
  );
}
