package com.swp391.bookstreet.attendance.service;

import com.swp391.bookstreet.activity.entity.Activity;
import java.time.Duration;
import java.time.Instant;

public final class AttendanceWindow {
    private AttendanceWindow() {}

    public static Instant opensAt(Activity activity) {
        return activity.getStartAt().minus(Duration.ofMinutes(activity.getAttendanceEarlyScanMinutes()));
    }

    public static boolean contains(Activity activity, Instant instant) {
        return instant != null && !instant.isBefore(opensAt(activity))
                && instant.isBefore(activity.getEndAt());
    }
}
