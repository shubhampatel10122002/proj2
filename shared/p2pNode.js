/**
 * shared/p2pNode.js
 * Creates and starts a libp2p node for peer-to-peer messaging between services.
 *
 * WHY libp2p here?
 *   Azure Queue  => reliable async task routing (survives node restarts)
 *   libp2p       => real-time decentralized event broadcast (node discovery,
 *                   status updates, decision propagation across peers)
 *
 * Each service creates one libp2p node.  All nodes subscribe to the same
 * GossipSub topic so that broadcast events reach every peer instantly.
 */
const { createLibp2p }       = require('libp2p');
const { TCP }                = require('@libp2p/tcp');
const { Noise }              = require('@chainsafe/libp2p-noise');
const { Yamux }              = require('@chainsafe/libp2p-yamux');
const { GossipSub }          = require('@chainsafe/libp2p-gossipsub');
const { Bootstrap }          = require('@libp2p/bootstrap');
const { fromString, toString } = require('uint8arrays');
const config = require('./config');

const BOOTSTRAP_LIST = [
  // When running locally each node discovers others via these multiaddrs.
  // The ingestion node always starts first so its addr acts as bootstrap.
  '/ip4/127.0.0.1/tcp/10001/p2p/QmBootstrap1111111111111111111111111111111111111',
];

/**
 * Create a libp2p node listening on `listenPort`.
 * @param {number} listenPort  TCP port for libp2p transport
 * @param {string} nodeLabel   Human-readable label for logs
 */
async function createNode(listenPort, nodeLabel = 'node') {
  const node = await createLibp2p({
    addresses: { listen: [`/ip4/0.0.0.0/tcp/${listenPort}`] },
    transports: [new TCP()],
    connectionEncrypters: [new Noise()],
    streamMuxers: [new Yamux()],
    services: {
      pubsub: new GossipSub({ allowPublishToZeroTopicPeers: true }),
    },
  });

  await node.start();

  const addrs = node.getMultiaddrs().map(a => a.toString());
  console.log(`[libp2p][${nodeLabel}] Node started. Listening on:`, addrs);

  return node;
}

/**
 * Publish an event to all peers subscribed to the moderation topic.
 */
async function publishEvent(node, eventType, data) {
  const msg = JSON.stringify({ eventType, data, ts: Date.now() });
  try {
    await node.services.pubsub.publish(
      config.p2p.topic,
      fromString(msg)
    );
    console.log(`[libp2p] Published event "${eventType}"`);
  } catch (err) {
    // Non-fatal: queue is the reliable channel; libp2p is best-effort broadcast
    console.warn(`[libp2p] Publish warning (${eventType}):`, err.message);
  }
}

/**
 * Subscribe to moderation topic and call `handler(eventType, data)`.
 */
function subscribeToEvents(node, handler) {
  node.services.pubsub.subscribe(config.p2p.topic);
  node.services.pubsub.addEventListener('message', event => {
    try {
      const { eventType, data } = JSON.parse(toString(event.detail.data));
      handler(eventType, data);
    } catch (err) {
      console.warn('[libp2p] Failed to parse incoming message:', err.message);
    }
  });
  console.log(`[libp2p] Subscribed to topic "${config.p2p.topic}"`);
}

module.exports = { createNode, publishEvent, subscribeToEvents };
