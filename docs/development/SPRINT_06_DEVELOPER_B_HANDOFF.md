# Sprint 6 — Developer B backend handoff

## Scope and source

Flow B implements the 27 acceptance criteria assigned to Developer B in
[`SPRINT_06_BACKEND_WORK_ASSIGNMENT.md`](../sprints/SPRINT_06_BACKEND_WORK_ASSIGNMENT.md):
`P03-02`–`P03-09`, `O06-S6-01`–`O06-S6-09`, and `O07-01`–`O07-10`. The active
Business Rules, Sprint 6 Use Case Specification, API Contract, Physical ERD,
and immutable V10 migration define the behavior. No schema migration was changed.

This handoff covers the backend only. Developer C owns the Participant scan page,
Organizer participation and correction screens, and final frontend integration.
The Sprint remains active until the cross-role frontend and closure gates pass.

## APIs delivered

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/participant/attendance-scans` | Participant self-scan of the shared Activity token. First valid scan returns `alreadyRecorded=false`; an in-window repeat returns `true` and the same Attendance. |
| `GET` | `/api/v1/organizer/events/{eventId}/event-registrations` | Paged Event participation and Activity outcome counts for the Event owner. |
| `GET` | `/api/v1/organizer/activities/{activityId}/registrations` | Paged Activity registrations with derived outcome, Attendance, Certificate and Rating status. |
| `GET` | `/api/v1/organizer/activity-registrations/{activityRegistrationId}` | Owned participation detail. |
| `GET` | `/api/v1/organizer/activity-registrations/{activityRegistrationId}/attendance-adjustments` | Paged immutable correction history. |
| `POST` | `/api/v1/organizer/activity-registrations/{activityRegistrationId}/attendance-adjustments` | Audited correction. Requires an `Idempotency-Key` UUID header. |

`GET /api/v1/organizer/activities/{activityId}` remains the only protected source
for the raw Activity QR token and now sends `Cache-Control: no-store`. Organizer
Activity lists and mutation responses expose availability without the token.

Example scan request (token placeholder; never use a real token in logs or handoffs):

```json
{"token":"00000000-0000-4000-8000-000000000000"}
```

Example correction body with header `Idempotency-Key: 71dfb84c-9dad-4e9a-917f-6a48ce734917`:

```json
{
  "targetAttendanceStatus": "VALID",
  "effectiveAttendedAt": "2027-01-11T01:55:00Z",
  "reason": "Xác nhận lại sau khi thiết bị quét gặp sự cố."
}
```

For a void, send `targetAttendanceStatus=VOIDED` and
`effectiveAttendedAt=null`. Correction replies contain the current participation,
Attendance, adjustment snapshot, Certificate and Rating status, plus
`idempotentReplay`. A repeated key with a different normalized command returns
`409 IDEMPOTENCY_KEY_REUSED`; a new key with no effective change returns
`409 ATTENDANCE_CORRECTION_HAS_NO_EFFECT`.

## State and transaction behavior

- Scan resolves the Activity from its opaque token and the Participant from the
  authenticated Session. Event/Activity locks serialize scan, schedule changes,
  cancellation and completion. The window is `[startAt − attendanceEarlyScanMinutes, endAt)`;
  Organizer may configure 0–1440 minutes per Activity, defaulting to 15.
- One Attendance is stored per ActivityRegistration. Duplicate/concurrent valid
  scans return its durable identity. A late scan triggers completion finalization
  before returning `ATTENDANCE_WINDOW_CLOSED`.
- The same completion command runs from the Activity scheduler, request-time
  lifecycle guards and Event completion. It classifies unfulfilled `ACTIVE`
  registrations as `NO_SHOW`, then calls C1's existing downstream command to
  issue eligible Certificate metadata and notifications in the same transaction.
- Corrections append `attendance_adjustments` with previous/new JSON snapshots,
  actor, normalized reason and processing time. A valid correction uses the
  supplied effective `attendedAt`; a void preserves historical Attendance and
  changes the registration outcome according to Activity/Event lifecycle.
- Voiding/restoring uses C1's downstream command to revoke/reissue the same
  Certificate identity and invalidate/reactivate the same Rating where eligible.
  A downstream or Notification persistence failure rolls back the correction.
- Direct Organizer Activity update and Partner change approval share the
  Attendance freeze and capacity floor. Both cancellation routes retain
  participation history and send deduplicated Activity notifications.
- Participation outcome precedence is `CANCELLED → ATTENDED → NO_SHOW → ACTIVE`
  and is shared with Participant registration responses.

## Automated evidence

The new `AttendanceFlowIntegrationTests` cover QR privacy, Session/role/CSRF,
scan window equality, duplicate/concurrent scans, cancellation, completion,
No-show, correction validation and history, C1 cascades, ownership, supported
filters/sorts, rollback and representative lifecycle races. The existing
`OrganizerActivityRequestIntegrationTests` now cover Partner approval paths
with valid Attendance and active registration.

Run the complete backend gate with PostgreSQL and Redis test services and
`EVENT_TEST_DATABASE_URL` pointing to a disposable database whose name ends in
`_event_test`:

```text
cd backend
mvn verify
```

The test database guard refuses other database names. CI supplies PostgreSQL
and Redis. The exact final test count belongs in the verification run report;
do not mark the Sprint complete from this handoff alone.

## Documentation notes

`AI_CONTEXT.md` and `docs/README.MD` still describe the pre-implementation
Sprint 6 state. The assigned context owner should update them at the agreed
milestone. Older process descriptions in `requirements/02_Quy_trinh_dang_ky_Booth_va_Activity.md`
still use `ATTENDED` as a stored registration status; active BR-93 and the
Sprint 6 contract define it as an outcome derived from valid Attendance.
