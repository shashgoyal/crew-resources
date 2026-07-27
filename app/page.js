'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import LandingPage from './components/LandingPage';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState({
    staff_id: '52147',
    full_name: 'GOYAL, SARTHAK',
    base_airport: 'JAI',
    role: 'FO',
    aircraft_type: 'ATR'
  });

  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [webhooks, setWebhooks] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [alertSubs, setAlertSubs] = useState({});  // { flightId: { status, adb_subscription_id, ... } }

  // Check stored user session or local storage
  useEffect(() => {
    const saved = localStorage.getItem('landed_pilot_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
        setProfile(parsed);
      } catch (e) {}
    }
  }, []);

  const handleLoginSuccess = (userProfile) => {
    setCurrentUser(userProfile);
    setProfile(userProfile);
    localStorage.setItem('landed_pilot_profile', JSON.stringify(userProfile));
    showToast(`Welcome back, ${userProfile.full_name}!`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    localStorage.removeItem('landed_pilot_profile');
    showToast('Signed out successfully.');
  };

  // Fetch initial flights and webhooks
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (currentUser?.staff_id) params.set('staff_id', currentUser.staff_id);
      if (currentUser?.email) params.set('email', currentUser.email);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/flights${queryStr}`);
      const data = await res.json();
      if (data.success) {
        setFlights(data.flights || []);
        if (data.profile) {
          setProfile(prev => ({ ...prev, ...data.profile }));
        }
      }

      const whRes = await fetch('/api/webhooks/aerodatabox');
      const whData = await whRes.json();
      if (whData.success) {
        setWebhooks(whData.webhooks || []);
      }

      // Fetch alert subscriptions for this user
      const userId = data?.profile?.id;
      if (userId) {
        try {
          const subRes = await fetch(`/api/subscriptions?userId=${userId}`);
          const subData = await subRes.json();
          if (subData.success && subData.subscriptions) {
            const subsMap = {};
            subData.subscriptions.forEach(s => { subsMap[s.flight_id] = s; });
            setAlertSubs(subsMap);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDashboardData();
    }

    // Subscribe to Supabase Realtime updates on flights table
    const flightsChannel = supabase
      .channel('public:flights')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flights' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setFlights(prev => prev.map(f => f.id === updated.id ? { ...f, ...updated } : f));
            showToast(`Flight ${updated.flight_number} status updated to ${updated.status}!`);
          } else if (payload.eventType === 'INSERT') {
            setFlights(prev => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    // Subscribe to Supabase Realtime updates on aerodatabox_webhooks table
    const webhooksChannel = supabase
      .channel('public:aerodatabox_webhooks')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'aerodatabox_webhooks' },
        (payload) => {
          setWebhooks(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    // Subscribe to Supabase Realtime updates on alert_subscriptions table
    const alertSubsChannel = supabase
      .channel('public:alert_subscriptions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_subscriptions' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const sub = payload.new;
            setAlertSubs(prev => ({ ...prev, [sub.flight_id]: sub }));
          } else if (payload.eventType === 'DELETE') {
            const sub = payload.old;
            setAlertSubs(prev => {
              const next = { ...prev };
              delete next[sub.flight_id];
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(flightsChannel);
      supabase.removeChannel(webhooksChannel);
      supabase.removeChannel(alertSubsChannel);
    };
  }, [currentUser]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Upload Schedule PDF
  const handleFileUpload = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      if (currentUser?.staff_id) {
        formData.append('staff_id', currentUser.staff_id);
      }
      if (currentUser?.email) {
        formData.append('email', currentUser.email);
      }

      const res = await fetch('/api/upload-schedule', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        let msg = `Schedule Updated! `;
        if (data.inserted_flights_count > 0) msg += `${data.inserted_flights_count} new flights added. `;
        if (data.updated_flights_count > 0) msg += `${data.updated_flights_count} existing flights overwritten. `;
        if (data.removed_stale_count > 0) msg += `${data.removed_stale_count} obsolete roster legs cleaned up.`;

        showToast(msg);
        if (data.metadata?.full_name) {
          setProfile(prev => ({
            ...prev,
            staff_id: data.metadata.staff_id || prev.staff_id,
            full_name: data.metadata.full_name || prev.full_name,
            base_airport: data.metadata.base_role_aircraft?.split(',')[0] || prev.base_airport,
            role: data.metadata.base_role_aircraft?.split(',')[1] || prev.role,
            aircraft_type: data.metadata.base_role_aircraft?.split(',')[2] || prev.aircraft_type
          }));
        }
        await fetchDashboardData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Simulate AeroDataBox Webhook Event
  const triggerAeroDataBoxWebhook = async (flightNum, status) => {
    try {
      const res = await fetch('/api/webhooks/aerodatabox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'FlightStatusUpdate',
          flightNumber: flightNum,
          status: status,
          actualDep: status === 'DEPARTED' ? new Date().toISOString() : undefined,
          actualArr: status === 'LANDED' ? new Date().toISOString() : undefined,
          source: 'AeroDataBox Alert Engine'
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`AeroDataBox Alert triggered for ${flightNum}: ${status}`);
        fetchDashboardData();
      } else {
        alert(`Webhook Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Webhook Trigger Error: ${err.message}`);
    }
  };

  // Toggle flight alert subscription
  const handleToggleAlert = async (flightId) => {
    const userId = profile?.id;
    if (!userId) {
      showToast('Profile not loaded yet. Please wait.');
      return;
    }

    const isCurrentlyTracked = !!alertSubs[flightId];
    const enable = !isCurrentlyTracked;

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flightId, userId, enable })
      });

      const data = await res.json();
      if (data.success) {
        if (enable) {
          setAlertSubs(prev => ({ ...prev, [flightId]: data.subscription }));
          showToast('Flight tracking enabled — will subscribe before departure.');
        } else {
          setAlertSubs(prev => {
            const next = { ...prev };
            delete next[flightId];
            return next;
          });
          showToast('Flight tracking disabled.');
        }
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (err) {
      showToast(`Toggle failed: ${err.message}`);
    }
  };

  const filteredFlights = flights.filter(f => {
    const matchesStatus = filterStatus === 'ALL' || f.status === filterStatus;
    const matchesSearch = f.flight_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.dep_airport.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.arr_airport.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.flight_date.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const landedCount = flights.filter(f => f.status === 'LANDED').length;
  const departedCount = flights.filter(f => f.status === 'DEPARTED').length;
  const scheduledCount = flights.filter(f => f.status === 'SCHEDULED').length;

  if (!currentUser) {
    return <LandingPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--ink)',
          border: '1px solid oklch(0.35 0.02 250)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          borderRadius: '12px',
          padding: '14px 24px',
          zIndex: 100,
          color: 'var(--cream)',
          fontWeight: 500,
          fontSize: '14px',
          animation: 'fadeIn 0.3s ease'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Hero Pilot Profile & Statistics */}
      <div className="glass-panel glow-card" style={{ padding: '28px 32px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          alignItems: 'center'
        }}>
          {/* Profile Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: 'var(--cream)'
            }}>
              ✈
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 className="font-display" style={{ fontSize: '26px', color: 'var(--ink)' }}>
                  {profile.full_name}
                </h2>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--sand)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em'
                }}>
                  EMP: {profile.staff_id}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '4px 12px',
                    color: 'var(--text-muted)'
                  }}
                >
                  Sign Out
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
                Base: <strong style={{ color: 'var(--ink)' }}>{profile.base_airport}</strong> · Role: <strong style={{ color: 'var(--ink)' }}>{profile.role}</strong> · Aircraft: <strong style={{ color: 'var(--ink)' }}>{profile.aircraft_type}</strong>
              </p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div style={{ background: 'var(--sand)', padding: '14px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</div>
              <div className="font-display" style={{ fontSize: '24px', color: 'var(--ink)', marginTop: '4px' }}>{flights.length}</div>
            </div>
            <div className="status-scheduled" style={{ padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scheduled</div>
              <div className="font-display" style={{ fontSize: '24px', marginTop: '4px' }}>{scheduledCount}</div>
            </div>
            <div className="status-departed" style={{ padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Departed</div>
              <div className="font-display" style={{ fontSize: '24px', marginTop: '4px' }}>{departedCount}</div>
            </div>
            <div className="status-landed" style={{ padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Landed</div>
              <div className="font-display" style={{ fontSize: '24px', marginTop: '4px' }}>{landedCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Schedule Uploader */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 className="font-display" style={{ fontSize: '22px', color: 'var(--ink)' }}>Upload your roster</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Drag in your IndiGo PDF crew schedule. We parse flight legs, duty times & store in Supabase.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label className="btn-primary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'Parsing PDF & Syncing...' : 'Upload PDF Schedule'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Controls Bar: Filters & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--sand)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          {['ALL', 'SCHEDULED', 'DEPARTED', 'LANDED', 'DELAYED'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: filterStatus === st ? 'var(--ink)' : 'transparent',
                color: filterStatus === st ? 'var(--cream)' : 'var(--text-secondary)',
                fontWeight: filterStatus === st ? '500' : '400',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '320px' }}>
          <input
            type="text"
            placeholder="Search Flight #, Airport, Date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'var(--cream)',
              border: '1px solid var(--border-color)',
              color: 'var(--ink)',
              fontSize: '14px',
              fontFamily: 'var(--font-sans)',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Flights Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div className="status-pulse" style={{ margin: '0 auto 16px auto', width: '12px', height: '12px', color: 'var(--ember)' }}></div>
          Loading flights & live statuses from Supabase...
        </div>
      ) : filteredFlights.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✈</div>
          <h3 className="font-display" style={{ fontSize: '24px', color: 'var(--ink)' }}>No Flights Found</h3>
          <p style={{ marginTop: '8px', fontSize: '14px' }}>
            Upload an IndiGo Crew Schedule PDF report to populate flight legs in your Supabase database.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredFlights.map(flight => {
            const sub = alertSubs[flight.id];
            const isTracked = !!sub;
            const subStatus = sub?.status; // pending | active | completed | failed

            return (
            <div key={flight.id || `${flight.flight_number}-${flight.flight_date}`} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Flight Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="font-display" style={{ fontSize: '20px', color: 'var(--ink)' }}>
                    {flight.flight_number}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                    [{flight.aircraft_type || '320'}]
                  </span>
                </div>

                <span className={`status-badge status-${(flight.status || 'SCHEDULED').toLowerCase()}`}>
                  <span className="status-pulse"></span>
                  {flight.status || 'SCHEDULED'}
                </span>
              </div>

              {/* Date */}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                {flight.flight_date}
              </div>

              {/* Route & Times */}
              <div style={{
                background: 'var(--sand)',
                padding: '14px 16px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                {/* Dep */}
                <div style={{ textAlign: 'left' }}>
                  <div className="font-display" style={{ fontSize: '22px', color: 'var(--ink)' }}>{flight.dep_airport}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    STD: {flight.std}
                  </div>
                </div>

                {/* Route arrow */}
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', height: '1px', width: '24px', background: 'var(--border-color)' }} />
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--ember)' }}>
                    <path d="M2 12l20-8-6 18-4-7-10-3z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span style={{ display: 'inline-block', height: '1px', width: '24px', background: 'var(--border-color)' }} />
                </div>

                {/* Arr */}
                <div style={{ textAlign: 'right' }}>
                  <div className="font-display" style={{ fontSize: '22px', color: 'var(--ink)' }}>{flight.arr_airport}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    STA: {flight.sta}
                  </div>
                </div>
              </div>

              {/* Track Toggle + Webhook Actions */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Track Toggle */}
                <button
                  onClick={() => flight.id && handleToggleAlert(flight.id)}
                  disabled={!flight.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    border: isTracked ? '1px solid var(--ember)' : '1px solid var(--border-color)',
                    background: isTracked ? 'oklch(0.95 0.06 45)' : 'transparent',
                    color: isTracked ? 'var(--ember)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: flight.id ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Radar icon */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ opacity: isTracked ? 1 : 0.5 }}>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M12 6a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {isTracked ? (
                    <>
                      Tracking
                      {subStatus && subStatus !== 'pending' && (
                        <span style={{
                          display: 'inline-block',
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: subStatus === 'active' ? 'oklch(0.55 0.16 155)' : subStatus === 'failed' ? 'oklch(0.55 0.20 25)' : 'var(--text-muted)',
                          marginLeft: '2px'
                        }} />
                      )}
                    </>
                  ) : 'Track'}
                </button>

                {/* Simulate buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => triggerAeroDataBoxWebhook(flight.flight_number, 'DEPARTED')}
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '6px 14px' }}
                  >
                    Departed
                  </button>
                  <button
                    onClick={() => triggerAeroDataBoxWebhook(flight.flight_number, 'LANDED')}
                    className="btn-secondary"
                    style={{
                      fontSize: '11px',
                      padding: '6px 14px',
                      background: 'oklch(0.93 0.06 155)',
                      borderColor: 'oklch(0.85 0.06 155)',
                      color: 'oklch(0.40 0.14 155)'
                    }}
                  >
                    Landed
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Live AeroDataBox Webhook Event Stream Log */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="font-display" style={{ fontSize: '22px', color: 'var(--ink)' }}>Webhook Event Stream</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Real-time audit log of incoming flight alert webhooks from AeroDataBox API.
            </p>
          </div>
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase'
          }}>
            Events: {webhooks.length}
          </span>
        </div>

        <div style={{
          background: 'var(--ink)',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid oklch(0.30 0.02 250)',
          maxHeight: '260px',
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--cream)'
        }}>
          {webhooks.length === 0 ? (
            <div style={{ color: 'oklch(0.55 0.015 250)', textAlign: 'center', padding: '20px 0' }}>
              No webhook events logged yet. Click "Departed" or "Landed" above to fire test alerts.
            </div>
          ) : (
            webhooks.map(wh => (
              <div key={wh.id || Math.random()} style={{
                padding: '8px 0',
                borderBottom: '1px solid oklch(0.28 0.02 250)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'oklch(0.55 0.015 250)' }}>
                    [{new Date(wh.received_at || Date.now()).toLocaleTimeString()}]
                  </span>
                  <span style={{ color: 'var(--ember)', fontWeight: 'bold' }}>
                    {wh.flight_number}
                  </span>
                  <span style={{
                    color: wh.status === 'LANDED' ? 'oklch(0.70 0.14 155)' : wh.status === 'DEPARTED' ? 'oklch(0.70 0.06 250)' : 'oklch(0.70 0.12 85)'
                  }}>
                    {wh.status}
                  </span>
                </div>
                <span style={{ color: 'oklch(0.45 0.015 250)', fontSize: '11px' }}>
                  {wh.event_type || 'FlightAlert'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
