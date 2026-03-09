import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromRequest } from '@/lib/driver-auth';

export async function GET(request: NextRequest) {
  const result = await getDriverFromRequest(request);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status }
    );
  }

  const { driver, user } = result;
  const mustChangePassword = user.user_metadata?.must_change_password === true;

  return NextResponse.json({
    driver: {
      id: driver.id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      vehicleType: driver.vehicleType,
      isActive: driver.isActive,
    },
    mustChangePassword,
  });
}
