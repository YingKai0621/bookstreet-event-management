# Sprint 01 Use Case Specifications and Acceptance Criteria

## 1 Scope

This document specifies the five Use Case slices implemented in Sprint 1. Acceptance Criteria are testable conditions and are the completion contract between requirement, frontend, backend and QA.

---

## UC-G02 Create Account

### Goal

Allow a visitor to create a Participant account using username and password.

### Primary actor

Guest / Public Visitor

### Preconditions

- The visitor is not authenticated.
- Registration is available.

### Trigger

The visitor submits the registration form.

### Input

- `username`
- `fullName`
- `password`
- `confirmPassword`
- `email` optional

### Main flow

1. The visitor enters the registration information.
2. The frontend checks that password and confirm password match.
3. The backend validates required fields and the configured password policy.
4. The backend checks username uniqueness without case sensitivity.
5. If email is supplied, the backend checks email uniqueness without case sensitivity.
6. The backend hashes the password.
7. The system creates the User with an active account status.
8. The system assigns the default `PARTICIPANT` role through UserRole.
9. The system returns the created account summary without password data.

### Alternative and exception flows

- A1. Password and confirm password do not match: reject the request and create no User.
- A2. Username already exists with any letter casing: reject as duplicate.
- A3. Supplied email already belongs to another account: reject as duplicate.
- A4. Input violates validation rules: return field-level validation errors.
- A5. A persistence step fails: rollback User and UserRole creation together.

### Postconditions

- A User record exists.
- Exactly one default Participant UserRole exists for the new User.
- No plaintext password or confirm password is stored.

### Related rules

- BR-64
- Physical ERD: `users`, `roles`, `user_roles`

### Acceptance Criteria

**AC-G02-01 Successful registration without email**

```gherkin
Given the username does not exist
When a visitor registers with valid username, full name, matching passwords and no email
Then the system creates an active User
And assigns the PARTICIPANT role
And returns HTTP 201
```

**AC-G02-02 Case-insensitive username uniqueness**

```gherkin
Given a User with username "BookLover" exists
When another visitor registers with username "booklover"
Then the system returns HTTP 409
And creates no new User
```

**AC-G02-03 Password confirmation**

```gherkin
Given the registration form contains two different password values
When the visitor submits the form
Then the system returns a validation error
And stores no account data
```

**AC-G02-04 Password safety**

```gherkin
Given a registration succeeds
When account data is read from the database or API
Then only a password hash exists in the database
And password and confirmPassword are absent from every response
```

**AC-G02-05 Optional email uniqueness**

```gherkin
Given an account already uses a non-null email
When another registration submits the same email with different letter casing
Then the system returns HTTP 409
And creates no new User
```

---

## UC-G03 Manage Account Access - Sprint 1 slice

### Goal

Allow a registered user to login, maintain authenticated access, retrieve their identity and logout.

### Primary actor

Registered User

### Preconditions

- The account exists.
- The account is allowed to login.

### Trigger

The user submits username and password.

### Main flow

1. The user submits username and password.
2. The backend looks up username without case sensitivity.
3. The backend verifies the password hash and account status.
4. The system creates a server-side session in Redis and sends a Secure, HttpOnly session cookie to the browser.
5. The system updates `last_login_at`.
6. The frontend can request the authenticated user's profile and roles.
7. The user logs out and the current server-side session is invalidated.

### Alternative and exception flows

- A1. Username or password is incorrect: return a generic authentication error.
- A2. Account is disabled or blocked: deny login without revealing sensitive internal details.
- A3. The session is missing, expired or invalidated: deny access and require login again.
- A4. Logout is repeated: the system remains logged out and exposes no protected data.

### Postconditions

- Successful login creates an authenticated server-side session.
- Successful logout invalidates the current session.
- No endpoint returns the password hash.

### Parallel extension and deferred part of UC-G03

Email verification is an approved parallel Auth extension with separate Acceptance Criteria in [`email-verification-use-case-specification.md`](email-verification-use-case-specification.md). It does not block the Sprint 1 Event and Partner Definition of Done. Forgot/Reset Password remains deferred; the team must first approve how accounts without email recover access.

### Acceptance Criteria

**AC-G03-01 Valid login**

```gherkin
Given an active User with a valid password exists
When the User submits the correct username and password
Then the system creates an authenticated session
And sends a Secure, HttpOnly session cookie
And updates lastLoginAt
```

**AC-G03-02 Invalid credentials**

```gherkin
Given a login request contains an invalid username or password
When the request is processed
Then the system returns HTTP 401 with a generic message
And does not reveal which credential was wrong
```

