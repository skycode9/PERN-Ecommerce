# E-Shopify · PERN E-Commerce

[![CI](https://github.com/skycode9/PERN-Ecommerce/actions/workflows/ci.yml/badge.svg)](https://github.com/skycode9/PERN-Ecommerce/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![Express](https://img.shields.io/badge/Express_5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A full-stack clothing store with a customer storefront and an admin panel. Built with
PostgreSQL, Express, React and Node, with Stripe and PayPal payments, custom JWT auth with Google
sign-in, and Docker images deployed on Render.

**Live demo:** https://pern-ecom.onrender.com

| Account           | Email                    | Password      |
| ----------------- | ------------------------ | ------------- |
| Customer          | `demo@example.com`       | `DemoPass123` |
| Admin (read-only) | `admin.demo@example.com` | `DemoPass123` |

- Card payments run in test mode: use `4242 4242 4242 4242` with any future expiry and any CVC,
  or a PayPal sandbox buyer account.
- Promo code `WELCOME10` gives 10% off orders over $50.
- The demo customer starts with 5000 reward points, so you can also try paying with points.
- The demo runs on Render's free tier, so the first request after a while can take up to a
  minute while the services wake up.

![Home page](docs/screenshots/home.png)

## Table of contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Running locally](#running-locally)
- [Deployment](#deployment)

## Features

**Storefront**

- Home page with banners, categories, latest products and live promos
- Collection page with category, brand, color and size filters
- Product details with image gallery, color/size options and related products
- Guest cart in local storage that merges into the account cart on sign-in
- Wishlist, saved addresses and order history
- Returns within a window after delivery, refunded as reward points
- Checkout with card (Stripe), PayPal, or reward points, plus promo codes
- Responsive layout with a separate mobile navbar

**Admin panel**

- Dashboard with total sales, orders, returns, products and categories
- Product and category management with multi-image upload to Cloudinary
- Order management with status updates (placed, shipped, delivered, returned)
- Promo codes with usage limits, minimum order value and date windows
- Home page banners: upload, replace and delete, with images cleaned up on Cloudinary

**Auth**

- Email/password and Google sign-in
- Short-lived access token kept in memory, refresh token in an httpOnly cookie
- Refresh tokens are stored hashed and rotated on every use
- Role-based routes on both the API and the client

## Screenshots

| Storefront                                        | Product details                                         |
| ------------------------------------------------- | ------------------------------------------------------- |
| ![Home](docs/screenshots/home.png)                | ![Product](docs/screenshots/product.png)                |
| **Collections & filters**                         | **Cart & checkout**                                     |
| ![Collections](docs/screenshots/collections.png)  | ![Checkout](docs/screenshots/checkout.png)              |
| **Sign in**                                       | **My orders**                                           |
| ![Sign in](docs/screenshots/sign-in.png)          | ![Orders](docs/screenshots/orders.png)                  |
| **Admin dashboard**                               | **Admin products**                                      |
| ![Dashboard](docs/screenshots/admin-dashboard.png) | ![Admin products](docs/screenshots/admin-products.png) |
| **Admin orders**                                  | **Mobile**                                              |
| ![Admin orders](docs/screenshots/admin-orders.png) | ![Mobile](docs/screenshots/mobile.png)                 |

## Tech stack

| Layer    | Tools                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Zustand, React Router |
| Backend  | Node 22, Express 5, TypeScript, Zod, Winston                                  |
| Database | PostgreSQL on Neon, Prisma ORM                                                |
| Auth     | JWT (HS256), bcrypt, Google Identity Services                                 |
| Payments | Stripe Payment Intents + webhooks, PayPal Orders API                          |
| Media    | Cloudinary                                                                    |
| DevOps   | Docker, nginx, Docker Compose, Render, GitHub Actions                         |
| Tooling  | ESLint, Prettier, Husky, lint-staged                                          |

## Architecture

```mermaid
flowchart LR
  B[Browser] -->|HTTPS| A[Express<br/>React build + /api]
  A --> DB[(PostgreSQL<br/>Neon)]
  A --> C[Cloudinary]
  A --> S[Stripe]
  A --> P[PayPal]
  S -->|webhook| A
```

The React app and the API are served from the same origin. In production a single image runs
Express, which serves the API under `/api` and the React build for every other route. Because the
browser only ever talks to one domain, the refresh cookie can stay `SameSite=Strict`.

`client/` and `server/` also have their own Dockerfiles. Docker Compose uses those, with nginx
serving the build and proxying `/api/*` to the API container.

### Auth flow

```mermaid
sequenceDiagram
  participant U as Browser
  participant A as API
  participant D as Database
  U->>A: login / register / Google
  A->>D: store sha256(refresh token)
  A-->>U: access token (body) + refresh token (httpOnly cookie)
  U->>A: requests with Authorization: Bearer
  Note over U,A: access token expires after 15 minutes
  U->>A: POST /auth/refresh (cookie)
  A->>D: match hash, delete old, store new
  A-->>U: new access token + rotated cookie
```

The access token lives only in memory, never in `localStorage`. On page load the client calls
`/auth/refresh` to get a fresh one, and a `401` triggers a single refresh and retry.

### Checkout flow

```mermaid
sequenceDiagram
  participant U as Browser
  participant A as API
  participant G as Stripe / PayPal
  U->>A: create order (address, promo)
  A->>A: price the cart from the database
  A->>G: create payment for that amount
  A-->>U: payment id + pending order
  U->>G: customer pays / approves
  U->>A: confirm / capture
  A->>G: verify payment status and amount
  A->>A: one transaction: decrement stock, use promo, clear cart, mark paid
  A-->>U: order id
```

- Totals are always computed on the server from database prices. The client never sends an
  amount.
- Stripe orders are also confirmed by a signed webhook, so an order is marked paid even if the
  browser closes before the confirm call. Finalizing an order is idempotent, so the confirm call
  and the webhook can both arrive safely.
- PayPal captures are checked for `COMPLETED` status and an exact amount match before the order
  is finalized.
- Stock is decremented with a conditional update inside the transaction, so two buyers cannot
  both take the last item.

### Security

- `helmet`, `hpp`, a 10kb JSON body limit and CORS restricted to known origins
- Global rate limit, plus a stricter one on login, register, Google and refresh
- Passwords hashed with bcrypt, generic auth errors so emails cannot be enumerated
- Access tokens expire in 15 minutes and pin the signing algorithm
- Google ID tokens are verified against the app's own client id
- Errors are logged on the server; clients only get a generic message
- The demo admin can open every admin page, but any write returns `403`

## Project structure

```
.
├── client/                 React app
│   ├── src/
│   │   ├── components/     ui primitives, layouts, admin and customer components
│   │   ├── features/       api calls, stores and types per feature
│   │   ├── pages/          route pages
│   │   └── lib/            api client, env, helpers
│   ├── nginx/              nginx config template used by the image
│   └── Dockerfile
├── server/                 Express API
│   ├── prisma/             schema, migrations, seed
│   ├── src/
│   │   ├── routes/         auth, customer and admin routers
│   │   ├── middleware/     auth guards, error handling
│   │   └── utils/          envelope, errors, payments, uploads, logger
│   └── Dockerfile
├── postman/                API collection
├── .github/workflows/      CI: lint, typecheck, build, docker build
├── Dockerfile              single production image (api + React build)
├── docker-compose.yml
└── render.yaml
```

## API overview

| Prefix                       | What it covers                                                       |
| ---------------------------- | -------------------------------------------------------------------- |
| `/auth`                      | register, login, Google, refresh, me, logout                         |
| `/customer`                  | home, products, addresses, cart, wishlist, promos, orders, returns   |
| `/customer/checkout`         | Stripe, PayPal and reward points checkout, Stripe webhook            |
| `/admin`                     | products, categories, promos, orders, banners, dashboard (admin only) |
| `/health`                    | uptime check used by Render                                          |

Every endpoint replies with the same envelope:

```json
{ "status": "success", "data": {}, "meta": {} }
{ "status": "error", "data": null, "errors": [{ "message": "Cart is empty", "code": "APP_ERROR" }] }
```

A Postman collection with every endpoint is in [`postman/`](postman).

## Running locally

You need Node 22+, a PostgreSQL database (a free [Neon](https://neon.tech) project works), and
test keys for Cloudinary, Stripe, PayPal and Google OAuth.

```bash
git clone https://github.com/skycode9/PERN-Ecommerce.git
cd PERN-Ecommerce

# api
cd server
cp .env.example .env          # fill in the values
npm install
npx prisma migrate deploy
npx prisma db seed            # demo products, banners, promo and demo accounts
npm run dev                   # http://localhost:8080

# web, in a second terminal
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

### With Docker

```bash
docker compose --env-file client/.env up --build
```

The app is then available at http://localhost:8080, with nginx in front of the API exactly as in
production.

### Scripts

Both `server/` and `client/` have the same scripts:

| Script                 | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Start in watch mode                           |
| `npm run build`        | Production build                              |
| `npm run typecheck`    | TypeScript check without emitting             |
| `npm run verify`       | Format, lint with fixes, then typecheck       |
| `npm run verify:check` | The same checks without writing (used in CI) |

A Husky pre-commit hook runs lint-staged on staged files.

### Environment variables

**server/.env**

| Name                                                                     | Description                                   |
| ------------------------------------------------------------------------ | --------------------------------------------- |
| `PORT`                                                                   | API port (default `8080`)                     |
| `CORS_ORIGINS`                                                           | Comma-separated allowed origins               |
| `TRUST_PROXY`                                                            | Number of proxies in front of the API         |
| `API_PREFIX` / `CLIENT_DIR`                                              | Set by the root image: api path and React build folder |
| `DATABASE_URL` / `DIRECT_URL`                                            | Pooled and direct Postgres connection strings |
| `JWT_SECRET`                                                             | Secret for signing access tokens              |
| `GOOGLE_CLIENT_ID`                                                       | Google OAuth client id                        |
| `ADMIN_EMAILS`                                                           | Emails that get the admin role on sign-up     |
| `DEMO_ADMIN_EMAIL`                                                       | Admin account that is read-only               |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Image uploads                                 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`                            | Stripe API key and webhook signing secret     |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_ENV`               | PayPal app credentials, `sandbox` or `live`   |

**client/.env**

| Name                          | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `VITE_BACKEND_URL`            | API base url (`/api` in the Docker image)        |
| `VITE_GOOGLE_CLIENT_ID`       | Google OAuth client id                           |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key                           |
| `VITE_PAYPAL_CLIENT_ID`       | PayPal client id (the button is hidden if empty) |
| `VITE_DEMO_MODE`              | `true` shows demo logins and test card hints     |

## Deployment

The repo includes a [Render Blueprint](render.yaml) with one Docker web service built from the
root [`Dockerfile`](Dockerfile). It builds the React app and the API into one image, runs
`prisma migrate deploy` on start and then serves both.

Steps:

1. In Render, choose **New → Blueprint** and select this repository.
2. Fill in the secret values and set `CORS_ORIGINS` to the service's url.
3. In Google Cloud, add the service url to the OAuth client's authorized JavaScript origins.
4. In Stripe, add a webhook endpoint at `https://<app-url>/api/customer/checkout/webhook` for
   `payment_intent.succeeded`, then copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Seed the database once from your machine with `npx prisma db seed`.

CI on GitHub Actions runs format, lint, typecheck and build for both apps, then builds both
Docker images.

## License

[MIT](LICENSE)
