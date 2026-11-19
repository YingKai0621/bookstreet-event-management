# Book Street Event Management System

SWP391 project for managing Book Street events, partners, booths, activities, participants and system administration.

## Technology

- Frontend: ReactJS
- Backend: Spring Boot
- Database: PostgreSQL
- Session storage: Redis
- Schema migration: Flyway

## Project status

Sprint 10 Role-Scoped In-App Notifications is the latest formally completed Sprint. Sprint 11 System Admin Management is
implemented on `main` through Flyway V18 and is in closure/deployment validation. Its delivered scope includes audited account
and role management, Partner organization locks and their system-wide guards, the real Admin dashboard and audit log, Badge
audit integration, verified-email password reset, and read-only Admin/Organizer Booth Payment histories.

Backend and frontend CI checks on the latest reviewed `main` commit are green. Focused Sprint 11 browser checks and a manual
Render/Vercel real-UI smoke are still required before Sprint 11 is formally marked complete.

Start with [`AI_CONTEXT.md`](AI_CONTEXT.md), then read the shared documentation in
[`docs/README.MD`](docs/README.MD) and the [`Current Sprint`](docs/sprints/CURRENT_SPRINT.md).
