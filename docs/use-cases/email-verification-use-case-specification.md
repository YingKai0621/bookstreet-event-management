# Email Verification Use Case Specification

## 1 Status and scope

- Decision status: approved design.
- Implementation status: implemented in the Auth module.
- This is a parallel extension of `UC-G03 Manage Account Access`, not a new top-level Use Case.
- It is not part of the Sprint 1 Definition of Done and does not expand the Event or Partner feature scope.

## 2 Goal

Allow a registered user who supplied an email address to prove control of that address. Verification enables authorities for already-assigned `PARTNER`, `ORGANIZER` or `ADMIN` roles after the user authenticates again.

## 3 Primary actor

Registered User

## 4 Preconditions

- The User exists.
- The User has a non-null email address.
- The email address is not already verified for flows that require a new verification message.

## 5 Triggers

- A visitor successfully registers with an email address.
- An authenticated User requests another verification message.
- A User submits the verification token received by email.

## 6 Main flow

1. The system creates a single-use verification token for a User who has an unverified email address.
2. The system stores only a cryptographic hash of the token.
3. The token expires 60 minutes after it is created.
4. After the account transaction commits, the system sends a frontend verification link containing the raw token.
5. The User opens the frontend verification page.
6. The frontend obtains a CSRF token and submits the email-verification token to the backend with `POST`.
7. The backend validates that the token exists, has type `EMAIL_VERIFICATION`, belongs to an unverified User, has not expired, has not been used and has not been revoked.
8. In one database transaction, the system sets `users.email_verified_at`, marks the token as used and revokes any other active email-verification tokens for the same User.
9. The frontend tells the User to log in again so a new Session can receive the effective authorities allowed by the verified email.

## 7 Registration behavior

- Registration without email creates the Participant account and does not create or send a verification token.
- Registration with email still creates only the `PARTICIPANT` role.
- Verification does not assign `PARTNER`, `ORGANIZER` or `ADMIN`.
- Verification-message delivery runs only after the account transaction commits.
- A delivery failure must not roll back or delete the new account. The failed token is revoked and the User can request another message subject to the normal issuance limits.

## 8 Resend flow

1. The User authenticates with the existing server-side Session.
2. The backend derives the User from the authenticated principal; the client does not send `userId` or email.
3. If the User has no email, the request is rejected.
4. If the email is already verified, the request succeeds without sending a message.
5. The backend enforces the resend cooldown and hourly limit.
6. The backend revokes previous unused email-verification tokens, creates a new token and sends the new verification link.

## 9 Alternative and exception flows

- A1. The submitted token is invalid, expired, used or revoked: reject it with the same generic error and do not reveal which condition failed.
- A2. The resend request has no account email: reject it without creating a token.
- A3. The token-issuance cooldown or hourly limit is exceeded: reject it without creating or sending another token.
- A4. The email is already verified: return an idempotent success and send no email.
- A5. Email delivery fails during resend: revoke the newly created token and report temporary delivery failure; do not change the User. The issuance attempt still counts toward the limits.
- A6. Two confirmations race for the same token: only one transaction may consume it successfully.

## 10 Postconditions

- A successful confirmation sets `email_verified_at` exactly once and consumes the submitted token.
- No raw verification token is stored or logged.
- Verification does not change `user_roles`.
- Existing Sessions are not silently elevated. Advanced authorities become effective only after a new successful login.
- `/auth/me` may show the latest `emailVerified` database value and assigned roles, but authorization continues to use the authority snapshot in the current Session until re-login.

## 11 Related rules and contracts

- BR-64 and BR-73 through BR-76
- Physical ERD v1: `users`, `user_tokens`, `user_roles`
- [`email-verification-api-contract.md`](../api/email-verification-api-contract.md)
- [`browser-security-contract.md`](../api/browser-security-contract.md)

## 12 Acceptance Criteria

**AC-G03-EV-01 Registration without email**

```gherkin
Given a visitor omits email during valid registration
When the account is created
Then the system creates no email-verification token
And sends no verification email
```

**AC-G03-EV-02 Registration with email**

```gherkin
Given a visitor supplies a valid email during registration
When the account transaction commits
Then the system creates a single-use verification token
And the token expires 60 minutes after creation
And sends the verification message after commit
And stores no raw token
```

**AC-G03-EV-03 Delivery failure does not remove account**

```gherkin
Given account creation committed successfully
When initial verification-email delivery fails
Then the account and PARTICIPANT role remain created
And the undelivered token is revoked
And the User can request another verification message
```

**AC-G03-EV-04 Valid confirmation**

```gherkin
Given an active, unused and unexpired verification token exists
When the User submits the raw token
Then the system sets emailVerifiedAt and marks the token used in one transaction
And revokes the User's other active email-verification tokens
And returns HTTP 204
```

**AC-G03-EV-05 Invalid token privacy**

```gherkin
Given a token is invalid, expired, used or revoked
When it is submitted for confirmation
Then the system returns the same generic HTTP 400 error
And does not verify the email
```

**AC-G03-EV-06 Resend replaces previous token**

```gherkin
Given an authenticated User has an unverified email
When a resend request is allowed
Then previous unused email-verification tokens are revoked
And exactly one newly issued token can be confirmed
```

**AC-G03-EV-07 Resend limits**

```gherkin
Given an authenticated User recently requested verification tokens
When the User exceeds the 60-second cooldown or 5-per-hour issuance limit
Then the system returns HTTP 429
And creates and sends no new token
```

**AC-G03-EV-08 Already verified resend**

```gherkin
Given an authenticated User's email is already verified
When the User requests another verification message
Then the system returns HTTP 204
And sends no email
```

**AC-G03-EV-09 Advanced authority refresh**

```gherkin
Given a User has an assigned advanced role and an existing unverified Session
When the User verifies the email
Then the existing Session is not elevated
And the advanced authority becomes effective only after a new successful login
```

**AC-G03-EV-10 Concurrent confirmation**

```gherkin
Given two requests submit the same valid token concurrently
When both requests are processed
Then only one request consumes the token successfully
And emailVerifiedAt remains consistent
```
