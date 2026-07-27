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
            background: 'var(--cream)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            padding: '20px 32px'
          }}>
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                <svg width="26" height="26" viewBox="0 0 32 32" fill="none" style={{ color: 'var(--ink)' }}>
                  <path
                    d="M4 20l24-10-6 18-5-8-13-0z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-display" style={{ fontSize: '24px', lineHeight: 1, color: 'var(--ink)' }}>
                  Landed
                </span>
              </a>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 14px',
                  borderRadius: '9999px',
                  background: 'oklch(0.93 0.06 155)',
                  border: '1px solid oklch(0.85 0.06 155)',
                  fontSize: '11px',
                  color: 'oklch(0.40 0.14 155)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase'
                }}>
                  <span className="status-pulse" style={{ background: 'oklch(0.40 0.14 155)' }}></span>
                  Supabase Connected
                </div>
              </div>
            </div>
          </header>

          <main style={{ flex: 1, padding: '32px 16px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              {children}
            </div>
          </main>

          <footer style={{ borderTop: '1px solid var(--border-color)' }}>
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                padding: '24px 32px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" style={{ color: 'var(--ink)' }}>
                    <path d="M4 20l24-10-6 18-5-8-13-0z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  <span className="font-display" style={{ fontSize: '18px', color: 'var(--ink)' }}>Landed</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px' }}>
                  Built for crew. Powered by Supabase, AeroDataBox Webhooks & IndiGo Crew Parser Engine.
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  color: 'var(--text-muted)'
                }}>
                  <a href="#" style={{ transition: 'color 0.2s' }}>Privacy</a>
                  <a href="#" style={{ transition: 'color 0.2s' }}>Terms</a>
                  <a href="#" style={{ transition: 'color 0.2s' }}>Contact</a>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)' }}>
                <p style={{
                  padding: '16px 32px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  color: 'var(--text-muted)'
                }}>
                  © {new Date().getFullYear()} Landed · Made at 35,000 ft
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
