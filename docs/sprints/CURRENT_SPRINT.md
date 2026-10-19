# Current Sprint

## No active implementation Sprint

- Latest completed Sprint: `Sprint 05 Activity Planning and Partner Proposal Workflow`
- Status: `COMPLETED`
- Completion date: `2026-10-19`
- Merge evidence: PR `#56`, merge commit `759a25c`
- Completion report: `docs/development/SPRINT_05_COMPLETION_REPORT.md`
- Sprint baseline: `docs/sprints/sprint-05.md`
- Use Case Specifications: `docs/use-cases/sprint-05-use-case-specifications.md`
- API Contract: `docs/api/sprint-05-api-contract.md`
- Backend Work Assignment: `docs/sprints/SPRINT_05_BACKEND_WORK_ASSIGNMENT.md`
- Implemented schema baseline: immutable Flyway migrations V1 through V9

## Delivered Sprint 5 goal

Sprint 5 delivered the concurrency-safe Activity planning workflow: shared Location management,
Partner Proposal review, official Activity lifecycle, Partner change/cancellation requests, public
Activity discovery and the integrated Partner/Organizer workspaces.

The implementation preserves these approved invariants:

- Partner requires an approved Event application but does not require a Booth.
- Activity belongs to one BOOTH, STAGE, WORKSHOP or AREA Location.
- Partner Booth use requires an Active Assignment in the same Event.
- Proposal does not reserve a slot; approval atomically creates one Draft Activity.
- Every non-cancelled official Activity conflicts by physical Location and half-open interval,
  including across Events.
- `maxActivitiesPerPartner` is enforced per Event and cancelled Activities release quota.
- One Pending change/cancellation request is allowed per Activity.
- Organizer and Partner use controlled review/request workflows instead of directly overwriting
  each other's records.

## Sprint 6 planning gate

Sprint 6 has not been baselined or approved. Before implementation, create its scope, business
decisions, Use Case Specifications, API Contract, work assignment, validation/error matrix and
Acceptance Criteria. Sprint 5 out-of-scope items do not automatically become Sprint 6 scope.

Potential follow-up candidates that require explicit Sprint 6 prioritization include Participant
Activity registration/attendance/rating/certificate flows. An optional setup buffer between
adjacent Activities is a future scheduling enhancement, not unfinished Sprint 5 work.
