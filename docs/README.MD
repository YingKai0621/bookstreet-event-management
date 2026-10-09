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

- Requirement: v5 (Sprint 4 scope clarification)
- Use Case Diagram: V2, with Post-MVP use cases labelled in the diagram
- Conceptual ERD: Baseline 2.1
- Logical ERD: v7 with active-MVP/Post-MVP overlay
- Physical implementation source: Flyway V1–V7 plus the active planned V8 overlay in
  `design/12_Physical_ERD_Report.md`; target v1 (33 tables) is reference only
- Active Sprint: Sprint 04
- Sprint 1 and Sprint 2: complete; Sprint 3 backend complete
- Sprint 3 Payment/Assignment backend: implemented and verified through V7
- Sprint 3 frontend integration and Playwright E2E: pending
- Sprint 4 documentation: approved; implementation and V8 pending

Các file Markdown là bản đọc nhanh trong repo. File `.drawio` là nguồn chỉnh sửa sơ đồ; ảnh trong `design/assets/` dùng để xem trực tiếp trên GitHub và trong report.

## Trạng thái extension đã duyệt

- Email verification đã triển khai: [`use-cases/email-verification-use-case-specification.md`](use-cases/email-verification-use-case-specification.md) và [`api/email-verification-api-contract.md`](api/email-verification-api-contract.md)
- Browser Session/CORS/CSRF đã triển khai; frontend phải tích hợp theo contract và cấu hình origin/cookie phù hợp từng môi trường: [`api/browser-security-contract.md`](api/browser-security-contract.md)
- Báo cáo hoàn thành Sprint 1 Backend: [`development/SPRINT_01_BACKEND_COMPLETION_REPORT.md`](development/SPRINT_01_BACKEND_COMPLETION_REPORT.md)
- Hướng dẫn bàn giao và tích hợp Sprint 1 cho frontend: [`development/SPRINT_01_FRONTEND_HANDOFF.md`](development/SPRINT_01_FRONTEND_HANDOFF.md)
- Trạng thái Sprint 4: [`sprints/CURRENT_SPRINT.md`](sprints/CURRENT_SPRINT.md)
- Sprint 4 baseline: [`sprints/sprint-04.md`](sprints/sprint-04.md)
- Sprint 4 Use Case Specifications: [`use-cases/sprint-04-use-case-specifications.md`](use-cases/sprint-04-use-case-specifications.md)
- Sprint 4 API Contract: [`api/sprint-04-api-contract.md`](api/sprint-04-api-contract.md)
- API Payment/Assignment Sprint 3: [`api/sprint-03-api-contract.md`](api/sprint-03-api-contract.md)

Các tài liệu lịch sử của Sprint 1–3 vẫn được giữ để tra cứu; phạm vi đang active được xác định bởi
`CURRENT_SPRINT.md`.

Nếu tài liệu có mâu thuẫn, dừng triển khai và kiểm tra thứ tự ưu tiên trong `AI_CONTEXT.md`.
