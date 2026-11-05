package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.service.NotificationCommand;
import com.swp391.bookstreet.notification.service.NotificationWriter;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Writes a Partner outcome in the transaction that changed its source record. */
@Service
public class PartnerOutcomeNotificationService {
    private final NotificationWriter writer;

    public PartnerOutcomeNotificationService(NotificationWriter writer) {
        this.writer = writer;
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
}