**AC-G03-03 Current user**

```gherkin
Given the User has valid authenticated access
When the User requests the current-user endpoint
Then the system returns userId, username, fullName, optional email and roles
And does not return password data
```

**AC-G03-04 Role protection**

```gherkin
Given an authenticated User has only the PARTICIPANT role
When the User calls an Organizer or Partner endpoint
Then the system returns HTTP 403
```

**AC-G03-05 Logout**

```gherkin
Given the User has an active authenticated session
When the User logs out
Then the current server-side session is invalidated
And the same session cookie can no longer access protected endpoints
```

---

## UC-O01 Manage Events - Sprint 1 slice

### Goal

Allow an Organizer to create, view, update and publish Events for which they are responsible.

### Primary actor

Event Organizer

### Preconditions

- The actor is authenticated with role `ORGANIZER`.
- The Organizer email is verified.

### Trigger

The Organizer opens Event management or submits an Event command.

### Main flow

1. The Organizer creates an Event with required scheduling and configuration data.
2. The backend sets `organizer_user_id` from the authenticated user.
3. The Event is created with status `DRAFT`.
4. The Organizer views and updates their Draft Event.
5. The Organizer requests publication.
6. The backend validates required data, time order, deadlines and non-negative limits.
7. The Event status changes from `DRAFT` to `PUBLISHED`.
8. Public Event endpoints can now return the Event.

### Alternative and exception flows

- A1. End time is not after start time: reject validation.
- A2. A deadline or cutoff is inconsistent with Event time: reject validation.
- A3. Another Organizer attempts access: return forbidden or not found according to the security policy.
- A4. Event is incomplete: publication fails and Event remains Draft.
- A5. Event is not Draft: reject an invalid publish transition.

### Postconditions

- A created Event belongs to the authenticated Organizer.
- Only a valid Published Event is visible to Guest/Participant public queries.

### Related rules

- BR-01
- BR-03
- BR-06
- BR-07
- BR-64
- Physical ERD: `events`

### Acceptance Criteria

**AC-O01-01 Create Draft Event**

```gherkin
Given a verified Organizer is authenticated
When the Organizer submits valid Event data
Then the system creates a DRAFT Event
And sets organizerUserId from the authenticated User
And returns HTTP 201
```

**AC-O01-02 Ownership protection**

```gherkin
Given Event E1 belongs to Organizer A
When Organizer B tries to update E1
Then the system returns HTTP 403 or 404 according to the security policy
And E1 is unchanged
```

**AC-O01-03 Invalid time range**

```gherkin
Given an Event request has endAt less than or equal to startAt
When the Organizer submits it
Then the system returns HTTP 422
And does not persist the invalid values
```

**AC-O01-04 Publish Event**

```gherkin
Given the Organizer owns a complete DRAFT Event
When the Organizer publishes it
Then the Event status becomes PUBLISHED
And public Event endpoints can return it
```

Additional publication acceptance cases (policy updated 2026-11-02):

- A Draft may omit active deadlines or retain a contradictory timeline while being edited.
- Partner application and Participant registration deadlines are always required to publish.
  Booth request and Activity proposal deadlines are required only when their corresponding quota
  is greater than zero. A missing required field returns 422 EVENT_INCOMPLETE_FOR_PUBLISH and
  leaves the Event DRAFT.
- Publishing at/after startAt or at/after any active required deadline returns 422
  EVENT_TIME_INVALID and leaves the Event DRAFT.
- Publishing returns 422 EVENT_TIME_INVALID when an enabled Booth request or Activity proposal
  deadline is less than 24 hours after the Partner application deadline, when the Participant
  registration deadline is not strictly before Event start, or when the Booth request deadline plus
  payment window does not leave at least 24 hours before Event start for Booth setup. The response
  identifies the field that must be corrected and the Event remains DRAFT.
- Legacy withdrawal/cancellation cutoff fields are not required and do not determine publication.
- Complete future schedules satisfying the deadline ordering in the API Contract
  can be published; description/banner are optional.

**AC-O01-05 Draft visibility**

```gherkin
Given an Event is still DRAFT
When a Guest requests the public Event list or detail
Then the Draft Event is not returned
```

---

## UC-E01 Apply to Event

### Goal

Allow an eligible Partner Organization to apply to participate in a Published Event.

### Primary actor

Partner / Exhibitor

### Preconditions

- The actor is authenticated with role `PARTNER`.
- The Partner email is verified.
- The User represents one active Partner Organization.
- The Event is accepting Partner applications.

### Trigger

The Partner submits an Event application.

### Main flow

