import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromRequest } from '@/lib/driver-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const result = await getDriverFromRequest(request);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status }
    );
  }

  const { driver } = result;
  const filter = request.nextUrl.searchParams.get('filter');

  if (!filter || !['today', 'past', 'upcoming'].includes(filter)) {
    return NextResponse.json(
      { error: 'Missing or invalid filter. Use filter=today|past|upcoming' },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().split('T')[0];

  let query = supabaseAdmin
    .from('orders')
    .select('*')
    .eq('assigned_driver_id', driver.id);

  if (filter === 'today') {
    query = query.eq('scheduled_date', today);
  } else if (filter === 'past') {
    query = query.or(`scheduled_date.lt.${today},stage.eq.completed`);
    query = query.order('scheduled_date', { ascending: false });
  } else {
    query = query.gt('scheduled_date', today);
    query = query.order('scheduled_date', { ascending: true });
  }

  const { data: orders, error: ordersError } = await query;

  if (ordersError) {
    console.error('orders query error:', ordersError);
    return NextResponse.json(
      { error: 'Failed to load orders' },
      { status: 500 }
    );
  }

  const transformedOrders = (orders || []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    customer: {
      name: o.customer_name,
      id: o.customer_id || '',
      address: o.customer_address || '',
      phone: o.customer_phone || '',
      coordinates: { lat: o.customer_lat || 0, lng: o.customer_lng || 0 },
    },
    items: o.items || [],
    stage: o.stage,
    scheduledDate: o.scheduled_date,
    assignedDay: o.assigned_day,
    comments: o.comments || '',
    orderType: o.order_type,
    rsm: o.rsm || '',
    invoicePhotoUrl: o.invoice_photo_url,
    orderDocumentUrl: o.order_document_url,
    presellNumber: o.presell_number,
    pickingColumn: o.picking_column,
    createdAt: o.created_at,
  }));

  return NextResponse.json({ orders: transformedOrders });
}
