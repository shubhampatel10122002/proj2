/**
 * ingestion-node/server.js
 * PORT: 3001
 *
 * Responsibilities:
 *  1. Accept content submissions (text or image) from the React frontend
 *  2. Assign a unique contentId
 *  3. Push the task onto Azure Queue Storage → AI Processing node picks it up
 *  4. Broadcast a "content-submitted" event via libp2p pubsub
 *  5. Track submission state in memory (demo store)
 */
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const { v4: uuidv4 } = require('uuid');
const path       = require('path');

const config     = require('../shared/config');
const azureQueue = require('../shared/azureQueue');
const { createNode, publishEvent, subscribeToEvents } = require('../shared/p2pNode');

const app     = express();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const PORT    = config.ports.ingestion;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory state store (replace with Redis/DB in production)
const submissions = new Map();

// ──────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────

/**
 * POST /submit/text
 * Body: { text: string }
 */
app.post('/submit/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'text field is required' });
    }

    const contentId = uuidv4();
    const task = {
      contentId,
      contentType: 'text',
      content:     text.trim(),
      submittedAt: new Date().toISOString(),
      status:      'queued',
    };

    submissions.set(contentId, task);

    // → Azure Queue (reliable async routing)
    await azureQueue.sendMessage(config.azure.ingestQueue, task);

    // → libp2p broadcast (real-time peer notification)
    if (p2pNode) {
      await publishEvent(p2pNode, 'content-submitted', {
        contentId,
        contentType: 'text',
        preview: text.substring(0, 80),
      });
    }

    console.log(`[Ingestion] Text submitted: ${contentId}`);
    res.status(202).json({ contentId, status: 'queued', message: 'Submitted for moderation' });
  } catch (err) {
    console.error('[Ingestion] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /submit/image
 * multipart/form-data: field "image"
 */
app.post('/submit/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'image file is required' });
    }

    const contentId = uuidv4();
    const imageBase64 = req.file.buffer.toString('base64');
    const task = {
      contentId,
      contentType:  'image',
      imageBase64,
      mimeType:     req.file.mimetype,
      originalName: req.file.originalname,
      sizeBytes:    req.file.size,
      submittedAt:  new Date().toISOString(),
      status:       'queued',
    };

    submissions.set(contentId, { ...task, imageBase64: '[stored]' }); // don't keep large blob in memory

    await azureQueue.sendMessage(config.azure.ingestQueue, task);

    if (p2pNode) {
      await publishEvent(p2pNode, 'content-submitted', {
        contentId,
        contentType:  'image',
        originalName: req.file.originalname,
        sizeBytes:    req.file.size,
      });
    }

    console.log(`[Ingestion] Image submitted: ${contentId}`);
    res.status(202).json({ contentId, status: 'queued', message: 'Image submitted for moderation' });
  } catch (err) {
    console.error('[Ingestion] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /status/:contentId
 * Poll for moderation result.
 */
app.get('/status/:contentId', (req, res) => {
  const task = submissions.get(req.params.contentId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

/**
 * PUT /status/:contentId
 * Called by other nodes to update submission state.
 */
app.put('/status/:contentId', (req, res) => {
  const existing = submissions.get(req.params.contentId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const updated = { ...existing, ...req.body };
  submissions.set(req.params.contentId, updated);
  res.json(updated);
});

/**
 * GET /submissions
 * List all tracked submissions (demo endpoint).
 */
app.get('/submissions', (_req, res) => {
  res.json(Array.from(submissions.values()));
});

app.get('/health', (_req, res) => res.json({ node: 'ingestion', status: 'ok' }));

// ──────────────────────────────────────────────────────────
// STARTUP
// ──────────────────────────────────────────────────────────
let p2pNode = null;

async function start() {
  // libp2p on port 10001
  p2pNode = await createNode(10001, 'ingestion');

  // React to events from other peers
  subscribeToEvents(p2pNode, (eventType, data) => {
    console.log(`[Ingestion][p2p] Event received: ${eventType}`, data?.contentId || '');
    if (eventType === 'moderation-complete' && data?.contentId) {
      const existing = submissions.get(data.contentId);
      if (existing) {
        submissions.set(data.contentId, { ...existing, ...data });
      }
    }
  });

  app.listen(PORT, () => {
    console.log(`\n✅ Ingestion Node running on http://localhost:${PORT}`);
    console.log('   Azure Queue → moderation-tasks');
    console.log('   libp2p      → topic: moderation-events\n');
  });
}

start().catch(err => {
  console.error('[Ingestion] Fatal startup error:', err);
  process.exit(1);
});
