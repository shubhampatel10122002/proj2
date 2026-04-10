import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const STORAGE = 'http://localhost:3004';

const s = {
  h1: { fontSize:22, fontWeight:800, marginBottom:'0.25rem' },
  sub: { color:'#8892aa', fontSize:14, marginBottom:'1.5rem' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'8px 12px', color:'#8892aa', fontWeight:600,
        borderBottom:'1px solid #2e3352', background:'#1a1d27' },
  td: { padding:'8px 12px', borderBottom:'1px solid #1e2235', color:'#e8ecf4', verticalAlign:'top' },
  safe: { color:'#22c55e', fontWeight:700 },
  harmful: { color:'#ef4444', fontWeight:700 },
  cid: { fontSize:11, color:'#4f8ef7', wordBreak:'break-all', maxWidth:160 },
  source: { fontSize:11, color:'#8892aa' },
  emptyBox: { textAlign:'center', padding:'4rem', color:'#8892aa', background:'#1a1d27',
              border:'1px dashed #2e3352', borderRadius:12 },
  sampleBox: {
    background:'#1a1d27', border:'1px solid #2e3352', borderRadius:12, padding:'1.5rem',
    marginBottom:'1.5rem', fontSize:13,
  },
  pre: {
    background:'#0f1117', border:'1px solid #2e3352', borderRadius:8,
    padding:'1rem', color:'#22c55e', fontSize:12, overflowX:'auto',
    fontFamily:'monospace', marginTop:8,
  },
};

const SAMPLE_CID_RECORD = {
  contentId: "f3a2b1c0-9d8e-7f6a-5b4c-3d2e1f0a9b8c",
  contentType: "text",
  contentPreview: "Have a wonderful and productive day!",
  aiProvider: "Google Perspective API",
  moderationScore: 0.03,
  aiDetails: { toxicity: 0.03, severeToxicity: 0.01, insult: 0.02, threat: 0.01 },
  decision: "safe",
  decisionSource: "AI",
  decisionReason: "Low toxicity score — content appears safe",
  confidence: 0.03,
  reviewerName: null,
  submittedAt: "2024-01-15T10:23:11.000Z",
  processedAt: "2024-01-15T10:23:12.847Z",
  storedAt: "2024-01-15T10:23:13.211Z",
  status: "approved",
  schemaVersion: "1.0",
  systemName: "Decentralized AI Content Moderation",
};

export default function AuditPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${STORAGE}/records`);
      setRecords(data);
    } catch (e) {
      console.error('Could not reach storage-node:', e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  return (
    <div>
      <h1 style={s.h1}>🗂️ Audit Trail (IPFS)</h1>
      <p style={s.sub}>Every final moderation decision is immutably stored on IPFS via Infura.</p>

      {/* Sample IPFS record */}
      <div style={s.sampleBox}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <strong style={{ color:'#e8ecf4' }}>📦 Sample IPFS Moderation Record</strong>
          <button onClick={() => setShowSample(!showSample)}
            style={{ background:'none', border:'1px solid #2e3352', color:'#8892aa',
              borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:12 }}>
            {showSample ? 'Hide' : 'Show'} JSON
          </button>
        </div>
        <p style={{ color:'#8892aa', marginTop:4, fontSize:12 }}>
          Each record is pinned to IPFS — accessible globally via any IPFS gateway using the CID.
        </p>
        {showSample && (
          <pre style={s.pre}>{JSON.stringify(SAMPLE_CID_RECORD, null, 2)}</pre>
        )}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <span style={{ fontSize:14, color:'#8892aa' }}>
          {loading ? '⟳ Loading…' : `${records.length} records stored on IPFS`}
        </span>
        <button onClick={load}
          style={{ padding:'6px 14px', background:'#1a1d27', border:'1px solid #2e3352',
            borderRadius:7, color:'#8892aa', cursor:'pointer', fontSize:13 }}>
          ⟳ Refresh
        </button>
      </div>

      {records.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={{ fontSize:40 }}>📭</div>
          <div style={{ marginTop:8, fontWeight:600 }}>No records stored yet</div>
          <div style={{ fontSize:13, marginTop:4 }}>
            Submit and moderate content to populate the IPFS audit trail.
          </div>
        </div>
      ) : (
        <div style={{ background:'#1a1d27', border:'1px solid #2e3352', borderRadius:12, overflow:'hidden' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Content ID</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Decision</th>
                <th style={s.th}>Source</th>
                <th style={s.th}>AI Score</th>
                <th style={s.th}>IPFS CID</th>
                <th style={s.th}>Stored</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.contentId} style={{ ':hover': { background:'#21263a' } }}>
                  <td style={s.td}>
                    <span style={{ fontFamily:'monospace', fontSize:12 }}>
                      {r.contentId?.substring(0,14)}…
                    </span>
                  </td>
                  <td style={s.td}>{r.contentType === 'text' ? '📝' : '🖼️'} {r.contentType}</td>
                  <td style={s.td}>
                    <span style={r.decision === 'safe' ? s.safe : s.harmful}>
                      {r.decision === 'safe' ? '✅ Safe' : '🚫 Harmful'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={s.source}>
                      {r.decisionSource === 'AI' ? '🤖 AI' : '👤 Human'}
                    </span>
                  </td>
                  <td style={s.td}>
                    {r.record?.moderationScore != null
                      ? `${(r.record.moderationScore * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td style={s.td}>
                    {r.cid
                      ? <a style={s.cid} href={r.ipfsUrl} target="_blank" rel="noreferrer">{r.cid}</a>
                      : '—'
                    }
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize:11, color:'#8892aa' }}>
                      {r.storedAt ? new Date(r.storedAt).toLocaleTimeString() : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
