# Thành viên 2 — Event Management, Sprint 01

## Phạm vi và nguồn yêu cầu

Module `backend/src/main/java/com/swp391/bookstreet/event` triển khai UC-O01
trong Sprint 01. Các nguồn cần đối chiếu:

- `docs/requirements/05_Business_Rules.md`: BR-01, BR-03, BR-06, BR-07, BR-64.
- `docs/requirements/06_Use_Case_List.md`.
- `docs/use-cases/sprint-01-use-case-specifications.md`: AC-O01-01 đến AC-O01-05.
- `docs/api/sprint-01-api-contract.md`: mục Public Event và Organizer Event.
- `docs/design/12_Physical_ERD_Report.md` và migration V3 hiện có.

Không triển khai Auth, Partner/Application, cancel Event, Booth, Activity, Payment.
Không sửa schema, migration V1–V3, hoặc các file quản lý context chung.

## Các API

Prefix chung: `/api/v1`.

| Method | Path | Trách nhiệm |
| --- | --- | --- |
| POST | /organizer/events | Tạo DRAFT; owner từ authenticated principal; trả 201 |
| GET | /organizer/events | Phân trang các Event thuộc Organizer hiện tại |
| GET | /organizer/events/{eventId} | Chi tiết Event thuộc Organizer hiện tại |
| PATCH | /organizer/events/{eventId} | Sửa Event DRAFT thuộc Organizer |
| POST | /organizer/events/{eventId}/publish | Kiểm tra dữ liệu và chuyển DRAFT thành PUBLISHED |
| GET | /events | Danh sách Event public |
| GET | /events/{eventId} | Chi tiết Event public |

Không nhận owner hoặc status từ request để quyết định quyền hoặc chuyển trạng thái.
Event không tồn tại, không thuộc owner, hoặc bị ẩn ở public trả cùng
`404 EVENT_NOT_FOUND`. Use case cho phép chính sách 404 này.
Sửa/publish trạng thái khác DRAFT trả `409 EVENT_NOT_DRAFT`.

Các thay đổi Event chạy trong transaction và khóa dòng bằng
`PESSIMISTIC_WRITE`. Hai request publish đồng thời chỉ có một request chuyển
trạng thái thành công. Không bổ sung cột version ngoài Physical ERD.

Danh sách dùng `page` bắt đầu từ 0, `size` mặc định 20 và tối đa 100.
Sort nhận một cặp `field,asc|desc`; các field hỗ trợ:
`eventId`, `name`, `startAt`, `endAt`, `createdAt`, `updatedAt`.
Thêm `eventId,asc` khi cần để kết quả ổn định.
Organizer mặc định `createdAt,desc`; public mặc định `startAt,asc`.
Response phân trang có `content`, `page`, `size`, `totalElements`, `totalPages`.
Đây là quy ước triển khai để frontend tích hợp; contract gốc chưa mô tả envelope.

## Tích hợp với thành viên 1

Auth/login/session Redis đã có; `AuthenticatedUser` triển khai
`AuthenticatedPrincipal` dùng chung.
GET public đã được permitAll trong cấu hình security thật.

`security/authentication/AuthenticatedPrincipal` là interface nhận diện dùng chung:
`Long userId()`, `boolean emailVerified()`, kế thừa `Serializable`.
Principal thật do Auth tạo sau khi xác thực triển khai interface này; Event và các
module nghiệp vụ khác chỉ phụ thuộc vào hợp đồng dùng chung, không phụ thuộc lẫn nhau.
Authority Organizer dùng `ROLE_ORGANIZER`, theo quy ước Spring Security.
Event đọc principal từ `SecurityContextHolder`, không từ body/header do client tự khai.

`EventCurrentUser` kiểm tra session, role, ID hợp lệ và email verified.
Principal chưa được tích hợp hoặc email chưa verified bị từ chối.
Các principal giả chỉ xuất hiện trong test; không có tài khoản hoặc user ID cố định
trong code chạy thật.

Thành viên 1 vẫn phụ trách đăng nhập, tạo/lưu/hủy session Redis, cấu hình cookie,
CSRF bootstrap cho frontend và kiểm tra account ACTIVE.
Test với principal được cung cấp bởi Spring Security Test không chứng minh
luồng login/logout của thành viên 1 đã hoàn thành.

## Chạy backend tại máy hiện tại

Mở Docker Desktop. Tại repository root:

```powershell
docker compose up -d --wait postgres redis
docker compose ps
Set-Location -LiteralPath '.\backend'
.\mvnw.cmd spring-boot:run
```

Chạy từng lệnh; nếu lệnh trước lỗi thì xử lý trước khi tiếp tục.
Backend dùng JDK 21, cổng mặc định 8080 và đọc `../.env` khi working directory
là `backend/`. Trong IntelliJ, mở `backend/pom.xml` như Maven project,
chọn SDK/Maven Runner JRE 21, chạy `BookstreetBackendApplication`
với working directory là `backend/`.

