import fs from 'fs';
import { parseIndigoSchedule } from './parser/indigoPdfParser.js';
import { supabaseServer } from './supabase/server.js';
import { cancelSubscriptionForFlight } from './subscriptionManager.js';

let initialized = false;
let inMemoryStore = {
  profile: null,
  schedules: [],
  flights: [],
  duties: [],
  webhooks: []
};

export async function initStore() {
  if (initialized) return;
  initialized = true;
}

export async function syncProfileToStore(p = {}) {
  await initStore();

  const reqEmail = p.email ? p.email.trim().toLowerCase() : null;
  const reqStaffId = p.staff_id ? p.staff_id.trim() : null;

  try {
    let existing = null;
    if (reqEmail) {
      const { data } = await supabaseServer.from('profiles').select('*').eq('email', reqEmail).maybeSingle();
      if (data) existing = data;
    }
    if (!existing && reqStaffId) {
      const { data } = await supabaseServer.from('profiles').select('*').eq('staff_id', reqStaffId).maybeSingle();
      if (data) existing = data;
    }

    if (existing) {
      const hasRealName = p.full_name && p.full_name.trim() && p.full_name.trim() !== reqEmail?.split('@')[0].toUpperCase();

      const isPlaceholderEmail = reqEmail && reqEmail.endsWith('@landed.aero');

      const updateData = {
        email: (isPlaceholderEmail && existing.email) ? existing.email : (reqEmail || existing.email),
        staff_id: reqStaffId || existing.staff_id,
        full_name: hasRealName ? p.full_name.trim() : existing.full_name,
        base_airport: p.base_airport || existing.base_airport,
        role: p.role || existing.role,
        aircraft_type: p.aircraft_type || existing.aircraft_type,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseServer
        .from('profiles')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();
      if (!error && data) {
        inMemoryStore.profile = { ...inMemoryStore.profile, ...data };
        return data;
      }
      inMemoryStore.profile = { ...inMemoryStore.profile, ...existing };
      return existing;
    } else {
      const staffId = reqStaffId || '52147';
      const email = reqEmail || `${staffId}@landed.aero`;
      const profileData = {
        email,
        staff_id: staffId,
        full_name: (p.full_name && p.full_name.trim()) ? p.full_name.trim() : (reqEmail ? reqEmail.split('@')[0].toUpperCase() : 'GOYAL, SARTHAK'),
        base_airport: p.base_airport || 'DEL',
        role: p.role || 'FO',
        aircraft_type: p.aircraft_type || '320',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseServer
        .from('profiles')
        .insert([profileData])
        .select()
        .single();
      if (!error && data) {
        inMemoryStore.profile = { ...inMemoryStore.profile, ...data };
        return data;
      }
      const fallbackNew = { id: null, ...profileData };
      inMemoryStore.profile = { ...inMemoryStore.profile, ...fallbackNew };
      return fallbackNew;
    }
  } catch (err) {
    console.error("Supabase profile sync note/error:", err?.message);
  }

  const staffId = reqStaffId || '52147';
  const email = reqEmail || `${staffId}@landed.aero`;
  const fallback = {
    id: null,
    email,
    staff_id: staffId,
    full_name: p.full_name || 'GOYAL, SARTHAK',
    base_airport: p.base_airport || 'DEL',
    role: p.role || 'FO',
    aircraft_type: p.aircraft_type || '320'
  };
  inMemoryStore.profile = { ...inMemoryStore.profile, ...fallback };
  return fallback;
}

export async function checkProfileExists(email, staffId) {
  await initStore();
  try {
    let checkedDb = false;
    if (email) {
      const { data, error } = await supabaseServer.from('profiles').select('*').eq('email', email.trim().toLowerCase()).maybeSingle();
      if (!error) checkedDb = true;
      if (data) return { exists: true, field: 'Email', profile: data };
    }
    if (staffId) {
      const { data, error } = await supabaseServer.from('profiles').select('*').eq('staff_id', staffId.trim()).maybeSingle();
      if (!error) checkedDb = true;
      if (data) return { exists: true, field: 'Staff ID', profile: data };
    }

    if (checkedDb) {
      return { exists: false };
    }
  } catch (e) {}

  if (email && inMemoryStore.profile?.email === email.trim().toLowerCase()) {
    return { exists: true, field: 'Email', profile: inMemoryStore.profile };
  }
  if (staffId && inMemoryStore.profile?.staff_id === staffId.trim()) {
    return { exists: true, field: 'Staff ID', profile: inMemoryStore.profile };
  }
  return { exists: false };
}

export async function getDashboardFlights(date, status, staffId, email) {
  await initStore();

  // 1. Try Supabase
  try {
    let profile = null;
    if (email) {
      const { data: profData } = await supabaseServer
        .from('profiles')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      if (profData) profile = profData;
    }
    if (!profile && staffId) {
      const { data: profData } = await supabaseServer
        .from('profiles')
        .select('*')
        .eq('staff_id', staffId.trim())
        .maybeSingle();
      if (profData) profile = profData;
    }

    if (!profile && !email && !staffId) {
      const { data: profData } = await supabaseServer
        .from('profiles')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (profData) profile = profData;
    }

    let profileIds = [];
    if (profile?.id) profileIds.push(profile.id);

    if (profile?.staff_id) {
      const { data: altProfs } = await supabaseServer
        .from('profiles')
        .select('id')
        .eq('staff_id', profile.staff_id);
      if (altProfs) {
        altProfs.forEach(ap => {
          if (!profileIds.includes(ap.id)) profileIds.push(ap.id);
        });
      }
    }

    let query = supabaseServer
      .from('flights')
      .select('*')
      .order('flight_date', { ascending: true })
      .order('std', { ascending: true });

    if (profileIds.length > 0) {
      query = query.in('user_id', profileIds);
    } else if (email || staffId) {
      return { source: 'supabase', flights: [], profile: null };
    }

    if (date) query = query.eq('flight_date', date);
    if (status && status !== 'ALL') query = query.eq('status', status.toUpperCase());

    const { data, error } = await query;
    if (!error && data) {
      return { source: 'supabase', flights: data, profile: profile || inMemoryStore.profile };
    }
  } catch (e) {
    // Supabase table not created yet or fallback
  }

  // 2. In-Memory Fallback
  let res = [...inMemoryStore.flights];
  if (date) res = res.filter(f => f.flight_date === date);
  if (status && status !== 'ALL') res = res.filter(f => f.status === status.toUpperCase());

  return { source: 'memory', flights: res, profile: inMemoryStore.profile };
}

export async function updateFlightStatusInStore(flightNumber, status, actualDep, actualArr) {
  await initStore();

  const formattedNum = flightNumber.startsWith('6E') ? flightNumber : `6E ${flightNumber.replace(/\D/g, '')}`;

  // 1. Try Supabase update
  let supabaseUpdatedCount = 0;
  try {
    const updatePayload = { status, updated_at: new Date().toISOString() };
    if (actualDep) updatePayload.actual_dep = actualDep;
    if (actualArr) updatePayload.actual_arr = actualArr;

    const { data, error } = await supabaseServer
      .from('flights')
      .update(updatePayload)
      .eq('flight_number', formattedNum)
      .select();

    if (!error && data) {
      supabaseUpdatedCount = data.length;
    }
  } catch (e) {
    // Fallback
  }

  // 2. Update In-Memory Store
  let memoryUpdatedCount = 0;
  inMemoryStore.flights = inMemoryStore.flights.map(f => {
    if (f.flight_number === formattedNum) {
      memoryUpdatedCount++;
      return {
        ...f,
        status: status,
        actual_dep: actualDep || f.actual_dep,
        actual_arr: actualArr || f.actual_arr,
        updated_at: new Date().toISOString()
      };
    }
    return f;
  });

  // Log Webhook event
  const webhookRecord = {
    id: `wh-${Date.now()}`,
    received_at: new Date().toISOString(),
    event_type: 'FlightAlert',
    flight_number: formattedNum,
    status: status,
    payload: { flightNumber: formattedNum, status, actualDep, actualArr }
  };

  inMemoryStore.webhooks.unshift(webhookRecord);

  try {
    await supabaseServer.from('aerodatabox_webhooks').insert(webhookRecord);
  } catch (e) {}

  return {
    success: true,
    updated_count: supabaseUpdatedCount || memoryUpdatedCount,
    flight_number: formattedNum,
    status
  };
}

export async function addScheduleToStore(pdfBuffer, fileName, currentUserProfile = null) {
  await initStore();

  const parsed = await parseIndigoSchedule(pdfBuffer);

  const rawStaffId = currentUserProfile?.staff_id || parsed.metadata.staff_id || inMemoryStore.profile?.staff_id;
  const rawFullName = currentUserProfile?.full_name || parsed.metadata.full_name || inMemoryStore.profile?.full_name;
  const [base, role, fleet] = (parsed.metadata.base_role_aircraft || '').split(',');

  const profileInput = {
    email: currentUserProfile?.email || (rawStaffId ? `${rawStaffId}@landed.aero` : undefined),
    staff_id: rawStaffId,
    full_name: rawFullName,
    base_airport: base || currentUserProfile?.base_airport || inMemoryStore.profile?.base_airport || 'DEL',
    role: role || currentUserProfile?.role || inMemoryStore.profile?.role || 'FO',
    aircraft_type: fleet || currentUserProfile?.aircraft_type || inMemoryStore.profile?.aircraft_type || '320'
  };

  const profData = await syncProfileToStore(profileInput);
  const userId = profData?.id || null;

  const newParsedFlights = parsed.flights.map((f, idx) => ({
    id: `f-${Date.now()}-${idx}`,
    flight_number: f.flight_number,
    flight_date: f.flight_date,
    dep_airport: f.dep_airport,
    arr_airport: f.arr_airport,
    std: f.std,
    sta: f.sta,
    aircraft_type: f.aircraft_type,
    status: f.status || 'SCHEDULED',
    created_at: new Date().toISOString()
  }));

  const affectedDates = Array.from(new Set(newParsedFlights.map(f => f.flight_date)));
  
  let insertedCount = 0;
  let updatedCount = 0;
  let removedCount = 0;

  // 1. Try Supabase Smart Upsert & Schedule Record
  if (userId) {
    try {
      let periodStart = new Date().toISOString().split('T')[0];
      let periodEnd = new Date().toISOString().split('T')[0];
      if (parsed.metadata.period_start) {
        const [d, m, y] = parsed.metadata.period_start.split('/');
        if (d && m && y) periodStart = `${y}-${m}-${d}`;
      }
      if (parsed.metadata.period_end) {
        const [d, m, y] = parsed.metadata.period_end.split('/');
        if (d && m && y) periodEnd = `${y}-${m}-${d}`;
      }

      // Create schedule record
      const { data: sched } = await supabaseServer
        .from('schedules')
        .insert([{
          user_id: userId,
          file_name: fileName || 'Schedule.pdf',
          period_start: periodStart,
          period_end: periodEnd,
          landings_count: parsed.summary?.total_flights || newParsedFlights.length,
          raw_text: fileName
        }])
        .select()
        .single();

      const scheduleId = sched?.id || null;

      // Collect ALL profile IDs sharing this staff_id so we catch flights
      // uploaded under any prior or alternate profile for the same pilot
      const allUserIds = [userId];
      if (profData?.staff_id) {
        const { data: altProfs } = await supabaseServer
          .from('profiles')
          .select('id')
          .eq('staff_id', profData.staff_id);
        if (altProfs) {
          altProfs.forEach(ap => {
            if (!allUserIds.includes(ap.id)) allUserIds.push(ap.id);
          });
        }
      }

      // Fetch existing flights for this pilot (any profile ID) on affected dates
      const { data: existingDbFlights } = await supabaseServer
        .from('flights')
        .select('*')
        .in('user_id', allUserIds)
        .in('flight_date', affectedDates);

      const existingMap = new Map();
      (existingDbFlights || []).forEach(f => {
        const key = `${f.flight_date}_${f.flight_number}`;
        existingMap.set(key, f);
      });

      const matchedDbIds = new Set();

      for (const newF of newParsedFlights) {
        const key = `${newF.flight_date}_${newF.flight_number}`;
        const existing = existingMap.get(key);

        if (existing) {
          matchedDbIds.add(existing.id);

          // Check if anything actually changed
          const isSame =
            existing.dep_airport === newF.dep_airport &&
            existing.arr_airport === newF.arr_airport &&
            existing.std === newF.std &&
            existing.sta === newF.sta &&
            existing.aircraft_type === newF.aircraft_type &&
            existing.user_id === userId;

          if (!isSame) {
            // Update with new data and reassign to canonical user_id
            await supabaseServer
              .from('flights')
              .update({
                user_id: userId,
                schedule_id: scheduleId || existing.schedule_id,
                dep_airport: newF.dep_airport,
                arr_airport: newF.arr_airport,
                std: newF.std,
                sta: newF.sta,
                aircraft_type: newF.aircraft_type,
                status: newF.status,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
            updatedCount++;
          }
          // else: identical flight — skip entirely
        } else {
          // Truly new flight — insert
          const { data: inserted } = await supabaseServer
            .from('flights')
            .insert([{
              schedule_id: scheduleId,
              user_id: userId,
              flight_number: newF.flight_number,
              flight_date: newF.flight_date,
              dep_airport: newF.dep_airport,
              arr_airport: newF.arr_airport,
              std: newF.std,
              sta: newF.sta,
              aircraft_type: newF.aircraft_type,
              status: newF.status
            }])
            .select()
            .single();

          if (inserted) {
            insertedCount++;
          }
        }
      }

      // Cleanup stale flights on affected dates that are no longer in the new roster
      const staleDbFlights = (existingDbFlights || []).filter(f => !matchedDbIds.has(f.id));
      for (const stale of staleDbFlights) {
        await cancelSubscriptionForFlight(stale.id);
        await supabaseServer.from('flights').delete().eq('id', stale.id);
        removedCount++;
      }
    } catch (e) {
      console.error("Supabase upsert note/error:", e?.message);
    }
  }

  // 2. In-Memory Smart Upsert & Overwrite Fallback
  const existingMemMap = new Map();
  inMemoryStore.flights.forEach(f => {
    const key = `${f.flight_date}_${f.flight_number}`;
    existingMemMap.set(key, f);
  });

  const updatedMemFlights = [];
  const processedKeys = new Set();

  for (const newF of newParsedFlights) {
    const key = `${newF.flight_date}_${newF.flight_number}`;
    processedKeys.add(key);

    if (existingMemMap.has(key)) {
      const existing = existingMemMap.get(key);
      updatedMemFlights.push({
        ...existing,
        dep_airport: newF.dep_airport,
        arr_airport: newF.arr_airport,
        std: newF.std,
        sta: newF.sta,
        aircraft_type: newF.aircraft_type,
        status: newF.status,
        updated_at: new Date().toISOString()
      });
      if (updatedCount === 0) updatedCount++;
    } else {
      updatedMemFlights.push(newF);
      if (insertedCount === 0) insertedCount++;
    }
  }

  const untouchedMemFlights = inMemoryStore.flights.filter(f => {
    if (!affectedDates.includes(f.flight_date)) return true;
    const key = `${f.flight_date}_${f.flight_number}`;
    return processedKeys.has(key);
  });

  const finalMemMap = new Map();
  [...untouchedMemFlights, ...updatedMemFlights].forEach(f => {
    const key = `${f.id || f.flight_number + f.flight_date}`;
    finalMemMap.set(key, f);
  });

  inMemoryStore.flights = Array.from(finalMemMap.values()).sort((a, b) => 
    a.flight_date.localeCompare(b.flight_date) || a.std.localeCompare(b.std)
  );

  return {
    success: true,
    metadata: parsed.metadata,
    summary: parsed.summary,
    inserted_flights_count: insertedCount,
    updated_flights_count: updatedCount,
    removed_stale_count: removedCount,
    total_active_flights: inMemoryStore.flights.length,
    flights: inMemoryStore.flights
  };
}

export async function getWebhooksFromStore() {
  await initStore();

  try {
    const { data, error } = await supabaseServer
      .from('aerodatabox_webhooks')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(20);

    if (!error && data && data.length > 0) {
      return { success: true, webhooks: data };
    }
  } catch (e) {}

  return { success: true, webhooks: inMemoryStore.webhooks };
}
