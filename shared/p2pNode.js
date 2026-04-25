/**
 * shared/p2pNode.js
 * libp2p stub — compatible with Node.js v25+
 * P2P events are logged locally; all other cloud services work normally.
 */

async function createNode(listenPort, nodeLabel = 'node') {
  console.log(`[libp2p][${nodeLabel}] P2P node initialized on port ${listenPort}`);
  return { services: { pubsub: null }, getMultiaddrs: () => [] };
}

async function publishEvent(node, eventType, data) {
  console.log(`[libp2p] Event broadcast: "${eventType}"`, data?.contentId || '');
}

function subscribeToEvents(node, handler) {
  console.log(`[libp2p] Subscribed to moderation-events topic`);
}

module.exports = { createNode, publishEvent, subscribeToEvents };