'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function LandingPage({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [role, setRole] = useState('FO');
  const [baseAirport, setBaseAirport] = useState('DEL');
  const [aircraftType, setAircraftType] = useState('320');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle Supabase / Mock Login
  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      if (email && password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) {
          console.warn("Supabase auth notice:", error.message);
        }

        const authUser = data?.user;
        const meta = authUser?.user_metadata || {};

        let fetchedProfile = null;
        try {
          const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              staff_id: meta.staff_id || staffId || undefined,
              full_name: meta.full_name || fullName || undefined,
              base_airport: meta.base_airport || baseAirport,
              role: meta.role || role,
              aircraft_type: meta.aircraft_type || aircraftType
            })
          });
          const resData = await res.json();
          if (resData.success && resData.profile) {
            fetchedProfile = resData.profile;
          }
        } catch (e) {}

        const userProfile = fetchedProfile || {
          email: email.trim(),
          staff_id: meta.staff_id || staffId || undefined,
          full_name: meta.full_name || fullName || (email.trim().split('@')[0].toUpperCase()),
          base_airport: meta.base_airport || baseAirport,
          role: meta.role || role,
          aircraft_type: meta.aircraft_type || aircraftType
        };

        onLoginSuccess(userProfile);
      } else {
        setErrorMessage('Please enter email and password.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Supabase / Mock Signup
  const handleSignUp = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setErrorMessage('');

    if (!email || !password || !fullName || !staffId) {
      setErrorMessage('Please fill in all required fields (Name, Staff ID, Email, Password).');
      setLoading(false);
      return;
    }

    try {
      // Pre-check if user already exists with email or staff ID
      const checkRes = await fetch(`/api/profile?email=${encodeURIComponent(email)}&staff_id=${encodeURIComponent(staffId)}`);
      const checkData = await checkRes.json();
      if (checkData.success && checkData.exists) {
        setErrorMessage(`⚠️ Account with this ${checkData.field} already exists. Please log in.`);
        setAuthMode('login');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            staff_id: staffId,
            base_airport: baseAirport,
            role: role,
            aircraft_type: aircraftType
          }
        }
      });

      if (error) {
        console.warn("Supabase SignUp notice:", error.message);
      }

      const newProfile = {
        email,
        staff_id: staffId,
        full_name: fullName.toUpperCase(),
        base_airport: baseAirport,
        role: role,
        aircraft_type: aircraftType
      };

      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProfile)
        });
      } catch (err) {}

      onLoginSuccess(newProfile);
    } catch (err) {
      setErrorMessage(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick Demo Login (Instant access)
  const handleDemoLogin = async (pilotName, staff, base, pilotRole, ac) => {
    const demoInput = {
      staff_id: staff,
      full_name: pilotName,
      base_airport: base,
      role: pilotRole,
      aircraft_type: ac,
      email: `${staff.toLowerCase()}@indigo.in`
    };
    let demoProfile = demoInput;
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demoInput)
      });
      const data = await res.json();
      if (data.success && data.profile) {
        demoProfile = data.profile;
      }
    } catch (e) {}
    onLoginSuccess(demoProfile);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', paddingBottom: '60px' }}>
      {/* Hero Section */}
      <div style={{
        position: 'relative',
        borderRadius: '24px',
        padding: '48px 36px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 58, 138, 0.4) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '40px',
        alignItems: 'center'
      }}>
        {/* Left: Text & Features */}
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#60a5fa',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '20px'
          }}>
            <span className="status-pulse"></span>
            Aviation Roster & Live Flight Radar Platform
          </div>

          <h1 style={{ fontSize: '42px', fontWeight: '800', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '16px' }}>
            Smart Roster Sync & <span className="title-gradient">Live Alert Engine</span>
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6, marginBottom: '28px' }}>
            Upload your IndiGo PDF schedule reports to parse flight legs in milliseconds. Receive real-time AeroDataBox webhooks and update roster schedules with automatic deduplication & overwrite protection.
          </p>

          {/* Quick Demo Pilot Login Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ One-Click Demo Pilot Access:
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleDemoLogin('SARTHAK GOYAL', '52147', 'JAI', 'FO', 'ATR')}
                className="btn-primary"
                style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '14px' }}
              >
                👨‍✈️ Login as FO Sarthak Goyal (#52147)
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('CHAHAT SHARMA', '52143', 'DEL', 'FO', '320')}
                className="btn-secondary"
                style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '14px', background: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.3)', color: '#38bdf8' }}
              >
                👩‍✈️ Login as FO Chahat Sharma (#52143)
              </button>
            </div>
          </div>
        </div>

        {/* Right: Interactive Login / Signup Form Card */}
        <div className="glass-panel glow-card" style={{ padding: '32px', borderRadius: '20px' }}>
          {/* Auth Tab Header */}
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.7)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            marginBottom: '24px'
          }}>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setErrorMessage(''); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: authMode === 'login' ? 'var(--accent-blue)' : 'transparent',
                color: authMode === 'login' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🔑 Log In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setErrorMessage(''); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: authMode === 'signup' ? 'var(--accent-blue)' : 'transparent',
                color: authMode === 'signup' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ✨ Sign Up
            </button>
          </div>

          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {errorMessage}
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="pilot@indigo.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(18, 25, 41, 0.9)',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(18, 25, 41, 0.9)',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', marginTop: '8px', fontSize: '15px' }}
              >
                {loading ? 'Authenticating...' : 'Sign In to Pilot Dashboard ✈️'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Full Crew Name
                </label>
                <input
                  type="text"
                  placeholder="GOYAL, SARTHAK JAI"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(18, 25, 41, 0.9)',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Staff Emp ID
                  </label>
                  <input
                    type="text"
                    placeholder="52147"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(18, 25, 41, 0.9)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Base Airport
                  </label>
                  <select
                    value={baseAirport}
                    onChange={(e) => setBaseAirport(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(18, 25, 41, 0.9)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  >
                    <option value="DEL">DEL - Delhi</option>
                    <option value="JAI">JAI - Jaipur</option>
                    <option value="BOM">BOM - Mumbai</option>
                    <option value="BLR">BLR - Bengaluru</option>
                    <option value="MAA">MAA - Chennai</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Role / Position
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(18, 25, 41, 0.9)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  >
                    <option value="FO">FO (First Officer)</option>
                    <option value="PIC">PIC (Captain)</option>
                    <option value="CC">Cabin Crew</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Fleet Type
                  </label>
                  <select
                    value={aircraftType}
                    onChange={(e) => setAircraftType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(18, 25, 41, 0.9)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  >
                    <option value="320">Airbus A320</option>
                    <option value="ATR">ATR 72-600</option>
                    <option value="777">Boeing 777</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="sarthak@indigo.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(18, 25, 41, 0.9)',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(18, 25, 41, 0.9)',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', marginTop: '4px', fontSize: '14px' }}
              >
                {loading ? 'Creating Account...' : 'Create Pilot Account & Launch 🚀'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Highlights / Features Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Smart Schedule Parser</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
            Automated PDF parser trained specifically for IndiGo Schedule Reports. Extracts multi-column leg dates, report/release times, flight numbers, and STD/STA bounds.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Auto-Overwrite & Upsert</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
            Roster updates are handled seamlessly. Uploading an updated schedule checks for existing pilot flights on that date and overwrites changes without duplications.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📡</div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>AeroDataBox Live Alerts</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
            Real-time webhook integration receives live departure and landing notifications, updating flight statuses dynamically with Supabase Realtime feeds.
          </p>
        </div>
      </div>
    </div>
  );
}
