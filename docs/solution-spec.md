# ĐẶC TẢ YÊU CẦU CHI TIẾT HỆ THỐNG WEB_BETONG

Phiên bản: 1.0  
Phạm vi: Phase 1 - Dispatch + Scheduling, Phase 2 - Costing  
Định hướng công nghệ: Next.js cho frontend, Python cho backend, kiến trúc đa tầng, bảo mật cao, hiệu năng tốt, ổn định và chịu tải tốt.

---

## 1. Tóm tắt điều hành

Đây là bài toán xây dựng một nền tảng điều hành toàn chuỗi bê tông gồm 2 khối lớn:
1. Điều phối đơn hàng đổ bê tông tươi, lập lịch xe trộn - cần bơm - trạm trộn.
2. Tính giá thành từ khai thác đá, nghiền đá, tồn kho đầu vào đến bê tông thành phẩm.

### 1.1 Mục tiêu cốt lõi
- Gom toàn bộ nhu cầu từ 08 đầu mối sale về 01 hệ thống thống nhất.
- Tự động gợi ý lịch cho 24 xe trộn + 03 cần bơm.
- Giảm trùng lịch, thiếu xe, thiếu cần, trễ giờ, dồn chuyến gây kẹt trạm.
- Giảm km rỗng và tăng vòng quay xe.
- Chuẩn hóa giá bán theo công thức cấu hình được, không hard-code.
- Chuẩn hóa dữ liệu chi phí để tính giá thành theo kỳ và theo sản phẩm.
- Kết nối được doanh thu - giá vốn - biên lợi nhuận theo đơn hàng và công trình.

### 1.2 Giải pháp công nghệ khuyến nghị
- Frontend: Next.js + TypeScript + App Router.
- Backend API: FastAPI (Python).
- Worker nền: Celery/RQ + Redis.
- Database giao dịch: PostgreSQL + PostGIS.
- Cache / realtime / queue: Redis.
- File storage: MinIO hoặc S3.
- Scheduler:
  - Giai đoạn 1: heuristic + rule-based.
  - Giai đoạn 2: OR-Tools / optimization worker.
- Observability: Prometheus + Grafana + Sentry.

### 1.3 Kết luận triển khai
Không nên làm “big bang” toàn hệ thống trong 1 lần. Nên chia rõ:
1. Foundation + master data + phân quyền.
2. Sales request + pricing + scheduling MVP.
3. Dispatch execution + mobile hiện trường + đối soát.
4. Inventory + costing.
5. Optimization nâng cao + BI.

---

## 2. Phân tích nghiệp vụ chi tiết

## 2.1 Bài toán hiện trạng

### 2.1.1 Điều phối đổ bê tông
- Nguồn đơn phân tán ở nhiều sale, dễ lệch thông tin.
- Điều phối phụ thuộc nhiều vào kinh nghiệm cá nhân.
- Xe/cần/trạm là tài nguyên hữu hạn nhưng yêu cầu có time window.
- Thời gian chạy phụ thuộc khoảng cách, traffic, công trình và độ khó.
- Nếu thiếu hệ thống trung tâm, thường gặp:
  - công trình bị dồn hoặc đói xe;
  - cần bơm chồng lịch;
  - trạm nghẽn khi nhiều xe check-in cùng lúc;
  - xe chạy rỗng nhiều;
  - khó giải thích vì sao trễ hoặc vì sao thiếu tài nguyên.

### 2.1.2 Giá bán
Giá bán thực tế không chỉ phụ thuộc mác bê tông mà còn phụ thuộc:
- loại / mác bê tông;
- khoảng cách hoặc thời gian di chuyển;
- mức độ khó công trình;
- phương án thi công;
- loại cần bơm;
- phụ phí theo giờ, cấm tải, set-up, tầng cao, đường hẹp, phát sinh.

Nếu hard-code công thức giá trong code, hệ thống sẽ khó thay đổi và khó kiểm soát. Vì vậy phải làm theo cơ chế ruleset cấu hình được.

### 2.1.3 Giá thành
Doanh nghiệp cần biết:
- 1 tấn đá 1x2 giá thành bao nhiêu;
- 1 m3 bê tông mác X giá thành bao nhiêu;
- điện, nhân công, hao hụt, sửa chữa, khấu hao đang được phân bổ ra sao;
- công đoạn nào đang đội chi phí;
- đơn hàng nào lãi / lỗ.

Như vậy hệ thống phải nối được chuỗi:
**khai thác đá -> nghiền -> tồn kho đá thành phẩm -> phối trộn -> giao hàng -> giá vốn -> lãi gộp**.

## 2.2 Mục tiêu theo phase

