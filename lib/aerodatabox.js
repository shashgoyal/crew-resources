/**
 * AeroDataBox Flight Alert PUSH API client.
 * Wraps the RapidAPI webhook subscription endpoints.
 */

const RAPIDAPI_KEY = process.env.AERODATABOX_RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'aerodatabox.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

function headers() {
  return {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
    'Content-Type': 'application/json'
  };
}

/**
 * Create a webhook subscription for a flight by number.
 * AeroDataBox will POST notifications to `webhookUrl` when the flight updates.
 *
 * @param {string} flightNumber - e.g. "6E 2451" or "6E2451"
 * @param {string} webhookUrl - public URL that accepts POST
 * @param {number} [maxRetries=0] - retry attempts on delivery failure (0-2, each costs 1 credit)
 * @returns {{ subscriptionId: string, raw: object }} - the AeroDataBox subscription ID + full response
 */
export async function createFlightSubscription(flightNumber, webhookUrl, maxRetries = 0) {
  // Normalize: "6E 2451" → "6E2451" (AeroDataBox accepts both, but no-space is canonical)
  const normalizedFlight = flightNumber.replace(/\s+/g, '');

  const url = `${BASE_URL}/subscriptions/webhook/FlightByNumber/${encodeURIComponent(normalizedFlight)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      url: webhookUrl,
      maxDeliveryRetries: Math.min(maxRetries, 2)
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AeroDataBox create subscription failed (${res.status}): ${text}`);
  }

  // AeroDataBox returns 199 for the notification contract format,
  // 200 for subscription info, 204 for no-content success
  if (res.status === 204) {
    return { subscriptionId: null, raw: null };
  }

  const data = await res.json();

  // The subscription ID is in `data.subscription.id` (FlightNotificationContract)
  // or directly in `data.id` (subscription object)
  const subscriptionId = data?.subscription?.id || data?.id || null;

  return { subscriptionId, raw: data };
}

/**
 * Get information about an existing webhook subscription.
 *
 * @param {string} subscriptionId - UUID returned when subscription was created
 * @returns {object|null} - subscription info or null if not found
 */
export async function getSubscription(subscriptionId) {
  const url = `${BASE_URL}/subscriptions/webhook/${subscriptionId}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: headers()
  });

  if (res.status === 204 || res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AeroDataBox get subscription failed (${res.status}): ${text}`);
  }

  return await res.json();
}

/**
 * Remove (delete) a webhook subscription.
 *
 * @param {string} subscriptionId - UUID of the subscription to remove
 * @returns {boolean} - true if successfully removed
 */
export async function removeSubscription(subscriptionId) {
  const url = `${BASE_URL}/subscriptions/webhook/${subscriptionId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers()
  });

  if (!res.ok && res.status !== 204 && res.status !== 200) {
    const text = await res.text();
    throw new Error(`AeroDataBox remove subscription failed (${res.status}): ${text}`);
  }

  return true;
}

/**
 * Check remaining alert credit balance.
 *
 * @returns {{ creditsRemaining: number, lastRefilledUtc: string, lastDeductedUtc: string }}
 */
export async function getBalance() {
  const url = `${BASE_URL}/subscriptions/balance`;

  const res = await fetch(url, {
    method: 'GET',
    headers: headers()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AeroDataBox get balance failed (${res.status}): ${text}`);
  }

  return await res.json();
}
