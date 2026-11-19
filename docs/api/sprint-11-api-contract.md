# Sprint 11 System Admin API Contract

> Status: `IMPLEMENTED - CLOSURE VALIDATION PENDING`.

- Prepared date: `2026-11-07`
- Scope baseline: `docs/sprints/sprint-11.md`
- Use Case Specifications: `docs/use-cases/sprint-11-use-case-specifications.md`
- Business Rules: `BR-112` through `BR-120`

- Editor upload amendment (2026-11-09): `content-image-upload-api-contract.md` specifies the
  additional ADMIN-only Badge illustration upload. Existing Badge mutation/audit behavior remains unchanged.

## 1. Scope and conventions

- Base path: `/api/v1`. Every path below is relative to it.
- Authentication remains a Spring Security server-side Session in Redis, with the HttpOnly Session cookie.
- JSON uses camelCase. Timestamps are ISO-8601 UTC instants. Money is a decimal number.
- IDs are positive signed 64-bit integers. A malformed ID in a path returns `404` with the operation's not-found code.
- Every `POST`, `PUT`, `PATCH` and `DELETE` requires the existing CSRF cookie and header proof.
- `GET` operations never change data.
- Every `/admin` operation requires a verified `ADMIN` Session.
- The acting Admin always comes from the Session. No request supplies an actor.
- Backend `Clock` owns all timestamps. Date filters and daily groups use `Asia/Ho_Chi_Minh`.
- `/admin/users`, `/admin/audit-logs`, `/admin/partner-organizations` and `/admin/dashboard` responses use
  `Cache-Control: no-store`.

### 1.1 Paging

List operations accept `page` (default `0`, minimum `0`) and `size` (default `20`, range `1` to `100`) and return:

```json
{ "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 }
```

Each list has a final ID tie-breaker for a stable order. An invalid `page`, `size`, `sort` or filter value returns `400`
with `INVALID_FILTER` or `INVALID_SORT`.

### 1.2 Reason

A required `reason` is trimmed and has repeated whitespace collapsed, then must contain 10 to 500 characters.

## 2. Operations

| Method | Path | Purpose | Criteria |
| --- | --- | --- | --- |
| `GET` | `/admin/users` | List accounts | `AC-A01-S11-01` |
| `POST` | `/admin/users` | Create an account | `AC-A01-S11-02`, `03` |
| `GET` | `/admin/users/{userId}` | Read an account | `AC-A01-S11-01` |
| `PATCH` | `/admin/users/{userId}` | Update another account | `AC-A01-S11-04` |
| `PATCH` | `/admin/users/{userId}/status` | Lock or unlock | `AC-A01-S11-05`, `06` |
| `PUT` | `/admin/users/{userId}/roles/{roleCode}` | Assign a role | `AC-A02-S11-01`, `02` |
| `DELETE` | `/admin/users/{userId}/roles/{roleCode}` | Remove a role | `AC-A02-S11-01`, `03`, `04`, `05` |
| `GET` | `/admin/audit-logs` | List audit rows | `AC-A04-S11-04` |
| `GET` | `/admin/partner-organizations` | List organizations | `AC-A05-S11-01` |
| `GET` | `/admin/partner-organizations/{partnerOrganizationId}` | Read an organization | `AC-A05-S11-02` |
| `PATCH` | `/admin/partner-organizations/{partnerOrganizationId}/status` | Lock or unlock | `AC-A05-S11-03`, `04` |
| `GET` | `/admin/dashboard` | Read system figures | `AC-D-S11-01`, `02` |
| `POST` | `/auth/password-reset/request` | Request a reset | `AC-G03-S11-01`, `03` |
| `POST` | `/auth/password-reset/confirm` | Set a new password | `AC-G03-S11-02`, `04`, `05` |

Existing operations that stay are listed in section 11. Removed operations are listed in section 12.

## 3. Session enforcement

This applies to every authenticated API under `AC-A01-S11-07` and `AC-A02-S11-03`.

- Each authenticated request reads the User's current status, roles and email verification from PostgreSQL.
- A `DISABLED` account, or a Session older than the User's last lock or password reset, ends that Session and
  returns `401 AUTHENTICATION_REQUIRED`. The response does not reveal the reason.