### 2.2.1 Phase 1 - Dispatch + Scheduling
- Tập trung hóa yêu cầu đổ bê tông.
- Tự động gợi ý lịch xe và cần bơm.
- Quản lý kế hoạch ngày / kế hoạch ca.
- Ghi nhận thực tế tài xế và tổ bơm.
- Chốt actual và đo KPI vận hành.

### 2.2.2 Phase 2 - Costing
- Tập hợp chi phí theo công đoạn.
- Quản lý nhập / xuất / tồn vật tư và sản lượng.
- Tính giá thành theo kỳ, theo sản phẩm và theo cost center.
- Kết nối giá vốn với doanh thu để xem biên lợi nhuận.

## 2.3 KPI đề xuất
- On-time delivery >= 90% giai đoạn đầu.
- Tỷ lệ xung đột sau auto schedule < 5%.
- Km rỗng giảm 10-20% sau 3-6 tháng.
- Tỷ lệ dữ liệu actual đầy đủ >= 95%.
- 100% báo giá sinh từ bảng giá cấu hình.
- Có báo cáo unit cost đá / bê tông theo kỳ.

## 2.4 Giả định và phụ thuộc
- Ban đầu có thể thiếu dữ liệu ETA thực tế, nên cần tham số mặc định.
- Cần 4-8 tuần actual data để hiệu chỉnh scheduler tốt hơn.
- Có thể tích hợp map/routing bên thứ ba.
- Có thể bắt đầu bằng web mobile nếu chưa muốn làm native app.

---

## 3. Phạm vi theo giai đoạn

## 3.1 In-scope Phase 1
- CRM khách hàng / công trình.
- Báo giá và pricing rules.
- Yêu cầu đổ bê tông.
- Duyệt điều phối.
- Scheduler gợi ý lịch.
- Bảng Gantt / kéo-thả / khóa chuyến.
- App tài xế, app tổ bơm.
- Theo dõi chuyến, chốt thực tế, KPI vận hành.

## 3.2 In-scope Phase 2
- Danh mục vật tư, kho, tồn kho.
- Ghi nhận sản lượng nghiền đá.
- Ghi nhận batch ticket trộn bê tông.
- Cost center, cost period, cost allocation.
- Tính giá thành đá và bê tông.
- Báo cáo margin.

## 3.3 Out-of-scope ở vòng đầu
- Kế toán tài chính full.
- Payroll full.
- ERP procurement full.
- AI dự báo nhu cầu dài hạn.

---

## 4. Vai trò người dùng

| Vai trò | Mục tiêu | Quyền chính |
|---|---|---|
| System Admin | quản trị nền tảng | users, roles, settings, audit |
| Sales | tạo khách hàng, công trình, báo giá, yêu cầu đổ | CRUD dữ liệu sale |
| Sales Manager | kiểm soát giá ngoại lệ | duyệt discount/override |
| Dispatcher | điều phối trung tâm | duyệt đơn, chốt trạm, chốt cần, lập lịch, override |
| Plant Operator | vận hành trạm | queue, load start/end, batch ticket |
| Driver | tài xế xe trộn | nhận chuyến, check-in/out, event thực tế |
| Pump Crew | tổ bơm | nhận lịch, setup, start/end pump, m3 thực tế |
| Ops Manager | quản trị vận hành | xem dashboard, KPI, duyệt thay đổi lớn |
| Cost Accountant | kế toán giá thành | cost period, allocation, costing |
| Director/Finance | lãnh đạo | báo cáo tổng hợp, margin, unit cost |

**Nguyên tắc phân quyền**
- RBAC theo vai trò + phạm vi plant / business unit.
- Chỉnh sửa sau khi phát hành kế hoạch phải có audit.
- Dữ liệu nhạy cảm như giá, costing, margin phải được khóa theo quyền.

---

## 5. Luồng nghiệp vụ end-to-end

## 5.1 Luồng chuẩn Phase 1
1. Sales tạo khách hàng / công trình.
2. Sales tạo báo giá hoặc chọn bảng giá.
3. Sales tạo yêu cầu đổ bê tông.
4. Hệ thống tính giá sơ bộ.
5. Dispatcher duyệt đơn, chọn trạm, chọn phương án bơm.
6. Scheduler gợi ý lịch xe + cần + queue trạm.
7. Dispatcher tinh chỉnh trên Gantt nếu cần.
8. Phát hành kế hoạch ngày / ca.
9. Driver và pump crew nhận lịch trên app.
10. Hệ thống ghi actual events.
11. Cuối ca chốt actual volume, actual thời gian, đối soát phát sinh.
12. Dashboard và KPI được cập nhật.

