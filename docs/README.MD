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

## Sprint đang hoạt động

- Sprint 10 Role-Scoped In-App Notifications:
  [`sprints/sprint-10.md`](sprints/sprint-10.md)
- Use Case Specifications:
  [`use-cases/sprint-10-use-case-specifications.md`](use-cases/sprint-10-use-case-specifications.md)
- API Contract:
  [`api/sprint-10-api-contract.md`](api/sprint-10-api-contract.md)
- Physical ERD overlay:
  [`design/SPRINT_10_ROLE_NOTIFICATIONS_PHYSICAL_ERD_OVERLAY.md`](design/SPRINT_10_ROLE_NOTIFICATIONS_PHYSICAL_ERD_OVERLAY.md)
- Implementation plan and ownership:
  [`sprints/SPRINT_10_IMPLEMENTATION_PLAN.md`](sprints/SPRINT_10_IMPLEMENTATION_PLAN.md),
  [`sprints/SPRINT_10_TEAM_ASSIGNMENT.md`](sprints/SPRINT_10_TEAM_ASSIGNMENT.md)

## Baseline hiện tại

- Requirement: active MVP baseline through `BR-109`, including Sprint 10 role-scoped Notification rules
- Use Case Diagram: V2, with Post-MVP use cases labelled in the diagram
- Conceptual ERD: Baseline 2.1
- Logical ERD: v8 plus approved Sprint 6–10 interpretations
- Physical implementation source: immutable Flyway V1–V15; Sprint 10 V16 is reserved but not implemented
- Active Sprint: Sprint 10 Role-Scoped In-App Notifications, activated `2026-11-03`
- Active foundation owner: Developer A `YingKai0621`; Developer B/C are documented Partner/Organizer
  work-package labels that teammates may claim without recording personal names
- Latest completed Sprint: Sprint 09 Heritage Public Content
- Completed implementation baseline: Authentication/Event through V5, Booth/Payment/Event hardening
  through V8, Activity through V9, Participant/Attendance through V11, Rewards through V12, Booth image
  through V13, General Feedback through V14 and Heritage through V15

Các file Markdown là bản đọc nhanh trong repo. File `.drawio` là nguồn chỉnh sửa sơ đồ; ảnh trong
`design/assets/` dùng để xem trực tiếp trên GitHub và trong report. Immutable Flyway V1–V15 và
`design/12_Physical_ERD_Report.md` là nguồn schema đã áp dụng; Sprint 10 overlay mô tả V16 đã duyệt nhưng
chưa được triển khai.

## Trạng thái extension đã duyệt

- Email verification đã triển khai: [`use-cases/email-verification-use-case-specification.md`](use-cases/email-verification-use-case-specification.md) và [`api/email-verification-api-contract.md`](api/email-verification-api-contract.md)
- Browser Session/CORS/CSRF đã triển khai; frontend phải tích hợp theo contract và cấu hình origin/cookie phù hợp từng môi trường: [`api/browser-security-contract.md`](api/browser-security-contract.md)
- Báo cáo hoàn thành Sprint 1 Backend: [`development/SPRINT_01_BACKEND_COMPLETION_REPORT.md`](development/SPRINT_01_BACKEND_COMPLETION_REPORT.md)
- Báo cáo hoàn thành Sprint 4: [`development/SPRINT_04_COMPLETION_REPORT.md`](development/SPRINT_04_COMPLETION_REPORT.md)
- Báo cáo hoàn thành Sprint 5: [`development/SPRINT_05_COMPLETION_REPORT.md`](development/SPRINT_05_COMPLETION_REPORT.md)
- Hướng dẫn bàn giao và tích hợp Sprint 1 cho frontend: [`development/SPRINT_01_FRONTEND_HANDOFF.md`](development/SPRINT_01_FRONTEND_HANDOFF.md)
- Trạng thái Sprint hiện tại: [`sprints/CURRENT_SPRINT.md`](sprints/CURRENT_SPRINT.md)
- Sprint 10 baseline: [`sprints/sprint-10.md`](sprints/sprint-10.md)
- Sprint 10 Use Case Specifications: [`use-cases/sprint-10-use-case-specifications.md`](use-cases/sprint-10-use-case-specifications.md)
- Sprint 10 API Contract: [`api/sprint-10-api-contract.md`](api/sprint-10-api-contract.md)
- Sprint 10 Documentation Audit: [`development/SPRINT_10_DOCUMENTATION_AUDIT.md`](development/SPRINT_10_DOCUMENTATION_AUDIT.md)
- Sprint 9 closure: [`development/SPRINT_09_CLOSURE_REPORT.md`](development/SPRINT_09_CLOSURE_REPORT.md)
- Sprint 5 baseline: [`sprints/sprint-05.md`](sprints/sprint-05.md)
- Sprint 5 Use Case Specifications: [`use-cases/sprint-05-use-case-specifications.md`](use-cases/sprint-05-use-case-specifications.md)
- Sprint 5 API Contract: [`api/sprint-05-api-contract.md`](api/sprint-05-api-contract.md)
- Sprint 5 Backend Work Assignment: [`sprints/SPRINT_05_BACKEND_WORK_ASSIGNMENT.md`](sprints/SPRINT_05_BACKEND_WORK_ASSIGNMENT.md)
- Sprint 4 baseline: [`sprints/sprint-04.md`](sprints/sprint-04.md)
- Sprint 4 Use Case Specifications: [`use-cases/sprint-04-use-case-specifications.md`](use-cases/sprint-04-use-case-specifications.md)
- Sprint 4 API Contract: [`api/sprint-04-api-contract.md`](api/sprint-04-api-contract.md)
- API Payment/Assignment Sprint 3: [`api/sprint-03-api-contract.md`](api/sprint-03-api-contract.md)

Các tài liệu Sprint trước vẫn được giữ để tra cứu; Sprint đang active luôn được xác định bởi
`CURRENT_SPRINT.md`.

Nếu tài liệu có mâu thuẫn, dừng triển khai và kiểm tra thứ tự ưu tiên trong `AI_CONTEXT.md`.