- A Session's effective authorities are the ones it stored at sign-in that the User still holds. A removed role therefore
  returns `403 ACCESS_DENIED` from the next request.
- A role assigned after sign-in grants nothing until the next sign-in, as `BR-76` requires.
- Locking an account closes its open Notification streams. Removing a role closes the streams for that role.
- Signing in to a `DISABLED` account keeps returning the existing `403 ACCOUNT_NOT_ACTIVE`.
- Public endpoints are not affected.

The Sprint 10 test that expects `403` for a disabled Session on Notification APIs changes to `401`.

## 4. Accounts

### 4.1 `AdminUserResponse`

```json
{
  "userId": 12,
  "username": "mocmien01",
  "fullName": "Nguyễn Văn A",
  "email": "a@example.com",
  "emailVerified": true,
  "phone": "0900000000",
  "roles": ["PARTICIPANT", "PARTNER"],
  "status": "ACTIVE",
  "createdAt": "2026-11-07T01:00:00Z"
}
```

`status` is exactly `ACTIVE` or `DISABLED`. `roles` contains exact role codes in the order `PARTICIPANT`, `PARTNER`,
`ORGANIZER`, `ADMIN`. `email` and `phone` may be null. The response never contains a password hash or token. The earlier
`code`, `role`, `primaryRole`, `lastActiveAt` and `avatarUrl` fields are removed.

### 4.2 `GET /admin/users`

Query: `page`, `size`, `search`, `role`, `status`, `sort`.

- `search` matches username, full name or email, ignoring case. Maximum 100 characters.
- `role` is an exact role code. `status` is `ACTIVE` or `DISABLED`.
- `sort` is one of `createdAt,desc` (default), `createdAt,asc`, `username,asc`, `username,desc`.

### 4.3 `POST /admin/users`

```json
{
  "username": "mocmien01",
  "fullName": "Nguyễn Văn A",
  "password": "********",
  "confirmPassword": "********",
  "email": "a@example.com",
  "phone": "0900000000"
}
```

Returns `201` with `AdminUserResponse`. Username, full name and password follow `BR-64`. `email` and `phone` are optional.
The account is `ACTIVE`, has only `PARTICIPANT` and has an unverified email. Input fields named `role` or `status` are
ignored and have no effect. A verification email is sent after commit when an email is supplied.

| Status | Code | When |
| --- | --- | --- |
| `422` | `VALIDATION_FAILED` | Invalid field, with `fieldErrors` |
| `422` | `PASSWORD_CONFIRMATION_MISMATCH` | Confirmation differs |
| `409` | `USERNAME_ALREADY_EXISTS` | Username in use, ignoring case |
| `409` | `EMAIL_ALREADY_EXISTS` | Email in use, ignoring case |

### 4.4 `PATCH /admin/users/{userId}`

```json
{ "fullName": "Nguyễn Văn B", "phone": "0911111111", "email": "b@example.com" }
```

Every field is optional, and an absent field stays unchanged. A blank `phone` clears the phone. Returns `AdminUserResponse`.
Changing an unverified email revokes pending verification tokens and sends a new one after commit.

| Status | Code | When |
| --- | --- | --- |
| `404` | `ADMIN_USER_NOT_FOUND` | Unknown account |
| `409` | `ADMIN_SELF_UPDATE_NOT_ALLOWED` | The target is the acting Admin |
| `409` | `VERIFIED_EMAIL_LOCKED` | A verified email would change |
| `409` | `EMAIL_ALREADY_EXISTS` | Email in use, ignoring case |
| `422` | `VALIDATION_FAILED` | Invalid field |

### 4.5 `PATCH /admin/users/{userId}/status`

```json
{ "status": "DISABLED", "reason": "Tài khoản có dấu hiệu bị lạm dụng." }
```

Returns `AdminUserResponse`. Repeating the current status returns `200`, changes nothing and writes no audit row.

