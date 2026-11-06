package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.activity.entity.ActivityProposal;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Writes Organizer work items inside the transaction that created their source transition. */
@Service
public class OrganizerWorkItemNotificationService {
    private final NotificationWriter writer;

    public OrganizerWorkItemNotificationService(NotificationWriter writer) {
        this.writer = writer;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void applicationSubmitted(Event event, PartnerEventApplication application) {
        if (application.getStatus() != PartnerEventApplication.ApplicationStatus.PENDING) return;
        Instant submittedAt = required(application.getSubmittedAt(),
                "Pending application has no submission time");
        writer.write(new NotificationCommand(
                event.getOrganizerUserId(), NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_NEW_PARTNER_APPLICATION,
                null, null, null, null, application.getId(), null, null, null,
                "organizer:application:" + application.getId() + ":submitted:" + submittedAt,
                "Có hồ sơ đối tác mới",
                "Một đối tác vừa gửi hồ sơ tham gia sự kiện và đang chờ bạn xem xét.",
                submittedAt));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void boothRequestSubmitted(Event event, BoothRequest request) {
        if (request.getStatus() != BoothRequestStatus.PENDING) return;
        Instant submittedAt = required(request.getSubmittedAt(),
                "Pending Booth request has no submission time");
        writer.write(new NotificationCommand(
                event.getOrganizerUserId(), NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_NEW_BOOTH_REQUEST,
                null, null, null, null, null, request.getBoothRequestId(), null, null,
                "organizer:booth-request:" + request.getBoothRequestId()
                        + ":submitted:" + submittedAt,
                "Có yêu cầu gian hàng mới",
                "Một đối tác vừa gửi yêu cầu gian hàng và đang chờ bạn xem xét.",
                submittedAt));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void activityProposalSubmitted(Event event, ActivityProposal proposal,
            boolean resubmission) {
        if (proposal.getStatus() != ActivityProposalStatus.PENDING) return;
        Instant transitionAt = required(resubmission
                        ? proposal.getUpdatedAt() : proposal.getSubmittedAt(),
                "Pending Activity proposal has no submission transition time");
        writer.write(new NotificationCommand(
                event.getOrganizerUserId(), NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED,
                null, null, null, null, null, null,
                proposal.getActivityProposalId(), null,
                "organizer:activity-proposal:" + proposal.getActivityProposalId()
                        + ":submitted:" + transitionAt,
                resubmission ? "Đề xuất hoạt động đã được gửi lại"
                        : "Có đề xuất hoạt động mới",
                resubmission
                        ? "Một đối tác vừa gửi lại đề xuất hoạt động đã chỉnh sửa để bạn xem xét."
                        : "Một đối tác vừa gửi đề xuất hoạt động và đang chờ bạn xem xét.",
                transitionAt));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void activityChangeRequestSubmitted(Event event, ActivityRequest request) {
        if (request.getStatus() != ActivityRequestStatus.PENDING
                || request.getRequestType() != ActivityRequestType.CHANGE) return;
        Instant submittedAt = required(request.getSubmittedAt(),
                "Pending Activity change request has no submission time");
        writer.write(new NotificationCommand(
                event.getOrganizerUserId(), NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST,
                null, null, null, null, null, null, null,
                request.getActivityRequestId(),
                "organizer:activity-change-request:" + request.getActivityRequestId()
                        + ":submitted:" + submittedAt,
                "Có yêu cầu thay đổi hoạt động mới",
                "Một đối tác vừa gửi yêu cầu thay đổi hoạt động và đang chờ bạn xem xét.",
                submittedAt));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void activityCancellationRequestSubmitted(Event event, ActivityRequest request) {
        if (request.getStatus() != ActivityRequestStatus.PENDING
                || request.getRequestType() != ActivityRequestType.CANCELLATION) return;
        Instant submittedAt = required(request.getSubmittedAt(),
                "Pending Activity cancellation request has no submission time");
        String message = request.isLate()
                ? "Một đối tác vừa gửi trễ yêu cầu hủy hoạt động và đang chờ bạn xem xét."
                : "Một đối tác vừa gửi yêu cầu hủy hoạt động và đang chờ bạn xem xét.";
        writer.write(new NotificationCommand(
                event.getOrganizerUserId(), NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST,
                null, null, null, null, null, null, null,
                request.getActivityRequestId(),
                "organizer:activity-cancellation-request:" + request.getActivityRequestId()
                        + ":submitted:" + submittedAt,
                "Có yêu cầu hủy hoạt động mới", message, submittedAt));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void boothReselectionRequired(Event event, BoothRequest releasedRequest) {
        Instant releasedAt;
        if (releasedRequest.getStatus() == BoothRequestStatus.WITHDRAWN) {
            releasedAt = releasedRequest.getWithdrawnAt();
        } else if (releasedRequest.getStatus() == BoothRequestStatus.PAYMENT_EXPIRED) {
            releasedAt = releasedRequest.getPaymentExpiredAt();
        } else {
            return;
        }
        releasedAt = required(releasedAt, "Released Booth request has no transition time");
        writer.write(new NotificationCommand(
                event.getOrganizerUserId(), NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_BOOTH_RESELECTION_REQUIRED,
                null, null, null, null, null, releasedRequest.getBoothRequestId(), null, null,
                "organizer:booth-reselection:" + releasedRequest.getBoothRequestId() + ":"
                        + releasedRequest.getStatus() + ":" + releasedAt,
                "Cần chọn lại đối tác cho gian hàng",
                "Gian hàng vừa được giải phóng và vẫn còn ứng viên hợp lệ đang chờ bạn lựa chọn.",
                releasedAt));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void boothPaymentConfirmed(Event event, BoothRequest request) {
        if (request.getStatus() != BoothRequestStatus.COMPLETED) return;
        Instant completedAt = required(request.getCompletedAt(),
                "Completed Booth request has no completion time");
        writer.write(new NotificationCommand(
                event.getOrganizerUserId(), NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_BOOTH_PAYMENT_CONFIRMED,
                null, null, null, null, null, request.getBoothRequestId(), null, null,
                "organizer:booth-payment-confirmed:" + request.getBoothRequestId()
                        + ":" + completedAt,
                "Đối tác đã thanh toán gian hàng",
                "Một đối tác vừa hoàn tất thanh toán và gian hàng đã được cấp.",
                completedAt));
    }

    private static Instant required(Instant value, String message) {
        if (value == null) throw new IllegalStateException(message);
        return value;
    }
}
