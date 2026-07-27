import { NextResponse } from 'next/server';
import { updateFlightStatusInStore, getWebhooksFromStore } from '@/lib/store';

export async function POST(request) {
  try {
    const payload = await request.json();

    // ── Handle REAL AeroDataBox FlightNotificationContract format ──
    // Shape: { flights: [...], subscription: { id, ... }, balance: { ... } }
    if (payload.flights && Array.isArray(payload.flights)) {
      const results = [];

      for (const flight of payload.flights) {
        const flightNumber = flight.number || flight.callSign;
        if (!flightNumber) continue;

        let status = (flight.status || 'UPDATED').toUpperCase();

        // Map AeroDataBox status enum to our status
        if (status === 'ARRIVED' || status === 'LANDED') status = 'LANDED';
        else if (status === 'DEPARTED' || status === 'ENROUTE') status = 'DEPARTED';
        else if (status === 'DELAYED') status = 'DELAYED';
        else if (status === 'CANCELED' || status === 'CANCELEDUNCERTAIN') status = 'CANCELLED';
        else if (status === 'DIVERTED') status = 'DELAYED';
        else if (status === 'BOARDING' || status === 'GATECLOSED' || status === 'CHECKIN') status = 'SCHEDULED';
        else if (status === 'APPROACHING') status = 'DEPARTED';

        const actualDep = flight.departure?.actualTimeUtc || flight.departure?.actualTimeLocal || null;
        const actualArr = flight.arrival?.actualTimeUtc || flight.arrival?.actualTimeLocal || null;

        const result = await updateFlightStatusInStore(flightNumber, status, actualDep, actualArr);
        results.push(result);
      }

      // Log the full notification for audit
      const { supabaseServer } = await import('@/lib/supabase/server');
      try {
        await supabaseServer.from('aerodatabox_webhooks').insert({
          received_at: new Date().toISOString(),
          event_type: 'FlightNotificationContract',
          flight_number: payload.flights.map(f => f.number).filter(Boolean).join(', '),
          status: payload.flights.map(f => f.status).filter(Boolean).join(', '),
          payload: payload
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: `Processed ${results.length} flight update(s) from AeroDataBox`,
        results
      });
    }

    // ── Handle SIMULATED / manual webhook format (existing) ──
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
