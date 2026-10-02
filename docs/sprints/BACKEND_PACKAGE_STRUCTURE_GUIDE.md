# Hướng dẫn cấu trúc Backend theo Module

## 1. Cấu trúc dự án được chọn

Backend BookStreet được tổ chức theo **module chức năng** hay còn gọi là **package by feature**.

Mỗi chức năng lớn của hệ thống có một package riêng, ví dụ:

```text
auth/
event/
partner/
booth/
payment/
activity/
```

Bên trong mỗi module có đầy đủ các tầng cần thiết của chính module đó:

```text
controller/
dto/
entity/
repository/
service/
```

Đây vẫn là **một ứng dụng Spring Boot duy nhất**, dùng chung PostgreSQL và Redis. Cách tổ chức này không biến dự án thành microservice.

## 2. Ví dụ cấu trúc thư mục

Giữ nguyên base package hiện tại của dự án và tổ chức phần bên dưới như sau:

```text
bookstreet/
├── auth/
│   ├── controller/
│   │   └── AuthController.java
│   ├── dto/
│   │   ├── LoginRequest.java
│   │   ├── RegisterRequest.java
│   │   └── AuthResponse.java
│   ├── entity/
│   │   ├── User.java
│   │   └── Role.java
│   ├── repository/
│   │   ├── UserRepository.java
│   │   └── RoleRepository.java
│   └── service/
│       └── AuthService.java
│
├── event/
│   ├── controller/
│   │   └── EventController.java
│   ├── dto/
│   │   ├── CreateEventRequest.java
│   │   └── EventResponse.java
│   ├── entity/
│   │   └── Event.java
│   ├── repository/
│   │   └── EventRepository.java
│   └── service/
│       └── EventService.java
│
├── partner/
│   ├── controller/
│   ├── dto/
│   ├── entity/
│   ├── repository/
│   └── service/
│
└── common/
    ├── exception/
    ├── response/
    └── security/
```

Chỉ tạo module khi Sprint cần đến nó. Ví dụ Sprint 1 chưa làm Booth hoặc Payment thì chưa cần tạo sẵn các package rỗng `booth/` và `payment/`.

## 3. Cách một request đi qua module

Ví dụ Organizer gửi request tạo Event:

```text
HTTP request
→ EventController
→ EventService
→ EventRepository
→ PostgreSQL
→ EventResponse
```

Vai trò của từng tầng:

- `controller`: nhận request, gọi service và trả response.
- `dto`: định nghĩa dữ liệu API nhận vào và trả ra.
- `service`: xử lý business rule, validation, authorization và transaction.
- `repository`: truy vấn database.
- `entity`: ánh xạ dữ liệu với bảng trong database.

Ví dụ: Khi làm chức năng Event, lập trình viên chủ yếu làm việc trong `event/` thay vì phải sửa nhiều package lớn của toàn dự án.

## 4. So sánh với n-layer truyền thống

### N-layer truyền thống – chia theo tầng kỹ thuật

```text
controller/
├── AuthController.java
├── EventController.java
└── PartnerController.java

service/
├── AuthService.java
├── EventService.java
└── PartnerService.java

repository/
├── UserRepository.java
├── EventRepository.java
└── PartnerRepository.java

entity/
├── User.java
├── Event.java
└── PartnerOrganization.java
```

Các file của một chức năng bị rải ra nhiều thư mục. Muốn tìm toàn bộ code Event phải mở lần lượt `controller`, `service`, `repository`, `entity` và `dto`.

### Package by feature – chia theo chức năng

```text
auth/
├── controller/
├── dto/
├── entity/
├── repository/
└── service/

event/
├── controller/
├── dto/
├── entity/
├── repository/
└── service/
```

Mọi file liên quan đến Event nằm trong `event/`; mọi file liên quan đến Auth nằm trong `auth/`.

| Tiêu chí | N-layer truyền thống | Package by feature |
|---|---|---|
| Cách chia chính | Theo controller/service/repository | Theo chức năng Auth/Event/Partner |
| Tìm code của một chức năng | Phải đi qua nhiều package | Chủ yếu mở một module |
| Nhiều người code song song | Dễ cùng sửa các package chung | Mỗi người tập trung vào module riêng |
| Mức độ conflict Git | Thường cao hơn khi dự án lớn | Thường thấp hơn |
| Mở rộng chức năng | Các package tầng ngày càng đông | Thêm hoặc mở rộng module tương ứng |
| Phù hợp BookStreet | Dùng được nhưng khó quản lý khi lớn | Phù hợp hơn với cách chia việc theo domain |

Hai cách đều có controller, service, repository và entity. Điểm khác nhau chỉ là **thứ tự gom nhóm thư mục**:

- N-layer: gom tất cả controller vào một chỗ.
- Package by feature: gom tất cả code của một chức năng vào một chỗ.

## 5. Ví dụ chia việc trong Sprint 1

```text
Thành viên 1 → auth/
Thành viên 2 → event/
Thành viên 3 → partner/
```

Ví dụ Thành viên 2 làm Event sẽ tạo và sửa chủ yếu:

```text
event/controller/EventController.java
event/dto/CreateEventRequest.java
event/dto/EventResponse.java
event/entity/Event.java
event/repository/EventRepository.java
event/service/EventService.java
```

Thành viên này không tự sửa `auth/` hoặc `partner/`. Nếu Event cần thông tin người đăng nhập, Event sử dụng thành phần security dùng chung đã thống nhất thay vì tự viết lại authentication.

## 6. Quy tắc giữa các module

- Mỗi class phải nằm trong module sở hữu nghiệp vụ đó.
- Controller chỉ nhận request và gọi service; không viết business logic trực tiếp trong controller.
- Service xử lý nghiệp vụ; repository chỉ tập trung truy vấn dữ liệu.
- DTO của module nào nằm trong module đó; không trả entity trực tiếp ra API.
- Một module không được gọi controller của module khác.
- Khi cần dữ liệu từ module khác, gọi qua service hoặc interface/query component đã được thống nhất; không tự sửa nghiệp vụ của module kia.
- `common/` chỉ chứa thành phần thật sự dùng chung như error response, exception handler và security helper.
- Không đưa business logic riêng của Auth, Event hoặc Partner vào `common/`.
- Không tạo package hoặc class rỗng chỉ để chuẩn bị cho Sprint sau.

## 7. Khi nào cấu trúc được xem là đúng?

Cấu trúc package đạt yêu cầu khi:

- Nhìn vào tên module có thể biết chức năng nào sở hữu code đó.
- Code của một chức năng nằm chủ yếu trong một module.
- Các tầng controller, service và repository có trách nhiệm rõ ràng.
- Các module không truy cập chéo tùy tiện.
- `common/` không trở thành nơi chứa mọi thứ.
- Ba thành viên có thể làm trên ba module khác nhau với ít conflict Git.
- Dự án vẫn build và chạy như một Spring Boot application duy nhất.

## 8. Kết luận ngắn gọn

N-layer truyền thống hỏi: **“File này thuộc tầng nào?”**

Package by feature hỏi trước: **“File này thuộc chức năng nào?”**, rồi mới xác định nó là controller, service, repository hay entity bên trong chức năng đó.

BookStreet chọn package by feature vì dự án có nhiều nhóm nghiệp vụ độc lập và team cần chia việc theo module để dễ quản lý, dễ tìm code và hạn chế conflict.