| Status | Code | When |
| --- | --- | --- |
| `404` | `ADMIN_USER_NOT_FOUND` | Unknown account |
| `409` | `ADMIN_SELF_LOCK_NOT_ALLOWED` | The target is the acting Admin |
| `409` | `LAST_ACTIVE_ADMIN_REQUIRED` | The target is the last active Admin |
| `422` | `VALIDATION_FAILED` | Status is not exact, or the reason is missing or invalid |

## 5. Roles

`roleCode` is exactly `PARTNER`, `ORGANIZER` or `ADMIN`. Neither operation has a body, and both return `AdminUserResponse`.
Repeating an assign or remove returns `200`, changes nothing and writes no audit row.

| Status | Code | Operation | When |
| --- | --- | --- | --- |
| `404` | `ADMIN_USER_NOT_FOUND` | Both | Unknown account |
| `422` | `ROLE_NOT_MANAGEABLE` | Both | `PARTICIPANT` or an unknown role |
| `409` | `TARGET_ACCOUNT_NOT_ACTIVE` | Assign | The account is `DISABLED` |
| `409` | `VERIFIED_EMAIL_REQUIRED` | Assign | The account has no verified email |
| `409` | `ADMIN_SELF_ROLE_REMOVAL_NOT_ALLOWED` | Remove | Removing the acting Admin's own `ADMIN` |
| `409` | `LAST_ACTIVE_ADMIN_REQUIRED` | Remove | Removing `ADMIN` from the last active Admin |
| `409` | `ORGANIZER_OWNS_OPEN_EVENTS` | Remove | The User owns a `DRAFT`, `PUBLISHED` or `ONGOING` Event |
| `409` | `PARTNER_ORGANIZATION_ACTIVE` | Remove | The User represents an `ACTIVE` organization |

Commands that can reduce the number of active Admins lock the active Admin rows in User ID order before checking, so that
concurrent commands cannot leave the system with none.

## 6. Audit log

### 6.1 `AdminAuditLogResponse`

```json
{
  "auditLogId": 501,
  "actor": { "userId": 1, "username": "admin", "fullName": "Quản trị viên" },
  "action": "USER_LOCKED",
  "targetType": "USER",
  "targetId": 12,
  "targetLabel": "mocmien01",
  "reason": "Tài khoản có dấu hiệu bị lạm dụng.",
  "details": { "from": "ACTIVE", "to": "DISABLED" },
  "createdAt": "2026-11-07T01:00:00Z"
}
```

| `action` | `targetType` | `reason` | `details` |
| --- | --- | --- | --- |
| `USER_CREATED` | `USER` | null | `{ "roles": ["PARTICIPANT"] }` |
| `USER_UPDATED` | `USER` | null | `{ "changedFields": ["phone"] }` |
| `USER_LOCKED`, `USER_UNLOCKED` | `USER` | required | `{ "from": "...", "to": "..." }` |
| `ROLE_ASSIGNED`, `ROLE_REMOVED` | `USER` | null | `{ "role": "ORGANIZER" }` |
| `ORGANIZATION_LOCKED`, `ORGANIZATION_UNLOCKED` | `PARTNER_ORGANIZATION` | required | `{ "from": "...", "to": "..." }` |
| `BADGE_CREATED`, `BADGE_UPDATED` | `BADGE` | null | `{ "changedFields": ["requiredPoints"] }` |
| `BADGE_AWARDS_SYNCHRONIZED` | `BADGE` | null | The existing synchronization counts |

`targetLabel` stores the username, organization name or Badge name at that moment, so history stays readable after a rename.
`changedFields` holds field names only, never values. No row contains a password, password hash, token or Session data.

### 6.2 `GET /admin/audit-logs`

Query: `page`, `size`, `actorUserId`, `action`, `targetType`, `targetId`, `from`, `to`.

- `from` and `to` are inclusive `yyyy-MM-dd` dates in `Asia/Ho_Chi_Minh`. `from` later than `to` is rejected.
- `targetId` requires `targetType`.
- The order is always newest first, with the highest ID first on a tie.

No operation updates or deletes an audit row.

## 7. Partner organizations

### 7.1 `AdminPartnerOrganizationResponse`