Cấu hình local đã kiểm tra: PostgreSQL `localhost:55432`,
database `bookstreet_db`, user `bookstreet`; Redis `localhost:6379`.
Mật khẩu nằm trong `.env` được Git ignore. Không đưa mật khẩu vào tài liệu hay commit.
`bookstreet` là tên nhóm dịch vụ Docker; tên database thực tế là `bookstreet_db`.
Không sửa cổng mặc định trong `.env.example` chỉ vì máy này dùng 55432.

Dừng ứng dụng chạy trong terminal bằng Ctrl+C. Không cần xóa volume PostgreSQL.

## Xem PostgreSQL trong IntelliJ IDEA

1. Mở **View → Tool Windows → Database**.
2. Bấm **+ → Data Source → PostgreSQL**.
3. Điền:
   - Host: `localhost`
   - Port: `55432`
   - Database: `bookstreet_db`
   - User: `bookstreet`
   - Password: giá trị `POSTGRES_PASSWORD` trong `.env` local
   - URL tương ứng: `jdbc:postgresql://localhost:55432/bookstreet_db`
4. Nếu IDE báo thiếu driver, chọn **Download missing driver files**.
5. Bấm **Test Connection**; thành công thì **Apply → OK**.
6. Trong tab **Schemas**, chọn `public` nếu chưa thấy bảng.
7. Mở `bookstreet_db → public → tables`; double-click `events` để xem dữ liệu.
8. Refresh sau khi gọi API để thấy dữ liệu mới.

Có thể mở query file/console gắn với data source và chạy truy vấn chỉ đọc:

```sql
SELECT current_database(), current_user;
SELECT version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;

SELECT event_id, organizer_user_id, name, status, start_at, end_at
FROM events
ORDER BY event_id DESC;
```

Bảng trống là bình thường khi chưa tạo Event bằng API. Không thêm dữ liệu demo
trực tiếp vào database để thay cho API/seed theo quy trình nhóm.

Nếu không thấy cửa sổ Database, kiểm tra plugin **Database Tools and SQL**
trong Settings → Plugins và tính năng database của bản IntelliJ đang sử dụng.

Tài liệu JetBrains:
- https://www.jetbrains.com/help/idea/connecting-to-a-database.html
- https://www.jetbrains.com/help/idea/quick-start-with-database-functionality.html

## Kiểm thử

`EventCurrentUserTests` kiểm tra các trường hợp thiếu session, anonymous,
sai role, email chưa verified và principal không được hỗ trợ.

`EventApiIntegrationTests` chỉ được bật khi có biến
`EVENT_TEST_DATABASE_URL`; database phải có tên kết thúc bằng `_event_test`.
Test dùng PostgreSQL thật, migration thật, request MVC và bộ lọc Spring Security.
Fixtures chỉ tồn tại trong database kiểm thử và được dọn theo ID của test.
Không đặt biến này trỏ vào database demo/production.

Các nhóm kiểm thử đối chiếu:

| Tiêu chí | Kiểm tra |
| --- | --- |
| AC-O01-01 | Tạo DRAFT, 201, owner từ principal, lưu cấu hình |
| AC-O01-02 | Organizer khác không đọc/sửa/publish được |
| AC-O01-03 | endAt không sau startAt trả 422, dữ liệu lỗi không được lưu |
| AC-O01-04 | Sửa rồi publish và đọc public |
| AC-O01-05 | List/detail public không lộ DRAFT |
| BR-64 | Role Organizer và email verified |
| Transaction | Rollback PATCH lỗi, publish đồng thời |
| API contract | Error envelope, malformed JSON, phân trang, CSRF |

## Quy tắc deadline và publish (2026-10-04)

- Draft được thiếu deadline; mốc có giá trị phải <= startAt.
- Booth Request/Activity Proposal deadline >= Partner application deadline nếu có cả hai.
- Cutoff rút/hủy độc lập với hạn nộp; không mang nghĩa cấm hủy muộn.
- Publish bắt buộc đủ 7 deadline/cutoff, kể cả quota bằng 0; thiếu trả 422 EVENT_INCOMPLETE_FOR_PUBLISH.
- startAt và cả 7 mốc phải > thời điểm server kiểm tra publish; bằng hoặc đã qua trả 422 EVENT_TIME_INVALID.
- Deadline có thể bằng startAt; description/banner tùy chọn.
- Draft cũ được sửa ngày, không thể publish lịch hết hạn. Publish lỗi giữ DRAFT; PATCH lỗi rollback.
- API Partner kiểm tra hạn khi nhận đơn riêng, ngoài phạm vi thành viên 2.

## Trạng thái bàn giao

Đã có 7/7 API Event, deadline validation và publish completeness.
2026-10-04: 112 test pass, không failure/error/skip; gồm 24 test API Event,
17 test deadline, 16 test publication và 6 test identity Event.
Test API dùng security thật với principal test và PostgreSQL riêng.
Xem S1_EVENT_REVIEW.md và backend/target/surefire-reports.
Frontend chưa đồng bộ contract; cần demo giao diện riêng khi tích hợp.
Không coi API Partner còn thiếu là thiếu phần thành viên 2.
AI_CONTEXT.md còn ghi Event chưa triển khai; context owner cập nhật riêng.
Chưa commit/push. Không đổi migration V1–V3 hoặc Event đã PUBLISHED.
