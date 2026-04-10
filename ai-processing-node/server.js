/**
 * ai-processing-node/server.js
 * PORT: 3002
 *
 * Responsibilities:
 *  1. Poll Azure Queue for new moderation tasks
 *  2. Route to AWS Rekognition (image) or Google Perspective API (text)
 *  3. Calculate confidence score and classify
 *  4. Auto-decide high-confidence cases
 *  5. Route gray-zone cases to Human Review queue
 *  6. Forward decisions to Storage Node
 *  7. Broadcast decision events via libp2p
 */
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const axios      = require('axios');
const AWS        = require('aws-sdk');

const config     = require('../shared/config');
const azureQueue = require('../shared/azureQueue');
const { createNode, publishEvent, subscribeToEvents } = require('../shared/p2pNode');

const app  = express();
const PORT = config.ports.aiProcessor;
app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────────────────
// AWS Rekognition setup
// ──────────────────────────────────────────────────────────
const rekognition = new AWS.Rekognition({
  accessKeyId:     config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region:          config.aws.region,
});

/**
 * Analyze an image using AWS Rekognition DetectModerationLabels.
 * Returns { score, labels, provider }
 */
async function analyzeImage(base64Image) {
  const params = {
    Image:        { Bytes: Buffer.from(base64Image, 'base64') },
    MinConfidence: 50,
  };
  const result = await rekognition.detectModerationLabels(params).promise();
  const labels = result.ModerationLabels || [];

  // Aggregate: highest individual label confidence → overall harm score
  let maxConfidence = 0;
  for (const label of labels) {
    if (label.Confidence > maxConfidence) maxConfidence = label.Confidence;
  }

  return {
    score:    maxConfidence / 100,  // Normalise to 0-1
    labels:   labels.map(l => ({ name: l.Name, confidence: l.Confidence })),
    provider: 'AWS Rekognition',
    rawResult: labels,
  };
}

// ──────────────────────────────────────────────────────────
// Google Perspective API setup
// ──────────────────────────────────────────────────────────

/**
 * Analyze text using Google Perspective API.
 * Returns { score, attributeScores, provider }
 */
async function analyzeText(text) {
  const url      = `${config.google.perspectiveUrl}?key=${config.google.perspectiveApiKey}`;
  const payload  = {
    comment:            { text },
    requestedAttributes: {
      TOXICITY:          {},
      SEVERE_TOXICITY:   {},
      IDENTITY_ATTACK:   {},
      INSULT:            {},
      THREAT:            {},
    },
    languages: ['en'],
  };

  const response = await axios.post(url, payload);
  const scores   = response.data.attributeScores;

  // Use TOXICITY as primary score
  const toxicityScore = scores.TOXICITY?.summaryScore?.value || 0;

  return {
    score:           toxicityScore,
    attributeScores: {
      toxicity:        scores.TOXICITY?.summaryScore?.value,
      severeToxicity:  scores.SEVERE_TOXICITY?.summaryScore?.value,
      identityAttack:  scores.IDENTITY_ATTACK?.summaryScore?.value,
      insult:          scores.INSULT?.summaryScore?.value,
      threat:          scores.THREAT?.summaryScore?.value,
    },
    provider: 'Google Perspective API',
  };
}

// ──────────────────────────────────────────────────────────
// Decision Logic (Human-in-the-Loop)
// ──────────────────────────────────────────────────────────

/**
 * Determine moderation action based on score.
 *
 * For images  (harm score):
 *   score >= 0.85  → auto-reject  (harmful)
 *   score <= 0.15  → auto-approve (safe image — low harm score)
 *   else           → human review
 *
 * For text (toxicity score):
 *   score >= 0.85  → auto-reject
 *   score < 0.40   → auto-approve
 *   else           → human review
 */
function makeDecision(score, contentType) {
  const { autoApprove, autoReject, grayZoneLow } = config.thresholds;

  if (contentType === 'image') {
    // For images: score = harm detected; invert logic → LOW score = safe
    if (score >= autoReject)  return { action: 'auto-reject',  source: 'AI',    reason: 'High-confidence harmful image' };
    if (score <= 0.15)        return { action: 'auto-approve', source: 'AI',    reason: 'Low harm signals detected' };
    return                          { action: 'human-review',  source: 'human', reason: 'Ambiguous harm signals — requires moderator' };
  } else {
    // For text: score = toxicity; HIGH score = harmful
    if (score >= autoReject)  return { action: 'auto-reject',  source: 'AI',    reason: 'High toxicity detected' };
    if (score < grayZoneLow)  return { action: 'auto-approve', source: 'AI',    reason: 'Low toxicity score — content appears safe' };
    return                          { action: 'human-review',  source: 'human', reason: 'Moderate toxicity — requires human judgment' };
  }
}

