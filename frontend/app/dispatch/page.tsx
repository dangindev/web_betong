import { ModuleSubnav } from "@/components/layout/module-subnav";

const sections = [
  {
    label: "Lập lịch điều phối",
    items: [
      {
        href: "/dieu-phoi/hop-cho",
        label: "Hộp chờ điều phối",
        description: "Duyệt yêu cầu và chuẩn bị dữ liệu trước khi chạy scheduler."
      },
      {
        href: "/dieu-phoi/bang-dieu-phoi",
        label: "Bảng điều phối",
        description: "Theo dõi kế hoạch xe/cần bơm và xử lý override."
      }
    ]
  },
  {
    label: "Hàng chờ trạm",
    items: [
      {
        href: "/dieu-phoi/hang-cho-tram",
        label: "Danh sách chuyến chờ",
        description: "Giám sát nhịp nạp tại trạm theo từng chuyến đã lập lịch."
      },
      {
        href: "/dieu-phoi/hang-cho-tram/khung-nang-luc-tram",
        label: "Khung năng lực trạm",
        description: "Xem và theo dõi slot công suất theo trạm."
      }
    ]
  },
  {
    label: "Đối soát & theo dõi vận hành",
    items: [
      {
        href: "/dieu-phoi/doi-soat",
        label: "Đối soát",
        description: "Chốt actual volume/trip và mã lý do sai lệch cuối ca."
      },
      {
        href: "/dieu-phoi/kpi",
        label: "KPI vận hành",
        description: "Xem chỉ số on-time, vòng quay xe, utilization theo ngày."
      }
    ]
  },
  {
    label: "Vận hành di động",
    items: [
      {
        href: "/di-dong/tai-xe",
        label: "PWA tài xế",
        description: "Nhận chuyến và gửi event vòng đời chuyến."
      },
      {
        href: "/di-dong/doi-bom",
        label: "PWA đội bơm",
        description: "Theo dõi session bơm và cập nhật tiến độ tại hiện trường."
      }
    ]
  }
];

export default function DispatchHomePage() {
  return (
    <ModuleSubnav
      title="Điều phối vận hành"
      description="Luồng chuẩn: Hộp chờ → Scheduler → Hàng chờ trạm → Đối soát → KPI."
      sections={sections}
    />
  );
}
