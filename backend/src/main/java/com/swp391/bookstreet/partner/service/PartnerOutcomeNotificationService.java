package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.service.NotificationCommand;
import com.swp391.bookstreet.notification.service.NotificationWriter;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Writes a Partner outcome in the transaction that changed its source record. */
@Service
public class PartnerOutcomeNotificationService {
    private final NotificationWriter writer;
    private final PartnerEventApplicationRepository applications;
    private final PartnerOrganizationRepository organizations;

    public PartnerOutcomeNotificationService(NotificationWriter writer,
            PartnerEventApplicationRepository applications,
            PartnerOrganizationRepository organizations) {
        this.writer = writer;
        this.applications = applications;
        this.organizations = organizations;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void applicationReviewed(PartnerEventApplication application) {
        var status = application.getStatus();
        if (status != PartnerEventApplication.ApplicationStatus.APPROVED
                && status != PartnerEventApplication.ApplicationStatus.REJECTED) return;
        var at = application.getReviewedAt();
        if (at == null) throw new IllegalStateException("Reviewed application has no review time");
        boolean approved = status == PartnerEventApplication.ApplicationStatus.APPROVED;
        writer.write(new NotificationCommand(
                application.getPartnerOrganization().getRepresentativeUserId(),
                NotificationRecipientRole.PARTNER,
                NotificationType.PARTNER_APPLICATION_STATUS_CHANGED,
                null, null, null, null, application.getId(), null, null, null,
                "partner:application:" + application.getId() + ":" + status + ":" + at,
                approved ? "Hồ sơ tham gia đã được duyệt" : "Hồ sơ tham gia chưa được duyệt",
                approved ? "Hồ sơ tham gia sự kiện của bạn đã được chấp thuận."
                        : "Hồ sơ tham gia sự kiện của bạn đã bị từ chối. Xem chi tiết hồ sơ để biết thêm.",
                at));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void boothChanged(BoothRequest request) {
        BoothRequestStatus status = request.getStatus();
        Instant at = switch (status) {
            case SELECTED -> request.getSelectedAt();
            case REJECTED -> request.getReviewedAt();
            case NOT_SELECTED, COMPLETED -> request.getCompletedAt();
            case PAYMENT_EXPIRED -> request.getPaymentExpiredAt();
            default -> null;
        };
        if (at == null) return;
        String title = switch (status) {
            case SELECTED -> "Gian hàng đã được chọn";
            case REJECTED -> "Yêu cầu gian hàng bị từ chối";
            case NOT_SELECTED -> "Gian hàng đã được cấp cho đối tác khác";
            case COMPLETED -> "Đã xác nhận gian hàng của bạn";
            case PAYMENT_EXPIRED -> "Thời hạn giữ gian hàng đã kết thúc";
            default -> throw new IllegalStateException("Unsupported Booth outcome");
        };
        String message = switch (status) {
            case SELECTED -> "Yêu cầu gian hàng đã được chọn. Hãy hoàn tất thanh toán trong thời hạn giữ chỗ.";
            case REJECTED -> "Yêu cầu gian hàng chưa được chấp thuận. Xem chi tiết để biết thêm.";
            case NOT_SELECTED -> "Một đối tác khác đã nhận gian hàng này. Bạn có thể xem các gian hàng khác.";
            case COMPLETED -> "Gian hàng đã được cấp thành công cho tổ chức của bạn.";
            case PAYMENT_EXPIRED -> "Thời hạn giữ gian hàng đã kết thúc. Bạn có thể xem các lựa chọn khác.";
            default -> throw new IllegalStateException("Unsupported Booth outcome");
        };
        writer.write(new NotificationCommand(
                request.getApplication().getPartnerOrganization().getRepresentativeUserId(),
                NotificationRecipientRole.PARTNER,
                NotificationType.PARTNER_BOOTH_REQUEST_STATUS_CHANGED,
                null, null, null, null, null, request.getBoothRequestId(), null, null,
                "partner:booth:" + request.getBoothRequestId() + ":" + status + ":" + at,
                title, message, at));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void boothHoldExpiring(BoothHold hold, Instant now) {
        BoothRequest request = hold.getBoothRequest();
        writer.write(new NotificationCommand(
                request.getApplication().getPartnerOrganization().getRepresentativeUserId(),
                NotificationRecipientRole.PARTNER,
                NotificationType.PARTNER_BOOTH_HOLD_EXPIRING,
                null, null, null, null, null, request.getBoothRequestId(), null, null,
                "partner:booth-hold-expiring:" + hold.getBoothHoldId() + ":" + hold.getExpiresAt(),
                "Gian hàng sắp hết hạn giữ chỗ",
                "Hãy hoàn tất thanh toán trước khi hết hạn để không mất gian hàng đã được chọn.",
                now));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void eventPublished(Event event, Instant publishedAt) {
        for (Long recipient : organizations.findActiveRepresentativeIdsExcluding(
                event.getOrganizerUserId())) {
            writer.write(new NotificationCommand(recipient, NotificationRecipientRole.PARTNER,
                    NotificationType.PARTNER_EVENT_PUBLISHED,
                    event.getEventId(), null, null, null, null, null, null, null,
                    "partner:event-published:" + event.getEventId(),
                    "Có sự kiện mới đang mở đăng ký",
                    "Một sự kiện mới vừa được công bố. Xem chi tiết để đăng ký tham gia.",
                    publishedAt));
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void eventCancelled(Event event) {
        Instant at = event.getCancelledAt();
        for (Long recipient : applications.findAffectedRepresentativeIds(event.getEventId(),
                List.of(PartnerEventApplication.ApplicationStatus.PENDING,
                        PartnerEventApplication.ApplicationStatus.APPROVED))) {
            writer.write(new NotificationCommand(recipient, NotificationRecipientRole.PARTNER,
                    NotificationType.PARTNER_EVENT_CANCELLED,
                    event.getEventId(), null, null, null, null, null, null, null,
                    "partner:event:cancelled:" + event.getEventId() + ":" + recipient,
                    "Sự kiện đã bị hủy", "Sự kiện bạn tham gia đã bị hủy. Xem chi tiết để biết thêm.", at));
        }
    }
}
