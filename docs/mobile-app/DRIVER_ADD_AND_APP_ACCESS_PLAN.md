# Plan: Add Drivers & Driver App Access

This document outlines how to implement (1) adding drivers from the Fleet Management UI and (2) giving drivers access to their own app so they can log in and see their orders.

---

## Current State

- **Drivers** live in Supabase table `public.drivers` with: `id`, `name`, `phone`, `vehicle_type`, `is_active`, `user_id` (nullable), `created_at`, `updated_at`. Optional `truck_number` may exist. **There is no `email` column yet** — we need to add it so drivers can log in to their app later (Supabase Auth uses email).
- **Hooks** in `src/hooks/useOrders.ts`: `useDrivers()`, `useCreateDriver()`, `useUpdateDriver()` already exist. `useCreateDriver` currently sets `user_id` to the **logged-in dispatch user** (the person creating the driver), which is incorrect for driver app access.
- **Fleet page** (`src/app/(main)/fleet/page.tsx`) shows drivers from the store (synced from Supabase via `DataProvider`) but the **Add Driver** button has no `onClick` or dialog.
- **Auth**: Supabase Auth + `profiles` table (`user_id`, `display_name`, `avatar_url`, etc.). Your **driver app** (separate app) will use the same Supabase project so drivers sign in with Supabase Auth and query orders assigned to them.

---

## Part 1: Add Driver (Dispatch App)

### 1.1 Add Driver button → open dialog

- On the Fleet page, give the **Add Driver** button an `onClick` that opens a dialog/sheet.
- Use the existing **Dialog** or **Sheet** component from `src/components/ui/` so the form is in a modal.

### 1.2 Add Driver form fields

- **Name** (required)
- **Email** (required or strongly recommended): store on the driver record. This is the email they will use to log in to the driver app later, so collecting it now avoids asking again when you click “Give app access.”
- **Phone** (optional): for contact (calls, SMS).
- **Vehicle type** (required): dropdown or select — `truck` | `van` | `hotshot` (match `vehicle_type` enum).
- **Truck number** (optional): only if your DB has `truck_number` and it’s in the insert type; otherwise skip or add in a later migration.
- **Active** (optional): checkbox, default `true` — map to `is_active`.

On submit:

- Call `useCreateDriver().mutateAsync` with `{ name, email, phone, vehicleType, isActive }` (and `truckNumber` if supported).
- **Do not** pass any `user_id` when “just” adding a driver (see Part 2 for linking a user). So in `useCreateDriver`, when creating a driver **without** app access, set `user_id: null` in the insert.

### 1.3 Fix useCreateDriver for “add only” flow

- In `src/hooks/useOrders.ts`, change the create-driver mutation so that:
  - It accepts an optional `userId: string | null`.
  - Insert payload: `user_id: userId ?? null` (not the current logged-in user’s id when only adding a driver).
- When opening the Add Driver dialog, you’re not yet creating an auth user, so call the mutation with no `userId` (or `userId: null`).

### 1.4 Invalidate list after create

- `useCreateDriver` already invalidates `["drivers"]` on success, so the Fleet list will refresh. Ensure the Fleet page reads drivers from the same source (store is already synced by `DataProvider` from `useDrivers()`), so no extra change needed for the list.

---

## Part 2: Give Drivers Access to Their App

“Give access” means: the driver can log in to **your separate driver app** with Supabase Auth and see only their assigned orders.

### 2.1 Data model (already in place)

- `drivers.user_id` (nullable) = Supabase Auth `user.id`. When set, this driver has an app account.
- Driver app flow: user logs in → get `auth.getUser()` → find `drivers` row where `user_id = user.id` → use that `driver.id` to filter orders.

### 2.2 Where to trigger “Give access”

Two options (pick one or both):