```json
{
  "partnerOrganizationId": 9,
  "name": "Nhà sách Mộc Miên",
  "description": "",
  "categoryCode": "PUBLISHER",
  "logoUrl": null,
  "contactEmail": "lienhe@example.com",
  "contactPhone": null,
  "address": null,
  "status": "ACTIVE",
  "representative": {
    "userId": 12,
    "username": "mocmien01",
    "fullName": "Nguyễn Văn A",
    "accountStatus": "ACTIVE",
    "hasPartnerRole": true
  },
  "createdAt": "2026-11-07T01:00:00Z",
  "updatedAt": "2026-11-07T01:00:00Z"
}
```

### 7.2 `GET /admin/partner-organizations`

Query: `page`, `size`, `search`, `status`, `sort`.

- `search` matches organization name, or representative username or full name, ignoring case. Maximum 100 characters.
- `status` is `ACTIVE` or `INACTIVE`.
- `sort` is one of `name,asc` (default), `name,desc`, `createdAt,desc`, `createdAt,asc`.

### 7.3 `PATCH /admin/partner-organizations/{partnerOrganizationId}/status`

```json
{ "status": "INACTIVE", "reason": "Đơn vị vi phạm quy định trưng bày." }
```

Returns `AdminPartnerOrganizationResponse`. Repeating the current status returns `200`, changes nothing and writes no audit
row. The existing Partner profile operation keeps its behavior and cannot change `status`.

| Status | Code | When |
| --- | --- | --- |
| `404` | `PARTNER_ORGANIZATION_NOT_FOUND` | Unknown organization |
| `409` | `PARTNER_ROLE_REQUIRED` | Unlock while the representative lacks `PARTNER` |
| `422` | `VALIDATION_FAILED` | Status is not exact, or the reason is missing or invalid |

## 8. Effects of a locked organization

A blocked command returns `409 PARTNER_ORGANIZATION_INACTIVE`, creates no row, and takes priority over later validation.

| Actor | Existing operation |
| --- | --- |
| Partner | `POST /events/{eventId}/applications` |
| Partner | `POST /events/{eventId}/booth-requests` |
| Partner | `POST /partner/booth-requests/{requestId}/payments` |
| Partner | `POST /partner/activity-proposals` and `POST /partner/activity-proposals/{proposalId}/resubmit` |
| Partner | `POST /partner/activities/{activityId}/change-requests` and `/cancellation-requests` |
| Organizer | `POST /organizer/applications/{applicationId}/approve` |
| Organizer | `POST /organizer/events/{eventId}/booth-requests/{boothRequestId}/select` |
| Organizer | `POST /organizer/activity-proposals/{proposalId}/approve` and `/request-changes` |
| Organizer | `POST /organizer/activity-change-requests/{requestId}/approve` and `/organizer/activity-cancellation-requests/{requestId}/approve` |

- An existing `ACTIVE` organization keeps all current behavior.
- An application without any organization keeps returning `PARTNER_ORGANIZATION_REQUIRED`.
- Replaying an idempotent Payment request already started returns its existing result rather than this error.
- Reject, withdraw, read, profile edit, trusted Payment callback, Hold expiry and lifecycle closure are not blocked.
- Booth request and selection previously reported an inactive organization as `PARTNER_APPLICATION_NOT_APPROVED`. They now
  use the new code, and the affected tests change.
- The event-publication and hold-reminder producers skip an `INACTIVE` organization.

Existing Organizer application, Booth request, proposal and Activity request responses gain one additive field,
`partnerOrganizationStatus`, for labels and disabled actions. The Partner workspace reads `status` from the existing
`GET /partner/organization`.

## 9. Dashboard

### 9.1 `GET /admin/dashboard`

```json
{
  "accounts": {
    "total": 120,
    "byRole": { "PARTICIPANT": 118, "PARTNER": 20, "ORGANIZER": 5, "ADMIN": 2 },
    "byStatus": { "ACTIVE": 118, "DISABLED": 2 }
  },
  "events": {
    "total": 10,
    "byStatus": { "DRAFT": 1, "PUBLISHED": 3, "ONGOING": 1, "COMPLETED": 4, "CANCELLED": 1 }
  },
  "activeBoothAssignments": 15,
  "boothRevenue": 30000000.00,
  "auditByDay": [{ "date": "2026-11-07", "count": 3 }]
}
```

