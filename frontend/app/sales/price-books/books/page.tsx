import { ModuleSubnav } from "@/components/layout/module-subnav";
import { ResourcePage } from "@/components/resources/resource-page";

const links = [
  {
    href: "/kinh-doanh/bang-gia/danh-sach",
    label: "Danh sách bảng giá",
    description: "CRUD bảng giá theo hiệu lực."
  },
  {
    href: "/kinh-doanh/bang-gia/quy-tac",
    label: "Danh sách quy tắc giá",
    description: "CRUD quy tắc tính giá."
  }
];

export default function SalesPriceBooksListPage() {
  return (
    <div className="space-y-4">
      <ModuleSubnav
        title="Bảng giá"
        description="Trang danh sách bảng giá (list) tách riêng khỏi trang chi tiết bản ghi."
        items={links}
      />
      <ResourcePage resource="price_books" title="Danh sách bảng giá" />
    </div>
  );
}
