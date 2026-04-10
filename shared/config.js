/**
 * shared/config.js
 * Central configuration for all nodes.
 * Values are read from process.env (populated via each node's .env file).
 */
require('dotenv').config();

module.exports = {
  ports: {
    ingestion:   process.env.INGESTION_PORT   || 3001,
    aiProcessor: process.env.AI_PORT          || 3002,
    humanReview: process.env.HUMAN_PORT       || 3003,
    storage:     process.env.STORAGE_PORT     || 3004,
    frontend:    process.env.FRONTEND_PORT    || 3000,
  },

  // Azure Queue Storage
  azure: {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    ingestQueue:      'moderation-tasks',
    reviewQueue:      'human-review-tasks',
    decisionQueue:    'final-decisions',
  },

  // AWS Rekognition
  aws: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region:          process.env.AWS_REGION || 'us-east-1',
  },

  // Google Perspective API
  google: {
    perspectiveApiKey: process.env.PERSPECTIVE_API_KEY,
    perspectiveUrl:
      'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze',
  },

  // IPFS / Infura
  ipfs: {
    projectId:     process.env.INFURA_IPFS_PROJECT_ID,
    projectSecret: process.env.INFURA_IPFS_PROJECT_SECRET,
    endpoint:      'https://ipfs.infura.io:5001',
  },

  // Human-in-the-loop confidence thresholds
  thresholds: {
    autoApprove: parseFloat(process.env.THRESHOLD_AUTO_APPROVE || '0.85'),
    autoReject:  parseFloat(process.env.THRESHOLD_AUTO_REJECT  || '0.85'),
    grayZoneLow: parseFloat(process.env.THRESHOLD_GRAY_LOW     || '0.40'),
  },

  // libp2p
  p2p: {
    topic: 'moderation-events',
  },
};
