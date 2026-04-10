import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const REVIEW = 'http://localhost:3003';

const s = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' },
  h1: { fontSize:22, fontWeight:800 },
  refreshBtn: {
    padding:'6px 14px', background:'#1a1d27', border:'1px solid #2e3352',
    borderRadius:7, color:'#8892aa', cursor:'pointer', fontSize:13,
  },
  emptyBox: {
    textAlign:'center', padding:'4rem 2rem',
    background:'#1a1d27', border:'1px dashed #2e3352', borderRadius:12,
    color:'#8892aa',
  },
  grid: { display:'flex', flexDirection:'column', gap:'1rem' },
  card: {
    background:'#1a1d27', border:'1px solid #2e3352',
    borderRadius:12, padding:'1.25rem', overflow:'hidden',
  },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.75rem' },
  typeTag: (t) => ({
    padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700,
    background: t === 'text' ? 'rgba(79,142,247,0.15)' : 'rgba(124,92,191,0.15)',
    color:       t === 'text' ? '#4f8ef7' : '#a78bfa',
    border:      `1px solid ${t === 'text' ? '#4f8ef7' : '#a78bfa'}44`,
  }),
  scoreBar: {
    height:6, borderRadius:3, background:'#0f1117', marginTop:6, overflow:'hidden',
  },
  scoreFill: (score) => ({
    height:'100%', borderRadius:3,
    width: `${score * 100}%`,
    background: score > 0.65 ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
              : score > 0.40 ? 'linear-gradient(90deg,#4f8ef7,#f59e0b)'
              : 'linear-gradient(90deg,#22c55e,#4f8ef7)',
  }),
  preview: {
    background:'#0f1117', border:'1px solid #2e3352', borderRadius:8,
    padding:'0.75rem', fontSize:13, color:'#c8d0e0', margin:'0.75rem 0',
    maxHeight:80, overflow:'hidden',
  },
  detailRow: { display:'flex', gap:'1.5rem', fontSize:12, color:'#8892aa', marginBottom:'0.75rem', flexWrap:'wrap' },
  actions: { display:'flex', gap:'0.75rem', marginTop:'0.75rem' },
  safeBtn: {
    flex:1, padding:'0.6rem', borderRadius:8, border:'1px solid #22c55e',
    background:'rgba(34,197,94,0.1)', color:'#22c55e', fontWeight:700,
    cursor:'pointer', fontSize:14,
  },
  harmBtn: {
    flex:1, padding:'0.6rem', borderRadius:8, border:'1px solid #ef4444',
    background:'rgba(239,68,68,0.1)', color:'#ef4444', fontWeight:700,
    cursor:'pointer', fontSize:14,
  },
  nameInput: {
    flex:1, background:'#0f1117', border:'1px solid #2e3352', borderRadius:8,
    padding:'6px 10px', color:'#e8ecf4', fontSize:13,
  },
  historyCard: {
    display:'flex', alignItems:'center', gap:'1rem',
    background:'#1a1d27', border:'1px solid #2e3352', borderRadius:10,
    padding:'0.75rem 1rem', marginBottom:'0.5rem',
  },
  decisionDot: (d) => ({
    width:10, height:10, borderRadius:'50%', flexShrink:0,
    background: d === 'safe' ? '#22c55e' : '#ef4444',
  }),
  tabs: { display:'flex', gap:'0.5rem', marginBottom:'1.5rem' },
  tab: (a) => ({
    padding:'6px 16px', borderRadius:7, border:'1px solid',
    borderColor: a ? '#4f8ef7' : '#2e3352',
    background: a ? 'rgba(79,142,247,0.12)' : 'transparent',
    color: a ? '#4f8ef7' : '#8892aa', cursor:'pointer', fontSize:13, fontWeight: a ? 700 : 400,
  }),
};

function ScoreBar({ score }) {
  if (score == null) return null;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#8892aa' }}>
        <span>AI Risk Score</span>
        <span style={{ fontWeight:700, color: score > 0.65 ? '#ef4444' : score > 0.40 ? '#f59e0b' : '#22c55e' }}>
          {(score * 100).toFixed(1)}%
        </span>
      </div>
      <div style={s.scoreBar}><div style={s.scoreFill(score)} /></div>
    </div>
  );
}

