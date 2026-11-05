package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityProposal;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.service.NotificationCommand;
import com.swp391.bookstreet.notification.service.NotificationWriter;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityPartnerOutcomeService {
    private final NotificationWriter writer;
    private final PartnerEventApplicationRepository applications;
    private final ActivityProposalRepository proposals;
    private final ActivityRepository activities;

    public ActivityPartnerOutcomeService(NotificationWriter writer,
            PartnerEventApplicationRepository applications,
            ActivityProposalRepository proposals, ActivityRepository activities) {
        this.writer = writer;
        this.applications = applications;
        this.proposals = proposals;
        this.activities = activities;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void proposalChanged(ActivityProposal proposal) {
        ActivityProposalStatus status = proposal.getStatus();
        Instant at = status == ActivityProposalStatus.CANCELLED
                ? proposal.getCancelledAt() : proposal.getReviewedAt();
        if (at == null || (status != ActivityProposalStatus.NEED_CHANGES
                && status != ActivityProposalStatus.APPROVED
                && status != ActivityProposalStatus.REJECTED
                && status != ActivityProposalStatus.CANCELLED)) return;
        Long recipient = applications.findById(proposal.getApplicationId()).orElseThrow()
                .getPartnerOrganization().getRepresentativeUserId();
        String title = switch (status) {
            case NEED_CHANGES -> "Đề xuất hoạt động cần chỉnh sửa";
            case APPROVED -> "Đề xuất hoạt động đã được duyệt";
            case REJECTED -> "Đề xuất hoạt động bị từ chối";
            case CANCELLED -> "Đề xuất hoạt động đã đóng";
            default -> throw new IllegalStateException();
        };
        writer.write(new NotificationCommand(recipient, NotificationRecipientRole.PARTNER,
                NotificationType.PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED,
                null, null, null, null, null, null, proposal.getActivityProposalId(), null,
                "partner:proposal:" + proposal.getActivityProposalId() + ":" + status + ":" + at,
                title, "Xem chi tiết đề xuất hoạt động để biết kết quả.", at));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requestChanged(ActivityRequest request) {
        ActivityRequestStatus status = request.getStatus();
        Instant at = status == ActivityRequestStatus.CANCELLED
                ? request.getCancelledAt() : request.getHandledAt();
        if (at == null || (status != ActivityRequestStatus.APPROVED
                && status != ActivityRequestStatus.REJECTED
                && status != ActivityRequestStatus.CANCELLED)) return;
        Activity activity = activities.findById(request.getActivityId()).orElseThrow();
        if (activity.getSourceProposalId() == null) return;
        Long recipient = representativeFor(activity);
        NotificationType type = request.getRequestType() == ActivityRequestType.CHANGE
                ? NotificationType.PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED
                : NotificationType.PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED;
        String title = switch (status) {
            case APPROVED -> "Yêu cầu hoạt động đã được duyệt";
            case REJECTED -> "Yêu cầu hoạt động bị từ chối";
            case CANCELLED -> "Yêu cầu hoạt động đã đóng";
            default -> throw new IllegalStateException();
        };
        writer.write(new NotificationCommand(recipient, NotificationRecipientRole.PARTNER,
                type, null, null, null, null, null, null, null, request.getActivityRequestId(),
                "partner:request:" + request.getActivityRequestId() + ":" + status + ":" + at,
                title, "Xem chi tiết yêu cầu hoạt động để biết kết quả.", at));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void activityCancelled(Activity activity, Instant at) {
        if (activity.getSourceProposalId() == null) return;
        writer.write(new NotificationCommand(representativeFor(activity),
                NotificationRecipientRole.PARTNER, NotificationType.PARTNER_ACTIVITY_CANCELLED,
                null, activity.getActivityId(), null, null, null, null, null, null,
                "partner:activity:cancelled:" + activity.getActivityId(),
                "Hoạt động đã bị hủy", "Hoạt động của tổ chức bạn đã bị hủy. Xem chi tiết để biết thêm.", at));
    }

    private Long representativeFor(Activity activity) {
        ActivityProposal proposal = proposals.findById(activity.getSourceProposalId()).orElseThrow();
        return applications.findById(proposal.getApplicationId()).orElseThrow()
                .getPartnerOrganization().getRepresentativeUserId();
    }
}
