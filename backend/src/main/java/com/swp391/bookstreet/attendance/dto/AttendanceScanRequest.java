package com.swp391.bookstreet.attendance.dto;

public record AttendanceScanRequest(String token) {
    @Override public String toString() { return "AttendanceScanRequest[token=REDACTED]"; }
    @com.fasterxml.jackson.annotation.JsonAnySetter
    public void rejectUnknown(String field, Object value) {
        throw new IllegalArgumentException("Unknown Attendance field.");
    }
}
