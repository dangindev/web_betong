import { ModuleSubnav } from "@/components/layout/module-subnav";

const sections = [
  {
    label: "Định giá & báo giá",
    items: [
      {
        href: "/kinh-doanh/bang-gia/danh-sach",
        label: "Bảng giá",
        description: "Quản lý bảng giá theo hiệu lực và phạm vi áp dụng."
      },
      {
        href: "/kinh-doanh/bang-gia/quy-tac",
        label: "Quy tắc giá",
        description: "Biên tập công thức/rule áp dụng trong từng bảng giá."
      },
      {
        href: "/kinh-doanh/bao-gia",
        label: "Báo giá",
        description: "Tạo báo giá và snapshot kết quả pricing."
      }
    ]
  },
  {
    label: "Đơn hàng & nhu cầu đổ",
    items: [
      {
        href: "/kinh-doanh/yeu-cau-do",
        label: "Yêu cầu đổ",
        description: "Nhập nhu cầu đổ theo khung thời gian và ràng buộc công trình."
      },
      {
        href: "/kinh-doanh/don-hang",
        label: "Đơn hàng",
        description: "Theo dõi đơn bán và liên kết sang điều phối thực thi."
      }
    ]
  }
];

export default function SalesHomePage() {
  return (
    <ModuleSubnav
      title="Điều hành kinh doanh"
      description="Luồng chuẩn: Bảng giá → Quy tắc giá → Báo giá → Yêu cầu đổ → Đơn hàng."
      sections={sections}
    />
  );
}
