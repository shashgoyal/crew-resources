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
    showToast(`👨‍✈️ Welcome back, ${userProfile.full_name}!`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    localStorage.removeItem('landed_pilot_profile');
    showToast('👋 Signed out successfully.');
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
            showToast(`🚀 Flight ${updated.flight_number} status updated to ${updated.status}!`);
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

    return () => {
      supabase.removeChannel(flightsChannel);
      supabase.removeChannel(webhooksChannel);
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

      const res = await fetch('/api/upload-schedule', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        let msg = `✅ Schedule Updated! `;
        if (data.inserted_flights_count > 0) msg += `${data.inserted_flights_count} new flights added. `;
        if (data.updated_flights_count > 0) msg += `🔄 ${data.updated_flights_count} existing flights overwritten. `;
        if (data.removed_stale_count > 0) msg += `🧹 ${data.removed_stale_count} obsolete roster legs cleaned up.`;

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
        showToast(`⚡ AeroDataBox Alert triggered for ${flightNum}: ${status}`);
        fetchDashboardData();
      } else {
        alert(`Webhook Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Webhook Trigger Error: ${err.message}`);
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
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--accent-blue)',
          boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4)',
          borderRadius: '12px',
          padding: '14px 24px',
          zIndex: 100,
          color: 'white',
          fontWeight: 600,
          fontSize: '14px',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.3s ease'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Hero Pilot Profile & Statistics */}
      <div className="glass-panel glow-card" style={{ padding: '24px 32px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          alignItems: 'center'
        }}>
          {/* Profile Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)'
            }}>
              👨‍✈️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700' }} className="title-gradient">
                  {profile.full_name}
                </h2>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)'
                }}>
                  EMP: {profile.staff_id}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 10px', background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                >
                  🚪 Sign Out
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                Base: <strong style={{ color: 'white' }}>{profile.base_airport}</strong> &bull; Role: <strong style={{ color: 'white' }}>{profile.role}</strong> &bull; Aircraft: <strong style={{ color: 'white' }}>{profile.aircraft_type}</strong>
              </p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL FLIGHTS</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'white', marginTop: '4px' }}>{flights.length}</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '14px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#fbbf24', textTransform: 'uppercase' }}>SCHEDULED</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#fbbf24', marginTop: '4px' }}>{scheduledCount}</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '14px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#60a5fa', textTransform: 'uppercase' }}>DEPARTED</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#60a5fa', marginTop: '4px' }}>{departedCount}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '14px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#34d399', textTransform: 'uppercase' }}>LANDED</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#34d399', marginTop: '4px' }}>{landedCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Schedule Uploader & Webhook Quick Action Bar */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>📄 IndiGo Personal Crew Schedule Upload</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Upload your PDF crew schedule report. System extracts flight legs, duty times & stores in Supabase database.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label className="btn-primary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'Parsing PDF & Syncing...' : '📤 Upload PDF Schedule'}
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
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          {['ALL', 'SCHEDULED', 'DEPARTED', 'LANDED', 'DELAYED'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: filterStatus === st ? 'var(--accent-blue)' : 'transparent',
                color: filterStatus === st ? 'white' : 'var(--text-secondary)',
                fontWeight: filterStatus === st ? '600' : '500',
                fontSize: '13px',
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
            placeholder="Search Flight #, Airport (DEL, JAI, MAA), Date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'rgba(18, 25, 41, 0.8)',
              border: '1px solid var(--border-color)',
              color: 'white',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Flights & Webhook Trigger Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div className="status-pulse" style={{ margin: '0 auto 16px auto', width: '16px', height: '16px' }}></div>
          Loading flights & live statuses from Supabase...
        </div>
      ) : filteredFlights.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✈️</div>
          <h3>No Flights Found</h3>
          <p style={{ marginTop: '8px', fontSize: '14px' }}>
            Upload an IndiGo Crew Schedule PDF report to populate flight legs in your Supabase database.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredFlights.map(flight => (
            <div key={flight.id || `${flight.flight_number}-${flight.flight_date}`} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Flight Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.01em' }}>
                    {flight.flight_number}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    [{flight.aircraft_type || '320'}]
                  </span>
                </div>

                <span className={`status-badge status-${(flight.status || 'SCHEDULED').toLowerCase()}`}>
                  <span className="status-pulse"></span>
                  {flight.status || 'SCHEDULED'}
                </span>
              </div>

              {/* Date */}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                📅 {flight.flight_date}
              </div>

              {/* Route & Times */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '12px 16px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                {/* Dep */}
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>{flight.dep_airport}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    STD: {flight.std}
                  </div>
                </div>

                {/* Vector Arrow */}
                <div style={{ textAlign: 'center', color: 'var(--accent-cyan)' }}>
                  <div style={{ fontSize: '14px' }}>✈️ ➔</div>
                </div>

                {/* Arr */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>{flight.arr_airport}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    STA: {flight.sta}
                  </div>
                </div>
              </div>

              {/* AeroDataBox Alert Simulator Actions */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => triggerAeroDataBoxWebhook(flight.flight_number, 'DEPARTED')}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  🛫 Webhook: Departed
                </button>
                <button
                  onClick={() => triggerAeroDataBoxWebhook(flight.flight_number, 'LANDED')}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 12px', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}
                >
                  🛬 Webhook: Landed
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live AeroDataBox Webhook Event Stream Log */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>📡 AeroDataBox Webhook Event Stream (Supabase Realtime)</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Real-time audit log of incoming flight alert webhooks from AeroDataBox API.
            </p>
          </div>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            Events Logged: {webhooks.length}
          </span>
        </div>

        <div style={{
          background: '#040711',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid var(--border-color)',
          maxHeight: '260px',
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px'
        }}>
          {webhooks.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              No webhook events logged yet. Click "Webhook: Departed" or "Webhook: Landed" above to fire test alerts.
            </div>
          ) : (
            webhooks.map(wh => (
              <div key={wh.id || Math.random()} style={{
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    [{new Date(wh.received_at || Date.now()).toLocaleTimeString()}]
                  </span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                    {wh.flight_number}
                  </span>
                  <span style={{
                    color: wh.status === 'LANDED' ? '#34d399' : wh.status === 'DEPARTED' ? '#60a5fa' : '#fbbf24'
                  }}>
                    {wh.status}
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
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
