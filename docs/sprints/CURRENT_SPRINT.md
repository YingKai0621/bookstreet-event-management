# Current Sprint

## Sprint 05 Activity Planning and Partner Proposal Workflow

- Status: `APPROVED — READY FOR IMPLEMENTATION`
- Approved: `2026-10-16`
- Sprint file: `docs/sprints/sprint-05.md`
- Use Case Specifications: `docs/use-cases/sprint-05-use-case-specifications.md`
- API Contract: `docs/api/sprint-05-api-contract.md`
- Backend Work Assignment: `docs/sprints/SPRINT_05_BACKEND_WORK_ASSIGNMENT.md`
- Planned migration: one `V9`; V1–V8 remain immutable

## Sprint goal

Deliver a concurrency-safe Activity planning workflow: shared Location management, Partner
Proposal review, official Activity lifecycle, Partner change/cancellation requests and public
Activity discovery, without starting Participant registration/attendance or expanding Booth refund
scope.

## Approved implementation baseline

- Partner must have an approved Event application but does not need a Booth.
- Activity always belongs to one Location: BOOTH, STAGE, WORKSHOP or AREA.
- A Partner using a Booth needs its Active Assignment in the same Event.
- Organizer direct BTC Activity uses only shared non-Booth Locations in Sprint 5.
- Proposal has no Draft; initial creation becomes Pending and does not reserve a slot.
- Approval atomically creates one official Draft Activity after hard revalidation.
- All non-cancelled official Activities, including Draft, conflict by physical Location and
  half-open interval across Events.
- Partner official changes/cancellations use one Pending request total per Activity.
- Activity lifecycle is Draft → Published → Ongoing → Completed, with controlled Cancellation;
  Rescheduled is not a persisted status.
- Event financial cancellation blockers from Sprint 4 remain unchanged.
- Registration configuration is prepared, but Participant Registration/Attendance is not in this
  Sprint.

## Included Use Case slices

- UC-E04 Propose Activity.
- UC-E05 Request Activity Change.
- UC-E06 Request Activity Cancellation.
- UC-O02 Manage Locations — Activity Location slice.
- UC-O05 Review Activity Proposals.
- UC-O06 Manage Activities.
- UC-G01 Discover Public Content — Activity slice.

## Scope guard

Sprint 5 excludes Activity payment/tickets, Participant registration/attendance/rating/certificate
commands, Participant notifications, Notification persistence, advanced map editing, Booth
change/cancellation/refunds and whole-Event Partner withdrawal.

The documentation baseline is approved; production implementation has not started on this branch.
Sprint 5 becomes `COMPLETED` only after V9, all Acceptance Criteria, full regression, Swagger smoke
flows and a completion report are verified.

## Previous completed Sprint

Sprint 04 Event Lifecycle and Pre-payment Booth Release remains completed on `2026-10-16` through
immutable V8 with 284 backend regression tests and 20 VNPay spike tests recorded in its completion
report.
