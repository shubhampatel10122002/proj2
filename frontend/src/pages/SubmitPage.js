import React, { useState, useRef } from 'react';
import axios from 'axios';

const INGESTION = 'http://localhost:3001';

const s = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  card: {
    background: '#1a1d27', border: '1px solid #2e3352',
    borderRadius: 12, padding: '1.5rem',
  },
  h2: { fontSize: 16, fontWeight: 700, color: '#e8ecf4', marginBottom: '1rem' },
  label: { fontSize: 13, color: '#8892aa', display: 'block', marginBottom: 6 },
  textarea: {
    width: '100%', background: '#0f1117', border: '1px solid #2e3352',
    borderRadius: 8, padding: '0.75rem', color: '#e8ecf4', fontSize: 14,
    resize: 'vertical', minHeight: 120, outline: 'none',
    fontFamily: 'inherit',
  },
  btn: (color='#4f8ef7') => ({
    marginTop: '0.75rem', width: '100%', padding: '0.65rem',
    background: `linear-gradient(135deg,${color},${color}cc)`,
    border: 'none', borderRadius: 8, color: '#fff',
    fontWeight: 700, fontSize: 14, cursor: 'pointer',
  }),
  dropzone: (drag) => ({
    border: `2px dashed ${drag ? '#4f8ef7' : '#2e3352'}`,
    borderRadius: 10, padding: '2rem', textAlign: 'center',
    cursor: 'pointer', color: drag ? '#4f8ef7' : '#8892aa',
    background: drag ? 'rgba(79,142,247,0.05)' : 'transparent',
    transition: 'all 0.2s',
  }),
  result: (status) => ({
    marginTop: '1.5rem', padding: '1rem 1.25rem',
    borderRadius: 10, border: '1px solid',
    borderColor: status === 'approved' ? '#22c55e'
               : status === 'rejected'  ? '#ef4444'
               : status === 'pending-review' ? '#f59e0b' : '#2e3352',
    background:  status === 'approved' ? 'rgba(34,197,94,0.08)'
               : status === 'rejected'  ? 'rgba(239,68,68,0.08)'
               : status === 'pending-review' ? 'rgba(245,158,11,0.08)'
               : 'rgba(46,51,82,0.4)',
  }),
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 },
  key: { color: '#8892aa' },
  val: { color: '#e8ecf4', fontWeight: 600 },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
    fontSize: 12, fontWeight: 700, background: color + '22', color,
    border: `1px solid ${color}55`,
  }),
  cid: {
    marginTop: 8, fontSize: 11, color: '#4f8ef7',
    wordBreak: 'break-all', background: 'rgba(79,142,247,0.08)',
    padding: '6px 10px', borderRadius: 6,
  },
  spinner: {
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid #2e3352', borderTopColor: '#4f8ef7',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    marginRight: 6, verticalAlign: 'middle',
  },
};

function StatusBadge({ status }) {
  const map = {
    approved:         ['#22c55e', '✅ Approved'],
    rejected:         ['#ef4444', '🚫 Rejected'],
    'pending-review': ['#f59e0b', '⏳ Pending Review'],
    queued:           ['#8892aa', '🕐 Queued'],
    processing:       ['#4f8ef7', '⚙️ Processing'],
  };
  const [color, label] = map[status] || ['#8892aa', status];
  return <span style={s.badge(color)}>{label}</span>;
}

function ResultCard({ result }) {
  if (!result) return null;
  const { status, decision, decisionSource, aiScore, ipfsCid, ipfsUrl } = result;
  return (
    <div style={s.result(status)}>
      <div style={{ marginBottom: 8 }}><StatusBadge status={status} /></div>
      <div style={s.row}><span style={s.key}>Content ID</span><span style={s.val}>{result.contentId?.substring(0,16)}…</span></div>
      {decision       && <div style={s.row}><span style={s.key}>Decision</span><span style={s.val}>{decision}</span></div>}
      {decisionSource && <div style={s.row}><span style={s.key}>Decided by</span><span style={s.val}>{decisionSource === 'AI' ? '🤖 AI Auto' : '👤 Human'}</span></div>}
      {aiScore != null && <div style={s.row}><span style={s.key}>AI Score</span><span style={s.val}>{(aiScore * 100).toFixed(1)}%</span></div>}
      {status === 'pending-review' && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#f59e0b' }}>
          → Awaiting a moderator. Open the <strong>Moderator</strong> tab to make the call.
        </div>
      )}
      {ipfsCid && (
        <div style={s.cid}>
          📦 IPFS CID: <a href={ipfsUrl} target="_blank" rel="noreferrer">{ipfsCid}</a>
        </div>
      )}
    </div>
  );
}

