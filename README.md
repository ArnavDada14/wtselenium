# LibraCMS — Library Book Issue & Digital Catalog System

A production-grade college library management system built with Node.js, Express, Prisma, Supabase, and React.

---

## Project Structure

```
WTProj/
├── server/          Express + TypeScript API
│   ├── prisma/      Database schema
│   └── src/
│       ├── db/      Prisma client
│       ├── lib/     Snowflake ID, UUIDv7, barcode, mailer, cache
│       ├── middleware/  Auth (JWT), RBAC, validation (Zod)
│       ├── modules/
│       │   ├── auth/
│       │   ├── catalog/
│       │   ├── issue/
│       │   ├── fines/
│       │   └── users/
│       └── jobs/    Cron overdue scanner
└── client/          Vite + React frontend
    └── src/
        ├── context/ AuthContext
        ├── lib/     Axios API client
        ├── components/ AppShell (sidebar + topbar)
        └── pages/   All UI pages
```

---

## Quick Start

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Create a storage bucket called `book-covers` (set to public)
3. Copy your connection strings and service role key

### 2. Configure the server

```bash
cd server
cp .env.example .env
# Fill in your DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_*, JWT_SECRET
```

### 3. Run database migrations

```bash
cd server
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to Supabase PostgreSQL
```

### 4. Start the API server

```bash
cd server
npm run dev
```

Server runs on `http://localhost:3001`

### 5. Start the frontend

```bash
cd client
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | Public | Login |
| POST | /api/auth/refresh | Public | Refresh JWT |
| GET | /api/auth/me | JWT | Current user |
| GET | /api/catalog/books | Public | Search catalog |
| POST | /api/catalog/books | LIBRARIAN | Add book |
| POST | /api/catalog/books/:id/copies | LIBRARIAN | Add copies |
| GET | /api/catalog/copies/barcode/:b/image | Public | Barcode PNG |
| POST | /api/issues | LIBRARIAN | Issue book |
| POST | /api/issues/:id/return | LIBRARIAN | Return book |
| POST | /api/issues/:id/renew | All | Renew issue |
| GET | /api/issues/me | STUDENT | Own issues |
| GET | /api/fines | LIBRARIAN | All fines |
| POST | /api/fines/:id/pay | LIBRARIAN | Record payment |
| POST | /api/fines/:id/waive | LIBRARIAN | Waive fine |
| GET | /api/users | LIBRARIAN | All users |
| POST | /api/users | ADMIN | Create user |
| GET | /api/users/dashboard/stats | LIBRARIAN | Dashboard metrics |

---

## ID System

- **Snowflake IDs** — Users, Books, Issues, Fines (64-bit integer, time-ordered, 8-byte PK)
- **UUIDv7** — BookCopy barcodes (time-ordered UUID, no coordination needed)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | Express + TypeScript |
| Database | Supabase (PostgreSQL via Prisma) |
| Storage | Supabase Storage (book covers) |
| ORM | Prisma |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Validation | Zod |
| Email | Nodemailer (direct SMTP) |
| Scheduler | node-cron (overdue scanner, 23:00 daily) |
| Cache | lru-cache (in-memory, 5-min TTL) |
| Barcodes | bwip-js (Code 128) |
| Frontend | Vite + React + TypeScript |
| HTTP Client | Axios (with auto token refresh) |
| Routing | React Router v6 |

---

## Deployment (Netlify + Render)

This project has a separate frontend and backend:

- `client/` (React/Vite) -> deploy to Netlify
- `server/` (Express/Prisma) -> deploy to Render using the included `render.yaml`

### 1) Prepare Supabase

Create a Supabase project and a public `book-covers` storage bucket. Keep the service-role key private. Configure the database tables once using the production database URL:

```bash
cd server
npm ci
npx prisma generate
npm run db:push
```

### 2) Deploy the API to Render

In Render, create a Blueprint from this repository and provide the requested secret environment values:

- `DATABASE_URL` — Supabase pooled PostgreSQL connection string
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` and `JWT_REFRESH_SECRET` — use separate, randomly generated values
- `FRONTEND_URL` — your final Netlify site origin, including `https://`

`render.yaml` sets the Node runtime, build/start commands, and `/api/health` health check. Render supplies `PORT`. To enable email notifications, also configure the `SMTP_*` variables documented in `server/.env.example`.

After the API deploys, verify `https://<your-backend-domain>/api/health` returns `status: ok`.

### 3) Deploy the frontend to Netlify

Import this repository into Netlify. The included `netlify.toml` configures the `client/` base directory, production build, publish directory, Node version, and SPA redirects. Set this environment variable in the Netlify site settings:

- `VITE_API_URL=https://<your-backend-domain>/api`

Trigger a deploy after setting the variable. In Render, set `FRONTEND_URL` to the exact Netlify origin and redeploy the API if needed.

### 4) Final verification

- The API health check passes.
- Login works and the catalog loads from the deployed frontend.
- Chatbot requests return data.
