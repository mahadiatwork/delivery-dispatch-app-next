import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverId, email, password } = body as {
      driverId: string;
      email: string;
      password?: string;
    };

    if (!driverId || !email) {
      return NextResponse.json(
        { error: 'driverId and email are required' },
        { status: 400 }
      );
    }

    const emailTrimmed = email.trim().toLowerCase();

    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    if (driver.user_id && driver.app_access_enabled) {
      return NextResponse.json(
        { error: 'Driver already has app access' },
        { status: 409 }
      );
    }

    const generatedPassword = password || generateTempPassword();

    let authUser: { user: { id: string } };

    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailTrimmed,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        // Auth user exists from a previous revoke — find, delete, and recreate
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existing = users?.find(u => u.email === emailTrimmed);

        if (existing) {
          await supabaseAdmin.auth.admin.deleteUser(existing.id);
        }

        const { data: retried, error: retryError } = await supabaseAdmin.auth.admin.createUser({
          email: emailTrimmed,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: { must_change_password: true },
        });

        if (retryError || !retried) {
          return NextResponse.json(
            { error: `Failed to recreate auth user: ${retryError?.message}` },
            { status: 500 }
          );
        }
        authUser = retried;
      } else {
        return NextResponse.json(
          { error: `Failed to create auth user: ${authError.message}` },
          { status: 500 }
        );
      }
    } else {
      authUser = created;
    }

    await supabaseAdmin.from('profiles').upsert({
      user_id: authUser.user.id,
      display_name: driver.name,
    });

    const { error: updateError } = await supabaseAdmin
      .from('drivers')
      .update({
        user_id: authUser.user.id,
        email: emailTrimmed,
        app_access_enabled: true,
      })
      .eq('id', driverId);

    if (updateError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { error: `Failed to link driver: ${updateError.message}` },
        { status: 500 }
      );
    }

    let emailSent = false;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'DispatchPro <onboarding@resend.dev>',
            to: [emailTrimmed],
            subject: 'Your DispatchPro Driver App Login',
            html: `
              <h2>Welcome to DispatchPro Driver App</h2>
              <p>Your driver account has been set up. Use the following credentials to log in:</p>
              <p><strong>Email:</strong> ${emailTrimmed}</p>
              <p><strong>Temporary Password:</strong> ${generatedPassword}</p>
              <p><em>You will be required to change your password on first login.</em></p>
              <br/>
              <p>— DispatchPro Team</p>
            `,
          }),
        });
        emailSent = emailResponse.ok;
      } catch {
        // Email sending is best-effort
      }
    }

    return NextResponse.json({
      success: true,
      tempPassword: generatedPassword,
      emailSent,
      userId: authUser.user.id,
    });
  } catch (err) {
    console.error('give-access error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
