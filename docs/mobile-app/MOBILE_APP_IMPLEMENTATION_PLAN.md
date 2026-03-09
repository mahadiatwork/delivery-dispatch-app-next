# Mobile Driver App – Implementation Plan (Cursor-Ready)

**Use this document in your mobile app repo:** add it to the project (e.g. in `/docs` or the repo root) and tell Cursor to implement the driver authentication and API integration following this plan. The backend (dispatch app) is already implemented; the mobile app only needs to implement the client side described here.

---

## Cursor instruction (copy this when starting)

> Implement the driver mobile app authentication and API integration as specified in this plan:
> 1. **Config:** Read Supabase URL, Supabase anon key, and API base URL from environment/config.
> 2. **Auth:** Login screen (email + password) using Supabase `signInWithPassword`. After success, get the session’s `access_token` and call the backend **GET /api/driver/me** with `Authorization: Bearer <access_token>`.
> 3. **Driver resolution:** If /api/driver/me returns 200, store the driver profile and go to the main app (or to a “Set new password” screen if `mustChangePassword` is true). If 403, show “No driver access” and sign out. If 401, sign out and return to login.
> 4. **Orders:** Main app calls **GET /api/driver/orders?filter=today**, `filter=past`, and `filter=upcoming` with the same Bearer token. Display the three lists (today / past / upcoming).
> 5. **Session:** Use Supabase’s session refresh; send the current access token on every API request. On 401 from the API, try refreshing the session once and retry; if still 401, sign out.
> 6. **Logout:** Sign out button that calls `supabase.auth.signOut()` and clears app state, then navigates to login.
> Follow the API contract and types in this document exactly.

---

## 1. Backend (already implemented)

- **Dispatch app:** Next.js app that hosts the driver API. Drivers are given access from Fleet → “Give app access” (email + temporary password; admin can “Email login to driver” to open mail client with pre-filled email).
- **Same Supabase project:** The mobile app must use the **same** Supabase project (same URL and **anon** key) as the dispatch app. Drivers sign in with Supabase Auth; the dispatch app’s API verifies the JWT and returns driver data.
- **No service role in the app:** The mobile app uses only the **anon** (publishable) key. Never put the service role key in the mobile app.

---

## 2. Environment / config (implement first)

The mobile app needs three values. Names can be adapted to your framework (e.g. Expo `extra`, React Native env, etc.).

| Variable | Description | Example |
|----------|-------------|--------|
| `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) | Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Supabase anon/publishable key | `eyJhbGci...` |
| `API_BASE_URL` (or `DRIVER_API_BASE_URL`) | Base URL of the **dispatch app** (Next.js) | `https://your-app.vercel.app` or `http://localhost:3000` |

- Use the **exact same** Supabase URL and anon key as the dispatch app so drivers log in to the same Auth.
- `API_BASE_URL` must not include a trailing slash (e.g. `https://your-app.vercel.app`, not `https://your-app.vercel.app/`).

---

## 3. Supabase client and login (implement second)

- Install the Supabase client for your stack (e.g. `@supabase/supabase-js` for React Native/Expo, or the official Supabase package for your framework).
- Create a single Supabase client instance using `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`. Do not use the service role key.
- **Login screen:**
  - Inputs: email (required), password (required).
  - Submit: call `supabase.auth.signInWithPassword({ email, password })`.
  - On success: Supabase stores the session. Proceed to “Resolve driver” (section 4).
  - On error: show a user-friendly message (e.g. “Invalid email or password”) from `error.message`.

---

## 4. Resolve driver and access (implement third)

After a successful login, the app must confirm the user is a driver with access by calling the **dispatch app API**, not by querying Supabase directly.

1. Get the access token from the session:
   - `const { data: { session } } = await supabase.auth.getSession();`
   - `const accessToken = session?.access_token;`
2. If there is no `accessToken`, treat as not logged in (e.g. redirect to login).
3. Call the API:
   - **URL:** `GET {API_BASE_URL}/api/driver/me`
   - **Header:** `Authorization: Bearer {accessToken}`
4. Handle the response:
   - **200:** Parse the JSON body (see “API contract” below). Store the `driver` object (at least `id`, and optionally `name`, `email` for UI). If `mustChangePassword === true`, navigate to a “Set new password” screen and do not show the main app until the user has changed their password. Otherwise navigate to the main app (e.g. home or “Today” tab).
   - **403:** Show a message such as “You don’t have driver access” or “Access has been disabled.” Optionally call `supabase.auth.signOut()` and navigate to login.
   - **401:** Treat as invalid or expired token: sign out and navigate to login (or refresh the session once and retry; if still 401, sign out).

---

## 5. API client helper (recommended)

Implement a small API client that:

- Takes the current Supabase session (or access token).
- For every request: sets `Authorization: Bearer {access_token}`. If the token is expired, refresh the session first (e.g. `supabase.auth.refreshSession()`) and use the new access token.
- Calls `GET {API_BASE_URL}/api/driver/me` and `GET {API_BASE_URL}/api/driver/orders?filter=...`.
- On 401: optionally try one refresh + retry; if still 401, sign out and redirect to login.
- On 403: surface “No driver access” to the UI (and optionally sign out).

This keeps auth and token handling in one place.

---

## 6. Load and display orders (implement fourth)

- All order data comes from the dispatch app API. Use the same Bearer token for every request.
- Endpoints (same base URL and auth as above):
  - **Today:** `GET {API_BASE_URL}/api/driver/orders?filter=today`
  - **Past:** `GET {API_BASE_URL}/api/driver/orders?filter=past`
  - **Upcoming:** `GET {API_BASE_URL}/api/driver/orders?filter=upcoming`