1. The Partner opens a Published Event.
2. The Partner enters an optional application note.
3. The backend resolves the Partner Organization from the authenticated User.
4. The backend validates Event status and application deadline.
5. The backend checks that no application already exists for the Partner Organization and Event.
6. The system creates `PartnerEventApplication` with status `PENDING` and `submitted_at`.
7. The Partner can view the submitted application and its current status.

### Alternative and exception flows

- A1. Partner Organization profile is missing or inactive: reject submission.
- A2. Event is not Published or not accepting applications: reject submission.
- A3. Application deadline has passed: reject submission.
- A4. An application already exists for the same Partner Organization and Event: reject duplicate.
- A5. A Pending application is withdrawn: set `WITHDRAWN` and `withdrawn_at`; do not delete the record.

### Postconditions

- At most one application record exists for a Partner Organization and Event.
- A successful submission is `PENDING`.
- Withdrawal preserves application history.

### Related rules

- BR-04
- BR-07
- BR-14
- BR-64
- Physical ERD: `partner_organizations`, `partner_event_applications`, `events`

### Acceptance Criteria

**AC-E01-01 Submit application**

```gherkin
Given a verified Partner with an active organization views a Published Event before the application deadline
When the Partner submits an application
Then the system creates one PENDING PartnerEventApplication
And records submittedAt
And returns HTTP 201
```

**AC-E01-02 Duplicate prevention**

```gherkin
Given an application already exists for the same Partner Organization and Event
When the Partner submits another application
Then the system returns HTTP 409
And does not create a second record
```

**AC-E01-03 Deadline enforcement**

```gherkin
Given the Event partner application deadline has passed
When the Partner submits an application
Then the system returns HTTP 409 with an application-closed error
And creates no application
```

**AC-E01-04 Partner data isolation**

```gherkin
Given Partner A is authenticated
When Partner A requests application data owned by Partner B
Then the system denies access
```

**AC-E01-05 Withdraw Pending application**

```gherkin
Given the Partner owns a PENDING application
When the Partner withdraws it
Then its status becomes WITHDRAWN
And withdrawnAt is recorded
And the record remains in the database
```

---

## UC-O03 Review Partner Applications

### Goal

Allow the Organizer responsible for an Event to approve or reject its Partner applications.

### Primary actor

Event Organizer

### Preconditions

- The actor is authenticated with role `ORGANIZER`.
- The Organizer is responsible for the Event through `events.organizer_user_id`.
- The application exists and is `PENDING`.

### Trigger

The Organizer opens the Event application queue or submits a review decision.

### Main flow

1. The Organizer opens the application list for one of their Events.
2. The system returns applications and their Partner Organization summaries.
3. The Organizer opens an application detail.
4. The Organizer selects Approve or Reject and may enter a review note.
5. The backend rechecks ownership and current application status.
6. The system changes status to `APPROVED` or `REJECTED`.
7. The system records `review_note` and `reviewed_at`.
8. The Partner can view the decision.

### Alternative and exception flows

- A1. Organizer does not own the Event: deny access.
- A2. Application is no longer Pending: reject invalid transition.
- A3. Concurrent reviews occur: exactly one valid transition succeeds.
- A4. Persistence fails: status, note and reviewed time are rolled back together.

### Postconditions

- The application has exactly one current review result.
- Approved Partners become eligible for later Booth Request and Activity Proposal flows.
- Rejected applications remain stored for audit/history.

### Related rules

- BR-03
- BR-14
- Physical ERD: `partner_event_applications`, `events`

### Acceptance Criteria

**AC-O03-01 List owned Event applications**

```gherkin
Given the Organizer owns Event E1
When the Organizer requests E1 applications
Then the system returns applications for E1
And does not include applications for an Event owned by another Organizer
```

**AC-O03-02 Approve application**

```gherkin
Given the Organizer owns the Event and the application is PENDING
When the Organizer approves the application
Then its status becomes APPROVED
And reviewedAt is recorded
And the Partner can view the result
```

**AC-O03-03 Reject application**

```gherkin
Given the Organizer owns the Event and the application is PENDING
When the Organizer rejects it with an optional review note
Then its status becomes REJECTED
And reviewedAt and the supplied review note are stored
```

**AC-O03-04 Unauthorized review**

```gherkin
Given the application belongs to an Event managed by Organizer A
When Organizer B tries to approve or reject it
Then the system denies the request
And the application remains PENDING
```

**AC-O03-05 Prevent repeated transition**

```gherkin
Given an application is already APPROVED, REJECTED or WITHDRAWN
When an Organizer submits another review decision
Then the system returns HTTP 409
And preserves the existing status
```