- A multi-role User counts once in each role, so `byRole` may total more than `accounts.total`.
- `boothRevenue` is the sum of `amount` for `SUCCESS` Payments of type `PAYMENT`. With no data it is `0`.
- `auditByDay` has one entry per day for the last 7 days, oldest first, including days with `0`.
- The earlier `userCount`, `eventCount`, `openEventCount`, `boothCount`, `activityCount`, `todayActivityCount` and
  `usersByRole` fields are removed.

The dashboard screen shows recent activity through `GET /admin/audit-logs?size=5`, and a failure there does not hide the
other figures.

## 10. Password reset

### 10.1 `POST /auth/password-reset/request`

```json
{ "email": "a@example.com" }
```

Public, with CSRF proof. Returns `202` with this body in every case where the email format is valid:

```json
{ "message": "Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn." }
```

- Email lookup ignores case. Mail goes only to an `ACTIVE` account with that verified email, within the limits in `BR-120`.
- Reaching a limit, an unknown email and a locked account all return the same `202`.
- An invalid email format returns `422 VALIDATION_FAILED`.
- The link is `{frontend-base-url}/reset-password?token=...`.

### 10.2 `POST /auth/password-reset/confirm`

```json
{ "token": "...", "newPassword": "********", "confirmPassword": "********" }
```

Public, with CSRF proof. Returns `204`. The password follows `BR-64`. Success marks the token used, revokes remaining reset
tokens and invalidates earlier Sessions of that User.

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN` | Wrong, expired, used or revoked token, including a locked account |
| `422` | `VALIDATION_FAILED` | Invalid password |
| `422` | `PASSWORD_CONFIRMATION_MISMATCH` | Confirmation differs |

## 11. Existing operations that stay

| Operation | Change |
| --- | --- |
| `GET`, `POST /admin/badges`; `GET`, `PUT /admin/badges/{badgeId}`; `POST /admin/badges/{badgeId}/synchronize-awards` | Behavior unchanged; commands write audit rows |
| The four `/admin/notifications` operations | Unchanged |
| `GET`, `PUT /auth/profile` | Unchanged; now also used by the Admin profile |

## 12. Removed behavior

| Removed | Replacement |
| --- | --- |
| `POST /admin/users/{userId}/reset-password` | None; users recover through section 10 |
| `role` and `status` in `POST` and `PATCH /admin/users` | Sections 4.5 and 5 |
| Unpaged array from `GET /admin/users` | Paged response in section 1.1 |
| `locked` and `active` status values | Exact `ACTIVE` and `DISABLED` |
| `ROLE_ADMIN` access to `/organizer` operations | `403 ACCESS_DENIED`; a person who needs both gets both roles |

These frontend calls have no backend and are removed: `/admin/roles`, `/admin/permissions`, `/admin/settings`,
`/admin/profile` and its password action, `/admin/badge-rules`, `/admin/feedbacks/stats`.

## 13. Shared errors

The existing `ApiErrorResponse` is reused:

```json
{
  "code": "PARTNER_ORGANIZATION_INACTIVE",
  "message": "Tổ chức đối tác đang bị khóa.",
  "fieldErrors": [],
  "timestamp": "2026-11-07T01:00:00Z",
  "path": "/api/v1/events/501/booth-requests"
}
```

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_FILTER`, `INVALID_SORT` | Unsupported query value |
| `401` | `AUTHENTICATION_REQUIRED` | No valid Session |
| `403` | `ACCESS_DENIED` | Missing role or unverified email |
| `403` | Existing CSRF error | Missing CSRF proof |

Clients branch on status and stable code, never on message text. Admin operations must not return a server error for invalid
input, a missing account or a conflict.

## 14. Exclusions

Sprint 11 adds no Permission or settings API, no Admin password operation, no Admin Notification producer, no refund or Payment
change, no organization edit or delete, and no audit update or delete. Optional `AC-OPT-S11` operations get a contract only if
unit `S11-7` is scheduled. On 2026-11-10 it was scheduled for Booth Payments only; section 16 holds that contract.
No operation in section 16 changes a Payment.

