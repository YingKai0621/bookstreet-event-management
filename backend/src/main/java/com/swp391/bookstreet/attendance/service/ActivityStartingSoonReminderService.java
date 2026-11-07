package com.swp391.bookstreet.attendance.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationCommand;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reminds seat-active Participants once per Activity start time. Rescheduling opens a new reminder. */
@Service
public class ActivityStartingSoonReminderService {
    private final ActivityRegistrationRepository registrations;
    private final ParticipantNotificationWriter notifications;
    private final Clock clock;
    private final Duration window;

    public ActivityStartingSoonReminderService(ActivityRegistrationRepository registrations,
            ParticipantNotificationWriter notifications, Clock clock,
            @Value("${bookstreet.activity.reminder-window-hours:24}") int windowHours) {
        this.registrations = registrations;
        this.notifications = notifications;
        this.clock = clock;
        this.window = Duration.ofHours(windowHours);
    }

    @Scheduled(
            initialDelayString = "${bookstreet.activity.lifecycle-initial-delay-ms:60000}",
            fixedDelayString = "${bookstreet.activity.lifecycle-delay-ms:60000}"
    )
    @Transactional
    public void remindStartingSoon() {
        remindStartingSoon(clock.instant());
    }

    @Transactional
    public int remindStartingSoon(Instant now) {
        var recipients = registrations.findActivityReminderRecipients(now, now.plus(window));
        for (var recipient : recipients) {
            notifications.write(new ParticipantNotificationCommand(
                    recipient.getUserId(), ParticipantNotificationType.ACTIVITY_STARTING_SOON,
                    null, recipient.getActivityId(), null,
                    "activity-starting-soon-" + recipient.getActivityId() + "-"
                            + recipient.getStartEpochSecond(),
                    "Hoạt động sắp diễn ra",
                    "Hoạt động bạn đã đăng ký sắp bắt đầu. Hãy kiểm tra thời gian và địa điểm.",
                    now));
        }
        return recipients.size();
    }
}
