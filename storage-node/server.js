/**
 * storage-node/server.js
 * PORT: 3004
 *
 * Responsibilities:
 *  1. Poll Azure Queue for final moderation decisions
 *  2. Build a structured record and pin it to IPFS via Infura
 *  3. Return IPFS CID for the audit trail
 *  4. Maintain local index of all stored records
 *  5. Broadcast storage events via libp2p
 *  6. Update ingestion node with IPFS CID
 */
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const axios      = require('axios');

const config     = require('../shared/config');
const azureQueue = require('../shared/azureQueue');
const ipfsClient = require('../shared/ipfsClient');
const { createNode, publishEvent, subscribeToEvents } = require('../shared/p2pNode');

const app  = express();
const PORT = config.ports.storage;
app.use(cors());
app.use(express.json());

// In-memory index of stored records
const storedRecords = [];

// ──────────────────────────────────────────────────────────
// Build the canonical IPFS record
// ──────────────────────────────────────────────────────────
function buildIpfsRecord(task) {
  return {
    // Identity
    contentId:     task.contentId,
    contentType:   task.contentType,

    // Content reference (store metadata, not raw content)
    contentPreview: task.contentType === 'text'
      ? (task.content || '').substring(0, 500)
      : { filename: task.originalName, sizeBytes: task.sizeBytes, mimeType: task.mimeType },

    // AI analysis
    aiProvider:    task.aiDetails?.provider || 'unknown',
    moderationScore: task.aiScore,
    aiDetails:     task.aiDetails?.attributeScores || task.aiDetails?.labels || null,

    // Decision
    decision:      task.decision,          // 'safe' | 'harmful'
    decisionSource: task.decisionSource,   // 'AI' | 'human'
    decisionReason: task.decisionReason || null,
    confidence:    task.aiScore,

    // Human review (if applicable)
    reviewerName:  task.reviewerName  || null,
    reviewNotes:   task.reviewNotes   || null,
    reviewedAt:    task.reviewedAt    || null,

    // Timestamps
    submittedAt:   task.submittedAt,
    processedAt:   task.processedAt,
    storedAt:      new Date().toISOString(),

    // Status
    status:        task.status,

    // Schema versioning for future audits
    schemaVersion: '1.0',
    systemName:    'Decentralized AI Content Moderation',
  };
}

// ──────────────────────────────────────────────────────────
// Poll decision queue and store to IPFS
// ──────────────────────────────────────────────────────────
let p2pNode = null;

async function pollDecisionQueue() {
  try {
    const tasks = await azureQueue.receiveMessages(config.azure.decisionQueue, 5);
    for (const task of tasks) {
      await storeDecision(task);
    }
  } catch (err) {
    console.error('[Storage] Poll error:', err.message);
  }
  setTimeout(pollDecisionQueue, 3000);
}

async function storeDecision(task) {
  const record = buildIpfsRecord(task);

  let cid = null;
  try {
    cid = await ipfsClient.storeRecord(record);
  } catch (err) {
    console.error(`[Storage] IPFS error for ${task.contentId}:`, err.message);
    cid = `local-fallback-${task.contentId}`;
  }

  const indexEntry = {
    contentId:      task.contentId,
    cid,
    decision:       record.decision,
    decisionSource: record.decisionSource,
    contentType:    record.contentType,
    storedAt:       record.storedAt,
    ipfsUrl:        `https://infura-ipfs.io/ipfs/${cid}`,
    record,
  };

  storedRecords.unshift(indexEntry);
  if (storedRecords.length > 500) storedRecords.pop();

  console.log(`[Storage] Stored: ${task.contentId} → CID: ${cid}`);

  // Notify ingestion node with CID
  try {
    await axios.put(`http://localhost:${config.ports.ingestion}/status/${task.contentId}`, {
      ipfsCid: cid,
      ipfsUrl: indexEntry.ipfsUrl,
      status:  task.status,
      decision: record.decision,
    });
  } catch (_) { /* non-critical */ }

  // libp2p broadcast
  if (p2pNode) {
    await publishEvent(p2pNode, 'record-stored', {
      contentId: task.contentId,
      cid,
      decision:  record.decision,
    });
  }

  return { cid, record };
}

// ──────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────

app.get('/records', (_req, res) => {
  res.json(storedRecords.slice(0, 100));
});

app.get('/records/:contentId', (req, res) => {
  const entry = storedRecords.find(r => r.contentId === req.params.contentId);
  if (!entry) return res.status(404).json({ error: 'Record not found' });
  res.json(entry);
});

/**
 * POST /store  — direct storage endpoint (for testing)
 */
app.post('/store', async (req, res) => {
  try {
    const result = await storeDecision(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({
  node:    'storage',
  status:  'ok',
  records: storedRecords.length,
}));

// ──────────────────────────────────────────────────────────
// STARTUP
// ──────────────────────────────────────────────────────────
async function start() {
  p2pNode = await createNode(10004, 'storage');

  subscribeToEvents(p2pNode, (eventType, data) => {
    console.log(`[Storage][p2p] Event: ${eventType}`, data?.contentId || '');
  });

  app.listen(PORT, () => {
    console.log(`\n✅ Storage Node running on http://localhost:${PORT}`);
    console.log('   Polling Azure Queue: final-decisions (every 3s)');
    console.log('   IPFS pinning via Infura\n');
  });

  setTimeout(pollDecisionQueue, 2000);
}

start().catch(err => {
  console.error('[Storage] Fatal error:', err);
  process.exit(1);
});
