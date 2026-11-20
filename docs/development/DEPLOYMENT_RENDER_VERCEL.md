# Render and Vercel Deployment

## Production topology

- Frontend: Vercel project `bookstreet-event-management`
- Backend: Render web service `duongsach-backend-01nm`
- Database: Render PostgreSQL `duongsach-db-01nm`
- Session storage: Render Key Value `duongsach-redis-01nm`
- Uploaded media: Cloudinary

The frontend uses same-origin rewrites from `/api/*` to the Render backend.
Render assigned the production service the URL
`https://duongsach-backend-01nm.onrender.com`; keep it aligned with
`frontend/vercel.json`.

## First Render deployment

1. In Render, create a new Blueprint from this GitHub repository.
2. Render reads `render.yaml` and provisions the backend, PostgreSQL, and Key
   Value services in Singapore.
3. Supply the secret values requested by the Blueprint:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM`
   - `GEMINI_API_KEY`
   - `VNPAY_TMN_CODE` and `VNPAY_HASH_SECRET`
4. Wait for `/api/v1/auth/csrf` to pass the health check. Flyway applies the
   schema migrations during application startup.

Never commit production secrets or paste them into `render.yaml`.

## Vercel deployment

The frontend directory is already linked locally to the Vercel project. Deploy
from the `frontend` directory after the Render backend is healthy:

```text
npx vercel deploy --prod
```

The production URL currently used by the backend configuration is
`https://bookstreet-event-management.vercel.app`.

## Custom domain

Add the custom domain to Vercel first. Vercel provisions HTTPS automatically.
Then add the final HTTPS origin to `CORS_ALLOWED_ORIGINS`, update
`FRONTEND_BASE_URL` and `VNPAY_RETURN_URL` on Render, and redeploy the backend.

## Release smoke test

1. Open the frontend production URL and verify the home page loads.
2. Register or sign in with one test account for each required role.
3. Verify authenticated navigation and logout.
4. Upload one small image and confirm its returned URL uses Cloudinary.
5. Verify event listing, event details, and the main Sprint 11 attendance flow.
6. Restart the Render backend and confirm the user can sign in again and the
   uploaded Cloudinary image still loads.
