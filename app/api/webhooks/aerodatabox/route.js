import { NextResponse } from 'next/server';
import { updateFlightStatusInStore, getWebhooksFromStore } from '@/lib/store';

export async function POST(request) {
  try {
    const payload = await request.json();

    let flightNumber = payload.flightNumber || payload.flight?.number || payload.flight?.iata || payload.number;
    let status = (payload.status || payload.flight?.status || 'UPDATED').toUpperCase();
    let actualDep = payload.actualDep || payload.flight?.departure?.actualTimeLocal || payload.departure?.actualTime;
    let actualArr = payload.actualArr || payload.flight?.arrival?.actualTimeLocal || payload.arrival?.actualTime;

    if (!flightNumber) {
      return NextResponse.json({ success: false, error: 'flightNumber missing from payload' }, { status: 400 });
    }

    // Map status string variations
    if (status.includes('ARRIV') || status.includes('LAND')) status = 'LANDED';
    else if (status.includes('DEPART') || status.includes('ENROUTE') || status.includes('AIRBORNE')) status = 'DEPARTED';
    else if (status.includes('DELAY')) status = 'DELAYED';
    else if (status.includes('CANCEL')) status = 'CANCELLED';

    const result = await updateFlightStatusInStore(flightNumber, status, actualDep, actualArr);

    return NextResponse.json({
      success: true,
      message: `Updated flight status for ${result.flight_number}`,
      status: result.status,
      updated_count: result.updated_count
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function GET() {
  const result = await getWebhooksFromStore();
  return NextResponse.json(result);
}
