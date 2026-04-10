/**
 * shared/ipfsClient.js
 * Stores moderation decision records on IPFS via Infura's pinning API.
 * Uses the HTTP API directly (no daemon needed).
 */
const axios  = require('axios');
const config = require('./config');

const INFURA_AUTH = Buffer.from(
  `${config.ipfs.projectId}:${config.ipfs.projectSecret}`
).toString('base64');

const ipfsAxios = axios.create({
  baseURL: config.ipfs.endpoint + '/api/v0',
  headers: { Authorization: `Basic ${INFURA_AUTH}` },
});

/**
 * Pin a JSON object to IPFS via Infura.
 * Returns the CID (Content Identifier) string.
 *
 * @param {object} jsonRecord  The moderation decision record
 * @returns {string} IPFS CID
 */
async function storeRecord(jsonRecord) {
  const jsonStr  = JSON.stringify(jsonRecord, null, 2);
  const FormData = (await import('form-data')).default || require('form-data');
  const form     = new FormData();
  form.append('file', Buffer.from(jsonStr), {
    filename:    'moderation-record.json',
    contentType: 'application/json',
  });

  const response = await ipfsAxios.post('/add?pin=true', form, {
    headers: { ...form.getHeaders() },
  });

  const cid = response.data.Hash;
  console.log(`[IPFS] Stored record. CID: ${cid}`);
  return cid;
}

/**
 * Retrieve a record from IPFS by CID.
 * Uses the public Infura gateway.
 */
async function fetchRecord(cid) {
  const url      = `https://infura-ipfs.io/ipfs/${cid}`;
  const response = await axios.get(url);
  return response.data;
}

module.exports = { storeRecord, fetchRecord };
