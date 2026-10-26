package com.swp391.bookstreet.registration.entity;

public enum ParticipationOutcome {
    ACTIVE,
    CANCELLED,
    ATTENDED,
    NO_SHOW;

    public static ParticipationOutcome of(ActivityRegistration registration,
            com.swp391.bookstreet.attendance.entity.Attendance attendance) {
        if (registration.getStatus() == ActivityRegistrationStatus.CANCELLED) return CANCELLED;
        if (attendance != null && attendance.getStatus()
                == com.swp391.bookstreet.attendance.entity.AttendanceStatus.VALID) return ATTENDED;
        return registration.getStatus() == ActivityRegistrationStatus.NO_SHOW ? NO_SHOW : ACTIVE;
    }
}
