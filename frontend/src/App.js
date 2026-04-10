import React, { useState } from 'react';
import SubmitPage from './pages/SubmitPage';
import ModeratorPage from './pages/ModeratorPage';
import AuditPage from './pages/AuditPage';

const NAV = [
  { id: 'submit',    label: '📤 Submit Content' },
  { id: 'moderate',  label: '🛡️ Moderator Dashboard' },
  { id: 'audit',     label: '🗂️ Audit Trail' },
];

const styles = {
  app: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    background: 'linear-gradient(135deg,#1a1d27 0%,#21263a 100%)',
    borderBottom: '1px solid #2e3352',
    padding: '0 2rem',
  },
  headerInner: {
    maxWidth: 1100, margin: '0 auto',
    display: 'flex', alignItems: 'center', gap: '2rem',
    height: 60,
  },
  logo: { fontSize: 18, fontWeight: 700, color: '#e8ecf4', whiteSpace: 'nowrap' },
  badge: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1,
    background: 'linear-gradient(90deg,#4f8ef7,#7c5cbf)',
    padding: '2px 8px', borderRadius: 20, color: '#fff',
    textTransform: 'uppercase',
  },
  nav: { display: 'flex', gap: '0.25rem', marginLeft: 'auto' },
  navBtn: (active) => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: active ? 700 : 400,
    background: active ? 'rgba(79,142,247,0.18)' : 'transparent',
    color: active ? '#4f8ef7' : '#8892aa',
    transition: 'all 0.15s',
  }),
  clouds: {
    background: '#21263a',
    borderBottom: '1px solid #2e3352',
    padding: '6px 2rem',
    display: 'flex', justifyContent: 'center', gap: '1.5rem',
  },
  cloud: {
    fontSize: 11, color: '#8892aa',
    display: 'flex', alignItems: 'center', gap: 5,
  },
  dot: (color) => ({
    width: 6, height: 6, borderRadius: '50%',
    background: color, display: 'inline-block',
  }),
  main: { flex: 1, maxWidth: 1100, margin: '0 auto', padding: '2rem', width: '100%' },
};

export default function App() {
  const [page, setPage] = useState('submit');

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>⬡ Decentralized AI Moderation</span>
          <span style={styles.badge}>Academic Prototype</span>
          <nav style={styles.nav}>
            {NAV.map(n => (
              <button key={n.id} style={styles.navBtn(page === n.id)} onClick={() => setPage(n.id)}>
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Cloud provider bar */}
      <div style={styles.clouds}>
        <span style={styles.cloud}><span style={styles.dot('#f59e0b')} /> AWS Rekognition (Image)</span>
        <span style={styles.cloud}><span style={styles.dot('#4285f4')} /> Google Perspective API (Text)</span>
        <span style={styles.cloud}><span style={styles.dot('#0078d4')} /> Azure Queue Storage (Routing)</span>
        <span style={styles.cloud}><span style={styles.dot('#65d0a5')} /> IPFS / Infura (Audit)</span>
        <span style={styles.cloud}><span style={styles.dot('#a78bfa')} /> libp2p (P2P Mesh)</span>
      </div>

      <main style={styles.main}>
        {page === 'submit'   && <SubmitPage />}
        {page === 'moderate' && <ModeratorPage />}
        {page === 'audit'    && <AuditPage />}
      </main>
    </div>
  );
}
