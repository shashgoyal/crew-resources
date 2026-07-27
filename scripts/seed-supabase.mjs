// ponytail: load .env.local without external dotenv package
import fs from 'fs';
import { parseIndigoSchedule } from '../lib/parser/indigoPdfParser.js';
import { createClient } from '@supabase/supabase-js';

if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment or .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function seed() {
  const pdfPath = process.argv[2] || 'ScheduleReport.pdf';
  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}. Usage: node scripts/seed-supabase.mjs <path-to-pdf>`);
    process.exit(1);
  }

  console.log(`Reading schedule PDF: ${pdfPath} ...`);
  const buffer = fs.readFileSync(pdfPath);
  const parsed = await parseIndigoSchedule(buffer);

  console.log("Parsed Metadata:", parsed.metadata);
  console.log("Parsed Flights Count:", parsed.flights.length);

  // 1. Create Profile
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .upsert({
      staff_id: parsed.metadata.staff_id || '52147',
      full_name: parsed.metadata.full_name || 'GOYAL, SARTHAK',
      role: 'FO',
      base_airport: 'JAI',
      aircraft_type: 'ATR'
    }, { onConflict: 'staff_id' })
    .select()
    .single();

  if (profErr) {
    console.error("Profile upsert error:", profErr);
  } else {
    console.log("Profile created/found:", profile.id, profile.full_name);
  }

  // 2. Insert Schedule
  const { data: schedule, error: schedErr } = await supabase
    .from('schedules')
    .insert({
      user_id: profile?.id,
      file_name: pdfPath,
      period_start: '2025-07-01',
      period_end: '2025-07-31',
      landings_count: parsed.flights.length,
      raw_text: JSON.stringify(parsed.metadata)
    })
    .select()
    .single();

  if (schedErr) console.error("Schedule insert error:", schedErr);

  // 3. Insert Flights
  const flightsToInsert = parsed.flights.map(f => ({
    schedule_id: schedule?.id,
    user_id: profile?.id,
    flight_number: f.flight_number,
    flight_date: f.flight_date,
    dep_airport: f.dep_airport,
    arr_airport: f.arr_airport,
    std: f.std,
    sta: f.sta,
    aircraft_type: f.aircraft_type,
    status: f.status
  }));

  const { data: insertedFlights, error: flightErr } = await supabase
    .from('flights')
    .insert(flightsToInsert)
    .select();

  if (flightErr) {
    console.error("Flight insert error:", flightErr);
  } else {
    console.log(`Successfully seeded ${insertedFlights.length} flights into Supabase!`);
  }
}

seed().catch(console.error);
