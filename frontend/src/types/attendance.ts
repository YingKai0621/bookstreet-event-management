export interface AttendanceSummary {
  attendanceId: number;
  status: 'VALID' | 'VOIDED';
  recordedSource: 'SELF_SCAN' | 'ORGANIZER_CORRECTION';
  attendedAt: string;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
}

export interface AttendanceScanResponse {
  activityRegistrationId: number;
  activityId: number;
  activityTitle: string;
  attendance: AttendanceSummary;
  alreadyRecorded: boolean;
}