## 15. Required verification

- Real database tests for every operation, guard and audit row, including rollback when the audit write fails.
- Concurrency tests for the last active Admin.
- Tests through the running server for Session enforcement and stream closure.
- Tests for each blocked command in section 8, and for each allowed command that must keep working.
- Focused browser tests for the Admin, Partner and Organizer states.

## 16. Booth Payment history (`S11-7`, scheduled 2026-11-10)

Two read-only operations over existing tables, governed by `BR-121`. They add no migration and change no Payment. Both share one query, so
filters, sorting and paging behave the same.

| Method | Path | Purpose | Criteria |
| --- | --- | --- | --- |
| `GET` | `/admin/booth-payments` | Every Booth Payment across Events | `AC-OPT-S11-01` |
| `GET` | `/organizer/booth-payments` | Booth Payments of the Events the Organizer owns | `AC-ORG-PAY-S11-01` to `03` |

### 16.1 Query

`page`, `size` and the paged response follow section 1.1.

| Parameter | Values | Admin | Organizer |
| --- | --- | --- | --- |
| `status` | `PENDING`, `SUCCESS`, `FAILED`, `TIMEOUT` | Yes | Yes |
| `eventId` | Positive ID | Any Event | An Event the Organizer does not own matches nothing |
| `reconciliationRequired` | `true`, `false` | Yes | Ignored |
| `search` | At most 100 characters, ignoring case | Organization name, Booth code, Event name, gateway reference | Organization name, Booth code, Event name |
| `from`, `to` | Inclusive `yyyy-MM-dd` in `Asia/Ho_Chi_Minh`, on `createdAt` | Yes | Yes |
| `sort` | `createdAt,desc` (default), `createdAt,asc`, `amount,desc`, `amount,asc`, each with the Payment ID as tie-breaker | Yes | Yes |

An unsupported value, or `from` later than `to`, returns `400 INVALID_FILTER`; an unsupported sort returns
`400 INVALID_SORT`. `TIMEOUT` is set by the reconciliation worker after the checkout expires and two trusted gateway
queries still report the payment incomplete; a late trusted success may still settle it under `BR-58`.

### 16.2 `AdminBoothPaymentResponse`

```json
{
  "boothPaymentId": 77,
  "event": { "eventId": 501, "name": "Hội sách mùa thu" },
  "partnerOrganization": { "partnerOrganizationId": 9, "name": "Nhà sách Mộc Miên" },
  "booth": { "boothId": 31, "code": "A01", "name": "Gian A01" },
  "transactionType": "PAYMENT",
  "amount": 1500000.00,
  "status": "PENDING",
  "reconciliationRequired": true,
  "gatewayProvider": "VNPAY",
  "gatewayTransactionRef": "BS77",
  "failureCode": null,
  "createdAt": "2026-11-08T03:00:00Z",
  "completedAt": null
}
```

### 16.3 `GET /organizer/booth-payments`

Each row is `AdminBoothPaymentResponse` without `reconciliationRequired`, `gatewayProvider`, `gatewayTransactionRef` and
`failureCode`. The page adds `collectedAmount`: the sum of `SUCCESS` Payments of type `PAYMENT` under the same filters except
`status`, with `0` when nothing matches.

```json
{ "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0, "collectedAmount": 1500000.00 }
```

### 16.4 Never returned

Neither response contains `checkoutUrl`, `idempotencyKey`, `providerResponseCode`, `providerTransactionStatus`,
`reconciliationDetail` or `failureMessage`.

### 16.5 Access

| Status | Code | When |
| --- | --- | --- |
| `401` | `AUTHENTICATION_REQUIRED` | No valid Session |
| `403` | `ACCESS_DENIED` | `/admin/booth-payments` without `ADMIN`, or `/organizer/booth-payments` without a verified `ORGANIZER` |

Reading writes no audit row (`BR-118`). There is no `POST`, `PUT`, `PATCH` or `DELETE` on either path.
