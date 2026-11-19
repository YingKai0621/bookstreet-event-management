# Project Documentation

Thư mục này là nguồn context dùng chung cho team và AI coding assistant của Book Street Event Management System.

## Đọc gì trước khi code

1. [`../AI_CONTEXT.md`](../AI_CONTEXT.md)
2. [`sprints/CURRENT_SPRINT.md`](sprints/CURRENT_SPRINT.md)
3. Tài liệu Sprint đang active trong `sprints/`
4. Use Case Specification trong `use-cases/`
5. API Contract trong `api/`
6. Business Rules, Physical ERD và coding guideline liên quan

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `requirements/` | Requirement và Business Rule baseline |
| `design/` | Báo cáo ERD, overlay, file Draw.io và ảnh sơ đồ |
| `sprints/` | Phạm vi, mục tiêu, kế hoạch, phân công và trạng thái Sprint |
| `use-cases/` | Use Case Specification và Acceptance Criteria |
| `api/` | API Contract theo Sprint và cross-cutting contract |
| `development/` | Coding guideline, review, handoff và báo cáo hoàn thành kỹ thuật |

## Sprint đang hoạt động

Sprint 11 System Admin Management đã merge phần implementation và đang chờ closure/deployment validation:

- Baseline: [`sprints/sprint-11.md`](sprints/sprint-11.md)
- Use Case Specifications: [`use-cases/sprint-11-use-case-specifications.md`](use-cases/sprint-11-use-case-specifications.md)
- API Contract: [`api/sprint-11-api-contract.md`](api/sprint-11-api-contract.md)
- Editor image contract: [`api/content-image-upload-api-contract.md`](api/content-image-upload-api-contract.md)
- Physical ERD: [`design/12_Physical_ERD_Report.md`](design/12_Physical_ERD_Report.md)
- Implementation plan and ownership:
  [`sprints/SPRINT_11_IMPLEMENTATION_PLAN.md`](sprints/SPRINT_11_IMPLEMENTATION_PLAN.md),
  [`sprints/SPRINT_11_TEAM_ASSIGNMENT.md`](sprints/SPRINT_11_TEAM_ASSIGNMENT.md)
- Closure evidence: [`development/SPRINT_11_CLOSURE_REPORT.md`](development/SPRINT_11_CLOSURE_REPORT.md)

## Baseline hiện tại

- Requirement: active MVP rules through `BR-121`
- Use Case Diagram: V2, with Post-MVP use cases labelled
- Conceptual ERD: Baseline 2.1
- Logical ERD: v8 plus approved Sprint overlays
- Physical implementation source: immutable Flyway V1–V18 and the current Physical ERD report
- Latest formally completed Sprint: Sprint 10 Role-Scoped In-App Notifications
- Active Sprint: Sprint 11, implementation merged and closure validation pending
- Active MVP Use Case count: 28

PostgreSQL là durable source of truth; Redis chỉ lưu Spring Session. Authentication dùng HttpOnly Session cookie, không dùng
JWT. Schema phải thay đổi bằng migration Flyway mới; không sửa migration đã áp dụng.

## Báo cáo và extension quan trọng

- Sprint 10 closure: [`development/SPRINT_10_CLOSURE_REPORT.md`](development/SPRINT_10_CLOSURE_REPORT.md)
- Sprint 9 closure: [`development/SPRINT_09_CLOSURE_REPORT.md`](development/SPRINT_09_CLOSURE_REPORT.md)
- Sprint 6 completion: [`development/SPRINT_06_COMPLETION_REPORT.md`](development/SPRINT_06_COMPLETION_REPORT.md)
- Email verification: [`api/email-verification-api-contract.md`](api/email-verification-api-contract.md)
- Browser Session/CORS/CSRF: [`api/browser-security-contract.md`](api/browser-security-contract.md)

Các tài liệu Sprint cũ vẫn được giữ để tra cứu. Sprint đang active luôn được xác định bởi
[`sprints/CURRENT_SPRINT.md`](sprints/CURRENT_SPRINT.md). Nếu tài liệu mâu thuẫn, áp dụng thứ tự nguồn sự thật trong
`AGENTS.md` và báo cáo xung đột trước khi code.
