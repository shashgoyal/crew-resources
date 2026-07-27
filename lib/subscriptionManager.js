/**
 * Subscription lifecycle manager.
 * - activatePendingSubscriptions: subscribes flights departing within 1 hour
 * - cleanupLandedSubscriptions: removes subscriptions for landed/completed flights
 * - toggleFlightAlert: user-facing toggle to mark a flight for tracking
 */

import { supabaseServer } from './supabase/server.js';
import { createFlightSubscription, removeSubscription } from './aerodatabox.js';

const WEBHOOK_BASE_URL = process.env.AERODATABOX_WEBHOOK_BASE_URL || 'http://localhost:3000';

/**
 * Activate pending subscriptions for flights departing within the next hour.
 * Called periodically by the cron endpoint.
 *
 * @returns {{ activated: number, errors: string[] }}
 */
export async function activatePendingSubscriptions() {
  const activated = [];
  const errors = [];

  try {
    // Get all pending subscriptions
    const { data: pendingSubs, error } = await supabaseServer
      .from('alert_subscriptions')
      .select('*, flights!inner(flight_date, std, flight_number, status)')
      .eq('status', 'pending');

    if (error) {
      errors.push(`Query error: ${error.message}`);
      return { activated: activated.length, errors };
    }

    if (!pendingSubs || pendingSubs.length === 0) {
      return { activated: activated.length, errors };
    }

    const now = new Date();

    for (const sub of pendingSubs) {
      try {
        const flight = sub.flights;
        if (!flight) continue;

        // Build the departure datetime from flight_date + std
        const depDatetime = new Date(`${flight.flight_date}T${flight.std}+05:30`); // IST offset for IndiGo
        const hoursUntilDep = (depDatetime - now) / (1000 * 60 * 60);

        // Only activate if departure is within the next 1 hour (and not already past by more than 30 min)
        if (hoursUntilDep > 1 || hoursUntilDep < -0.5) {
          continue;
        }

        // Skip if flight is already landed/cancelled
        if (['LANDED', 'CANCELLED'].includes(flight.status)) {
          await supabaseServer
            .from('alert_subscriptions')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', sub.id);
          continue;
        }

        // Create AeroDataBox webhook subscription
        const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhooks/aerodatabox`;
        const { subscriptionId, raw } = await createFlightSubscription(
          sub.flight_number,
          webhookUrl
        );

        if (subscriptionId) {
          await supabaseServer
            .from('alert_subscriptions')
            .update({
              status: 'active',
              adb_subscription_id: subscriptionId,
              webhook_url: webhookUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', sub.id);

          activated.push(sub.flight_number);
          console.log(`[SubscriptionManager] Activated subscription for ${sub.flight_number} → ${subscriptionId}`);
        } else {
          // 204 response — subscription accepted but no ID returned
          await supabaseServer
            .from('alert_subscriptions')
            .update({
              status: 'active',
              webhook_url: webhookUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', sub.id);

          activated.push(sub.flight_number);
        }
      } catch (err) {
        errors.push(`${sub.flight_number}: ${err.message}`);
        console.error(`[SubscriptionManager] Error activating ${sub.flight_number}:`, err.message);

        // Mark as failed so it doesn't retry indefinitely
        await supabaseServer
          .from('alert_subscriptions')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', sub.id);
      }
    }
  } catch (err) {
    errors.push(`Unexpected error: ${err.message}`);
  }

  return { activated: activated.length, activatedFlights: activated, errors };
}

/**
 * Cleanup subscriptions for flights that have landed.
 * Removes the AeroDataBox webhook and marks the subscription as completed.
 *
 * @returns {{ cleaned: number, errors: string[] }}
 */
export async function cleanupLandedSubscriptions() {
  const cleaned = [];
  const errors = [];

  try {
    // Get active subscriptions where the linked flight has landed
    const { data: activeSubs, error } = await supabaseServer
      .from('alert_subscriptions')
      .select('*, flights!inner(status, flight_number)')
      .eq('status', 'active');

    if (error) {
      errors.push(`Query error: ${error.message}`);
      return { cleaned: cleaned.length, errors };
    }

    if (!activeSubs || activeSubs.length === 0) {
      return { cleaned: cleaned.length, errors };
    }

    for (const sub of activeSubs) {
      try {
        const flightStatus = sub.flights?.status;

        // Only cleanup if the flight has landed, arrived, or was cancelled
        if (!['LANDED', 'CANCELLED', 'ARRIVED'].includes(flightStatus)) {
          continue;
        }

        // Remove AeroDataBox subscription if we have an ID
        if (sub.adb_subscription_id) {
          try {
            await removeSubscription(sub.adb_subscription_id);
          } catch (removeErr) {
            // Non-fatal: subscription may have already been removed by AeroDataBox
            console.warn(`[SubscriptionManager] Remove warning for ${sub.flight_number}:`, removeErr.message);
          }
        }

        // Mark as completed
        await supabaseServer
          .from('alert_subscriptions')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', sub.id);

        cleaned.push(sub.flight_number);
        console.log(`[SubscriptionManager] Cleaned up subscription for ${sub.flight_number}`);
      } catch (err) {
        errors.push(`${sub.flight_number}: ${err.message}`);
      }
    }
  } catch (err) {
    errors.push(`Unexpected error: ${err.message}`);
  }

  return { cleaned: cleaned.length, cleanedFlights: cleaned, errors };
}

/**
 * Toggle flight alert tracking on or off for a specific flight.
 *
 * @param {string} flightId - UUID of the flight
 * @param {string} userId - UUID of the user/profile
 * @param {boolean} enable - true to subscribe, false to unsubscribe
 * @returns {{ success: boolean, subscription?: object }}
 */
export async function toggleFlightAlert(flightId, userId, enable) {
  if (enable) {
    // Get flight details for the subscription record
    const { data: flight } = await supabaseServer
      .from('flights')
      .select('flight_number, flight_date, std')
      .eq('id', flightId)
      .single();

    if (!flight) {
      throw new Error('Flight not found');
    }

    // Check if subscription already exists
    const { data: existing } = await supabaseServer
      .from('alert_subscriptions')
      .select('*')
      .eq('flight_id', flightId)
      .maybeSingle();

    if (existing) {
      // Re-enable if it was failed/completed
      if (existing.status === 'failed' || existing.status === 'completed') {
        const { data } = await supabaseServer
          .from('alert_subscriptions')
          .update({
            status: 'pending',
            adb_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        return { success: true, subscription: data };
      }
      return { success: true, subscription: existing };
    }

    // Insert new pending subscription
    const { data, error } = await supabaseServer
      .from('alert_subscriptions')
      .insert({
        user_id: userId,
        flight_id: flightId,
        flight_number: flight.flight_number,
        flight_date: flight.flight_date,
        std: flight.std,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { success: true, subscription: data };
  } else {
    // Disable: remove AeroDataBox subscription if active, then delete the record
    const { data: existing } = await supabaseServer
      .from('alert_subscriptions')
      .select('*')
      .eq('flight_id', flightId)
      .maybeSingle();

    if (existing?.adb_subscription_id && existing.status === 'active') {
      try {
        await removeSubscription(existing.adb_subscription_id);
      } catch (err) {
        console.warn('[SubscriptionManager] Remove warning:', err.message);
      }
    }

    if (existing) {
      await supabaseServer
        .from('alert_subscriptions')
        .delete()
        .eq('id', existing.id);
    }

    return { success: true };
  }
}

/**
 * Get all alert subscriptions for a user.
 *
 * @param {string} userId - UUID of the user/profile
 * @returns {object[]} - array of subscription records
 */
export async function getUserAlertSubscriptions(userId) {
  const { data, error } = await supabaseServer
    .from('alert_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[SubscriptionManager] Error fetching subscriptions:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Cancel and delete subscription for a flight (e.g. when a flight is removed due to roster update).
 * If the subscription is active at AeroDataBox, sends a DELETE request to AeroDataBox API to stop alerts and save credits.
 *
 * @param {string} flightId - UUID of the flight being deleted
 */
export async function cancelSubscriptionForFlight(flightId) {
  try {
    const { data: sub } = await supabaseServer
      .from('alert_subscriptions')
      .select('*')
      .eq('flight_id', flightId)
      .maybeSingle();

    if (sub) {
      if (sub.adb_subscription_id && sub.status === 'active') {
        try {
          await removeSubscription(sub.adb_subscription_id);
          console.log(`[SubscriptionManager] Removed active AeroDataBox webhook ${sub.adb_subscription_id} for stale flight ${sub.flight_number}`);
        } catch (err) {
          console.warn(`[SubscriptionManager] Warning removing webhook for stale flight ${sub.flight_number}:`, err.message);
        }
      }
      await supabaseServer.from('alert_subscriptions').delete().eq('id', sub.id);
      console.log(`[SubscriptionManager] Deleted tracking subscription record for stale flight ${sub.flight_number}`);
    }
  } catch (e) {
    console.error('[SubscriptionManager] Error canceling subscription for flight:', e?.message);
  }
}

