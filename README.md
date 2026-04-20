# web_betong
Hệ thống điều hành bê tông gồm các phân hệ chính: Kinh doanh (báo giá/đơn hàng), Điều phối, Kho & Giá thành, Quản trị.

## 1) Thành phần chính
- `frontend` (Next.js 15, port `13000`)
- `backend` (FastAPI, port `18000`)
- `postgres` (PostgreSQL + PostGIS, port `5432`)
- `redis` (port `6379`)
- `minio` (port `9000`, console `9001`)
- `traefik` (port `8088`, dashboard `8090`)

## 2) Yêu cầu
Tối thiểu:
- Docker + Docker Compose

Nếu chạy một số lệnh ngoài Docker (seed/test thủ công):
- Python `>=3.12`
- Node.js `>=20`

## 3) Chạy dự án bằng Docker (khuyến nghị)
Từ thư mục gốc project:

```bash
# build + chạy toàn bộ service
docker compose up -d --build

# kiểm tra trạng thái
docker compose ps

# xem log
docker compose logs -f --tail=200
```

Truy cập sau khi chạy:
- Frontend: `http://localhost:13000`
- Backend health: `http://localhost:18000/healthz`
- Backend readiness: `http://localhost:18000/readyz`
- Swagger: `http://localhost:18000/docs`
- ReDoc: `http://localhost:18000/redoc`

Dừng dịch vụ:

```bash
docker compose down
```

## 4) Migration database
Chạy migration mới nhất:

```bash
docker compose exec backend alembic -c alembic.ini upgrade head
```

## 5) Seed dữ liệu mẫu
Lệnh seed script nằm ở `scripts/seed.py`.

Cách chạy ổn định từ host:

```bash
DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:5432/web_betong \
PYTHONPATH=./backend \
python3 ./scripts/seed.py
```

Tài khoản quản trị được seed mặc định:
- `username`: `admin`
- `password`: `Admin@123`

## 6) Đăng nhập hệ thống
- UI đăng nhập: `http://localhost:13000/dang-nhap`
- API login: `POST /api/v1/auth/login`

## 7) Chạy test và kiểm tra chất lượng
### Qua Makefile
```bash
make backend-test
make frontend-test
make test
make lint
make typecheck
```

### Chạy trực tiếp
```bash
# backend
PYTHONPATH=./backend python3 -m pytest ./backend/tests/test_suite.py

# frontend
npm --prefix ./frontend run test
npm --prefix ./frontend run lint
npm --prefix ./frontend run typecheck
npm --prefix ./frontend run build
```

## 8) Các lệnh Makefile thường dùng
```bash
make up        # docker compose up -d --build
make down      # docker compose down
make logs      # docker compose logs -f --tail=200
make migrate   # alembic upgrade head
make seed      # chạy scripts/seed.py
```

Lưu ý: `Makefile` hiện chứa một số đường dẫn tuyệt đối dạng `/root/web_betong/...`. Nếu bạn clone repo ở đường dẫn khác, ưu tiên dùng các lệnh trực tiếp ở mục 5/7 hoặc điều chỉnh lại `Makefile`.

## 9) Troubleshooting nhanh
### Seed lỗi `Temporary failure in name resolution`
Nguyên nhân thường gặp: shell host không resolve được hostname `postgres`.

Cách xử lý: chạy seed với `DATABASE_URL` trỏ `127.0.0.1` như mục 5.

### Xung đột port
Nếu cổng bị chiếm (`13000`, `18000`, `5432`, ...), sửa mapping trong `docker-compose.yml` rồi chạy lại:

```bash
docker compose down
docker compose up -d --build
```

### Làm sạch dữ liệu local
```bash
docker compose down -v
```

> Lệnh trên xóa volumes (mất dữ liệu DB/MinIO local).