## 5.2 Luồng chuẩn Phase 2
1. Ghi nhận nhập vật tư, điện, nhân công, sửa chữa, khấu hao.
2. Ghi nhận sản lượng nghiền đá.
3. Ghi nhận tồn kho đá thành phẩm.
4. Ghi nhận batch ticket bê tông và tiêu hao.
5. Chạy allocation engine.
6. Sinh snapshot giá thành theo kỳ.
7. Nối giá thành với đơn hàng để ra margin.

## 5.3 Luồng ngoại lệ bắt buộc phải hỗ trợ
- Đổi giờ thi công.
- Tăng / giảm khối lượng.
- Xe hỏng, cần hỏng, trạm dừng đột xuất.
- Đơn bị hủy một phần hoặc toàn phần.
- Thiếu dữ liệu do mất mạng -> phải hỗ trợ offline sync.
- Phụ phí phát sinh sau thi công.


---

## 6. Đặc tả yêu cầu chức năng chi tiết

## 6.1 FR-01 - Quản lý khách hàng, công trình, tọa độ và điều kiện thi công
**Mục tiêu:** chuẩn hóa đầu vào cho sales và dispatch.

**Hệ thống phải cho phép:**
- tạo / sửa / khóa khách hàng;
- quản lý nhiều công trình cho một khách hàng;
- lưu địa chỉ chuẩn, tọa độ, vùng, tuyến đường;
- lưu điều kiện công trình dạng cấu hình: hẻm nhỏ, cấm giờ, tầng cao, đường xấu, yêu cầu bơm, set-up tăng thêm;
- đính kèm ảnh, sơ đồ, ghi chú đặc biệt.

**Business rules:**
- Mỗi công trình phải có địa chỉ hợp lệ.
- Nên geocode trước khi đưa vào auto scheduling.
- Điều kiện công trình phải mở rộng được, không hard-code cố định vài loại.

## 6.2 FR-02 - Quản lý bảng giá, báo giá và engine tính giá
**Mục tiêu:** chuẩn hóa giá bán và cho phép thay đổi bằng cấu hình.

**Hệ thống phải cho phép:**
- khai báo bảng giá theo hiệu lực thời gian;
- khai báo base price theo mác / sản phẩm;
- khai báo distance fee theo km hoặc theo phút;
- khai báo difficulty fee theo level hoặc checklist điểm;
- khai báo pump fee theo loại cần, chiều cao, setup time;
- khai báo surcharge: giờ cao điểm, cấm tải, đêm, chờ lâu, phát sinh;
- lưu snapshot giá tại thời điểm báo giá / chốt đơn.

**Công thức gợi ý:**
`FinalUnitPrice = BasePrice + DistanceFee + DifficultyFee + PumpFee + Surcharge - Discount`

**Business rules:**
- Không hard-code công thức trong code business.
- Rule phải versioned theo thời gian hiệu lực.
- Giá đã báo cho khách phải lưu snapshot riêng, không bị thay đổi khi ruleset hiện hành đổi.

## 6.3 FR-03 - Tạo yêu cầu đổ bê tông
**Mục tiêu:** nhập đơn vận hành chuẩn hóa.

**Dữ liệu tối thiểu bắt buộc:**
- mã yêu cầu / mã đơn;
- khách hàng;
- công trình;
- loại / mác bê tông;
- khối lượng m3;
- thời gian mong muốn hoặc time window;
- đổ trực tiếp hay bơm;
- độ khó / điều kiện công trình;
- người liên hệ tại công trình.

**Hệ thống phải cho phép:**
- một sales order có nhiều pour request;
- đính kèm file hiện trường;
- tính giá sơ bộ tự động;
- cảnh báo nếu thiếu dữ liệu làm scheduler hoạt động kém chính xác.

## 6.4 FR-04 - Duyệt điều phối và chốt phương án vận hành
**Mục tiêu:** biến yêu cầu sale thành yêu cầu điều phối khả thi.

**Dispatcher phải làm được:**
- duyệt / từ chối / yêu cầu bổ sung thông tin;
- chọn trạm cấp;
- chọn phương án bơm;
- chốt khung giờ thực tế;
- nhập nhịp xe mục tiêu;
- khóa các tham số mà scheduler không được đổi.

**Business rules:**
- Đơn chưa duyệt không được phát hành.
- Các field đã khóa tay phải được scheduler tôn trọng.
- Mọi thay đổi sau khi phát hành phải có before/after audit.

## 6.5 FR-05 - Máy lập lịch tự động
**Mục tiêu:** gợi ý lịch khả thi, giảm xung đột và giảm km rỗng.

