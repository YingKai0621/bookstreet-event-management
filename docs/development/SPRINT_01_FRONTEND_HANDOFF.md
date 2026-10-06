# Sprint 1 Frontend Handoff

## 1. Mục đích và trạng thái

Tài liệu này hướng dẫn đội frontend tích hợp UI hiện tại với backend Sprint 1 đã
merge vào `main`. API Contract vẫn là nguồn sự thật; tài liệu này chỉ tổng hợp
cách chạy, thứ tự tích hợp và những điểm chưa khớp trong code frontend hiện tại.

Backend Sprint 1 đã hoàn thành và đã được kiểm thử độc lập. Sprint chỉ được xem
là hoàn tất toàn bộ sau khi frontend gọi API thật và luồng demo end-to-end đạt.

### Browser security đã sẵn sàng để tích hợp

Backend đã triển khai Browser Security Contract:

- Có endpoint public `GET /api/v1/auth/csrf`.
- Có CORS allowlist theo môi trường, mặc định local là `http://localhost:5173`.
- Session cookie có thể cấu hình `Secure` và `SameSite` theo môi trường.
- Kiểm thử tích hợp đã bao phủ cookie, CORS, CSRF và việc đổi token sau
  login/logout.

Đội frontend có thể bắt đầu tích hợp browser end-to-end. Sprint chỉ đóng hoàn
toàn sau khi luồng thực tế qua frontend, backend, Redis và PostgreSQL chạy đạt.

## 2. Tài liệu nguồn phải đọc

- [Sprint 1 API Contract](../api/sprint-01-api-contract.md)
- [Email Verification API Contract](../api/email-verification-api-contract.md)
- [Browser Security Contract](../api/browser-security-contract.md)
- [Sprint 1 Use Case Specifications](../use-cases/sprint-01-use-case-specifications.md)
- [Sprint 1 Backend Completion Report](SPRINT_01_BACKEND_COMPLETION_REPORT.md)

Swagger UI dùng để khám phá và thử API tại:
`http://localhost:8080/swagger-ui/index.html`.

## 3. Chạy môi trường local

Yêu cầu: Java 21+, Maven, Node.js/npm và Docker Desktop.

Từ thư mục gốc của repository:

```powershell
Copy-Item .env.example .env
docker compose up -d
docker compose ps
```

Điền giá trị local cần thiết trong `.env`. Không commit `.env`, thông tin đăng
nhập demo hoặc mail credential.

Chạy backend trong terminal thứ nhất:

```powershell
Set-Location backend
mvn spring-boot:run
```

Chạy frontend trong terminal thứ hai:

```powershell
Set-Location frontend
npm install
npm run dev
```

PostgreSQL và Redis phải chạy để backend khởi động. Frontend không kết nối trực
tiếp tới PostgreSQL hoặc Redis; frontend chỉ gọi HTTP API của backend.

## 4. Những điểm frontend hiện tại phải sửa khi tích hợp

### 4.1 Địa chỉ backend

`frontend/vite.config.ts` hiện proxy `/api` sang `http://localhost:4000`, là cấu
hình cũ. Backend Spring Boot hiện chạy tại `http://localhost:8080`.

Cách local đơn giản là giữ request theo đường dẫn tương đối `/api/v1/...` và đổi
Vite proxy sang cổng `8080`. Frontend cũng có thể gọi trực tiếp
`http://localhost:8080` từ origin đã được cấu hình trong `CORS_ALLOWED_ORIGINS`;
khi đó mọi request cần cookie phải dùng `credentials: "include"`.

### 4.2 Session cookie, không phải JWT

Backend không trả `accessToken` hoặc `refreshToken`. Login tạo server-side
Session trong Redis và gửi cookie HttpOnly cho browser.

Frontend phải:

- Dùng `credentials: "include"` trong mọi request cần session/cookie.
- Không lưu session identifier trong `localStorage` hoặc `sessionStorage`.
- Không gửi header `Authorization: Bearer ...` cho luồng Sprint 1.
- Gọi `GET /api/v1/auth/me` để khôi phục trạng thái người dùng khi tải lại trang.
- Xóa trạng thái người dùng trong memory sau khi logout hoặc nhận HTTP 401.

### 4.3 Response không có envelope `{ success, data }`

Backend trả DTO trực tiếp. Ví dụ, `/auth/me` trả trực tiếp `userId`, `username`,
`fullName`, `email`, `emailVerified`, `status` và `roles`.