- **Header:** `Authorization: Bearer {accessToken}` on every request.
- **200:** Parse `{ orders: Order[] }` and show the list in the appropriate tab/section (Today / Past / Upcoming).
- **401/403:** Handle as in section 4 (sign out or show “No access”).
- Trigger fetches on screen focus and/or pull-to-refresh; avoid calling on every frame.

---

## 7. Token refresh and session

- Rely on Supabase’s session management: use `getSession()` (and refresh if needed) before critical API calls so the access token is current.
- If an API call returns 401, try refreshing the session once (`refreshSession()`), then retry with the new token; if it still returns 401, sign out and go to login.
- Never send the service role key; only the anon key and the user’s access token are used.

---

## 8. Optional: “Set new password” on first login

- When **GET /api/driver/me** returns `mustChangePassword: true`, show a dedicated “Set new password” screen. Block access to the main app (Today/Past/Upcoming) until the user completes this.
- Screen: two fields (new password, confirm password), “Save” button. Validate that they match and meet any password rules.
- On submit: call `supabase.auth.updateUser({ password: newPassword, data: { must_change_password: false } })`.
- On success: navigate to the main app. Optionally call **GET /api/driver/me** again to confirm `mustChangePassword` is false.
- If you do not implement this, you can ignore `mustChangePassword` and always go to the main app after login.

---

## 9. Logout

- Provide a “Log out” / “Sign out” action (e.g. in profile or settings).
- Call `supabase.auth.signOut()` and clear any stored driver profile or app state.
- Navigate to the login screen.

---

## 10. API contract (reference)

**Base URL:** `API_BASE_URL` (no trailing slash).  
**Auth:** Every request must include: `Authorization: Bearer {supabase_access_token}`.

### GET /api/driver/me

- **Purpose:** Identify the current user as a driver and get their profile. Call this after login instead of querying Supabase for drivers.
- **Response 200:**
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
- **401:** Missing or invalid token. Body: `{ "error": "Missing or invalid Authorization header" }` or `{ "error": "Invalid or expired token" }`.
- **403:** Not a driver or access disabled. Body: `{ "error": "No driver access" }`.

### GET /api/driver/orders

- **Query:** `filter=today | past | upcoming` (required).
- **Response 200:**
  ```json
  {
    "orders": [
      {
        "id": "uuid",
        "orderNumber": "string",
        "customer": {
          "name": "string",
          "id": "string",
          "address": "string",
          "phone": "string",
          "coordinates": { "lat": number, "lng": number }
        },
        "items": [],
        "stage": "string",
        "scheduledDate": "YYYY-MM-DD" | null,
        "assignedDay": "Mon" | "Tue" | ...,
        "comments": "string",
        "orderType": "string",
        "rsm": "string",
        "invoicePhotoUrl": "string" | null,
        "orderDocumentUrl": "string" | null,
        "presellNumber": "string" | null,
        "pickingColumn": "string",
        "createdAt": "string"
      }
    ]
  }
  ```
- **today:** `scheduledDate` equals today (server date).
- **past:** `scheduledDate` &lt; today or `stage === "completed"`; newest first.
- **upcoming:** `scheduledDate` &gt; today; soonest first.
- **400:** Missing or invalid `filter`. Body: `{ "error": "Missing or invalid filter. Use filter=today|past|upcoming" }`.
- **401/403:** Same as /api/driver/me.

---

## 11. TypeScript types (for Cursor / implementation)

Use these in the mobile app for type-safe API responses:

```ts
// Driver profile (from GET /api/driver/me)
export type DriverVehicleType = "truck" | "van" | "hotshot";

export interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: DriverVehicleType;
  isActive: boolean;
}

export interface DriverMeResponse {
  driver: DriverProfile;
  mustChangePassword?: boolean;
}

// Order (from GET /api/driver/orders)
export interface OrderCustomer {
  name: string;
  id: string;
  address: string;
  phone: string;
  coordinates: { lat: number; lng: number };
}

export interface DriverOrder {
  id: string;
  orderNumber: string;
  customer: OrderCustomer;
  items: unknown[];
  stage: string;
  scheduledDate: string | null;
  assignedDay: string;
  comments: string;
  orderType: string;
  rsm: string;
  invoicePhotoUrl: string | null;
  orderDocumentUrl: string | null;
  presellNumber: string | null;
  pickingColumn: string;
  createdAt: string;
}

export interface DriverOrdersResponse {
  orders: DriverOrder[];
}
```

---

## 12. Error handling summary

| Situation | Action |
|-----------|--------|
| No network | Show “No connection” (and retry when back online or user taps Retry). |
| 403 from /api/driver/me or /api/driver/orders | Show “No driver access” (or “Access has been disabled”); optionally sign out. |
| 401 from API | Refresh session once and retry; if still 401, sign out and go to login. |
| Empty orders | Show empty state (“No orders today”, “No past deliveries”, “No upcoming orders”). |

---

## 13. Implementation checklist

| # | Task |
|---|------|
| 1 | Config: SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE_URL |
| 2 | Supabase client (anon key only); login screen with signInWithPassword |
| 3 | After login: get access_token, call GET /api/driver/me with Authorization: Bearer {token} |
| 4 | On 200: store driver; go to main app or “Set new password” if mustChangePassword |
| 5 | On 403: show “No driver access” and sign out |
| 6 | Main app: GET /api/driver/orders?filter=today, past, upcoming with Bearer token |
| 7 | Display Today / Past / Upcoming order lists |
| 8 | Session refresh; use current token for every API request; on 401 refresh once then sign out |
| 9 | Logout: signOut() and clear state, navigate to login |
| 10 | (Optional) “Set new password” screen when mustChangePassword is true |

---

This plan is the single source of truth for implementing the driver mobile app against the existing dispatch app backend. Add it to your mobile app repo and use the Cursor instruction at the top to generate the authentication and API integration.
