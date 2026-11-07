# Sprint 10 Role-Scoped Notifications — Three-Developer Assignment

- Status: `COMPLETED - 2026-11-07`; see `docs/development/SPRINT_10_CLOSURE_REPORT.md`
- Prepared date: `2026-11-03`
- Team size: exactly three developers
- Scope baseline: `docs/sprints/sprint-10.md`
- API contract: `docs/api/sprint-10-api-contract.md`
- Implementation plan: `docs/sprints/SPRINT_10_IMPLEMENTATION_PLAN.md`

The labels Developer A, B, and C are stable work packages. Developer A is assigned to `YingKai0621`.
The other two teammates may take Developer B or Developer C by coordinating that role before branch work
begins. Personal names do not need to be stored here; the role description, files, Acceptance Criteria and
merge order are the instructions that each teammate and their AI must follow.

## 1. Shared rules

1. Developer A is the only V16 migration and shared Notification-core owner.
2. V16 was reserved only after activation and an updated `main` check; B/C must not create or renumber it.
3. Developers B and C consume the writer/DTO contract from Developer A and do not create competing shared
   abstractions, migrations, or security matchers.
4. A domain Notification is inserted inside the owning transaction. Existing email remains after commit.
5. Each developer tests both the approved transition and its no-notification/retry/rollback cases.
6. Shared files are edited by their assigned role owner or through a deliberately handed-off commit; they
   are not concurrently rewritten on separate branches.

## 2. Developer A — `YingKai0621` — foundation, Participant/Admin, and integration owner

Primary delivery:

- PR 1 shared persistence/backend foundation
- PR 4 Admin foundation and cross-role frontend refresh
- PR 5 integration, traceability, and closure coordination

Exclusive ownership:

- the one Sprint 10 Flyway migration after its version is reserved
- shared Notification entity, enums, repository, writer, query/read service, DTOs, controllers, and tests
- exact role security matchers and shared Notification security tests
- Participant compatibility and atomic first-read correction
- Admin real empty/failure experience with no producer
- shared frontend wiring, including `frontend/src/App.tsx`, common response types, and cross-role browser test
  scaffolding

Evidence ownership:

- `AC-N-S10-01` through `AC-N-S10-11`
- `AC-P-S10-01` through `AC-P-S10-07`
- `AC-A-S10-01` through `AC-A-S10-05`
- final cross-role evidence for `AC-S10-REG-01` through `AC-S10-REG-06`

Developer A must not invent Admin alerts or absorb Partner/Organizer business decisions into the shared
writer.

## 3. Developer B — Partner outcome owner

Primary delivery:

- PR 2 Partner producers and real Partner inbox

Exclusive feature ownership:

- Partner application review outcomes
- Booth selection, rejection, Assignment, payment expiry, and competing-request outcomes
- proposal review/lifecycle outcomes
- Activity change/cancellation request review/lifecycle outcomes
- Event and Activity cancellation impact plus suppression precedence
- Partner notification service adapter, preview, full inbox, route, filters, wording, and allowlisted
  navigation
- Partner-focused domain, API, frontend, and browser tests

Evidence ownership:

- `AC-E-S10-01` through `AC-E-S10-13`
- Partner producer contribution to `AC-N-S10-07` and `AC-N-S10-08`
- Partner portions of `AC-S10-REG-01`, `AC-S10-REG-03`, `AC-S10-REG-05`, and `AC-S10-REG-06`

Developer B owns edits to payment/settlement and Assignment producer paths during PR 2. Those paths must
reach their final committed state before choosing a Notification outcome; after-commit email events are
not reused as inbox producers.

## 4. Developer C — Organizer work-item owner

Primary delivery:

- PR 3 Organizer producers and real Organizer inbox

Exclusive feature ownership:

- application, Booth-request, proposal submit/resubmit, and Activity-request submission work items
- Event-owner recipient resolution
- Organizer notification service adapter, preview, full inbox, route correction, filters, wording, and
  allowlisted navigation
- re-selection eligibility tests, released-request reference behavior, and Organizer UI flow
- Organizer-focused domain, API, frontend, and browser tests

Evidence ownership:

- `AC-O-S10-01` through `AC-O-S10-10`
- Organizer producer contribution to `AC-N-S10-07` and `AC-N-S10-08`
- Organizer portions of `AC-S10-REG-01`, `AC-S10-REG-03`, `AC-S10-REG-04`, and `AC-S10-REG-06`

The payment-expiry branches needed by re-selection overlap files owned by Developer B in PR 2. Developer C
does not edit those files concurrently. PR 3 starts from merged PR 2, then adds/reuses the canonical
selection-eligibility seam and verifies that at most one Organizer work item references the released
terminal request.

## 5. Shared-file ownership

| Shared area | Owner | Consumer rule |
| --- | --- | --- |
| Flyway migration and schema tests | Developer A | B/C do not create or renumber migrations |
| Notification core, DTO shape, role security | Developer A | B/C call the reviewed writer contract |
| `frontend/src/App.tsx` and cross-role test scaffold | Developer A | B/C provide role-local adapters/components and wiring requirements |
| Payment/Hold/Assignment paths during PR 2 | Developer B | C rebases on merged PR 2 before re-selection integration |
| Organizer routing and Organizer notification components | Developer C | A only supplies shared DTO/wiring support |
| Partner notification pages/components | Developer B | A only supplies shared DTO/wiring support |
| Admin notification pages/components | Developer A | No Admin type or producer is added |

If a task crosses ownership, the current owner either implements the small integration or hands off one
explicit commit. Copying logic into another package is not an acceptable conflict-avoidance strategy.

## 6. Merge order

1. Documentation PR #116 is approved and merged; the activation update is merged next.
2. Developer A uses the exclusively reserved V16 and completes PR 1.
3. After teammates coordinate who takes Developer B and Developer C, they may prepare role-local tests/UI,
   but producer branches rebase on merged PR 1 before final integration.
4. PR 2 merges before the PR 3 Booth re-selection portion because Payment/Hold/Assignment paths overlap.
5. PR 3 merges Organizer behavior.
6. Developer A rebases PR 4 on PR 2 and PR 3, completes Admin/shared frontend wiring, and resolves only
   intentional shared-file changes.
7. PR 5 runs consolidated backend, migration, frontend, browser, and Acceptance Criteria evidence checks.

## 7. Handoff checklist

Each developer hands off:

- changed files and owned Acceptance Criteria
- focused test commands and exact pass/fail/skip counts
- producer success, retry, rollback, wrong-recipient, and suppression evidence
- any shared-file handoff commit
- confirmation that `.env`, credentials, demo data, and local scripts are absent
- confirmation that no unapproved type, producer, route, delivery channel, or polling behavior was added

Developer A closes the Sprint only after all 52 Acceptance Criteria have evidence and CI plus focused
Playwright are green.