`frontend/src/services/apiClient.ts` hiện đang ép mọi response vào
`ApiResponse<T>` và trả `json.data`. Cách xử lý này phải được đổi trước khi dùng
API Spring Boot thật. Các response `204 No Content` cũng phải được xử lý mà
không cố parse JSON.

### 4.4 Login và register model đang lệch contract

Frontend hiện gửi email để login và chờ token. Backend nhận:

```json
{
  "username": "booklover",
  "password": "user-entered-password"
}
```

Register phải gửi `username`, `fullName`, `password`, `confirmPassword` và email
tùy chọn. Frontend không được gửi `role`; tài khoản mới luôn nhận role
`PARTICIPANT` từ backend.

Các endpoint `/auth/demo-login`, `/auth/demo-accounts` và
`/auth/forgot-password` đang được frontend tham chiếu nhưng không thuộc backend
Sprint 1. Không gọi các endpoint này trong luồng tích hợp Sprint 1.

## 5. Quy tắc API client cần tuân theo

Base path của Sprint 1 là `/api/v1`.

Mẫu tối thiểu cho một request đọc dữ liệu:

```ts
const response = await fetch('/api/v1/auth/me', {
  method: 'GET',
  credentials: 'include',
  headers: {
    Accept: 'application/json',
  },
});
```

Đối với request làm thay đổi dữ liệu, frontend phải dùng CSRF theo Browser
Security Contract:

1. Gọi `GET /api/v1/auth/csrf` với `credentials: "include"`.
2. Giữ token trong memory.
3. Gửi token bằng header mà backend trả về, hiện được thiết kế là
   `X-XSRF-TOKEN`.
4. Lấy token mới sau login và logout.
5. Khi gặp lỗi CSRF 403, chỉ refresh token và retry tối đa một lần.

Backend đã hỗ trợ đầy đủ luồng này. Không tắt CSRF để làm cho frontend chạy tạm.

## 6. Endpoint theo màn hình Sprint 1

### Tài khoản và phiên đăng nhập

- Đăng ký Participant: `POST /api/v1/auth/register`
- Đăng nhập: `POST /api/v1/auth/login`
- Khôi phục current user: `GET /api/v1/auth/me`
- Đăng xuất: `POST /api/v1/auth/logout`
- Xác minh email từ link: `POST /api/v1/auth/email-verification/confirm`
- Gửi lại email xác minh: `POST /api/v1/auth/email-verification/resend`

### Sự kiện công khai

- Danh sách sự kiện đã publish: `GET /api/v1/events`
- Chi tiết sự kiện đã publish: `GET /api/v1/events/{eventId}`

### Organizer quản lý Event

- Tạo Draft Event: `POST /api/v1/organizer/events`
- Danh sách Event sở hữu: `GET /api/v1/organizer/events`
- Chi tiết Event sở hữu: `GET /api/v1/organizer/events/{eventId}`
- Sửa Draft Event: `PATCH /api/v1/organizer/events/{eventId}`
- Publish Draft Event: `POST /api/v1/organizer/events/{eventId}/publish`

### Partner Organization và application

- Xem organization hiện tại: `GET /api/v1/partner/organization`
- Tạo/cập nhật organization: `PUT /api/v1/partner/organization`
- Nộp application: `POST /api/v1/events/{eventId}/applications`
- Danh sách application của Partner: `GET /api/v1/partner/applications`
- Chi tiết application sở hữu: `GET /api/v1/partner/applications/{applicationId}`
- Rút application Pending: `POST /api/v1/partner/applications/{applicationId}/withdraw`

### Organizer review application

- Danh sách application của Event sở hữu:
  `GET /api/v1/organizer/events/{eventId}/applications`
- Chi tiết application: `GET /api/v1/organizer/applications/{applicationId}`
- Duyệt application: `POST /api/v1/organizer/applications/{applicationId}/approve`
- Từ chối application: `POST /api/v1/organizer/applications/{applicationId}/reject`

## 7. Phân quyền và email verification

- Tài khoản đăng ký mới chỉ có role `PARTICIPANT`.
- Các chức năng Partner cần role `PARTNER` và email đã xác minh.
- Các chức năng quản lý Event cần role `ORGANIZER` và email đã xác minh.
- UI có thể ẩn chức năng theo role để cải thiện trải nghiệm, nhưng backend luôn
  là nơi quyết định quyền cuối cùng.
- `/auth/me` trả assigned roles từ database; nó không chứng minh session hiện tại
  đã có đủ effective authorities.
- Sau khi xác minh email, người dùng có role nâng cao phải logout và login lại để
  session nhận authority mới.