- **Option A – When adding a driver:** In the Add Driver dialog, add a checkbox like “Create login for driver app.” If checked, after creating the driver record you create an Auth user (and optionally profile), then update the new driver’s `user_id` to that user’s id (see 2.3).
- **Option B – From Fleet list:** Each driver card has an action “Give app access” (or “Invite to app”). For an existing driver with `user_id == null`, use the driver’s **stored email** (from `drivers.email`). The dialog can show “Login email: driver@example.com” (editable if needed) and only ask for “Temporary password” (or “Send magic link”). Then create user + profile and set `drivers.user_id`.

Recommendation: implement **Option B** first (give access to existing drivers), then optionally add **Option A** so you can do both in one step when adding a driver.

### 2.3 Backend / Supabase: create auth user for driver

- You **cannot** create Supabase Auth users from the client with a random password unless you use the **service role** (admin). From the **browser** you only have the anon key, so:
  - **Preferred:** Use a **Supabase Edge Function** or a **backend API route** that uses the **service role** to:
    - Create the auth user: `auth.admin.createUser({ email, password })` (or `inviteUserByEmail` if you prefer invite links).
    - Optionally create a row in `profiles` (e.g. `user_id`, `display_name` = driver name).
    - Return the new `user.id`.
  - Then the dispatch app (still as logged-in dispatch user) calls your **driver create/update** logic with that `user.id`: either create driver with `user_id` set, or update existing driver’s `user_id`.
- **Alternative (no backend):** Use Supabase “Invite user by email” from the dashboard or an Edge Function that sends a magic link; after the driver signs in once, you have a `user.id` to link. Then in the dispatch app you’d need a way to “link” that user to the driver (e.g. by email or a one-time token). This is more complex; the cleanest is an Edge Function that creates user + profile and returns `user.id`, then the dispatch app updates `drivers.user_id`.

### 2.4 Dispatch app: “Give app access” flow (Option B)

1. User clicks “Give app access” on a driver card (only show when `driver.user_id` is null; if not null, show “App access enabled” or “Revoke access”). Require that the driver has an **email** set; if not, show “Add email first” or open the edit-driver form.
2. Open a small dialog: **Email** pre-filled from `driver.email` (editable), “Temporary password” (optional; if empty, use “send magic link” or a generated password and show it once).
3. Call your **Edge Function** (or API route) with: `{ driverId, email, password? }` (email from driver record or as edited). The function:
   - Creates auth user (and profile if needed).
   - Updates `public.drivers` set `user_id = <new_user_id>` where `id = driverId` (using service role or a DB function with `SECURITY DEFINER` so the backend can update any driver).
4. Show success and optionally “Copy login link” or “Password: …” for the driver.
5. Invalidate drivers query so the card shows “App access enabled.”

### 2.5 Driver app (your other app) – contract

- **Login:** Supabase Auth (email/password or magic link). Same Supabase project as the dispatch app.
- **After login:**  
  - Get `user.id` from `supabase.auth.getUser()`.  
  - Query: `supabase.from('drivers').select('id, name, ...').eq('user_id', user.id).single()`.  
  - If no row, this user is not a driver → show “No driver profile” or redirect.  
  - If found, store `driverId`.
- **Orders:**  
  - Query orders where `assigned_driver_id = driverId`:  
    `supabase.from('orders').select('*').eq('assigned_driver_id', driverId).order('scheduled_date', { ascending: true })` (or whatever fields you need).
- **RLS:** Add a policy on `orders` so that when `auth.uid()` matches `drivers.user_id` for the row in `drivers` whose `id` equals `assigned_driver_id`, the driver can SELECT that order. Same for `drivers`: driver can SELECT only the row where `user_id = auth.uid()`.

Example RLS (concept):  
- `orders`: allow select where `assigned_driver_id` in (select id from drivers where user_id = auth.uid()).  
- `drivers`: allow select where user_id = auth.uid().

### 2.6 Revoke access (optional)

