/**
 * shared/azureQueue.js
 * Wrapper around Azure Storage Queue SDK v12.
 * Used by ingestion, AI processing, human review, and storage nodes.
 */
const { QueueServiceClient } = require('@azure/storage-queue');
const config = require('./config');

let _serviceClient = null;

function getServiceClient() {
  if (!_serviceClient) {
    _serviceClient = QueueServiceClient.fromConnectionString(
      config.azure.connectionString
    );
  }
  return _serviceClient;
}

/**
 * Ensure a queue exists (create if missing).
 */
async function ensureQueue(queueName) {
  const client = getServiceClient().getQueueClient(queueName);
  await client.createIfNotExists();
  return client;
}

/**
 * Send a message to an Azure Queue.
 * Messages are base64-encoded JSON.
 */
async function sendMessage(queueName, payload) {
  const client  = await ensureQueue(queueName);
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  const result  = await client.sendMessage(encoded);
  console.log(`[AzureQueue] Sent to "${queueName}":`, payload.contentId || payload.type);
  return result;
}

/**
 * Receive and delete up to `maxMessages` from a queue.
 * Returns array of parsed JSON objects.
 */
async function receiveMessages(queueName, maxMessages = 5) {
  const client   = await ensureQueue(queueName);
  const response = await client.receiveMessages({ numberOfMessages: maxMessages });

  const results = [];
  for (const msg of response.receivedMessageItems) {
    const decoded = Buffer.from(msg.messageText, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);
    await client.deleteMessage(msg.messageId, msg.popReceipt);
    results.push(payload);
  }
  return results;
}

/**
 * Peek (non-destructive) at the front of a queue.
 */
async function peekMessages(queueName, maxMessages = 5) {
  const client   = await ensureQueue(queueName);
  const response = await client.peekMessages({ numberOfMessages: maxMessages });
  return response.peekedMessageItems.map(m =>
    JSON.parse(Buffer.from(m.messageText, 'base64').toString('utf-8'))
  );
}

module.exports = { sendMessage, receiveMessages, peekMessages, ensureQueue };
