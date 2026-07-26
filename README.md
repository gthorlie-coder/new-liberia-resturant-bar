# New Liberia Restaurant & Bar

Phase 1 of the build: **Auth, Menu, Ordering, Payments** (foundation modules),
matching the roadmap in the deliverable package.

## Structure

```
new-liberia/
├── backend/      Node.js + Express REST API, PostgreSQL
├── mobile/       Flutter customer app (starter)
└── docker-compose.yml
```

## Running the backend locally

1. Copy the env file and fill in real values:
   ```
   cd backend
   cp .env.example .env
   ```
   You'll need a Firebase project (Authentication enabled: phone, Google,
   Apple) and its service account credentials for `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

2. Start Postgres (and the API, once its image builds) via Docker:
   ```
   cd ..
   docker compose up -d postgres
   ```

3. Install dependencies and run migrations + seed data:
   ```
   cd backend
   npm install
   npm run migrate
   npm run seed
   ```

4. Start the API:
   ```
   npm run dev
   ```
   It runs on `http://localhost:4000`. Check `GET /health`.

## What's implemented in this pass

- **Auth**: Firebase token verification middleware, `/auth/sync` to create/
  fetch the app-level user record after Firebase sign-in, role-based access
  control (`requireRole`).
- **Menu**: public category/menu-item browsing, manager/admin create & update.
- **Orders**: create an order (server re-prices every line item from the DB —
  never trusts client prices), fetch an order with its items, list a user's
  order history, and update order status (used by kitchen/bar/rider apps).
- **Payments**: charge-initiation endpoints for Orange Money, Lonestar MTN
  MoMo, card, and cash, plus manager/cashier refunds. The actual provider
  API calls are marked with `TODO` — wire those in once sandbox credentials
  are issued.
- **Database**: full schema from the PRD (branches, users, menu, orders,
  payments, deliveries, reservations, loyalty, inventory, staff, audit logs).
- **Mobile**: Flutter app skeleton with brand theming (navy/gold, light +
  dark mode) and a working Menu screen wired to the live API.

## Not yet built (next modules per the roadmap)

Delivery live-tracking, reservations/QR check-in, kitchen/bar display
screens, loyalty redemption logic, staff scheduling, inventory management,
marketing, and the web admin dashboard. Build and test each one module at a
time, the same way this pass did Auth → Menu → Ordering → Payments.

## Security notes before going to production

- Rotate the values in `.env.example` — never commit real secrets.
- Put the Firebase service account and payment provider keys in a secrets
  manager, not plain environment files, once deployed.
- Add automated tests (unit + integration) before wiring in real payment
  provider calls — see the Testing Plan in the deliverable PDF.