function PendingCard({ item, onDecide }) {
  const [reviewer, setReviewer] = useState('Moderator');
  const [deciding, setDeciding] = useState(false);

  async function decide(decision) {
    setDeciding(true);
    await onDecide(item.contentId, decision, reviewer);
    setDeciding(false);
  }

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div>
          <span style={s.typeTag(item.contentType)}>{item.contentType === 'text' ? '📝 TEXT' : '🖼️ IMAGE'}</span>
          <span style={{ fontSize:11, color:'#8892aa', marginLeft:10 }}>{item.contentId?.substring(0,14)}…</span>
        </div>
        <ScoreBar score={item.aiScore} />
      </div>

      <div style={s.detailRow}>
        <span>🤖 <strong style={{color:'#e8ecf4'}}>{item.provider}</strong></span>
        <span>📅 {item.submittedAt ? new Date(item.submittedAt).toLocaleTimeString() : '—'}</span>
        <span style={{color:'#f59e0b'}}>⚠️ {item.decisionReason}</span>
      </div>

      {item.aiDetails && Object.keys(item.aiDetails).length > 0 && (
        <div style={{ ...s.detailRow, marginBottom: 0 }}>
          {Object.entries(item.aiDetails).slice(0,5).map(([k,v]) => (
            <span key={k}>{k}: <strong style={{color:'#e8ecf4'}}>{v != null ? (v*100).toFixed(0)+'%' : '—'}</strong></span>
          ))}
        </div>
      )}

      <div style={s.preview}>{item.preview}</div>

      <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
        <input style={s.nameInput} value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="Reviewer name" />
      </div>
      <div style={s.actions}>
        <button style={s.safeBtn} disabled={deciding} onClick={() => decide('safe')}>
          {deciding ? '…' : '✅ Mark Safe'}
        </button>
        <button style={s.harmBtn} disabled={deciding} onClick={() => decide('harmful')}>
          {deciding ? '…' : '🚫 Mark Harmful'}
        </button>
      </div>
    </div>
  );
}

export default function ModeratorPage() {
  const [pending, setPending]   = useState([]);
  const [history, setHistory]   = useState([]);
  const [tab, setTab]           = useState('pending');
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${REVIEW}/pending`);
      setPending(data);
    } catch (e) {
      console.error('Could not reach human-review-node:', e.message);
    }
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${REVIEW}/history`);
      setHistory(data);
    } catch (e) { console.error(e.message); }
  }, []);

  useEffect(() => {
    loadPending();
    loadHistory();
    const t = setInterval(() => { loadPending(); loadHistory(); }, 5000);
    return () => clearInterval(t);
  }, [loadPending, loadHistory]);

  async function handleDecide(contentId, decision, reviewer) {
    try {
      await axios.post(`${REVIEW}/decide/${contentId}`, { decision, reviewerName: reviewer });
      setToast(`✅ Marked as "${decision}"`);
      setTimeout(() => setToast(null), 3000);
      await loadPending();
      await loadHistory();
    } catch (e) {
      setToast('❌ Error: ' + (e.response?.data?.error || e.message));
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div>
      {toast && (
        <div style={{ position:'fixed', top:80, right:20, padding:'10px 18px',
          background:'#1a1d27', border:'1px solid #4f8ef7', borderRadius:10,
          fontSize:14, color:'#e8ecf4', zIndex:1000 }}>
          {toast}
        </div>
      )}

      <div style={s.header}>
        <h1 style={s.h1}>🛡️ Moderator Dashboard</h1>
        <button style={s.refreshBtn} onClick={() => { loadPending(); loadHistory(); }}>
          {loading ? '⟳ Loading…' : '⟳ Refresh'}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display:'flex', gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          { label:'Pending Review', value: pending.length, color:'#f59e0b' },
          { label:'Reviewed Today',  value: history.length,  color:'#4f8ef7' },
          { label:'Approved',        value: history.filter(h=>h.decision==='safe').length,    color:'#22c55e' },
          { label:'Rejected',        value: history.filter(h=>h.decision==='harmful').length, color:'#ef4444' },
        ].map(stat => (
          <div key={stat.label} style={{ flex:1, background:'#1a1d27', border:'1px solid #2e3352',
            borderRadius:10, padding:'0.75rem 1rem' }}>
            <div style={{ fontSize:24, fontWeight:800, color:stat.color }}>{stat.value}</div>
            <div style={{ fontSize:12, color:'#8892aa' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab==='pending')} onClick={()=>setTab('pending')}>
          Pending Review {pending.length > 0 && `(${pending.length})`}
        </button>
        <button style={s.tab(tab==='history')} onClick={()=>setTab('history')}>
          Review History
        </button>
      </div>

      {tab === 'pending' && (
        <div style={s.grid}>
          {pending.length === 0
            ? <div style={s.emptyBox}>
                <div style={{fontSize:40}}>🎉</div>
                <div style={{marginTop:8, fontWeight:600}}>No items pending review</div>
                <div style={{fontSize:13, marginTop:4}}>All gray-zone content has been reviewed or the queue is empty.</div>
              </div>
            : pending.map(item => (
                <PendingCard key={item.contentId} item={item} onDecide={handleDecide} />
              ))
          }
        </div>
      )}

      {tab === 'history' && (
        <div>
          {history.length === 0
            ? <div style={s.emptyBox}>No review history yet.</div>
            : history.slice(0,50).map(h => (
                <div key={h.contentId} style={s.historyCard}>
                  <div style={s.decisionDot(h.decision)} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:600, color:'#e8ecf4' }}>
                      {h.decision === 'safe' ? '✅ Safe' : '🚫 Harmful'}
                    </span>
                    <span style={{ fontSize:12, color:'#8892aa', marginLeft:8 }}>
                      {h.contentType} · by {h.reviewerName}
                    </span>
                  </div>
                  <span style={{ fontSize:11, color:'#8892aa' }}>
                    {h.reviewedAt ? new Date(h.reviewedAt).toLocaleTimeString() : '—'}
                  </span>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
