import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverId } = body as { driverId: string };

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 });
    }

    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const authUserId = driver.user_id;

    const { error: updateError } = await supabaseAdmin
      .from('drivers')
      .update({ user_id: null, app_access_enabled: false })
      .eq('id', driverId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to revoke access: ${updateError.message}` },
        { status: 500 }
      );
    }

    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('revoke-access error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
