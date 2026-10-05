# Project Documentation

Thư mục này là nguồn context dùng chung cho team và AI coding assistant của Book Street Event Management System.

## Đọc gì trước khi code

1. [`../AI_CONTEXT.md`](../AI_CONTEXT.md)
2. [`sprints/CURRENT_SPRINT.md`](sprints/CURRENT_SPRINT.md)
3. Tài liệu Sprint đang active trong `sprints/`
4. Use Case Specification trong `use-cases/`
5. API Contract trong `api/`
6. Requirement và thiết kế liên quan đến task đang làm

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `requirements/` | Requirement baseline 01–09 ở Markdown |
| `design/` | Báo cáo ERD 10–12, file Draw.io và ảnh sơ đồ |
| `sprints/` | Phạm vi, mục tiêu và trạng thái Sprint |
| `use-cases/` | Use Case Specification và Acceptance Criteria theo Sprint hoặc extension đã duyệt |
| `api/` | API Contract theo Sprint và cross-cutting contract |
| `development/` | Coding guideline, review, handoff và báo cáo hoàn thành kỹ thuật |

## Baseline hiện tại

- Requirement: v4
- Use Case Diagram: V2
- Conceptual ERD: Baseline 2.1
- Logical ERD: v7
- Physical ERD: v1
- Active Sprint: Sprint 01
- Sprint 1 Backend: Complete; frontend integration pending

Các file Markdown là bản đọc nhanh trong repo. File `.drawio` là nguồn chỉnh sửa sơ đồ; ảnh trong `design/assets/` dùng để xem trực tiếp trên GitHub và trong report.

## Trạng thái extension đã duyệt

- Email verification đã triển khai: [`use-cases/email-verification-use-case-specification.md`](use-cases/email-verification-use-case-specification.md) và [`api/email-verification-api-contract.md`](api/email-verification-api-contract.md)
- Browser Session/CORS/CSRF mới triển khai một phần và vẫn chờ cấu hình frontend theo môi trường: [`api/browser-security-contract.md`](api/browser-security-contract.md)
- Báo cáo hoàn thành Sprint 1 Backend: [`development/SPRINT_01_BACKEND_COMPLETION_REPORT.md`](development/SPRINT_01_BACKEND_COMPLETION_REPORT.md)

Các tài liệu extension trên không tự động mở rộng Definition of Done của Sprint 1.

Nếu tài liệu có mâu thuẫn, dừng triển khai và kiểm tra thứ tự ưu tiên trong `AI_CONTEXT.md`.
