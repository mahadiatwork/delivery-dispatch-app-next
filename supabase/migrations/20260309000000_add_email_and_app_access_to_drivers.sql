-- Add email and app_access_enabled columns to drivers table
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS app_access_enabled BOOLEAN NOT NULL DEFAULT false;

-- Create a unique index on email (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS drivers_email_unique ON public.drivers (email) WHERE email IS NOT NULL;