**Đầu vào của scheduler:**
- pour requests đã duyệt;
- năng lực trạm;
- xe khả dụng theo ca;
- cần bơm khả dụng theo ca;
- ETA / route estimates;
- tham số load/unload/setup/wash;
- resource locks và các chuyến đã khóa.

**Ràng buộc chính:**
- xe không thể ở 2 nơi cùng lúc;
- cần không thể ở 2 công trình cùng lúc;
- trạm có năng lực xuất hữu hạn theo time bucket;
- phải đủ số chuyến để hoàn thành m3;
- phải tôn trọng time window;
- cycle time xe phải khả thi;
- thời gian di chuyển + setup + bơm + teardown của cần phải khả thi.

**Đầu ra bắt buộc:**
- gợi ý plant;
- gợi ý pump;
- gợi ý số chuyến và thứ tự chuyến;
- xe nào đi chuyến nào;
- planned load/depart/arrive/unload/return;
- conflict list;
- explanation score.

## 6.6 FR-06 - Bảng điều phối Gantt và manual override
**Mục tiêu:** con người vẫn làm chủ lịch điều phối.

**Hệ thống phải có:**
- Gantt theo tài nguyên xe / cần;
- Gantt theo đơn / công trình;
- kéo-thả chuyến;
- đổi xe / đổi cần;
- khóa chuyến / khóa đơn;
- phát hiện conflict realtime sau khi kéo-thả;
- version history của lịch.

**Business rules:**
- Manual override luôn thắng auto schedule.
- Chuyến đã khóa không được re-optimize nếu không có quyền phù hợp.
- Thay đổi lịch ảnh hưởng hiện trường phải phát thông báo realtime.

## 6.7 FR-07 - Điều phối trạm, queue loading và phát hành lệnh chạy
**Mục tiêu:** kiểm soát nghẽn trạm và phát hành chuyến theo ca.

**Hệ thống phải cho phép:**
- quản lý năng lực trạm theo giờ / ca;
- quản lý queue slot;
- xem số xe đang chờ;
- phát hành lệnh chạy theo ca;
- plant operator xác nhận load start / load end;
- quản lý batch ticket nếu có.

**Business rules:**
- Tổng volume tại một slot không vượt năng lực trạm.
- Nếu vượt, scheduler phải dời chuyến hoặc gắn conflict.
- Trạm có thể unavailable tạm thời và scheduler phải tránh cấp mới.

## 6.8 FR-08 - App tài xế / web mobile tài xế
**Mục tiêu:** ghi nhận actual hành trình.

**Chức năng bắt buộc:**
- xem danh sách chuyến hôm nay;
- nhận chuyến;
- check-in trạm;
- load start / load end;
- depart plant;
- arrive site;
- pour start / pour end;
- leave site;
- return plant;
- chụp ảnh phiếu / chứng từ;
- nhập ghi chú phát sinh;
- offline sync khi mất mạng.

**Business rules:**
- Event log phải append-only, không sửa đè.
- Nếu có GPS, phải lấy theo chu kỳ hợp lý để không bùng nổ dữ liệu.

## 6.9 FR-09 - App tổ bơm
**Mục tiêu:** ghi nhận actual của cần bơm và phát sinh thi công.

**Chức năng bắt buộc:**
- xem lịch cần theo ngày / ca;
- xác nhận di chuyển / set-up / start pump / end pump;
- nhập m3 thực tế bơm;
- nhập phát sinh độ khó / chờ đợi / phụ phí;
- đính kèm ảnh / biên bản.

**Business rules:**
- Khối lượng bơm thực tế phải đối soát được với khối lượng giao.
- Phụ phí phát sinh phải qua rule hoặc approval flow.

## 6.10 FR-10 - Chốt actual, đối soát và báo cáo vận hành
**Mục tiêu:** so sánh kế hoạch với thực tế và đo hiệu quả.

**Hệ thống phải cho phép:**
- chốt actual volume;
- chốt actual trip count;
- ghi nhận lý do lệch;
- đo đúng giờ / trễ;
- đo thời gian chờ trạm / công trình;
- đo vòng quay xe;
- đo utilization xe và cần;
- đo km rỗng nếu có route/GPS.

**Báo cáo cần có:**
- kế hoạch vs thực tế theo ngày / tuần / tháng;
- hiệu suất theo xe;
- hiệu suất theo cần;
- hiệu suất theo trạm;
- tỷ lệ trễ;
- số chuyến / ngày;
- khối lượng theo khách hàng / công trình.


## 6.11 FR-11 - Cấu hình hệ thống và tham số mặc định
**Mục tiêu:** cho hệ thống chạy được ngay cả khi dữ liệu lịch sử chưa đủ.

