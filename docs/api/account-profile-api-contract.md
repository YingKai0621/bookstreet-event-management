# Account profile bug-fix extension

Explicitly requested outside Sprint 4's Event scope. Implements BR-02/BR-05:
profile ownership comes only from the authenticated Redis-backed session.
Uses existing V1 users.full_name, phone_number and avatar_url; no migration.

GET /api/v1/auth/profile returns {id, fullName, email, phone, avatarUrl, emailVerified} from PostgreSQL.
emailVerified reflects users.email_verified_at, is read-only, and controls visibility
of the profile's verification button. Verification uses the existing email-verification
API contract; the browser refreshes the profile after confirmation and on window focus.
PUT /api/v1/auth/profile replaces editable fields {fullName, phone, avatarUrl}.
Requires session authentication and CSRF; no user identifier is accepted from the body.
Email, username, roles and account status cannot be changed through this endpoint.
Full name is normalized and must contain 2–50 characters; phone is optional, at most
20 characters. Avatar is optional text (including an uploaded image data URL), at
most 7,000,000 characters. Null/blank phone or avatar clears that field.
Response is the persisted profile. Validation or persistence failure must not be
shown as a successful save, and the browser must not persist a fallback profile.

Acceptance: a new account never displays another account's cached name/avatar;
profile edits survive reload through PostgreSQL; cross-account access is unavailable;
failed writes show an error. Email notification preferences remain disabled because
the approved schema has no preference field. This endpoint grants no role.
