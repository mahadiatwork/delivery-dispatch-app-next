# Plan: Mobile App Authentication & Driver Access (API-Based)

Drivers **authenticate** in the mobile app with Supabase Auth, then get **all driver and order data** from **this Next.js app’s API**. The mobile app does not query Supabase for `drivers` or `orders`; it only uses Supabase for login and sends the JWT to your API. Access is enforced in the API.

---

## 1. Overview

| Step | Where | What happens |
|------|--------|----------------|
| **Give access** | Dispatch app (Next.js) | Admin clicks “Give app access” → Auth user created, `drivers.user_id` and `drivers.app_access_enabled = true`. Driver gets email + temp password. |
| **Login** | Mobile app | Driver signs in with **Supabase Auth** (same project: same URL + anon key). |
| **Resolve driver** | Mobile app → **this app’s API** | App calls **GET /api/driver/me** with `Authorization: Bearer <access_token>`. API returns driver profile (and optionally `mustChangePassword`). If 403 → no access. |
| **Load orders** | Mobile app → **this app’s API** | App calls **GET /api/driver/orders?filter=today\|past\|upcoming** with the same Bearer token. API returns only that driver’s orders, filtered by date. |

No direct Supabase queries for `drivers` or `orders` from the mobile app. One backend (this app) owns access control and data.

---

## 2. Giving Access (Already in Place)

- **Dispatch app (Fleet):** “Give app access” → `POST /api/drivers/give-access` with `driverId`, `email`, optional `password`.
- **Backend:** Creates Supabase Auth user, profile row, and sets `drivers.user_id` and `drivers.app_access_enabled = true`.
- **Driver receives:** Login email + temporary password (from dispatch UI or from an email you add later).
- **Revoke:** “Revoke access” sets `user_id = null` and `app_access_enabled = false`; next API call with that user’s token will return 403 from `/api/driver/me`.

---

## 3. Mobile App Authentication

### 3.1 Supabase (same project)

- Use the **same** Supabase **URL** and **anon key** in the mobile app as the dispatch app.
- Drivers sign in with the **public** anon key (no service role in the app).

### 3.2 Login flow

1. **Login screen:** Email + password.
2. **Call:** `supabase.auth.signInWithPassword({ email, password })`.
3. **On success:** Supabase stores the session. Read the **access token** for API calls:  
   `session.access_token` (or `supabase.auth.getSession()` then `session.data.session?.access_token`).
4. **On failure:** Show “Invalid email or password” (or handle “email not confirmed” if needed).

### 3.3 After login – use the API only

Do **not** query the `drivers` table from the mobile app. Instead:

1. Get the access token from the Supabase session.
2. Call **GET /api/driver/me** with header:  
   `Authorization: Bearer <access_token>`.
3. **If 200:** Response includes the driver profile (id, name, email, etc.) and optionally `mustChangePassword`. Store `driverId` and go to the main app (or to “Set new password” if `mustChangePassword` is true).
4. **If 403:** User is not a driver or access is disabled → show “You don’t have driver access” / “Access has been disabled” and optionally sign out.

All “resolve driver” and “do they have access?” logic lives in the API; the app just follows the API responses.

---

## 4. This App’s Driver API (Option A – The Only Path)

**Base URL:** Your Next.js app (e.g. `https://your-app.vercel.app` or your domain).

**Auth for every request:**  
`Authorization: Bearer <supabase_access_token>`

The API must:

1. Read the Bearer token from the request.
2. Verify the token with Supabase (e.g. `supabase.auth.getUser(access_token)` or verify JWT and get `sub` = user id).
3. Find the driver: `drivers` where `user_id = auth.uid()` and `app_access_enabled = true`.
4. If no such row → **403** (not a driver or access revoked).
5. If found → use that driver’s `id` for all logic and return only that driver’s data.

### 4.1 GET /api/driver/me

- **Purpose:** Identify the current user as a driver and get their profile. Use this after login instead of querying Supabase for `drivers`.
- **Headers:** `Authorization: Bearer <access_token>`
- **Success (200):**  
  ```json
  {
    "driver": {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "phone": "string",
      "vehicleType": "truck" | "van" | "hotshot",
      "isActive": true
    },
    "mustChangePassword": false
  }
  ```
  - `mustChangePassword`: optional, from `user.user_metadata.must_change_password`; if true, mobile app shows “Set new password” before showing orders.
- **Error (403):** Not a driver or `app_access_enabled` is false. Body e.g. `{ "error": "No driver access" }`.
- **Error (401):** Missing or invalid token.

### 4.2 GET /api/driver/orders