**Phải cấu hình được:**
- tốc độ di chuyển mặc định theo vùng / khung giờ;
- thời gian load mặc định theo trạm;
- thời gian unload / pump rate mặc định;
- setup / teardown mặc định của từng loại cần;
- effective truck capacity;
- buffer time và cảnh báo scheduler.

## 6.12 FR-12 - Tích hợp bản đồ, thông báo và kênh ngoài
**Mục tiêu:** lấy ETA và thông báo nhanh cho nội bộ / khách hàng.

**Tích hợp đề xuất:**
- geocode / routing / ETA;
- Zalo / SMS / email;
- webhook nội bộ;
- export Excel / PDF.

**Business rules:**
- Không phụ thuộc chặt vào một nhà cung cấp map duy nhất.
- Tất cả tích hợp phải thông qua adapter layer.

## 6.13 FR-13 - Quản lý cost center, cost period và cost object
**Mục tiêu:** làm nền cho costing.

**Hệ thống phải cho phép:**
- định nghĩa cost center: khai thác, nghiền, vận chuyển nội bộ, trạm trộn, bơm, admin;
- định nghĩa cost object: đá 1x2, đá 0x4, bê tông mác X, dịch vụ bơm;
- mở / đóng kỳ giá thành theo ngày / tuần / tháng.

## 6.14 FR-14 - Quản lý vật tư, nhập xuất tồn
**Mục tiêu:** có dữ liệu đầu vào cho costing.

**Phải quản lý được:**
- xi măng, phụ gia, cát, đá, nước, dầu, mỡ, phụ tùng;
- kho, vị trí kho;
- phiếu nhập;
- phiếu xuất;
- điều chuyển;
- điều chỉnh tồn;
- hao hụt / phế phẩm.

**Business rules:**
- Mỗi movement kho phải có source reference.
- Không sửa trực tiếp số tồn cuối, mọi thay đổi phải đi qua transaction.

## 6.15 FR-15 - Ghi nhận sản xuất đá và sản xuất bê tông
**Mục tiêu:** lấy sản lượng chuẩn để phân bổ chi phí.

**Phải ghi nhận được:**
- ca nghiền, dây chuyền, input stone, output stone;
- runtime / downtime;
- điện tiêu thụ hoặc công tơ;
- batch ticket bê tông;
- mix design chuẩn và actual adjustment.

## 6.16 FR-16 - Engine phân bổ chi phí và tính giá thành
**Mục tiêu:** tính giá thành theo công đoạn và theo sản phẩm.

**Phải hỗ trợ:**
- direct material;
- direct labor;
- electricity / utilities;
- maintenance;
- depreciation;
- overhead allocation;
- variance analysis ở giai đoạn sau.

**Phương pháp gợi ý:**
- Giai đoạn đầu: actual + phân bổ theo sản lượng / runtime / tỷ lệ.
- Giai đoạn sau: bổ sung định mức và variance chuẩn.

## 6.17 FR-17 - Báo cáo quản trị biên lợi nhuận
**Mục tiêu:** kết nối doanh thu với giá vốn.

**Báo cáo cần có:**
- lãi gộp theo đơn;
- lãi gộp theo khách hàng;
- lãi gộp theo công trình;
- lãi gộp theo mác;
- so sánh báo giá, giá bán thực tế, giá vốn.

## 6.18 FR-18 - Bảo mật, phân quyền, audit và quản trị dữ liệu
**Mục tiêu:** bảo vệ dữ liệu và tạo niềm tin vận hành.

**Phải có:**
- RBAC;
- audit log;
- session management;
- giới hạn truy cập theo plant / business unit;
- lưu trước/sau khi đổi giá, đổi lịch;
- ký số hoặc xác nhận điện tử nội bộ nếu cần trong tương lai.

---

## 7. Yêu cầu phi chức năng

## 7.1 Hiệu năng
- Trang danh sách phổ biến nên phản hồi < 2 giây với filter/pagination đúng chuẩn.
- Live dispatch board cập nhật gần realtime, độ trễ mục tiêu < 3 giây.
- Scheduler heuristic cho kế hoạch ngày nên phản hồi trong 30 giây đến 2 phút tùy số đơn.
- Bảng dữ liệu lớn phải dùng server-side pagination, index tốt và virtualized rendering.

## 7.2 Khả năng mở rộng
- Mô hình dữ liệu phải mở rộng cho nhiều trạm, nhiều kho, nhiều khu vực.
- Có thể tăng từ 24 xe lên 50-100 xe mà không phải viết lại core.
- Bảng event lớn phải partition theo thời gian.
- Có thể scale worker độc lập với API.

## 7.3 Tính sẵn sàng và ổn định
- Uptime mục tiêu >= 99.5%.
- Có backup, restore, retry queue, health check.
- Có monitoring, alerting, slow query tracking.

