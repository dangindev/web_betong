import { ModuleSubnav } from "@/components/layout/module-subnav";

const links = [
  {
    href: "/kinh-doanh/bang-gia/danh-sach",
    label: "Danh sách bảng giá",
    description: "Trang danh sách và thao tác CRUD cho bảng giá."
  },
  {
    href: "/kinh-doanh/bang-gia/quy-tac",
    label: "Danh sách quy tắc giá",
    description: "Trang danh sách và thao tác CRUD cho quy tắc giá."
  }
];

export default function SalesPriceBooksHomePage() {
  return (
    <ModuleSubnav
      title="Bảng giá"
      description="Mỗi cấp được tách thành trang riêng: danh sách bảng giá và danh sách quy tắc giá."
      items={links}
    />
  );
}
