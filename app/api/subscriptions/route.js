import { NextResponse } from 'next/server';
import { toggleFlightAlert, getUserAlertSubscriptions } from '@/lib/subscriptionManager';

/**
 * POST /api/subscriptions — Toggle flight alert on/off
 * Body: { flightId, userId, enable }
 */
export async function POST(request) {
  try {
    const { flightId, userId, enable } = await request.json();

    if (!flightId || !userId) {
      return NextResponse.json(
        { success: false, error: 'flightId and userId are required' },
        { status: 400 }
      );
    }

    const result = await toggleFlightAlert(flightId, userId, enable);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Subscription toggle error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/subscriptions?userId=... — List user's alert subscriptions
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const subscriptions = await getUserAlertSubscriptions(userId);
    return NextResponse.json({ success: true, subscriptions });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
