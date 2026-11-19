# Content Image Upload API Contract

- Status: `IMPLEMENTED - STORAGE PROVIDER DEPLOYMENT UPDATE PENDING MERGE`
- Reviewed: `2026-11-19`
- Scope: existing Event, Booth, Activity, Badge and Heritage image fields
- Schema impact: none; PostgreSQL stores only the returned relative URL

## 1. Purpose and boundary

These operations let an authorized editor upload an image before saving the related domain object. Uploading returns a
relative public URL; it does **not** create or update an Event, Booth, Activity, Badge or Heritage record. The editor passes
the returned URL to the existing mutation API for that object.

This is not a general media library. There is no image listing endpoint, client-selected file name, public upload, image
metadata table or binary image column in PostgreSQL.

## 2. Shared browser contract

- Authentication uses the existing Spring Security Session cookie; no bearer token or JWT is accepted.
- Every upload or delete is state-changing and requires the existing CSRF proof.
- The multipart field name is exactly `file`.
- Accepted content is a valid JPG, PNG or WebP image whose declared MIME type matches its file signature.
- The maximum file size is 5 MiB. Empty, mismatched or unsupported content is rejected.
- The backend creates a safe unique file name. The original client file name is not used as a storage key.
- Public reads do not require a Session.

## 3. Operations

### 3.1 Event banner

`POST /api/v1/organizer/event-banners`

- Role: verified `ORGANIZER`
- Success: `201 Created`
- Response: `{ "url": "/api/v1/media/event-banners/{generatedName}" }`
- Read: `GET /api/v1/media/event-banners/{generatedName}`
- Saving the URL belongs to the existing Event create/update command.

### 3.2 Booth image

`POST /api/v1/organizer/booth-images`

- Role: verified `ORGANIZER`
- Success: `201 Created`
- Response: `{ "url": "/api/v1/media/booth-images/{generatedName}" }`
- Read: `GET /api/v1/media/booth-images/{generatedName}`
- Optional cleanup: `DELETE /api/v1/organizer/booth-images/{generatedName}` returns `204 No Content` only while no Booth
  references that URL. A referenced image returns `409 BOOTH_IMAGE_IN_USE`.

### 3.3 Organizer Activity image

`POST /api/v1/organizer/events/{eventId}/activity-images`

- Role: verified `ORGANIZER`
- Ownership: `{eventId}` must be an Event owned by the signed-in Organizer.
- Success: `201 Created`
- Response: `{ "url": "/api/v1/media/activity-images/{generatedName}" }`
- Read: `GET /api/v1/media/activity-images/{generatedName}`
- Saving the URL belongs to the existing Activity create/update command.

### 3.4 Partner Activity image

`POST /api/v1/partner/activities/{activityId}/images`

- Role: verified `PARTNER`
- Ownership and state: the Partner must represent an active organization, own the Activity, and the Activity must be
  `DRAFT` or `PUBLISHED`.
- Success: `201 Created`
- Response and public read use the same Activity URL as section 3.3.
- Upload prepares the proposed URL; the existing Activity change-request command remains responsible for changing data.

### 3.5 Badge illustration

`POST /api/v1/admin/badge-images`

- Role: verified `ADMIN`
- Success: `201 Created`
- Response: `{ "url": "/api/v1/media/badge-images/{generatedName}" }`
- Read: `GET /api/v1/media/badge-images/{generatedName}`
- Saving the URL belongs to the existing audited Badge create/update command.

### 3.6 Heritage image

`POST /api/v1/organizer/heritage-images`

- Role: verified `ORGANIZER`
- Success: `201 Created`
- Response: `{ "imageUrl": "/assets/heritage/uploads/{generatedName}" }`
- Read: `GET /assets/heritage/uploads/{generatedName}`
- Optional cleanup: `DELETE /api/v1/organizer/heritage-images/{generatedName}` returns `204 No Content` only while no
  Heritage content references that URL. A referenced image returns `409 HERITAGE_IMAGE_IN_USE`.

## 4. Storage-provider behavior

The URL persisted by domain records stays relative and provider-neutral. With local storage, the read endpoint streams the
file. With Cloudinary storage, the same read endpoint responds with `307 Temporary Redirect` to the asset's secure Cloudinary
CDN URL. Frontend code must use the returned relative URL and follow normal HTTP redirects; it must not construct Cloudinary
URLs or store Cloudinary credentials.

Provider configuration and credentials are deployment concerns. They never appear in API responses, logs, committed `.env`
files or frontend environment variables. Changing provider does not require a database migration or rewriting existing API
clients. It does not automatically copy old filesystem files: before switching a database that already references locally
uploaded relative URLs, those physical assets must be copied to the matching provider folder/public ID or re-uploaded through
the application. Seeded absolute external URLs are unaffected.

## 5. Error behavior

- `401 AUTHENTICATION_REQUIRED`: no valid Session.
- `403 ACCESS_DENIED`: wrong role, unverified advanced role or missing/invalid CSRF proof.
- `404`: owned Event/Activity or requested stored image is not visible to the caller.
- `409`: organization/state guard fails, or a cleanup request targets an image already in use.
- `422`: empty, larger than 5 MiB, unsupported or signature/MIME-mismatched image.
- `500`: storage/read/delete provider failure. The response never contains provider credentials or raw provider diagnostics.

Feature-specific error codes already used by Event, Booth and Heritage remain stable. Shared Activity and Badge validation uses
`IMAGE_INVALID`, `IMAGE_NOT_FOUND` and `IMAGE_STORAGE_FAILED`.

## 6. Verification requirements

1. Each upload rejects missing authorization, missing CSRF, oversized data and fake image bytes.
2. Organizer Event/Activity ownership and Partner organization/Activity ownership are verified server-side.
3. Admin Badge upload is not accessible to Organizer, Partner or Participant Sessions.
4. A successful upload can be read through its returned relative URL with both local and Cloudinary providers.
5. Cloudinary reads redirect only to the secure URL returned by the configured provider.
6. Booth and Heritage cleanup cannot delete a referenced image.
7. Uploading alone does not mutate any domain row; the existing domain command remains the persistence boundary.
