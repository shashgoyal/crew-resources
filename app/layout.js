import './globals.css';

export const metadata = {
  title: 'Landed | Real-Time Flight & Crew Roster Tracker',
  description: 'Automated IndiGo Crew Schedule Parser and AeroDataBox Real-Time Flight Alert Tracker powered by Supabase.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Navigation Bar */}
          <header style={{
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(9, 13, 22, 0.85)',
            backdropFilter: 'blur(12px)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            padding: '16px 32px'
          }}>
            <div style={{
              maxWidth: '1400px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  color: 'white',
                  boxShadow: '0 0 16px rgba(59, 130, 246, 0.4)'
                }}>
                  ✈️
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    LANDED
                  </h1>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    FLIGHT ALERT WEBHOOK & ROSTER ENGINE
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '12px',
                  color: '#34d399',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <span className="status-pulse" style={{ background: '#34d399' }}></span>
                  Supabase & Webhook Connected
                </div>
              </div>
            </div>
          </header>

          <main style={{ flex: 1, padding: '32px 16px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              {children}
            </div>
          </main>

          <footer style={{
            borderTop: '1px solid var(--border-color)',
            padding: '24px 32px',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--text-muted)'
          }}>
            Landed &copy; 2026 | Powered by Supabase, AeroDataBox Webhooks & IndiGo Crew Parser Engine
          </footer>
        </div>
      </body>
    </html>
  );
}
