/**
 * human-review-node/server.js
 * PORT: 3003
 *
 * Responsibilities:
 *  1. Poll Azure Queue for gray-zone items requiring human review
 *  2. Expose REST API for moderator dashboard
 *  3. Accept human decisions (safe / harmful) from the frontend
 *  4. Forward final decision to Storage Node via Azure Queue
 *  5. Broadcast decision via libp2p
 */
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const axios      = require('axios');

const config     = require('../shared/config');
const azureQueue = require('../shared/azureQueue');
const { createNode, publishEvent, subscribeToEvents } = require('../shared/p2pNode');

const app  = express();
const PORT = config.ports.humanReview;
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// In-memory queue of items awaiting human review
const pendingReview = new Map();   // contentId → task
const reviewHistory = [];          // completed reviews

// ──────────────────────────────────────────────────────────
// Poll Human Review Queue
// ──────────────────────────────────────────────────────────
let p2pNode = null;

async function pollReviewQueue() {
  try {
    const tasks = await azureQueue.receiveMessages(config.azure.reviewQueue, 5);
    for (const task of tasks) {
      pendingReview.set(task.contentId, task);
      console.log(`[HumanReview] New item for review: ${task.contentId} (AI score: ${task.aiScore?.toFixed(3)})`);
      if (p2pNode) {
        await publishEvent(p2pNode, 'review-required', {
          contentId:   task.contentId,
          contentType: task.contentType,
          aiScore:     task.aiScore,
        });
      }
    }
  } catch (err) {
    console.error('[HumanReview] Poll error:', err.message);
  }
  setTimeout(pollReviewQueue, 3000);
}

// ──────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────

/**
 * GET /pending
 * Returns all items awaiting human review.
 * Used by the moderator dashboard.
 */
app.get('/pending', (_req, res) => {
  const items = Array.from(pendingReview.values()).map(t => ({
    contentId:      t.contentId,
    contentType:    t.contentType,
    preview:        t.contentType === 'text'
                      ? (t.content || '').substring(0, 200)
                      : `[Image: ${t.originalName || 'uploaded'}]`,
    aiScore:        t.aiScore,
    aiDetails:      t.aiDetails?.attributeScores || t.aiDetails?.labels || {},
    decisionReason: t.decisionReason,
    submittedAt:    t.submittedAt,
    processedAt:    t.processedAt,
    provider:       t.aiDetails?.provider,
  }));
  res.json(items);
});

/**
 * GET /pending/:contentId
 * Full task detail for one pending item.
 */
app.get('/pending/:contentId', (req, res) => {
  const task = pendingReview.get(req.params.contentId);
  if (!task) return res.status(404).json({ error: 'Not found or already reviewed' });
  res.json(task);
});

/**
 * POST /decide/:contentId
 * Body: { decision: 'safe' | 'harmful', reviewerName?: string, notes?: string }
 *
 * Human moderator submits their verdict.
 */
app.post('/decide/:contentId', async (req, res) => {
  const { contentId } = req.params;
  const { decision, reviewerName = 'moderator', notes = '' } = req.body;

  if (!['safe', 'harmful'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "safe" or "harmful"' });
  }

  const task = pendingReview.get(contentId);
  if (!task) return res.status(404).json({ error: 'Item not found in review queue' });

  const finalRecord = {
    ...task,
    decision,
    decisionSource: 'human',
    reviewerName,
    reviewNotes:    notes,
    reviewedAt:     new Date().toISOString(),
    status:         decision === 'safe' ? 'approved' : 'rejected',
  };

  // Remove from pending
  pendingReview.delete(contentId);
  reviewHistory.unshift(finalRecord);
  if (reviewHistory.length > 200) reviewHistory.pop();

  // → Azure Queue → Storage Node
  await azureQueue.sendMessage(config.azure.decisionQueue, finalRecord);
  console.log(`[HumanReview] Decision recorded: ${contentId} → ${decision} (by ${reviewerName})`);

  // Update ingestion node status
  try {
    await axios.put(`http://localhost:${config.ports.ingestion}/status/${contentId}`, {
      status:         finalRecord.status,
      decision:       finalRecord.decision,
      decisionSource: 'human',
      reviewerName,
      aiScore:        task.aiScore,
    });
  } catch (_) { /* non-critical */ }

  // libp2p broadcast
  if (p2pNode) {
    await publishEvent(p2pNode, 'moderation-complete', {
      contentId,
      decision,
      decisionSource: 'human',
      reviewer:       reviewerName,
    });
  }

  res.json({ message: 'Decision recorded', contentId, decision, status: finalRecord.status });
});

/**
 * GET /history
 * Returns recently reviewed items.
 */
app.get('/history', (_req, res) => {
  res.json(reviewHistory.slice(0, 50));
});

app.get('/health', (_req, res) => res.json({ node: 'human-review', status: 'ok', pendingCount: pendingReview.size }));

// ──────────────────────────────────────────────────────────
// STARTUP
// ──────────────────────────────────────────────────────────
async function start() {
  p2pNode = await createNode(10003, 'human-review');

  subscribeToEvents(p2pNode, (eventType, data) => {
    console.log(`[HumanReview][p2p] Event: ${eventType}`, data?.contentId || '');
  });

  app.listen(PORT, () => {
    console.log(`\n✅ Human Review Node running on http://localhost:${PORT}`);
    console.log('   Polling Azure Queue: human-review-tasks (every 3s)');
    console.log('   Moderator dashboard API ready\n');
  });

  setTimeout(pollReviewQueue, 2000);
}

start().catch(err => {
  console.error('[HumanReview] Fatal error:', err);
  process.exit(1);
});
