# Rà soát Event Management — Thành viên 2

Cập nhật 2026-10-04. Phạm vi UC-O01, AC-O01-01 đến AC-O01-05, 7 API Event.
Báo cáo này thay thế các nhận xét cũ ngày 2026-10-01.

> **Historical implementation review:** Báo cáo này ghi nhận trạng thái Sprint 1. Chính sách Event
> lifecycle/cancellation hiện hành nằm trong Business Rules và tài liệu Sprint 4; các diễn giải cũ
> về refund/cutoff bên dưới không phải nguồn triển khai mới.

## 1. Auth/public đã tích hợp

SecurityConfiguration cho phép GET public; repository chỉ trả PUBLISHED.
AuthenticatedUser triển khai `AuthenticatedPrincipal` dùng chung. Event kiểm tra session,
ROLE_ORGANIZER, email verified và lấy owner từ principal. Test API dùng security thật
với principal test. Các lỗi từ chối quyền tại ranh giới security dùng mã `ACCESS_DENIED`.
Không còn nạp EventTestSecurityConfiguration; test này không thay thế demo frontend login thật.

## 2. Ownership và transaction

Create tạo DRAFT. Chỉ Organizer phụ trách được PATCH/publish Draft.
Khác owner/không tồn tại trả 404; sai trạng thái trả 409 EVENT_NOT_DRAFT.
Khóa dòng và transaction bảo vệ PATCH/publish; một lần chuyển trạng thái khi publish đồng thời.

## 3. Đã sửa — Deadline/cutoff

- Mọi mốc có giá trị phải <= startAt; endAt > startAt.
- Booth Request/Activity Proposal deadline >= Partner application deadline khi có cả hai.
- Cho phép bằng nhau, so sánh Instant độc lập offset.
- Cutoff rút/hủy độc lập hạn nộp, có thể sau hạn nộp nhưng không sau startAt.
- Các cutoff vẫn được kiểm tra như dữ liệu Event. Cách dùng chúng để phân loại refund là thiết kế
  Post-MVP; Sprint 4 không triển khai business refund.
- Áp dụng trên create, trạng thái sau PATCH và publish. Sai trả 422 EVENT_TIME_INVALID kèm field.
- Dời startAt kiểm tra lại deadline; PATCH sai rollback các thay đổi.

## 4. Đã sửa — Điều kiện publish

Chính sách được cụ thể hóa theo yêu cầu người dùng 2026-10-04, đồng bộ API Contract/UC-O01.
Draft được thiếu deadline để nhập dần. Publish bắt buộc đủ bảy mốc, kể cả quota bằng 0:

1. partnerApplicationDeadlineAt
2. boothRequestDeadlineAt
3. activityProposalDeadlineAt
4. participantRegistrationDeadlineAt
5. partnerWithdrawalCutoffAt
6. boothCancellationCutoffAt
7. activityCancellationCutoffAt

Thiếu trả 422 EVENT_INCOMPLETE_FOR_PUBLISH. startAt và cả bảy mốc phải > thời điểm server
kiểm tra publish; bằng hoặc đã qua trả 422 EVENT_TIME_INVALID. Thời điểm lấy một lần mỗi validation.
Deadline có thể bằng startAt. Tên/start/end/payment window/quota vẫn bắt buộc; số không âm.
Description/banner tùy chọn. Draft cũ được sửa lịch; không thể publish lịch hết hạn.
Publish lỗi giữ DRAFT và không xuất hiện public. Không đổi schema nullable vì Draft cần nhập dần.

## 5. Kiểm thử

2026-10-04: 112 test pass, 0 failure/error/skip, gồm 24 test API Event,
17 test deadline, 16 test publication và 6 test Event identity.
Bao phủ thiếu từng mốc, quá hạn, bằng now, lịch hợp lệ, timezone, rollback và Draft visibility.
Từ backend/, với PostgreSQL/Redis đang chạy:

```powershell
$env:EVENT_TEST_DATABASE_URL = 'jdbc:postgresql://localhost:55432/bookstreet_review_event_test'
mvn test
Remove-Item Env:EVENT_TEST_DATABASE_URL
```

Database phải riêng và có hậu tố _event_test, không dùng database demo/production.
Không có biến này thì test tích hợp Event bị skip. Kết quả: backend/target/surefire-reports,
backend/target/publish-policy-tests.log.

## 6. Giới hạn

Không đổi migration V1–V3, schema hoặc dữ liệu seed. Event đã PUBLISHED không bị tự sửa/unpublish.
Chặn nộp đơn theo thời gian thực thuộc API Partner, không thuộc task Event.
Frontend chưa đồng bộ contract; không suy ra toàn Sprint hoàn tất từ test Event.
AI_CONTEXT.md còn ghi Event chưa triển khai; context owner cập nhật riêng. Chưa commit/push.
