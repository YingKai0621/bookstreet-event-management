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

- Requirement: v6 (approved Sprint 5 Activity rules)
- Use Case Diagram: V2, with Post-MVP use cases labelled in the diagram
- Conceptual ERD: Baseline 2.1
- Logical ERD: v8 with approved Sprint 5 Activity overlay
- Physical implementation source: immutable Flyway V1–V8; approved V9 Activity design overlay is
  ready for implementation; target v1 image remains reference only
- Active Sprint: Sprint 05 Activity Planning and Partner Proposal Workflow — approved, not yet
  implemented
- Latest completed Sprint: Sprint 04
- Sprint 1 and Sprint 2: complete; Sprint 3 backend complete
- Sprint 3 Payment/Assignment backend: implemented and verified through V7
- Sprint 3 Payment/Assignment frontend integration: implemented; browser-level Playwright E2E remains technical debt
- Sprint 4 Event lifecycle and pre-payment Booth release: completed and verified through V8
- Sprint 5 Activity planning: documentation baseline approved; V9/code not yet implemented

Các file Markdown là bản đọc nhanh trong repo. File `.drawio` là nguồn chỉnh sửa sơ đồ; ảnh trong
`design/assets/` dùng để xem trực tiếp trên GitHub và trong report. Riêng Activity Sprint 5, V9
overlay trong `design/12_Physical_ERD_Report.md` là nguồn thiết kế được duyệt và tạm thời supersede
cụm Activity của Draw.io target v1 cho tới khi migration triển khai và sơ đồ được render lại.

## Trạng thái extension đã duyệt

- Email verification đã triển khai: [`use-cases/email-verification-use-case-specification.md`](use-cases/email-verification-use-case-specification.md) và [`api/email-verification-api-contract.md`](api/email-verification-api-contract.md)
- Browser Session/CORS/CSRF đã triển khai; frontend phải tích hợp theo contract và cấu hình origin/cookie phù hợp từng môi trường: [`api/browser-security-contract.md`](api/browser-security-contract.md)
- Báo cáo hoàn thành Sprint 1 Backend: [`development/SPRINT_01_BACKEND_COMPLETION_REPORT.md`](development/SPRINT_01_BACKEND_COMPLETION_REPORT.md)
- Báo cáo hoàn thành Sprint 4: [`development/SPRINT_04_COMPLETION_REPORT.md`](development/SPRINT_04_COMPLETION_REPORT.md)
- Hướng dẫn bàn giao và tích hợp Sprint 1 cho frontend: [`development/SPRINT_01_FRONTEND_HANDOFF.md`](development/SPRINT_01_FRONTEND_HANDOFF.md)
- Trạng thái Sprint hiện tại: [`sprints/CURRENT_SPRINT.md`](sprints/CURRENT_SPRINT.md)
- Sprint 5 baseline: [`sprints/sprint-05.md`](sprints/sprint-05.md)
- Sprint 5 Use Case Specifications: [`use-cases/sprint-05-use-case-specifications.md`](use-cases/sprint-05-use-case-specifications.md)
- Sprint 5 API Contract: [`api/sprint-05-api-contract.md`](api/sprint-05-api-contract.md)
- Sprint 5 Backend Work Assignment: [`sprints/SPRINT_05_BACKEND_WORK_ASSIGNMENT.md`](sprints/SPRINT_05_BACKEND_WORK_ASSIGNMENT.md)
- Sprint 4 baseline: [`sprints/sprint-04.md`](sprints/sprint-04.md)
- Sprint 4 Use Case Specifications: [`use-cases/sprint-04-use-case-specifications.md`](use-cases/sprint-04-use-case-specifications.md)
- Sprint 4 API Contract: [`api/sprint-04-api-contract.md`](api/sprint-04-api-contract.md)
- API Payment/Assignment Sprint 3: [`api/sprint-03-api-contract.md`](api/sprint-03-api-contract.md)

Các tài liệu lịch sử của Sprint 1–3 vẫn được giữ để tra cứu; trạng thái Sprint gần nhất và việc có
hay không có Sprint đang active được xác định bởi `CURRENT_SPRINT.md`.

Nếu tài liệu có mâu thuẫn, dừng triển khai và kiểm tra thứ tự ưu tiên trong `AI_CONTEXT.md`.