## 7.4 Bảo mật
- TLS everywhere.
- Password hash bằng Argon2 hoặc bcrypt.
- JWT access token ngắn hạn + refresh token rotation.
- Rate limit cho API public/mobile.
- Signed URL cho file đính kèm.
- Secrets không lưu trong repo.

## 7.5 Kiểm thử và bảo trì
- Code chia tầng rõ ràng.
- Có unit test, integration test, e2e cho luồng quan trọng.
- Có Alembic migrations, seed data, feature flags.

---

## 8. Kiến trúc giải pháp đề xuất

## 8.1 Stack công nghệ

### Frontend
- Next.js 15+
- TypeScript strict mode
- TanStack Query cho data fetching / cache
- Zustand hoặc Redux Toolkit cho client state
- Data Grid có virtual scroll cho bảng lớn
- WebSocket hoặc SSE cho live board

### Backend
- FastAPI
- Pydantic
- SQLAlchemy 2.x
- Alembic
- Celery/RQ worker
- Redis
- PostgreSQL 16 + PostGIS
- OR-Tools cho optimizer nâng cao

### Hạ tầng
- Docker cho dev/staging/prod
- Nginx / Traefik
- MinIO / S3
- Prometheus + Grafana
- Sentry
- CI/CD GitHub Actions hoặc GitLab CI

## 8.2 Kiến trúc đa tầng
- Presentation Layer: Next.js web, mobile web.
- API Layer: auth, validation, serialization, versioning.
- Application Layer: use cases như create request, calculate price, run scheduler, close cost period.
- Domain Layer: pricing, dispatch, inventory, costing.
- Infrastructure Layer: ORM, map adapter, notification adapter, storage adapter.
- Worker Layer: optimizer, notifications, aggregates, costing jobs.
- Reporting Layer: materialized views, denormalized read models.

## 8.3 Kiến trúc dữ liệu cho tốc độ cao
- OLTP dùng PostgreSQL chuẩn hóa.
- Redis cho session, hot cache, queue, realtime summary.
- Materialized views cho dashboard nặng.
- Partition cho trip_events, audit_logs, inventory_transactions, location_logs.
- PostGIS cho geospatial queries.
- CQRS-lite: ghi vào transactional tables, đọc từ optimized views khi phù hợp.


---

## 9. Thiết kế máy lập lịch thực dụng

## 9.1 Input dữ liệu
- đơn đã duyệt;
- trạm khả dụng và năng lực theo giờ;
- xe khả dụng theo ca;
- cần bơm khả dụng theo ca;
- ETA / route estimates giữa trạm và công trình;
- thời gian load/unload/setup/wash mặc định hoặc learned;
- resource locks;
- các chuyến / đơn đã khóa tay.

## 9.2 Output dữ liệu
- assigned plant;
- assigned pump;
- số chuyến yêu cầu;
- xe nào đi chuyến nào;
- planned load / depart / arrive / unload / return;
- conflict list;
- score breakdown và giải thích.

## 9.3 Ràng buộc phải mô hình hóa
- time window của công trình;
- plant capacity theo slot;
- xe và tài xế không trùng lịch;
- cần bơm không trùng lịch;
- loại xe / loại bơm phù hợp công trình;
- maintenance / breakdown lock;
- manual lock;
- cấm tải / hạn chế giờ.

## 9.4 Công thức cơ sở gợi ý
- `required_trip_count = ceil(requested_volume_m3 / effective_truck_capacity_m3)`
- `cycle_minutes = load + outbound + wait_site + unload_or_pump + cleanup + return`
- `required_concurrent_trucks = ceil((pump_rate_m3_per_hour * cycle_minutes / 60) / effective_truck_capacity_m3)`

## 9.5 Thuật toán phiên bản 1 - Heuristic + rule-based
1. Chuẩn hóa input.
2. Chọn candidate plants.
3. Tính ETA và cycle time.
4. Tính số chuyến cần.
5. Chọn candidate pumps.
6. Sắp đơn theo ưu tiên: time window chặt, đơn có pump, đơn volume lớn, đơn khó.
7. Gán tài nguyên bằng greedy heuristic:
   - ưu tiên plant gần hơn;
   - ưu tiên xe thuộc plant đó;
   - ưu tiên giữ nhịp xe đều;
   - ưu tiên giảm queue và empty km.
8. Sinh conflict list cho phần chưa tối ưu / chưa khả thi.
9. Trả explanation để dispatcher hiểu vì sao gợi ý như vậy.

