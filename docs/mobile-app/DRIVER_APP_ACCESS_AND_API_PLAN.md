# Plan: Driver App Access — Email, Forced Password Change & API for Mobile App

This document covers the full flow once you **give a driver app access** from the dispatch app: the driver receives an email with a temporary password, must change it on first login, then uses your **Next.js API endpoints** from a separate mobile app to see today’s orders, past deliveries, and future orders.

---

## 1. Current State (Already Done)

- Dispatch app: **Give app access** creates a Supabase Auth user, profile row, and sets `drivers.user_id`. Admin can copy a generated temporary password to share manually.
- Driver app (mobile): will use **this app’s API** (same Next.js backend), not direct Supabase client for order data. Auth can stay Supabase (mobile app signs in with Supabase, then sends the JWT to your API).

---

## 2. Desired Flow (Summary)

1. **Admin** clicks “Give app access” in Fleet → temporary password is created (and optionally generated).
2. **Driver receives an email** with:
   - Their login email
   - Temporary password
   - Link to download/open the driver app (or your login URL).
3. **Driver** opens the mobile app → signs in with **email + temporary password** (Supabase Auth).
4. **First login:** app detects “must change password” → **force** a “Set new password” screen; driver cannot see orders until they set a new password.
5. After setting a new password, driver sees:
   - **Today’s orders** (to deliver today)
   - **Past orders** (what they delivered before)
   - **Future orders** (upcoming assigned deliveries).

All order data is loaded by the **mobile app calling this application’s API endpoints**, authenticated with the same Supabase JWT.

---

## 3. Sending the Email with Temporary Password

Right now the temporary password is only shown in the dispatch UI. To **send it by email**:

### Option A – Transactional email from your backend (recommended)

- When **Give access** succeeds in `POST /api/drivers/give-access`:
  1. Create the user and set the temporary password (already done).
  2. Call a **transactional email provider** (e.g. Resend, SendGrid, Postmark) from the same API route:
     - **To:** driver’s email  
     - **Subject:** e.g. “Your DispatchPro driver app login”  
     - **Body:** Include login email, temporary password, and a note that they must change it on first login. Optionally add a link to your driver app (store link or deep link).
- **Env:** e.g. `RESEND_API_KEY` or `SENDGRID_API_KEY`. Keep the key server-side only.
- **Template:** Plain text or HTML; avoid putting the password in the URL (send in body only).

### Option B – Supabase Auth “Invite” (different flow)

- Use `auth.admin.inviteUserByEmail()`. Supabase sends an invite email with a **magic link**; the user sets their password when they click it. This does **not** send a “temporary password” in the classic sense; it’s a “set your password via link” flow. If you want “email + temporary password” and then “force change on first login”, Option A fits better.

**Recommendation:** Use **Option A** so you control the exact message (email + temp password + “change on first login”) and the link to your driver app.

---

## 4. Forced Password Change on First Login

Supabase does not enforce “change password on first login” out of the box. Implement it in the **driver app** and optionally with a small API.

### 4.1 Mark “must change password”

When creating the driver’s Auth user in `POST /api/drivers/give-access`, set **user metadata** so the app can detect first login:

```ts
await supabase.auth.admin.createUser({
  email: emailTrimmed,
  password,
  email_confirm: true,
  user_metadata: { must_change_password: true },
});
```

No DB migration needed; metadata lives in `auth.users.raw_user_meta_data`.

### 4.2 Driver app (mobile) flow

1. Driver signs in with **email + temporary password** (Supabase `signInWithPassword`).
2. After successful login, read session / user: `user.user_metadata?.must_change_password === true`.
3. If **true:** show a **“Set new password”** screen only (no access to orders). Driver enters new password (and confirm); call Supabase `supabase.auth.updateUser({ password: newPassword })`, then clear the flag (see 4.3).
4. If **false:** go to main app (today / past / future orders).

### 4.3 Clearing the “must change password” flag

After the driver sets a new password, set `must_change_password: false` so they are not forced again:

