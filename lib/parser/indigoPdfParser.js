/**
 * IndiGo PCSR PDF Parser — adapter for the Landed flight tracker.
 *
 * Delegates all heavy parsing to pcsrParser.js (ported from crew-allowance),
 * which is the production-grade, battle-tested parser for IndiGo Personal
 * Crew Schedule Report PDFs. Supports both EOM and GRID formats.
 *
 * This module adapts the pcsrParser output shape to the format that
 * lib/store.js and the Landed API routes expect.
 */

import { parsePcsrPdf } from './pcsrParser.js';

/**
 * Parse an IndiGo Schedule Report PDF buffer.
 *
 * @param {Buffer} pdfBuffer - Raw PDF file bytes
 * @returns {Promise<{
 *   metadata: { staff_id, full_name, base_role_aircraft, period_start, period_end },
 *   flights: Array<{ flight_number, flight_date, dep_airport, arr_airport, std, sta, aircraft_type, status }>,
 *   duties: Array,
 *   crewAssignments: Array,
 *   transfers: Array,
 *   summary: { total_flights, duty_days, off_days, standby_days }
 * }>}
 */
export async function parseIndigoSchedule(pdfBuffer) {
  // Convert Node.js Buffer → ArrayBuffer for pdfjs-dist
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  );

  const result = await parsePcsrPdf(arrayBuffer);

  // ── Map pilot info → metadata ──────────────────────────────────────────────
  const pilot = result.pilot || {};
  const [year, mo] = (result.month || '2025-07').split('-').map(Number);

  // Reconstruct period_start / period_end from month
  const daysInMonth = new Date(year, mo, 0).getDate();
  const period_start = `01/${String(mo).padStart(2, '0')}/${year}`;
  const period_end = `${daysInMonth}/${String(mo).padStart(2, '0')}/${year}`;

  // Reconstruct base_role_aircraft in "BASE,ROLE,FLEET" format
  const home_base = pilot.home_base || 'DEL';

  // Extract role and fleet from the raw PCSR header text.
  // The pcsrParser doesn't parse role separately, so we read it from the
  // raw header line like "52147 GOYAL, SARTHAK JAI,FO,ATR" or "DEL-FO-320".
  let role = 'FO';
  let fleet = pilot.fleet || '320';
  const rawText = result._rawText || '';
  const headerMatch = rawText.match(
    /\b\d{4,6}\s+[A-Z,\s]+?\s+([A-Z]{3})[,\-](CP|FO|LD|SE|CA)[,\-]([A-Z0-9]{3})\b/
  );
  if (headerMatch) {
    role = headerMatch[2];
    fleet = headerMatch[3];
  }
  const base_role_aircraft = `${home_base},${role},${fleet}`;

  const metadata = {
    staff_id: pilot.employee_id || '',
    full_name: pilot.name || '',
    base_role_aircraft,
    period_start,
    period_end,
  };

  // ── Map sectors → flights ──────────────────────────────────────────────────
  const flights = (result.sectors || []).map(s => ({
    flight_number: formatFlightNumber(s.flight_no),
    flight_date: s.date,
    dep_airport: s.dep || '',
    arr_airport: s.arr || '',
    std: s.std_local || s.atd_local || '00:00',
    sta: s.sta_local || s.ata_local || '00:00',
    aircraft_type: fleet,
    status: s.is_dhf ? 'DHF' : s.is_dht ? 'DHT' : 'SCHEDULED',
  }));

  // ── Build duties from sectors (group by date) ──────────────────────────────
  const flightsByDate = new Map();
  for (const f of flights) {
    if (!flightsByDate.has(f.flight_date)) flightsByDate.set(f.flight_date, []);
    flightsByDate.get(f.flight_date).push(f);
  }

  const duties = [];
  for (const [date, dateFlights] of flightsByDate) {
    const [y, m, d] = date.split('-');
    duties.push({
      date,
      date_display: `${d}/${m}`,
      duty_code: 'FLIGHT',
      report_time: dateFlights[0]?.std || null,
      release_time: dateFlights[dateFlights.length - 1]?.sta || null,
      flight_count: dateFlights.length,
      raw_tokens: dateFlights.map(f => f.flight_number),
    });
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const allDates = new Set();
  for (let day = 1; day <= daysInMonth; day++) {
    allDates.add(`${year}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  const flyingDates = new Set(flights.map(f => f.flight_date));
  const offDays = allDates.size - flyingDates.size;

  const summary = {
    total_flights: flights.length,
    duty_days: flyingDates.size,
    off_days: offDays,
    standby_days: 0,
  };

  return {
    metadata,
    flights,
    duties,
    crewAssignments: [],
    transfers: [],
    summary,
  };
}

/**
 * Normalise flight number to "6E XXXX" format (with space).
 */
function formatFlightNumber(fltNo) {
  if (!fltNo) return '';
  // Strip "6E" prefix and leading zeros, then re-add with space
  const num = fltNo.replace(/^6E\s*/i, '').replace(/^0+/, '');
  return `6E ${num}`;
}
