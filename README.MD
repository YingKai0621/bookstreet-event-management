# Book Street Event Management System

SWP391 project for managing Book Street events, partners, booths, activities and participants.

## Technology

- Frontend: ReactJS
- Backend: Spring Boot
- Database: PostgreSQL
- Session storage: Redis

## Project Status

Sprint 5 Activity Planning and Partner Proposal Workflow is complete through Flyway V9 and merge
commit `759a25c`. The delivered scope includes shared Activity Locations, Partner Proposals,
Organizer review, official Activity lifecycle, Partner Change/Cancellation Requests, public
Activity discovery and integrated Partner/Organizer workspaces.

The current backend test inventory contains 370 tests, and the focused Sprint 5 Activity
Playwright suite passes 9 Partner/Organizer scenarios. Automated browser-level Payment/Assignment
E2E, existing frontend lint warnings, bundle splitting and Participant Activity
registration/attendance/rating/certificate flows remain future work.

Start with the shared documentation in [`docs/README.MD`](docs/README.MD), then read the
[`Current Sprint`](docs/sprints/CURRENT_SPRINT.md) and
[`Sprint 5 Completion Report`](docs/development/SPRINT_05_COMPLETION_REPORT.md).
