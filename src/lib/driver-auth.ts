import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface DriverFromAuth {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vehicleType: string;
  isActive: boolean;
  appAccessEnabled: boolean;
  userId: string;
}

type DriverAuthResult =
  | { driver: DriverFromAuth; user: { id: string; user_metadata: Record<string, unknown> }; error?: never }
  | { driver?: never; user?: never; error: { status: number; message: string } };

export async function getDriverFromRequest(request: NextRequest): Promise<DriverAuthResult> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: { status: 401, message: 'Missing or invalid Authorization header' } };
  }

  const token = authHeader.slice(7);

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: { status: 401, message: 'Invalid or expired token' } };
  }

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', user.id)
    .eq('app_access_enabled', true)
    .single();

  if (driverError || !driver) {
    return { error: { status: 403, message: 'No driver access' } };
  }

  return {
    driver: {
      id: driver.id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      vehicleType: driver.vehicle_type,
      isActive: driver.is_active,
      appAccessEnabled: driver.app_access_enabled,
      userId: user.id,
    },
    user: { id: user.id, user_metadata: user.user_metadata },
  };
}