// ──────────────────────────────────────────────────────────
// Core processing pipeline
// ──────────────────────────────────────────────────────────

async function processTask(task, p2pNode) {
  console.log(`[AI] Processing task: ${task.contentId} (${task.contentType})`);

  let analysisResult;
  try {
    if (task.contentType === 'image') {
      analysisResult = await analyzeImage(task.imageBase64);
    } else {
      analysisResult = await analyzeText(task.content);
    }
  } catch (err) {
    console.error(`[AI] Analysis error for ${task.contentId}:`, err.message);
    // On API failure, escalate to human review
    analysisResult = {
      score:    0.5,
      provider: task.contentType === 'image' ? 'AWS Rekognition' : 'Google Perspective API',
      error:    err.message,
    };
  }

  const decision = makeDecision(analysisResult.score, task.contentType);

  const result = {
    ...task,
    aiScore:      analysisResult.score,
    aiDetails:    analysisResult,
    decision:     decision.action === 'auto-reject' ? 'harmful' : decision.action === 'auto-approve' ? 'safe' : 'pending',
    decisionSource: decision.source,
    decisionReason: decision.reason,
    processedAt:  new Date().toISOString(),
    status:       decision.action === 'human-review' ? 'pending-review' :
                  decision.action === 'auto-approve'  ? 'approved' : 'rejected',
  };

  if (decision.action === 'human-review') {
    // → Azure Queue → Human Review Node picks up
    await azureQueue.sendMessage(config.azure.reviewQueue, result);
    console.log(`[AI] Escalated to human review: ${task.contentId} (score: ${analysisResult.score.toFixed(3)})`);
  } else {
    // → Azure Queue → Storage Node stores immediately
    await azureQueue.sendMessage(config.azure.decisionQueue, result);
    console.log(`[AI] Auto-decided "${decision.action}": ${task.contentId} (score: ${analysisResult.score.toFixed(3)})`);

    // Notify ingestion node via HTTP to update status
    try {
      const axios2 = require('axios');
      await axios2.put(`http://localhost:${config.ports.ingestion}/status/${task.contentId}`, {
        status: result.status,
        decision: result.decision,
        decisionSource: 'AI',
        aiScore: result.aiScore,
      });
    } catch (_) { /* non-critical */ }
  }

  // Broadcast via libp2p to all peers
  if (p2pNode) {
    await publishEvent(p2pNode, 'moderation-complete', {
      contentId:      result.contentId,
      status:         result.status,
      decision:       result.decision,
      decisionSource: result.decisionSource,
      aiScore:        result.aiScore,
    });
  }

  return result;
}

// ──────────────────────────────────────────────────────────
// Queue polling loop
// ──────────────────────────────────────────────────────────
let p2pNode = null;

async function pollQueue() {
  try {
    const tasks = await azureQueue.receiveMessages(config.azure.ingestQueue, 5);
    for (const task of tasks) {
      await processTask(task, p2pNode);
    }
  } catch (err) {
    console.error('[AI] Poll error:', err.message);
  }
  setTimeout(pollQueue, 3000); // poll every 3 seconds
}

// ──────────────────────────────────────────────────────────
// REST API
// ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ node: 'ai-processing', status: 'ok' }));

/**
 * POST /analyze/text  — direct analysis endpoint (for testing)
 */
app.post('/analyze/text', async (req, res) => {
  try {
    const result = await analyzeText(req.body.text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /analyze/image  — base64 image (for testing)
 */
app.post('/analyze/image', async (req, res) => {
  try {
    const result = await analyzeImage(req.body.imageBase64);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// STARTUP
// ──────────────────────────────────────────────────────────
async function start() {
  p2pNode = await createNode(10002, 'ai-processor');

  subscribeToEvents(p2pNode, (eventType, data) => {
    console.log(`[AI][p2p] Event: ${eventType}`, data?.contentId || '');
  });

  app.listen(PORT, () => {
    console.log(`\n✅ AI Processing Node running on http://localhost:${PORT}`);
    console.log('   Polling Azure Queue: moderation-tasks  (every 3s)');
    console.log('   AWS Rekognition  → image moderation');
    console.log('   Perspective API  → text toxicity\n');
  });

  // Start queue polling after small delay
  setTimeout(pollQueue, 2000);
}

start().catch(err => {
  console.error('[AI Processing] Fatal error:', err);
  process.exit(1);
});
