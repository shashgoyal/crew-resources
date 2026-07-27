import { NextResponse } from 'next/server';
import { activatePendingSubscriptions, cleanupLandedSubscriptions } from '@/lib/subscriptionManager';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/manage-subscriptions
 *
 * Periodically called (every 15 min) to:
 * 1. Activate pending subscriptions for flights departing within 1 hour
 * 2. Cleanup subscriptions for flights that have landed
 *
 * Protected by CRON_SECRET header or query param.
 */
export async function GET(request) {
  try {
    // Verify cron secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || request.headers.get('x-cron-secret');

    if (CRON_SECRET && secret !== CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Running subscription manager...');

    // 1. Activate pending subscriptions
    const activateResult = await activatePendingSubscriptions();
    console.log('[Cron] Activation result:', activateResult);

    // 2. Cleanup landed subscriptions
    const cleanupResult = await cleanupLandedSubscriptions();
    console.log('[Cron] Cleanup result:', cleanupResult);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      activated: activateResult,
      cleaned: cleanupResult
    });
  } catch (err) {
    console.error('[Cron] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