export default function SubmitPage() {
  const [text, setText]           = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [drag, setDrag]           = useState(false);
  const [submitting, setSub]      = useState(false);
  const [polling, setPoll]        = useState(false);
  const [result, setResult]       = useState(null);
  const [imgResult, setImgResult] = useState(null);
  const fileRef = useRef();

  // ── Text submission ──────────────────────────────────────
  async function submitText() {
    if (!text.trim()) return;
    setSub(true); setResult(null);
    try {
      const { data } = await axios.post(`${INGESTION}/submit/text`, { text });
      pollStatus(data.contentId, setResult);
    } catch (e) {
      setResult({ error: e.response?.data?.error || e.message });
    } finally { setSub(false); }
  }

  // ── Image submission ─────────────────────────────────────
  async function submitImage() {
    if (!imageFile) return;
    setSub(true); setImgResult(null);
    const fd = new FormData();
    fd.append('image', imageFile);
    try {
      const { data } = await axios.post(`${INGESTION}/submit/image`, fd);
      pollStatus(data.contentId, setImgResult);
    } catch (e) {
      setImgResult({ error: e.response?.data?.error || e.message });
    } finally { setSub(false); }
  }

  // ── Poll for final result ────────────────────────────────
  function pollStatus(contentId, setter, attempts = 0) {
    setPoll(true);
    setTimeout(async () => {
      try {
        const { data } = await axios.get(`${INGESTION}/status/${contentId}`);
        setter(data);
        if (data.status === 'queued' || data.status === 'processing') {
          if (attempts < 30) pollStatus(contentId, setter, attempts + 1);
        } else {
          setPoll(false);
        }
      } catch (_) {
        if (attempts < 30) pollStatus(contentId, setter, attempts + 1);
        else setPoll(false);
      }
    }, 2500);
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: '0.25rem' }}>Content Submission</h1>
      <p style={{ color: '#8892aa', fontSize: 14, marginBottom: '1.5rem' }}>
        Submit text or an image for AI-powered decentralized content moderation.
      </p>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={s.grid}>
        {/* ── Text Panel ── */}
        <div style={s.card}>
          <div style={s.h2}>📝 Submit Text</div>
          <label style={s.label}>Content to moderate</label>
          <textarea
            style={s.textarea}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter text for moderation…&#10;&#10;Try: 'Have a great day!' or a harmful phrase to see the system respond differently."
          />
          <button style={s.btn()} onClick={submitText} disabled={submitting || !text.trim()}>
            {submitting ? <><span style={s.spinner}/>Submitting…</> : '🚀 Submit for Moderation'}
          </button>
          {polling && !result?.status?.match(/approved|rejected|pending-review/) && (
            <p style={{ fontSize: 12, color: '#8892aa', marginTop: 8 }}>
              <span style={s.spinner}/>Polling for result…
            </p>
          )}
          <ResultCard result={result} />
        </div>

        {/* ── Image Panel ── */}
        <div style={s.card}>
          <div style={s.h2}>🖼️ Submit Image</div>
          <div
            style={s.dropzone(drag)}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); setImageFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current.click()}
          >
            {imageFile
              ? <><div style={{ fontSize: 24 }}>📎</div><div style={{ marginTop: 6 }}>{imageFile.name}</div><div style={{ fontSize: 12, marginTop: 2 }}>({(imageFile.size/1024).toFixed(1)} KB)</div></>
              : <><div style={{ fontSize: 32 }}>⬆️</div><div style={{ marginTop: 8, fontWeight: 600 }}>Drop image here or click to upload</div><div style={{ fontSize: 12, marginTop: 4 }}>PNG, JPG, WEBP up to 10MB</div></>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => setImageFile(e.target.files[0])} />
          {imageFile && (
            <img src={URL.createObjectURL(imageFile)} alt="preview"
              style={{ width:'100%', maxHeight:120, objectFit:'cover', borderRadius:8, marginTop:8 }} />
          )}
          <button style={s.btn('#7c5cbf')} onClick={submitImage} disabled={submitting || !imageFile}>
            {submitting ? <><span style={s.spinner}/>Uploading…</> : '🚀 Submit Image for Moderation'}
          </button>
          {polling && !imgResult?.status?.match(/approved|rejected|pending-review/) && (
            <p style={{ fontSize: 12, color: '#8892aa', marginTop: 8 }}>
              <span style={s.spinner}/>Polling for result…
            </p>
          )}
          <ResultCard result={imgResult} />
        </div>
      </div>

      {/* Architecture info box */}
      <div style={{ marginTop:'2rem', padding:'1rem 1.25rem', background:'#1a1d27',
        border:'1px solid #2e3352', borderRadius:12, fontSize:13, color:'#8892aa' }}>
        <strong style={{ color:'#e8ecf4' }}>How it works: </strong>
        Submissions go to the <strong style={{color:'#4f8ef7'}}>Ingestion Node (port 3001)</strong> →
        queued in <strong style={{color:'#0078d4'}}>Azure Queue Storage</strong> →
        picked up by <strong style={{color:'#f59e0b'}}>AI Processing Node (port 3002)</strong> using
        <strong style={{color:'#f59e0b'}}> AWS Rekognition</strong> or <strong style={{color:'#4285f4'}}>Google Perspective API</strong> →
        gray-zone items escalated to <strong style={{color:'#a78bfa'}}>Human Review (port 3003)</strong> →
        final decisions stored on <strong style={{color:'#65d0a5'}}>IPFS via Pinata (port 3004)</strong>.
        All nodes coordinate via <strong style={{color:'#a78bfa'}}>libp2p GossipSub</strong>.
      </div>
    </div>
  );
}
