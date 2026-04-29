/**
 * shared/p2pNode.js
 *
 * Real libp2p node:
 *   - TCP transport
 *   - Noise encryption
 *   - Yamux stream multiplexing
 *   - GossipSub pubsub (topic: moderation-events)
 *   - mDNS for local peer discovery (works for localhost demo across processes)
 *
 * libp2p 1.x is ESM-only, so we use dynamic import() from CommonJS.
 */
const config = require('./config');

const TOPIC = config.p2p.topic; // 'moderation-events'

/**
 * Create and start a libp2p node listening on the given TCP port.
 *
 * @param {number} listenPort   TCP port for libp2p
 * @param {string} nodeLabel    Human-readable label for logs
 * @returns {Promise<Libp2p>}   A started libp2p node with gossipsub service
 */
async function createNode(listenPort, nodeLabel = 'node') {
  const { createLibp2p }   = await import('libp2p');
  const { tcp }            = await import('@libp2p/tcp');
  const { noise }          = await import('@chainsafe/libp2p-noise');
  const { yamux }          = await import('@chainsafe/libp2p-yamux');
  const { gossipsub }      = await import('@chainsafe/libp2p-gossipsub');
  const { mdns }           = await import('@libp2p/mdns');
  const { identify }       = await import('@libp2p/identify');

  const node = await createLibp2p({
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${listenPort}`],
    },
    transports:        [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers:      [yamux()],
    peerDiscovery:     [mdns({ interval: 2000 })],
    services: {
      identify: identify(),
      pubsub:   gossipsub({
        emitSelf:                 false,
        allowPublishToZeroTopicPeers: true,
      }),
    },
  });

  await node.start();

  const peerId = node.peerId.toString();
  console.log(`[libp2p][${nodeLabel}] Started peerId=${peerId.slice(0, 16)}... on port ${listenPort}`);

  // Log peer connections
  node.addEventListener('peer:discovery', (evt) => {
    const peer = evt.detail.id?.toString?.() || String(evt.detail);
    console.log(`[libp2p][${nodeLabel}] Discovered peer: ${peer.slice(0, 16)}...`);
  });
  node.addEventListener('peer:connect', (evt) => {
    const peer = evt.detail?.toString?.() || '';
    console.log(`[libp2p][${nodeLabel}] Connected to peer: ${peer.slice(0, 16)}...`);
  });

  // Subscribe to the shared topic up front so messages start flowing
  // as soon as a peer is discovered.
  node.services.pubsub.subscribe(TOPIC);

  return node;
}

/**
 * Publish an event to the moderation-events topic.
 * Payload is wrapped as { type, data, ts, from }.
 */
async function publishEvent(node, eventType, data) {
  if (!node || !node.services?.pubsub) return;
  const { fromString } = await import('uint8arrays/from-string');

  const envelope = {
    type: eventType,
    data,
    ts:   new Date().toISOString(),
    from: node.peerId.toString(),
  };

  try {
    await node.services.pubsub.publish(TOPIC, fromString(JSON.stringify(envelope)));
    console.log(`[libp2p] Published "${eventType}"${data?.contentId ? ` (${data.contentId.slice(0, 8)})` : ''}`);
  } catch (err) {
    // Pubsub raises "NoPeersSubscribedToTopic" until the mesh forms.
    // That's fine for a localhost demo; log and continue.
    console.log(`[libp2p] Publish skipped (${err.message})`);
  }
}

/**
 * Subscribe to messages on the moderation-events topic.
 * Handler receives (eventType, data, envelope).
 */
function subscribeToEvents(node, handler) {
  if (!node || !node.services?.pubsub) return;

  node.services.pubsub.addEventListener('message', async (evt) => {
    if (evt.detail.topic !== TOPIC) return;

    const { toString } = await import('uint8arrays/to-string');
    let envelope;
    try {
      envelope = JSON.parse(toString(evt.detail.data));
    } catch {
      return;
    }

    try {
      handler(envelope.type, envelope.data, envelope);
    } catch (err) {
      console.error('[libp2p] Handler error:', err.message);
    }
  });

  console.log(`[libp2p] Subscribed to topic: ${TOPIC}`);
}

module.exports = { createNode, publishEvent, subscribeToEvents };