- **Option A (from mobile):** Call an API on **this app** that accepts the driver’s JWT and updates metadata, e.g.  
  `POST /api/driver/me/complete-setup`  
  which uses the service role or Admin API to set `user_metadata: { must_change_password: false }` for that user.  
  The mobile app calls this **after** a successful `updateUser({ password })`.
- **Option B (from mobile with Supabase client):** Use `supabase.auth.updateUser({ data: { must_change_password: false } })` if you are happy storing this only in `user_metadata` and not in your DB. Then the app just needs to read `user_metadata.must_change_password` on each launch until it’s false.

**Recommendation:** Use **Option B** for simplicity (no new API for clearing the flag). When the driver changes password, the mobile app calls `updateUser({ password: newPassword, data: { must_change_password: false } })` in one go.

---

## 5. API Endpoints for the Mobile Driver App

The **mobile app** will call **this Next.js application’s API**. All driver endpoints must:

- Accept the **Supabase JWT** (e.g. `Authorization: Bearer <access_token>`).
- Resolve `auth.uid()` (from the JWT) to the **driver** row (`drivers.user_id = auth.uid()`).
- Return data only for that driver (and optionally enforce “must change password” before returning orders).

Suggested base path: **`/api/driver/...`** (singular “driver” for “current driver”).

### 5.1 Authenticating API requests

- **Middleware or per-route check:**  
  - Read `Authorization: Bearer <token>`.  
  - Verify the token with Supabase (e.g. `supabase.auth.getUser(token)` or verify JWT and get `sub` = user id).  
  - Load the driver: `drivers` where `user_id = sub`.  
  - If no driver row → 403 (not a driver).  
  - Attach `driverId` (and optionally `driver` row) to the request so handlers only return that driver’s data.

You can implement a small helper that:

- Gets the Bearer token from the request.
- Uses Supabase Auth (with anon key is enough for `getUser(access_token)`) to get the user.
- Queries `drivers` by `user_id` (use **service role** or a DB view/function so the backend can read any driver by user_id).  
Then each route uses this “current driver” and returns only their data.

