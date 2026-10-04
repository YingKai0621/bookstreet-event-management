# Sprint 01 – Phân công công việc Backend

## 1. Mục đích của tài liệu

Tài liệu này chỉ dùng để xác định:

- Mỗi thành viên phụ trách phần nào trong Sprint 1.
- Ranh giới công việc giữa các thành viên.
- Khi nào phần việc của một thành viên được xem là hoàn thành.

Chi tiết nghiệp vụ, API và Acceptance Criteria phải đọc trong tài liệu của dự án. Tài liệu này không thay thế requirement hoặc Current Sprint.

Trước khi code, mọi thành viên phải đọc theo hướng dẫn trong `AGENTS.md` và `AI_CONTEXT.md`, đặc biệt là Current Sprint, Use Case Specification, API Contract và Physical ERD hiện hành.

## 2. Nguyên tắc làm việc chung

- Tất cả feature branch phải được tạo từ `main` mới nhất sau khi schema Sprint 1 đã được merge.
- Mỗi người chỉ sửa module mình phụ trách. Nếu cần sửa file dùng chung, phải báo team trước.
- Không tự ý thay đổi V1, V2, V3 hoặc tạo migration mới.
- Không tự thêm bảng, cột, role, status, API hoặc business flow ngoài tài liệu.
- Authentication của Sprint 1 dùng server-side session với Redis, không dùng JWT hoặc refresh token.
- Không push trực tiếp vào `main`.
- Pull request không được chứa file hoặc thay đổi ngoài phạm vi công việc.
- Nếu tài liệu chưa rõ hoặc mâu thuẫn, dừng lại và hỏi team; không tự giả định.

## 3. Phân công thành viên

### Thành viên 1 – Authentication và Session Security

**Branch đề xuất:** `feature/s1-auth-session`

**Phụ trách:**

- Toàn bộ phần đăng ký, đăng nhập, lấy thông tin người đang đăng nhập và đăng xuất.
- User, Role và các thành phần liên quan đến authentication/authorization.
- Mã hóa và kiểm tra mật khẩu.
- Spring Security, Spring Session và Redis session.
- Phân quyền theo role và cung cấp cách thống nhất để các module khác lấy thông tin người đang đăng nhập.
- Test cho các chức năng Auth thuộc Sprint 1.

**Không phụ trách:**

- Event business logic.
- Partner Organization và Partner Event Application.
- JWT, refresh token và chức năng ngoài Sprint 1.

**Được xem là hoàn thành khi:**

- Các chức năng Auth trong Sprint 1 chạy đúng API Contract và Acceptance Criteria.
- Mật khẩu được hash, không được trả về API hoặc ghi vào log.
- Session được tạo, đọc và hủy đúng; dữ liệu session được lưu bằng Redis theo cấu hình dự án.
- Role và trạng thái tài khoản được kiểm tra đúng.
- Các module khác có thể lấy user ID và role từ người dùng đã đăng nhập, không lấy từ request body.
- Các trường hợp thành công và lỗi quan trọng đều có test.
- `mvn test` thành công và pull request không có thay đổi ngoài phạm vi.

---

### Thành viên 2 – Event Management

**Branch đề xuất:** `feature/s1-event-management`

**Phụ trách:**

- Toàn bộ entity, repository, DTO, service và controller của Event trong Sprint 1.
- Chức năng Event dành cho Organizer.
- Chức năng xem Event công khai thuộc Sprint 1.
- Validation, ownership và authorization liên quan đến Event.
- Test cho các chức năng Event thuộc Sprint 1.

**Không phụ trách:**

- Authentication và cấu hình session.
- Partner Organization hoặc Partner Event Application.
- Booth, Activity, Payment hoặc chức năng Event ngoài Sprint 1.

**Được xem là hoàn thành khi:**

- Tất cả chức năng Event trong Sprint 1 chạy đúng API Contract và Acceptance Criteria.
- Organizer chỉ quản lý được Event do chính mình phụ trách.
- Người dùng public chỉ xem được Event được phép công khai; Draft không bị lộ.
- Các quy tắc validation và thay đổi trạng thái Event được kiểm tra đúng.
- Dữ liệu được lưu và đọc đúng từ PostgreSQL, không dùng dữ liệu giả trong service/controller.
- Các trường hợp thành công, validation, sai quyền và không tìm thấy dữ liệu đều có test phù hợp.
- `mvn test` thành công và pull request không có thay đổi ngoài phạm vi.

