# Delivery Dispatch App

Next.js application for dispatch operations: orders, picking, fleet, driver app access, and Supabase-backed data.

## Prerequisites

- Node.js 18+ (or 20+ recommended)
- npm, pnpm, or yarn

## Setup

```sh
git clone <YOUR_GIT_URL>
cd delivery-dispatch-app-next
npm install
```

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; for driver app access API routes)
- `RESEND_API_KEY` (optional; for emailing driver login credentials)

## Development

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```sh
npm run build
npm start
```

## Stack

- **Framework:** Next.js (App Router)
- **UI:** React, Tailwind CSS, shadcn/ui (Radix)
- **Data & auth:** Supabase
- **State:** TanStack Query, Zustand

## Deployment

Deploy to Vercel (or any Node host). Add the same environment variables in the hosting dashboard. Driver mobile apps should use your deployed URL as `API_BASE_URL` and the same Supabase project URL and anon key.

## Documentation

See `docs/` for mobile app and API plans.
