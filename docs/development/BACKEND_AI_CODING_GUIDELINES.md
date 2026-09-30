# Backend AI Coding Guidelines

AI phải đọc `AGENTS.md`, `AI_CONTEXT.md` và tài liệu của Current Sprint trước khi sửa code. Nếu tài liệu chưa rõ hoặc mâu thuẫn, phải báo lại thay vì tự giả định.

## 1. Kiến trúc được chọn

BookStreet là **modular monolith**: một ứng dụng Spring Boot, chia package theo chức năng.

```text
bookstreet/
├── auth/
│   ├── controller/
│   ├── dto/
│   ├── entity/
│   ├── repository/
│   └── service/
├── event/
│   ├── controller/
│   ├── dto/
│   ├── entity/
│   ├── repository/
│   └── service/
├── partner/
│   ├── controller/
│   ├── dto/
│   ├── entity/
│   ├── repository/
│   └── service/
└── common/
    ├── exception/
    ├── response/
    └── security/
```

Chỉ tạo module khi Sprint cần. Không tạo trước package rỗng cho Booth, Payment, Activity hoặc chức năng tương lai.

## 2. Trách nhiệm từng tầng

- `controller`: nhận request, gọi service, trả response; không chứa business logic.
- `dto`: dữ liệu API nhận vào/trả ra; không trả entity trực tiếp.
- `service`: business rule, validation, authorization và transaction.
- `repository`: truy vấn database.
- `entity`: ánh xạ đúng Physical ERD và Flyway migration.

Luồng chuẩn:

```text
Controller → Service → Repository → Database
```

## 3. Quy tắc dùng interface

Không tạo `Service` interface và `ServiceImpl` cho mọi service.

Chỉ dùng interface khi có lý do rõ ràng:

- Spring Data Repository.
- Ranh giới dùng chung, ví dụ `CurrentUserProvider`.
- Giao tiếp giữa các module cần tách phụ thuộc.
- Tích hợp bên ngoài hoặc có nhiều implementation thực sự.

Với service chỉ có một implementation, dùng class trực tiếp:

```java
@Service
@RequiredArgsConstructor
public class EventService {
    private final EventRepository eventRepository;
}
```

## 4. Quy tắc code

- Dùng constructor injection; không dùng field injection.
- Đặt tên class/method theo đúng nghiệp vụ.
- Dùng DTO cho request/response.
- Dùng enum Java cho status nhưng phải khớp giá trị trong database.
- Dùng Bean Validation cho định dạng request; business validation đặt trong service.
- Dùng `@Transactional` tại service method cần transaction.
- Xử lý lỗi tập trung bằng `@RestControllerAdvice`.
- Không log hoặc trả về password, session ID hay secret.
- Không lấy authenticated user ID từ request body; lấy từ security context qua thành phần dùng chung.
- Một module không gọi controller của module khác.
- Khi cần dữ liệu module khác, dùng service hoặc query interface đã thống nhất.
- `common/` chỉ chứa code thật sự dùng chung; không đặt business logic riêng vào đó.

## 5. Không over-engineering

Không tự thêm các thành phần sau nếu chưa có yêu cầu rõ ràng:

- Generic `BaseController`, `BaseService` hoặc `BaseRepository`.
- Interface cho mọi class.
- Factory/Strategy chỉ để chuẩn bị cho tương lai.
- Clean/Hexagonal Architecture nhiều tầng.
- CQRS, Event Sourcing hoặc microservice.
- Bảng, cột, role, status, API hoặc dependency mới ngoài baseline.

Ưu tiên giải pháp đơn giản nhất đáp ứng đúng requirement và có thể test.

## 6. Quy tắc khi AI thực hiện task

1. Kiểm tra branch, working tree và tài liệu liên quan.
2. Xác nhận phạm vi task; không sửa module không liên quan.
3. Đọc migration hiện có trước khi tạo entity.
4. Thực hiện thay đổi nhỏ, rõ ràng và bám API Contract.
5. Thêm test cho luồng thành công, validation, authorization và lỗi quan trọng.
6. Chạy build/test phù hợp.
7. Báo cáo file đã đổi, kết quả test và vấn đề còn lại.
8. Không commit, push, merge hoặc tạo migration mới nếu người dùng chưa yêu cầu.

## 7. Điều kiện hoàn thành

AI chỉ báo task hoàn thành khi:

- Code đúng phạm vi và đúng tài liệu hiện hành.
- Module/layer được đặt đúng vị trí.
- Không có abstraction thừa.
- Build và test liên quan đều pass.
- Validation, authorization và error handling cần thiết đã được kiểm tra.
- Không có thay đổi ngoài phạm vi hoặc secret trong repository.

Nếu chưa thể chạy test hoặc còn quyết định nghiệp vụ chưa rõ, phải ghi rõ task chưa được xác minh đầy đủ.
