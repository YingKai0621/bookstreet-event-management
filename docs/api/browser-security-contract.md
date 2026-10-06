# Browser Security Contract

## 1 Status and scope

- Decision status: approved design.
- Implementation status: implemented and covered by backend integration tests.
- This is a cross-cutting contract for the browser frontend and every session-authenticated backend API.
- It can be implemented before the final UI because it depends on deployment origins and cookie policy, not page design.

## 2 Session cookie

- Authentication remains a Spring Security server-side Session stored in Redis.
- The browser sends the Session identifier only in an HttpOnly cookie.
- Frontend JavaScript must not read, copy or persist the Session identifier.
- Every frontend request that needs Session or CSRF cookies uses `credentials: "include"`.
- Deployed HTTPS environments set the Session cookie as `Secure`.
- Same-site deployment uses `SameSite=Lax` unless a stricter value is proven compatible.
- A genuinely cross-site frontend/API deployment uses `SameSite=None; Secure`.
- Localhost development may use `Secure=false`; different localhost ports are still same-site even though they are cross-origin.

Cookie policy must be environment configuration. The production policy must not be weakened to make local development easier.

## 3 CSRF token contract

CSRF protection remains enabled for browser requests that use the Session cookie.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/auth/csrf` | Public | Materialize and return the current CSRF token |

Response `200`:

```json
{
  "headerName": "X-XSRF-TOKEN",
  "token": "current-csrf-token"
}
```

- The backend may also expose the token through the readable `XSRF-TOKEN` cookie used by Spring's SPA CSRF support.
- The frontend sends the token in the `X-XSRF-TOKEN` header.
- The CSRF cookie is intentionally readable by same-origin frontend JavaScript; the Session cookie remains HttpOnly.
- CSRF is required for every state-changing browser request, including public `register`, `login` and email-verification `confirm` requests.
- The frontend obtains or refreshes a token on application startup and after login, logout or Session renewal because authentication may rotate the token.
- `GET`, `HEAD` and `OPTIONS` remain read-only and must not perform business-state changes.
- Missing or invalid CSRF tokens return HTTP 403 through the standard REST error format.

Swagger UI is an API exploration client, not an exception to CSRF protection.

## 4 CORS policy

- Allowed origins are an explicit environment-configured allowlist.
- Development initially allows `http://localhost:5173`.
- Production uses the real HTTPS frontend origin.
- Never use wildcard origin `*` together with credentialed requests.
- Set `allowCredentials = true`.
- Allowed methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Required request headers include `Accept`, `Content-Type` and `X-XSRF-TOKEN`.
- CORS handling and preflight processing must run before Spring Security authorization.

CORS only controls which browser origins may read or send credentialed cross-origin requests. It does not replace authentication, authorization or CSRF protection.

## 5 Frontend request sequence

1. Call `GET /api/v1/auth/csrf` with `credentials: "include"`.
2. Read `headerName` and `token` from the response.
3. For a state-changing request, send the returned header and keep `credentials: "include"`.
4. After login or logout, request a fresh CSRF token before the next state-changing request.
5. On HTTP 401, return to the login flow. On a CSRF-related HTTP 403, refresh the CSRF token once before presenting an error; do not retry a business command indefinitely.

## 6 Required tests before browser integration is complete

- Allowed configured origin receives the expected CORS response headers.
- An unlisted origin is rejected.
- Credentialed preflight succeeds for configured methods and headers.
- State-changing request without CSRF returns 403.
- State-changing request with the current token succeeds when authentication and business rules allow it.
- Login/logout token rotation is handled.
- Session cookie is HttpOnly and uses the environment's expected Secure and SameSite values.
- Public confirmation still requires CSRF but not an authenticated Session.