- **Purpose:** Return orders assigned to the current driver, filtered by time window.
- **Headers:** `Authorization: Bearer <access_token>`
- **Query:** `filter=today | past | upcoming` (required).
- **Success (200):**  
  ```json
  {
    "orders": [
      {
        "id": "uuid",
        "orderNumber": "string",
        "customer": { "name", "address", "phone", ... },
        "items": [...],
        "stage": "string",
        "scheduledDate": "YYYY-MM-DD",
        "assignedDay": "Mon" | ...,
        "comments": "string",
        ...
      }
    ]
  }
  ```
  - **today:** `scheduled_date` = today (server date or agreed timezone).
  - **past:** `scheduled_date < today` or `stage = 'completed'`; order by date/updated desc.
  - **upcoming:** `scheduled_date > today`; order by `scheduled_date` asc.
- **Error (403):** No driver access.  
- **Error (401):** Missing or invalid token.  
- **Error (400):** Missing or invalid `filter`.

Backend resolves the driver from the JWT, then queries `orders` where `assigned_driver_id = driver.id` and applies the date filter. No RLS is required for driver access to orders; the API enforces it.

---

## 5. Routes/Orders: What the API Returns

- **Today:** Orders with `scheduled_date` equal to the current date (use a consistent timezone, e.g. server or config).
- **Past:** Orders with `scheduled_date` before today or `stage = 'completed'`; ordered by `scheduled_date` or `updated_at` descending.
- **Upcoming:** Orders with `scheduled_date` after today; ordered by `scheduled_date` ascending.

The mobile app only needs to call `GET /api/driver/orders?filter=today`, `filter=past`, and `filter=upcoming` and display the returned lists (e.g. tabs or sections).

---

## 6. End-to-End Flow

1. **Dispatch app:** Admin gives driver app access → driver gets Auth user + `drivers.user_id` and `app_access_enabled = true`. Driver receives email + temp password.
2. **Mobile app – login:** Driver enters email + password → `signInWithPassword` → session (and access token) stored.
3. **Mobile app – resolve driver:** Call **GET /api/driver/me** with `Authorization: Bearer <access_token>`.  
   - 403 → show “No access” and optionally sign out.  
   - 200 → store driver profile; if `mustChangePassword` then show “Set new password” and after that go to main app; else go to main app.
4. **Mobile app – routes/orders:** Call **GET /api/driver/orders?filter=today** (and `past`, `upcoming`) with the same Bearer token. Display the returned orders in the right sections.
5. **Token refresh:** Use Supabase’s session refresh so the access token stays valid; keep sending the current access token in the `Authorization` header for every API request.
6. **Revoke from dispatch:** Admin revokes access → `app_access_enabled = false` (and `user_id = null`). Next **GET /api/driver/me** (or any driver API call) returns 403 → app shows “Access disabled.”

---

## 7. Implementation Checklist

### This repo (Next.js – driver API)

- [ ] **Auth helper:** Implement a shared helper (e.g. `getDriverFromRequest(request)`) that: reads `Authorization: Bearer <token>`, verifies the token with Supabase, loads the driver where `user_id = auth.uid()` and `app_access_enabled = true`. Returns `{ driver }` or throws/returns 401/403.
- [ ] **GET /api/driver/me:** Use the helper; return driver profile and optional `mustChangePassword` from user metadata.
- [ ] **GET /api/driver/orders:** Accept query `filter=today|past|upcoming`. Use the helper to get the current driver; query `orders` where `assigned_driver_id = driver.id` and apply the date filter; return JSON list of orders.
- [ ] (Optional) **POST /api/driver/me/complete-setup:** If you use “must change password,” call this after the driver sets a new password to clear `must_change_password` in user metadata (or clear it from the client with `updateUser` and skip this).

### Mobile app

- [ ] Use same Supabase URL + anon key; implement login with `signInWithPassword`.
- [ ] After login, get `access_token` from the session and call **GET /api/driver/me** with `Authorization: Bearer <access_token>`. On 403, show “No access”; on 200, store driver and go to main app (or “Set new password” first if `mustChangePassword`).
- [ ] For routes/orders, call **GET /api/driver/orders?filter=today**, `filter=past`, and `filter=upcoming` with the same header. Display the returned orders.
- [ ] Use Supabase session refresh and always send the current access token in API requests.
- [ ] (Optional) First-login “must change password” flow using `user_metadata` and `updateUser` (see DRIVER_APP_ACCESS_AND_API_PLAN.md).

### Dispatch app (already done)

- [x] Give app access sets `user_id` and `app_access_enabled = true`.
- [x] Revoke sets `user_id = null` and `app_access_enabled = false`.

---

## 8. Security Summary

- **Authentication:** Supabase Auth only in the mobile app (email/password). No direct Supabase access to `drivers` or `orders` from the app.
- **Authorization:** Every driver request is validated by this app’s API: verify JWT → resolve driver with `app_access_enabled = true` → return only that driver’s data. No RLS needed for driver access.
- **Giving/revoking access:** Only from the dispatch app; revoke immediately disables access on the next API call.

The plan is **Option A only**: mobile app authenticates with Supabase and uses **this Next.js app’s API** for all driver profile and routes/orders data.
