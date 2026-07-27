import { NextResponse } from 'next/server';
import { getDashboardFlights } from '@/lib/store';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const staffId = searchParams.get('staff_id') || searchParams.get('staffId');
    const email = searchParams.get('email');

    const result = await getDashboardFlights(date, status, staffId, email);

    return NextResponse.json({
      success: true,
      flights: result.flights || [],
      profiles: result.profile ? [result.profile] : [],
      profile: result.profile || null
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