---

### Thành viên 3 – Partner Organization và Partner Event Application

**Branch đề xuất:** `feature/s1-partner-applications`

**Phụ trách:**

- Toàn bộ entity, repository, DTO, service và controller của Partner Organization trong Sprint 1.
- Toàn bộ luồng Partner gửi, xem và rút application.
- Toàn bộ luồng Organizer xem, approve hoặc reject application.
- Validation, ownership, data isolation và chuyển trạng thái application.
- Ngăn application trùng và xử lý trường hợp gửi đồng thời ở mức cần thiết.
- Test cho Partner Organization và Partner Event Application.

**Không phụ trách:**

- Authentication và cấu hình session.
- Quản lý Event ngoài dữ liệu cần đọc để kiểm tra application.
- BoothRequest, BoothHold, BoothAssignment, Payment hoặc chức năng ngoài Sprint 1.

**Được xem là hoàn thành khi:**

- Các chức năng Partner/Application chạy đúng API Contract và Acceptance Criteria.
- Mỗi representative user chỉ quản lý đúng organization của mình.
- Partner không thể tạo application trùng cho cùng một Event.
- Partner chỉ xem hoặc rút application của mình.
- Organizer chỉ xem và xử lý application thuộc Event do mình phụ trách.
- Các chuyển trạng thái application hợp lệ và không thể xử lý lại application đã kết thúc.
- Dữ liệu được lưu và đọc đúng từ PostgreSQL.
- Các trường hợp thành công, trùng dữ liệu, sai trạng thái, sai quyền và không tìm thấy dữ liệu đều có test phù hợp.
- `mvn test` thành công và pull request không có thay đổi ngoài phạm vi.

## 4. Phần dùng chung và dependency

- Thành viên Auth cần ưu tiên cơ chế lấy authenticated user ID và role để hai module còn lại tích hợp.
- Event và Partner service nên nhận user ID đã xác thực qua lớp security dùng chung, không tin user ID do client gửi lên.
- Partner Application được phép đọc Event để kiểm tra điều kiện đăng ký nhưng không được sửa business logic của Event.
- Nếu hai người cùng cần sửa một file dùng chung, phải thống nhất người thực hiện trước để tránh conflict.
- Demo seed và migration tiếp theo là công việc tích hợp chung. Không thành viên nào tự tạo V4 nếu chưa được team duyệt.

## 5. Definition of Done chung cho mỗi pull request

Một thành viên chỉ báo **DONE** khi đáp ứng tất cả điều kiện sau:

- Hoàn thành đúng phạm vi được giao.
- Bám đúng requirement, Current Sprint, API Contract, Physical ERD và Acceptance Criteria.
- Không tự thêm chức năng hoặc thay đổi baseline.
- Code build được và toàn bộ test liên quan đều pass.
- Đã kiểm tra validation, authorization, ownership và error response liên quan.
- Không để lộ password, secret hoặc dữ liệu nhạy cảm.
- Không chứa code tạm, dữ liệu hard-code không được duyệt hoặc TODO ảnh hưởng luồng chính.
- Đã tự chạy thử luồng chính của module với PostgreSQL và các dependency cần thiết.
- Pull request chỉ chứa thay đổi thuộc phần việc của mình.
- Pull request có mô tả phần đã làm, cách test, kết quả test và vấn đề còn tồn tại nếu có.
- Code đã được review và merge vào `main`.

Nếu mới viết xong code nhưng chưa test, chưa review hoặc chưa merge thì trạng thái là **IN PROGRESS**, chưa phải **DONE**.

## 6. Mẫu báo cáo khi tạo pull request

```text
Phần việc:
- ...

Đã hoàn thành:
- ...

Cách kiểm tra:
1. ...
2. ...

Kết quả test:
- ...

File/migration thay đổi:
- ...

Vấn đề còn lại hoặc dependency:
- Không có / ...
```

## 7. Thứ tự tích hợp đề xuất

1. Authentication/session foundation.
2. Event Management.
3. Partner Organization và Partner Event Application.
4. Demo seed, kiểm thử tích hợp và demo end-to-end toàn Sprint 1.

Việc merge theo thứ tự trên không có nghĩa là các thành viên phải chờ nhau mới code. Các module vẫn được phát triển song song, nhưng cần đồng bộ `main` trước khi tích hợp và tạo pull request cuối.