## 9.6 Thuật toán phiên bản 2 - Optimization nâng cao
- Dùng OR-Tools khi đã đủ actual data và cần giảm chi phí hơn nữa.
- Mô hình như VRP with time windows + resource constraints + plant capacity.
- Objective ưu tiên: khả thi > đúng giờ > giảm empty km > giảm nghẽn trạm > cân bằng utilization.

## 9.7 Manual override là bắt buộc
- kéo-thả chuyến;
- khóa chuyến;
- khóa đơn;
- khóa tài nguyên;
- lý do override;
- lưu lịch sử trước/sau.

## 9.8 Learning loop
- Ghi actual timeline từng trip.
- So sánh estimated vs actual theo tuyến, giờ, công trình, loại bơm.
- Cập nhật tham số ETA và score weights theo dữ liệu thật.

---

## 10. Thiết kế engine tính giá

## 10.1 Nguyên tắc
- Không hard-code giá trong code business.
- Giá phải versioned theo hiệu lực.
- Giá đã chốt phải lưu snapshot.
- Giá phải giải thích được theo từng thành phần.

## 10.2 Cấu trúc rule gợi ý
- BasePrice(product / grade)
- DistanceFee(distance_band hoặc duration_band)
- DifficultyFee(level hoặc score)
- PumpFee(pump_type, setup_time, floor_level)
- Surcharge(time_of_day, restricted_road, waiting, holiday)
- Discount(policy hoặc manual approved)

## 10.3 Thứ tự ưu tiên rule
1. Price book theo khu vực / plant / khách hàng.
2. Rule chi tiết hơn thắng rule chung hơn.
3. Rule có priority cao hơn thắng nếu cùng phạm vi.
4. Manual price override phải có reason + approver.

---

## 11. Thiết kế engine tính giá thành

## 11.1 Đối tượng chịu phí
- đá thành phẩm theo loại;
- bê tông theo product code / mác;
- dịch vụ bơm nếu cần theo dõi riêng.

## 11.2 Nguồn chi phí
- direct material;
- direct labor;
- điện / utilities;
- nhiên liệu;
- sửa chữa / bảo trì;
- khấu hao;
- overhead.

## 11.3 Phân bổ giai đoạn đầu
- Điện: theo công tơ riêng nếu có, nếu không thì theo giờ máy chạy.
- Nhân công: theo timesheet, nếu chưa có thì theo cost center / ca.
- Overhead: phân bổ theo sản lượng hoặc tỷ lệ cấu hình.
- Khấu hao: theo asset và cost center.

## 11.4 Công thức tổng quát
`UnitCost = (DirectMaterial + DirectLabor + Utilities + Maintenance + Depreciation + AllocatedOverhead - ByproductCredit) / OutputQty`

## 11.5 Quy trình close costing period
1. Khóa chứng từ kỳ.
2. Kiểm tra thiếu dữ liệu.
3. Tập hợp cost pool.
4. Chạy allocation rules.
5. Tính unit cost theo cost object.
6. Review và close period.

---

## 12. Thiết kế database chi tiết

## 12.1 Nguyên tắc thiết kế dữ liệu
- PostgreSQL 16 + PostGIS.
- Primary key khuyến nghị UUID.
- Trường tiền: `DECIMAL(18,2)`.
- Trường số lượng / m3 / tấn: `DECIMAL(18,3)`.
- Thời gian dùng `TIMESTAMPTZ`, lưu UTC.
- Rule linh hoạt dùng `JSONB` nhưng không lạm dụng.
- Bảng log lớn phải partition theo tháng.
- Transactional data không sửa đè, ưu tiên append-only / snapshot.

## 12.2 Nhóm IAM và tổ chức

### `organizations`
- `id`, `code`, `name`, `legal_name`, `tax_code`, `timezone`, `base_currency`, `status`, `settings_json`

### `business_units`
- `id`, `organization_id`, `parent_id`, `code`, `name`, `unit_type`, `address`, `status`

### `users`
- `id`, `organization_id`, `employee_id`, `username`, `email`, `phone`, `password_hash`, `full_name`, `status`, `last_login_at`, `locale`, `timezone`

### `roles`
- `id`, `organization_id`, `code`, `name`, `description`, `is_system`

### `permissions`
- `id`, `module_code`, `action_code`, `description`

### `role_permissions`
- `id`, `role_id`, `permission_id`

### `user_roles`
- `id`, `user_id`, `role_id`, `business_unit_id`, `is_primary`

### `employees`
- `id`, `organization_id`, `employee_no`, `full_name`, `department`, `position`, `employment_type`, `hire_date`, `status`, `default_shift_group`

### `user_sessions`
- `id`, `user_id`, `refresh_token_hash`, `ip_address`, `user_agent`, `expires_at`, `revoked_at`

