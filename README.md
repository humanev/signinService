# Humans of EV Sign-in Service

This service provides member and administrator authentication for the sibling
`humans-of-ev-5` React application. It uses MongoDB-backed sessions; browser
JavaScript never receives a session token.

## Run locally

Requirements: Node.js 20.6 or newer, MongoDB, and an SMTP account for admin
invitations and password recovery.

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, `SESSION_SECRET`, `TOKEN_PEPPER`, and the SMTP settings.
   Generate separate random values of at least 32 bytes for the two secrets.
   Do not commit `.env` or paste secrets into source files.

   In PowerShell, generate each secret with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```
3. Install dependencies and create the first administrator:

   ```powershell
   npm install
   npm run create-admin -- owner@example.com
   ```

   Enter the owner's password at the hidden prompt. This is a local CLI command;
   there is no public first-admin bootstrap endpoint.
4. Start the API:

   ```powershell
   npm start
   ```

5. In `humans-of-ev-5`, run `npm install` and `npm run dev`. Vite proxies `/api`
   to `http://localhost:5000`. Override the proxy target with
   `SIGNIN_SERVICE_URL` if needed.

Production deployments must serve the API over HTTPS, set `NODE_ENV=production`,
configure `FRONTEND_ORIGINS` to the exact frontend origin(s), set `TRUST_PROXY`
only when running behind a trusted proxy, and route `/api` to this service. If
the frontend and API are on different origins, set `VITE_API_BASE_URL` in the
frontend build and configure matching CORS origins.

## Authentication endpoints

- `POST /api/auth/member/register` and `POST /api/auth/member/login`
- `GET /api/auth/me` and `POST /api/auth/logout`
- `POST /api/auth/login` for administrators
- `POST /api/auth/signup` to accept a one-time email invitation
- `GET /api/admin/session`
- `POST /api/admin/team` to send an invitation; only the owner can manage the team
- `POST /api/admin/recovery/request` and `/api/admin/recovery/reset`
- `POST /api/admin/profile/password`

Mutating endpoints require a session-bound CSRF token from `GET /api/auth/csrf`.
Passwords are hashed with bcrypt. Sessions and one-time codes are stored in
MongoDB; invitation and recovery codes are stored only as keyed hashes. Recovery
codes expire after 10 minutes and allow at most five attempts.

## Scope and limitations

The member and admin authentication flows use this API. The rest of the website's
content, contact, newsletter, media-upload, and payment APIs remain frontend
previews and are not persisted by this service. Do not treat those features as
production-ready.

## Project structure

- `server.js`, `server/` — API startup and middleware
- `config/` — database, environment, and session settings
- `models/` — users, admin invitations, and recovery codes
- `controllers/`, `routes/` — request handling and API routes
- `middleware/` — session authorization, CSRF, and rate limits
- `services/` — password, session, email, and one-time-token helpers
- `scripts/createAdmin.js` — interactive first-owner creation
- `test/` — focused validation and model tests