### 5.2 Endpoints to implement

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/driver/me` | Returns the **current driver** (id, name, email, vehicle_type, etc.) and optionally `must_change_password` from user_metadata. Used by the app to get `driverId` and to decide whether to show “Set new password” or the main screen. |
| GET | `/api/driver/orders` | Returns **orders** assigned to the current driver. **Query params:** e.g. `filter=today \| past \| upcoming` (or three separate params). Backend filters by `assigned_driver_id = driverId` and by date relative to “today” (use server date or a provided date). |
| POST | `/api/driver/me/complete-setup` | (Optional) Called after the driver sets a new password; clears `must_change_password` in user metadata. If you clear the flag from the client with `updateUser`, this endpoint is not strictly necessary. |

**Order filtering (server-side):**

- **Today:** `assigned_driver_id = driverId` AND `scheduled_date` is the **current date** (start/end of day in your chosen timezone).
- **Past:** `assigned_driver_id = driverId` AND (`scheduled_date < today` OR `stage = 'completed'`). Optionally order by `scheduled_date` or `updated_at` desc.
- **Upcoming/Future:** `assigned_driver_id = driverId` AND `scheduled_date > today`, order by `scheduled_date` asc.

Use your existing `orders` table and `scheduled_date` (and `stage` if you want “past” to include completed today’s orders). All filtering and ordering should be done in the API so the mobile app only receives the right slice.

### 5.3 Response shape (suggested)

- **GET /api/driver/me**  
  - `{ driver: { id, name, email, vehicleType, ... }, mustChangePassword?: boolean }`  
  - If the user is not a driver: **403** and a clear message.

- **GET /api/driver/orders?filter=today|past|upcoming**  
  - `{ orders: Order[] }` with the same (or a subset of) order fields you use in the dispatch app, so the mobile app can show a list and detail view consistently.

---

## 6. Driver App (Mobile) High-Level Flow

1. **Login screen:** Email + password (Supabase `signInWithPassword`). On success, store session (Supabase handles this).
2. **Startup / after login:**  
   - Call **GET /api/driver/me** with the Supabase access token in `Authorization`.  
   - If response is 403 → show “You are not registered as a driver.”  
   - If `mustChangePassword === true` → navigate to **“Set new password”** screen; no access to orders until done.
3. **Set new password screen:**  
   - Driver enters new password (and confirm).  
   - Call `supabase.auth.updateUser({ password: newPassword, data: { must_change_password: false } })`.  
   - On success, go to main app (e.g. “Today” tab).
4. **Main app (tabs or sections):**  
   - **Today:** GET `/api/driver/orders?filter=today`.  
   - **Past:** GET `/api/driver/orders?filter=past`.  
   - **Upcoming:** GET `/api/driver/orders?filter=upcoming`.  
   - Use the same JWT in `Authorization` for every request.

---

## 7. Implementation Checklist (This Repo – Next.js API)

### Phase 1 – Give-access: send email with temp password

- [ ] Choose an email provider (e.g. Resend) and add the API key to `.env.local` (e.g. `RESEND_API_KEY`).
- [ ] In `POST /api/drivers/give-access`, after creating the user and before/after linking the driver:
  - Call the email API to send one email to the driver’s address with: login email, temporary password, “You must change this password on first login,” and optional link to the driver app.
- [ ] (Optional) Make the email template configurable (e.g. subject/body in env or a simple template file).

### Phase 2 – Force password change (metadata)

- [ ] In `POST /api/drivers/give-access`, when calling `auth.admin.createUser`, add `user_metadata: { must_change_password: true }`.
- [ ] (Optional) Add `POST /api/driver/me/complete-setup` that reads the JWT, gets the user id, and sets `user_metadata.must_change_password = false` via Admin API, so the mobile app can call this after password change instead of using `updateUser` from the client.

### Phase 3 – Driver API: auth helper and /me

- [ ] Add a shared helper (e.g. `getDriverFromRequest(request)`) that: reads `Authorization: Bearer <token>`, verifies the token with Supabase, loads the driver by `user_id`, returns `{ driver }` or throws/returns 401/403.
- [ ] Implement **GET /api/driver/me**: use the helper, return driver profile and `mustChangePassword` from `user.user_metadata` (you can get user from the same token or from Supabase Auth).

### Phase 4 – Driver API: orders

- [ ] Implement **GET /api/driver/orders** with query param `filter=today|past|upcoming`.
- [ ] Use the same auth helper to get the current driver.
- [ ] Query `orders` where `assigned_driver_id = driver.id`, and filter by `scheduled_date` (and optionally `stage`) for today / past / upcoming. Return a consistent JSON shape (e.g. same as or a subset of your Order type).

### Phase 5 – Docs and driver app contract

- [ ] Document the driver API (base URL, auth header, endpoints, query params, response shapes) in a short doc or OpenAPI snippet so the mobile app team (or you) can integrate.
- [ ] Ensure the driver app uses the **same Supabase project** (same URL and anon key) for login, and your **Next.js base URL** for all `/api/driver/*` calls.

---

## 8. Summary

| Item | Where | What to do |
|------|--------|------------|
| Email with temp password | Dispatch app API (`give-access`) | After creating user, send one transactional email (e.g. Resend) with email, password, and “change on first login” message. |
| Must change password | Give-access + driver app | Set `user_metadata.must_change_password: true` when creating user. Driver app checks this and shows “Set new password” until they call `updateUser({ password, data: { must_change_password: false } })`. |
| Driver API | This Next.js app | Add auth helper (verify JWT → get driver by user_id). Implement GET `/api/driver/me` and GET `/api/driver/orders?filter=today|past|upcoming`. |
| Mobile app | Separate repo | Login with Supabase; call this app’s `/api/driver/*` with Bearer token; enforce password change when `mustChangePassword` is true; then show today / past / upcoming orders from the API. |

This gives you a single place (this app) for driver identity, orders, and business logic, while the mobile app only handles UI and uses your API for all driver data.