- HTTP 401 nghĩa là chưa có session hợp lệ. HTTP 403 nghĩa là đã xác định request
  nhưng thiếu quyền, email chưa xác minh hoặc CSRF không hợp lệ tùy error code.

Thông tin tài khoản seed phục vụ demo phải được chia sẻ riêng cho người cần dùng,
không ghi password vào source code, tài liệu hoặc Git history.

## 8. Pagination, sort và error handling

Application list dùng các query parameter tùy chọn `page`, `size` và
`sort=field,direction`. Các field được phép là:

- `submittedAt`
- `status`
- `eventId`
- `reviewedAt`
- `withdrawnAt`

Không gửi object JSON `pageable` trong query string. Ví dụ hợp lệ:

```text
/api/v1/partner/applications?page=0&size=20&sort=submittedAt,desc
```

Frontend phải xử lý lỗi theo `code`, không so sánh nội dung `message`. Error body
chuẩn gồm `code`, `message`, `fieldErrors`, `timestamp` và `path`.

Các nhóm status quan trọng:

- `400`: request/query không hợp lệ, gồm `INVALID_SORT`.
- `401`: chưa đăng nhập hoặc session hết hạn.
- `403`: thiếu quyền, email verification hoặc CSRF.
- `404`: resource không tồn tại hoặc không thuộc phạm vi được phép xem.
- `409`: trạng thái nghiệp vụ xung đột.
- `422`: validation hoặc quy tắc thời gian/cấu hình không đạt.
- `429`: resend email verification vượt giới hạn.
- `503`: dịch vụ gửi email không khả dụng.

## 9. Luồng demo end-to-end đề xuất

1. Khởi động PostgreSQL, Redis, backend và frontend.
2. Organizer đăng nhập, tạo Draft Event, cập nhật đủ deadline và publish.
3. Kiểm tra Event vừa publish xuất hiện ở danh sách công khai.
4. Partner đăng nhập, kiểm tra hoặc cập nhật organization.
5. Partner nộp application vào Event đang nhận đăng ký.
6. Organizer mở danh sách application của Event và approve hoặc reject.
7. Partner tải lại danh sách để thấy trạng thái mới.
8. Tạo application Pending khác để kiểm tra withdraw.
9. Xác nhận application đã approve/reject không thể withdraw.
10. Xác nhận Participant hoặc user không đúng role nhận 403 ở API được bảo vệ.

Lưu ý nghiệp vụ hiện tại:

- Chỉ application `PENDING` mới được withdraw, approve hoặc reject.
- Một Partner Organization chỉ có một application cho mỗi Event.
- Sau khi withdraw, Partner chưa thể nộp lại application cho cùng Event trong
  Sprint 1.
- Draft Event không xuất hiện trong public Event API.

## 10. Ngoài phạm vi Sprint 1

Không nối UI Sprint 1 vào API giả cho các chức năng chưa có backend: booth,
payment, refund, activity, QR, attendance, points, badge, certificate, feedback,
reporting, password reset và Admin management.

Các màn hình prototype có thể được giữ để phát triển sau, nhưng phải phân biệt rõ
mock data với dữ liệu trả từ backend Sprint 1.

## 11. Definition of Done cho frontend integration

- API client dùng session cookie và `credentials: "include"`, không dùng JWT.
- API client xử lý DTO trực tiếp, `204 No Content` và standard error body.
- CSRF và CORS hoạt động theo Browser Security Contract.
- Không hardcode user ID, organization ID hoặc organizer ID.
- Route và action thể hiện đúng role nhưng vẫn xử lý 401/403 từ backend.
- Không commit `.env`, password hoặc credential.
- Luồng demo tại mục 9 chạy với backend thật.
- `npm run lint` và `npm run build` chạy đạt trước khi mở PR.

## 12. Lỗi thường gặp

- `MissingProjectException`: chạy Maven từ thư mục `backend`, không phải root.
- Frontend gọi cổng `4000`: sửa proxy cũ để trỏ tới backend cổng `8080`.
- Login thành công nhưng `/me` trả 401: kiểm tra `credentials: "include"` và cookie.
- State-changing request trả 403: kiểm tra role, email verification và CSRF token.
- Browser báo CORS: kiểm tra origin frontend có nằm trong `CORS_ALLOWED_ORIGINS`
  và backend đã được khởi động lại sau khi đổi cấu hình hay chưa.
- Application list trả `INVALID_SORT`: dùng đúng `sort=field,direction` và field
  trong danh sách cho phép.

