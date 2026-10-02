# BookStreet Project Instructions

## Project

This repository implements the SWP391 Book Street Event Management System.

Technology stack:

- Frontend: ReactJS
- Backend: Spring Boot
- Database: PostgreSQL
- Temporary session storage: Redis
- Database migration: Flyway
- Build tool: Maven
- Local services: Docker Compose

## Required reading before coding

Before modifying code, read these sources in order:

1. `AI_CONTEXT.md`
2. `docs/sprints/CURRENT_SPRINT.md`
3. The Sprint file referenced by `docs/sprints/CURRENT_SPRINT.md`
4. The Use Case Specifications referenced by `docs/sprints/CURRENT_SPRINT.md`
5. The API Contract referenced by `docs/sprints/CURRENT_SPRINT.md`
6. Relevant Business Rules and the current Physical ERD under `docs/`
7. Coding style - `docs/development/BACKEND_AI_CODING_GUIDELINES.md`

Do not begin implementation until the active Sprint scope and Acceptance Criteria are understood.

## Source-of-truth order

If documents conflict, use this order and report the conflict before coding:

1. `05_Business_Rules`
2. `06_Use_Case_List`
3. Active Sprint Use Case Specifications and Acceptance Criteria
4. Current Physical ERD
5. Active Sprint API Contract
6. Supporting overview and demo documents

Sprint documents limit what is implemented now; they do not silently change the business baseline.

## Authentication decision

- Use Spring Security server-side sessions stored in Redis.
- The browser uses an HttpOnly session cookie.
- Do not introduce JWT, bearer access tokens, refresh tokens, `/auth/refresh` or JWT tables.

## Database rules

- PostgreSQL is the durable source of truth.
- Redis stores temporary sessions only.
- Use Flyway for every database schema or seed-data change.
- Hibernate must use `ddl-auto: validate`.
- Never modify an applied migration.
- `V1` and `V2` are immutable; new database work starts from `V3`.
- Follow the current Physical ERD exactly.
- Do not invent tables, columns, relationships, roles or statuses.
- Never commit `.env` or real credentials.
- Demo passwords must never be stored as plaintext.
- Do not manually create shared Sprint data in pgAdmin when an API or migration should create it.

## Account rules

- The exact role codes are `PARTICIPANT`, `PARTNER`, `ORGANIZER` and `ADMIN`.
- New self-registered accounts receive only `PARTICIPANT`.
- Usernames are 3 to 20 characters, start with an ASCII letter and contain only ASCII letters and digits.
- Full names are normalized for surrounding/repeated whitespace and contain 2 to 50 characters.
- Registration passwords contain 8 to 64 characters and must not exceed 72 UTF-8 bytes before BCrypt hashing.
- Username uniqueness is case-insensitive.
- Email is optional but case-insensitively unique when supplied.
- `confirmPassword` is validated but never stored.
- Passwords must be BCrypt hashed.
- Current account statuses are only `ACTIVE` and `DISABLED`; do not invent `BLOCKED`.
- `PARTNER`, `ORGANIZER` and `ADMIN` require a verified email.

## Code organization

Organize backend code by feature, including `auth`, `event`, `partner`, `security` and `common`. Within a feature, use focused subpackages such as `controller`, `dto`, `entity`, `repository` and `service`. Do not create one global package containing every Entity or Controller.



## Team workflow

- Start every task from an updated `main`.
- Use one branch per task; do not code directly on `main`.
- Keep pull requests focused and do not edit unrelated files.
- Only one assigned developer owns shared migrations and configuration changes at a time.
- Do not create duplicate Flyway version numbers.
- Run relevant tests before declaring work complete.
- Every implementation must map to the active Sprint scope and an Acceptance Criterion.

## Context-file ownership

- `AGENTS.md` and `AI_CONTEXT.md` are shared project-control files.
- Feature developers must not edit them as part of unrelated work.
- Changes to `AGENTS.md` require team agreement.
- The assigned project/context owner updates `AI_CONTEXT.md` after a migration, milestone, baseline change or Sprint transition.
- Developers report stale information instead of silently changing it.
