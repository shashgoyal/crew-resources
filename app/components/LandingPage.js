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

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'var(--cream)',
    border: '1px solid var(--border-color)',
    color: 'var(--ink)',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  };

  const selectStyle = {
    ...inputStyle,
    fontSize: '13px',
    appearance: 'auto'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    marginBottom: '6px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* ── HERO SECTION ── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '48px',
          alignItems: 'start',
          paddingBottom: '48px',
          paddingTop: '16px'
        }}>
          {/* Left: Copy */}
          <div className="animate-fade-up">
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              padding: '5px 14px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--text-muted)',
              marginBottom: '24px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ember)' }} />
              Private beta · for aircrew
            </div>

            <h1 className="font-display" style={{
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              lineHeight: 0.98,
              letterSpacing: '-0.02em',
              color: 'var(--ink)'
            }}>
              Land safely.
              <br />
              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>They already know.</span>
            </h1>

            <p style={{
              marginTop: '28px',
              maxWidth: '520px',
              fontSize: '17px',
              lineHeight: 1.65,
              color: 'var(--text-secondary)'
            }}>
              Landed reads your roster and quietly WhatsApps the people who care —
              the moment your wheels leave the ground, and the moment they touch it again.
              No apps for them. No texts from you.
            </p>

            {/* Demo Login Buttons */}
            <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'var(--text-muted)'
              }}>
                Quick demo access
              </span>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleDemoLogin('SARTHAK GOYAL', '52147', 'JAI', 'FO', 'ATR')}
                  className="btn-primary"
                  style={{ padding: '12px 24px', fontSize: '14px' }}
                >
                  FO Sarthak Goyal
                  <ArrowIcon />
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin('CHAHAT SHARMA', '52143', 'DEL', 'FO', '320')}
                  className="btn-secondary"
                  style={{ padding: '12px 24px', fontSize: '14px' }}
                >
                  FO Chahat Sharma
                  <ArrowIcon />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="hairline" style={{
              marginTop: '40px',
              paddingTop: '28px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px',
              maxWidth: '420px'
            }}>
              <StatBlock k="2 sec" v="to upload a roster" />
              <StatBlock k="0" v="messages you send" />
              <StatBlock k="24/7" v="silent tracking" />
            </div>
          </div>

          {/* Right: Auth Form Card */}
          <div className="glass-panel glow-card" style={{ padding: '32px', borderRadius: '20px' }}>
            {/* Auth Tab Header */}
            <div style={{
              display: 'flex',
              background: 'var(--sand)',
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
                  background: authMode === 'login' ? 'var(--ink)' : 'transparent',
                  color: authMode === 'login' ? 'var(--cream)' : 'var(--text-secondary)',
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setErrorMessage(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: authMode === 'signup' ? 'var(--ink)' : 'transparent',
                  color: authMode === 'signup' ? 'var(--cream)' : 'var(--text-secondary)',
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)'
                }}
              >
                Create Account
              </button>
            </div>

            {errorMessage && (
              <div style={{
                background: 'oklch(0.93 0.06 25)',
                border: '1px solid oklch(0.85 0.06 25)',
                color: 'oklch(0.50 0.16 25)',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                {errorMessage}
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    type="email"
                    placeholder="pilot@indigo.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: '8px', fontSize: '15px' }}
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                  {!loading && <ArrowIcon />}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Full Crew Name</label>
                  <input
                    type="text"
                    placeholder="GOYAL, SARTHAK JAI"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Staff ID</label>
                    <input
                      type="text"
                      placeholder="52147"
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Base Airport</label>
                    <select value={baseAirport} onChange={(e) => setBaseAirport(e.target.value)} style={selectStyle}>
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
                    <label style={labelStyle}>Role</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)} style={selectStyle}>
                      <option value="FO">FO (First Officer)</option>
                      <option value="PIC">PIC (Captain)</option>
                      <option value="CC">Cabin Crew</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Fleet Type</label>
                    <select value={aircraftType} onChange={(e) => setAircraftType(e.target.value)} style={selectStyle}>
                      <option value="320">Airbus A320</option>
                      <option value="ATR">ATR 72-600</option>
                      <option value="777">Boeing 777</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    type="email"
                    placeholder="sarthak@indigo.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '4px', fontSize: '14px' }}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                  {!loading && <ArrowIcon />}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── HERO IMAGE PREVIEW ── */}
      <section style={{ position: 'relative', marginBottom: '48px' }}>
        <div className="grain" style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
          <img
            src="/hero-sky.jpg"
            alt="View of clouds and an aircraft wing from a passenger window at golden hour"
            width={1600}
            height={400}
            style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent, transparent)',
            pointerEvents: 'none'
          }} />
          {/* Flight tag overlay */}
          <div style={{
            position: 'absolute',
            left: '20px',
            top: '20px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)',
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.9)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ember)', animation: 'pulse-ring 1.8s infinite' }} />
              In flight · 6E 2451
            </div>
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.7)' }}>
              <span>JAI</span>
              <span style={{ display: 'inline-block', height: '1px', width: '32px', background: 'rgba(255,255,255,0.4)' }} />
              <span>DEL</span>
            </div>
          </div>

          {/* WhatsApp card overlay */}
          <div style={{
            position: 'absolute',
            bottom: '-12px',
            right: '24px',
            width: '260px',
            transform: 'rotate(-2deg)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            padding: '16px',
            boxShadow: '0 20px 60px -20px rgba(30,30,40,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#25D366', display: 'grid', placeItems: 'center', color: 'white' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11 11 0 0 0 3.7 17.3L2.5 22l4.8-1.2A11 11 0 1 0 20.5 3.5Zm-8.4 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.9.8.8-2.8-.2-.3a9 9 0 1 1 7.2 3.7Zm5.2-6.7c-.3-.1-1.7-.8-1.9-.9s-.4-.1-.6.1-.7.9-.9 1.1-.3.1-.6 0a7.5 7.5 0 0 1-3.7-3.2c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.5-.4-.6-.4h-.6a1.2 1.2 0 0 0-.8.4 3.4 3.4 0 0 0-1.1 2.5c0 1.5 1.1 2.9 1.2 3.1s2.1 3.2 5 4.5c1.9.7 2.6.8 3.5.7a3 3 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3Z"/></svg>
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>Mum</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>via Landed</p>
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <div style={{ marginLeft: '20px', borderRadius: '14px', borderTopLeftRadius: '4px', background: 'var(--sand)', padding: '10px 12px', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
                ✈️ Just took off from Jaipur. Landing in Delhi around 08:12 local. — Sarthak
              </div>
              <p style={{ paddingLeft: '20px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>07:47 · delivered</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section style={{ paddingBottom: '48px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1px',
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          background: 'var(--border-color)'
        }}>
          {[
            { n: '01', t: 'Smart Schedule Parser', d: 'Automated PDF parser trained for IndiGo Schedule Reports. Extracts multi-column leg dates, report/release times, flight numbers, and STD/STA bounds.' },
            { n: '02', t: 'Auto-Overwrite & Upsert', d: 'Roster updates handled seamlessly. Uploading an updated schedule checks for existing flights and overwrites changes without duplications.' },
            { n: '03', t: 'AeroDataBox Live Alerts', d: 'Real-time webhook integration receives live departure and landing notifications, updating flight statuses dynamically via Supabase Realtime.' },
          ].map((item) => (
            <div key={item.n} style={{
              background: 'var(--bg-card)',
              padding: '32px',
              transition: 'background 0.2s ease'
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'var(--ember)'
              }}>
                {item.n}
              </span>
              <h3 className="font-display" style={{
                marginTop: '24px',
                fontSize: '26px',
                lineHeight: 1.15,
                color: 'var(--ink)'
              }}>
                {item.t}
              </h3>
              <p style={{
                marginTop: '12px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)'
              }}>
                {item.d}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Helper Components ── */

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StatBlock({ k, v }) {
  return (
    <div>
      <dt className="font-display" style={{ fontSize: '28px', color: 'var(--ink)' }}>{k}</dt>
      <dd style={{
        marginTop: '4px',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-muted)'
      }}>{v}</dd>
    </div>
  );
}
