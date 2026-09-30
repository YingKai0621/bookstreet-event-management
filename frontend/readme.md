# Đường Sách TP.HCM Trực Tuyến

Nền tảng web giới thiệu Đường Sách TP.HCM, dùng React và backend Node.js/PostgreSQL. API hiện chỉ mở các chức năng đã được triển khai cho landing page, bản đồ và quản lý cơ sở vật chất.

## Chức năng chính

- Khám phá gian hàng, sự kiện, di sản và bản đồ Đường Sách.
- Tìm kiếm, lọc nội dung và xem thông tin chi tiết.
- Đăng nhập tiêu chuẩn và đăng nhập nhanh cho Độc giả, Đối tác, Ban quản lý và Quản trị.
- Quản trị viên quản lý gian hàng, địa điểm tổ chức và thiết bị.
- Gian hàng hỗ trợ tìm kiếm theo tên và lọc theo cơ sở.
- Bản đồ, gian hàng, sự kiện và di sản sử dụng dữ liệu từ PostgreSQL.
- Hỗ trợ giao diện tiếng Việt/Anh và hiển thị responsive trên desktop/mobile.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Framer Motion, GSAP |
| Backend | Node.js, Express 5, Prisma ORM |
| Cơ sở dữ liệu | PostgreSQL |
| Xác thực | JWT, bcrypt, phân quyền theo vai trò |
| Kiểm thử backend | Vitest, Supertest |

## Chạy dự án cục bộ

Yêu cầu: Node.js 20 trở lên, npm, Docker Desktop hoặc PostgreSQL 15 trở lên.

### 1. Cài đặt thư viện

```bash
npm install
cd server
npm install
cd ..
```

### 2. Tạo tệp cấu hình

Sao chép `.env.example` thành `.env` và `server/.env.example` thành `server/.env`, sau đó điều chỉnh chuỗi kết nối cùng các khóa JWT nếu cần.

```bash
cp .env.example .env
cp server/.env.example server/.env
```

### 3. Khởi động PostgreSQL và chuẩn bị dữ liệu

```bash
docker compose up -d postgres
cd server
npm run db:push
npm run seed
cd ..
```

Lưu ý: lệnh `npm run seed` nạp lại dữ liệu khởi tạo. Không chạy lệnh này trên cơ sở dữ liệu có dữ liệu cần giữ lại.

### 4. Chạy backend và frontend

Mở hai cửa sổ terminal:

```bash
# Terminal 1 - Backend
npm run dev:backend
```

```bash
# Terminal 2 - Frontend
npm run dev
```

- Website: `http://localhost:5173`
- API mặc định: `http://localhost:4000/api`
- Kiểm tra trạng thái API: `http://localhost:4000/api/health`

## Các lệnh thường dùng

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy frontend ở chế độ phát triển |
| `npm run dev:backend` | Chạy backend ở chế độ phát triển |
| `npm run build` | Kiểm tra TypeScript và tạo bản frontend production |
| `npm run lint` | Kiểm tra mã nguồn frontend |
| `npm --prefix server test` | Chạy kiểm thử tích hợp backend |
| `npm --prefix server run seed` | Nạp dữ liệu khởi tạo vào database |

## Cấu trúc thư mục

```text
project-Duongsach/
├── public/                 # Hình ảnh và tài nguyên tĩnh
├── src/                    # Ứng dụng React, trang, component và lớp gọi API
├── server/
│   ├── prisma/             # Schema, migration và seed database
│   ├── src/                # REST API, middleware, module nghiệp vụ và cron job
│   └── tests/              # Kiểm thử tích hợp backend
├── database/               # Dữ liệu SQL và tài liệu liên quan database
├── compose.yaml            # PostgreSQL dùng cho môi trường local
└── vite.config.ts          # Cấu hình frontend và proxy API
```

Chi tiết riêng của backend được trình bày tại [`server/README.md`](server/README.md).