- Button “Revoke app access” on the driver card: set `drivers.user_id = null` for that driver (from dispatch app, with a mutation that your RLS allows for the dispatch user). Optionally disable or delete the auth user in an Edge Function if you want to fully remove login.

---

## Part 3: Implementation Checklist

### Phase 1 – Add Driver (including email)

- [ ] **Database:** Add `email` column to `public.drivers` (e.g. `TEXT` nullable or unique; consider `UNIQUE` if each driver login is one-to-one with email). Run migration, then regenerate Supabase types.
- [ ] **Types:** Add `email: string` (or `string | null`) to the frontend `Driver` type in `src/types/order.ts`. Update `transformDriver` and `useCreateDriver` / `useUpdateDriver` in `src/hooks/useOrders.ts` to read/write `email` (and add `email` to `TablesInsert<"drivers">` / `TablesUpdate<"drivers">` once types are regenerated).
- [ ] Fleet page: Add state for “add driver dialog open” and wire **Add Driver** button to open it.
- [ ] Implement Add Driver dialog (Dialog/Sheet) with form: **name**, **email**, phone, vehicle type, active (and truck number if in DB).
- [ ] useCreateDriver: accept optional `userId` and use `user_id: userId ?? null` in insert; include `email` in the insert payload.
- [ ] On submit, call useCreateDriver with no userId; close dialog and show success (e.g. toast).
- [ ] Optionally add edit driver (useUpdateDriver) from the same or another dialog for name/email/phone/vehicle/active.

### Phase 2 – Give app access (backend)

- [ ] Create Supabase Edge Function (or Next.js API route with service role): input `{ driverId, email, password? }`; create auth user; optionally create profile; update `drivers.user_id` for that `driverId`; return `user.id` or success.
- [ ] If using RLS: ensure the Edge Function or a `SECURITY DEFINER` function can update `drivers.user_id` (or call from service role client in the function).

### Phase 3 – Give app access (dispatch app UI)

- [ ] Extend driver type / API to include `user_id` (or “hasAccess”) so the UI can show “Give app access” vs “App access enabled”.
- [ ] On driver card: if no `user_id`, show “Give app access” (disabled or prompt “Add email first” if `!driver.email`). When opening the dialog, pre-fill email from `driver.email`; user can edit and set temporary password; call Edge Function then update driver’s `user_id` (or refetch drivers); show success.
- [ ] If `user_id` present: show “App access enabled” and optionally “Revoke access” (set `user_id` to null via useUpdateDriver or dedicated mutation).

### Phase 4 – Driver app (your app)

- [ ] Login with Supabase Auth; resolve driver: `drivers` where `user_id = auth.uid()`.
- [ ] Orders query: `orders` where `assigned_driver_id = driver.id`.
- [ ] RLS on `orders` and `drivers` so drivers only see their own row and their assigned orders.

### Phase 5 – Optional

- [ ] Add “Create login for driver app” in the Add Driver dialog (Option A): after creating driver, if checked, use the **email from the form** and call same “give access” flow (temporary password or magic link) and set new driver’s `user_id`.
- [ ] Regenerate Supabase types after adding the `email` column (and for any other column changes, e.g. `truck_number`).

---

## Summary

| Feature              | Where                | What to do |
|---------------------|----------------------|------------|
| Add Driver          | Fleet page + dialog  | Form (name, **email**, phone, vehicle type, active) → useCreateDriver with user_id null. Store email so “Give app access” can use it for login. |
| Give app access     | Fleet card + backend | Edge Function (or API) creates auth user, updates drivers.user_id; UI calls it and refreshes. |
| Driver app login    | Your driver app      | Supabase Auth; resolve driver by user_id; load orders by assigned_driver_id; RLS for security. |

This keeps the dispatch app as the place to add drivers and grant/revoke app access, and your existing driver app only needs to use the same Supabase project and the `drivers.user_id` + `orders.assigned_driver_id` link to show each driver their orders.