## 12.3 Nhóm master data khách hàng, công trình, tài nguyên

### `customers`
- `id`, `organization_id`, `code`, `customer_type`, `name`, `tax_code`, `billing_address`, `payment_terms_days`, `credit_limit`, `status`

### `customer_contacts`
- `id`, `customer_id`, `full_name`, `phone`, `email`, `position`, `is_primary`

### `site_access_profiles`
- `id`, `organization_id`, `code`, `name`, `difficulty_level`, `narrow_alley`, `restricted_hours_json`, `max_vehicle_weight_ton`, `bad_road_level`, `high_floor_level`, `requires_pump`, `preferred_pump_type`, `extra_setup_minutes`, `extra_risk_score`, `notes`

### `project_sites`
- `id`, `organization_id`, `customer_id`, `code`, `site_name`, `site_type`, `address_line`, `ward`, `district`, `city`, `latitude`, `longitude`, `geom`, `access_profile_id`, `default_contact_id`, `default_plant_id`, `status`

### `plants`
- `id`, `organization_id`, `business_unit_id`, `code`, `name`, `address`, `latitude`, `longitude`, `geom`, `max_output_m3_per_hour`, `loading_bays_count`, `default_load_minutes`, `default_wash_minutes`, `status`

### `plant_loading_bays`
- `id`, `plant_id`, `bay_code`, `sequence_no`, `max_concurrent_trucks`, `status`

### `vehicle_types`
- `id`, `organization_id`, `code`, `name`, `default_capacity_m3`, `notes`

### `vehicles`
- `id`, `organization_id`, `vehicle_type_id`, `home_plant_id`, `plate_no`, `capacity_m3`, `effective_capacity_m3`, `status`, `current_odometer_km`, `driver_employee_id`, `gps_device_code`, `last_maintenance_at`, `next_maintenance_due_at`

### `pumps`
- `id`, `organization_id`, `home_plant_id`, `code`, `pump_type`, `boom_length_m`, `capacity_m3_per_hour`, `default_setup_minutes`, `default_teardown_minutes`, `status`

### `assets`
- `id`, `organization_id`, `cost_center_id`, `asset_code`, `asset_name`, `asset_type`, `serial_no`, `commissioned_at`, `status`

### `materials`
- `id`, `organization_id`, `code`, `name`, `material_type`, `uom`, `density`, `default_cost_method`, `status`

### `concrete_products`
- `id`, `organization_id`, `code`, `name`, `grade_code`, `slump`, `strength_mpa`, `is_pumpable`, `base_uom`, `status`

### `mix_designs`
- `id`, `organization_id`, `concrete_product_id`, `code`, `effective_from`, `effective_to`, `yield_m3`, `status`, `notes`

### `mix_design_components`
- `id`, `mix_design_id`, `material_id`, `quantity_per_batch`, `quantity_per_m3`, `loss_factor_pct`

## 12.4 Nhóm pricing, sales và order intake

### `price_books`
- `id`, `organization_id`, `code`, `name`, `region_scope`, `customer_scope`, `effective_from`, `effective_to`, `status`, `priority`

### `price_rules`
- `id`, `price_book_id`, `rule_type`, `rule_name`, `condition_json`, `formula_json`, `priority`, `is_active`

### `quotations`
- `id`, `organization_id`, `customer_id`, `site_id`, `quotation_no`, `price_book_id`, `valid_from`, `valid_to`, `status`, `notes`

### `quotation_items`
- `id`, `quotation_id`, `concrete_product_id`, `quoted_volume_m3`, `base_price`, `distance_fee`, `difficulty_fee`, `pump_fee`, `surcharge_fee`, `discount_fee`, `final_unit_price`, `pricing_snapshot_json`

### `sales_orders`
- `id`, `organization_id`, `customer_id`, `site_id`, `quotation_id`, `order_no`, `contract_no`, `ordered_by_user_id`, `payment_terms_days`, `status`, `notes`

### `pour_requests`
- `id`, `organization_id`, `sales_order_id`, `request_no`, `customer_id`, `site_id`, `concrete_product_id`, `requested_volume_m3`, `requested_date`, `requested_start_at`, `requested_end_at`, `pour_method`, `requires_pump`, `expected_pump_type`, `difficulty_level`, `site_contact_name`, `site_contact_phone`, `special_constraints_json`, `status`

### `pour_request_time_windows`
- `id`, `pour_request_id`, `window_start_at`, `window_end_at`, `priority`

### `price_calculation_snapshots`
- `id`, `organization_id`, `source_type`, `source_id`, `price_book_id`, `input_snapshot_json`, `result_snapshot_json`, `final_unit_price`, `calculated_at`, `calculated_by`
