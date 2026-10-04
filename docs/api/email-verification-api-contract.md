# Email Verification API Contract

## 1 Status and scope

- Decision status: approved design.
- Implementation status: implemented in the Auth module.
- This contract defines the parallel email-verification extension of `UC-G03 Manage Account Access`.
- It does not add email verification to the Sprint 1 Definition of Done.

Base path: `/api/v1/auth/email-verification`

All state-changing requests follow the CSRF rules in [`browser-security-contract.md`](browser-security-contract.md).

## 2 Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/confirm` | Public with valid CSRF token | Confirm control of the email address using a verification token |
| POST | `/resend` | Authenticated Session with valid CSRF token | Send another verification message for the current User |

Email links open a frontend route. They must not confirm the email through `GET` because confirmation changes server state.

## 3 POST `/confirm`

Request:

```json
{
  "token": "raw-base64url-token-from-email"
}
```

Success response: `204 No Content`.

The backend must:

1. Hash the submitted raw token using SHA-256.
2. Find the matching `EMAIL_VERIFICATION` token by `token_hash`.
3. Validate that it is unused, unrevoked and not expired.
4. Atomically set `users.email_verified_at`, set `user_tokens.used_at` and revoke the User's other active email-verification tokens.

Errors:

- `400 INVALID_OR_EXPIRED_VERIFICATION_TOKEN` for an unknown, expired, used or revoked token.
- `422 VALIDATION_FAILED` when the request body is missing or malformed.

The error response must not distinguish unknown, expired, used and revoked tokens.

## 4 POST `/resend`

Request body: none.

The backend derives the User and email from the authenticated principal and database. The client must not send `userId` or email.

Success response: `204 No Content`.

- For an unverified email, success means a new message was accepted for delivery.
- For an already verified email, success is idempotent and no message is sent.

Errors:

- `401 AUTHENTICATION_REQUIRED`
- `422 EMAIL_REQUIRED`
- `429 EMAIL_VERIFICATION_RATE_LIMITED`
- `503 EMAIL_DELIVERY_UNAVAILABLE`

If delivery fails, the newly created token is revoked. The issuance attempt still counts toward the cooldown and hourly limit.

## 5 Registration integration

`POST /api/v1/auth/register` keeps its existing request and response.

- No email: do not create a verification token and do not send email.
- Email supplied: create the Participant account normally and trigger verification-message delivery after the account transaction commits.
- Initial mail failure does not change the successful `201` registration result, roll back the account or remove the Participant role.
- The token for a failed initial delivery is revoked. The authenticated User can use resend subject to the normal cooldown and hourly limit.

## 6 Token policy

- Generate 32 cryptographically secure random bytes.
- Encode the raw token with URL-safe Base64 without padding.
- Store only the lowercase hexadecimal SHA-256 hash in `user_tokens.token_hash`.
- Set `token_type = EMAIL_VERIFICATION`.
- Set `created_at` and `expires_at` explicitly in application code; the verification TTL is 60 minutes.
- A token is single-use.
- Issuing another token revokes previous unused `EMAIL_VERIFICATION` tokens for that User.
- Cooldown: at least 60 seconds between token issuance attempts.
- Hourly limit: at most 5 token issuance attempts per User in a rolling hour.
- Every persisted token counts as an issuance attempt, including a token later revoked because email delivery failed.
- Never place the raw token, complete verification URL or mail-provider credential in application logs.

Physical ERD v1 already provides the required `users.email_verified_at` and `user_tokens` fields. This approved design requires no new table, column or Flyway migration.

## 7 Session and role behavior

- Verification never creates, deletes or changes a `user_roles` row.
- `PARTICIPANT` remains usable without verified email.
- Assigned `PARTNER`, `ORGANIZER` and `ADMIN` roles require verified email before their authorities become effective.
- The authenticated principal stores an authority snapshot in the server-side Session. Confirmation does not mutate that snapshot.
- After successful confirmation, the frontend must ask the User to log out and log in again before using an advanced-role endpoint.
- `/api/v1/auth/me` reports current database profile data and assigned roles; it is not proof that the current Session contains every reported role as an effective authority.

## 8 Email delivery configuration

Implementation uses the Spring mail abstraction and injects provider values through environment configuration:

- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `MAIL_FROM`
- `MAIL_SMTP_AUTH`
- `MAIL_STARTTLS_ENABLE`
- `FRONTEND_BASE_URL`

Verification-link format:

```text
{FRONTEND_BASE_URL}/verify-email?token={rawToken}
```

Secrets must not be committed to the repository. A local mail catcher may be used for development without changing the API contract.

## 9 Required tests before implementation is complete

- Registration with and without email.
- Delivery only after transaction commit.
- Delivery failure preserves the account and revokes the undelivered token.
- Raw token is absent from the database and logs.
- Valid, invalid, expired, used and revoked confirmation cases.
- Generic error response for every unusable token state.
- Resend revokes previous unused tokens.
- Cooldown and hourly limit.
- Idempotent resend for an already verified email.
- Concurrent confirmation consumes a token only once.
- Existing Session is not elevated; re-login activates eligible advanced authorities.
