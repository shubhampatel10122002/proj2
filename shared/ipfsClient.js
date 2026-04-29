/**
 * shared/ipfsClient.js
 * Stores moderation decision records on IPFS via Pinata's pinning API.
 *
 * Auth: Pinata JWT (preferred — single env var). Generate at
 *   https://app.pinata.cloud/developers/api-keys
 */
const axios   = require('axios');
const FormData = require('form-data');
const config  = require('./config');

const PINATA_API_BASE = 'https://api.pinata.cloud';
const PINATA_GATEWAY  = 'https://gateway.pinata.cloud/ipfs';
const PUBLIC_GATEWAY  = 'https://ipfs.io/ipfs';

function authHeader() {
  if (!config.ipfs.pinataJwt) {
    throw new Error('PINATA_JWT is not set — see .env.example');
  }
  return { Authorization: `Bearer ${config.ipfs.pinataJwt}` };
}

/**
 * Pin a JSON object to IPFS via Pinata.
 * Returns the CID (Content Identifier) string.
 *
 * @param {object} jsonRecord  The moderation decision record
 * @returns {Promise<string>}  IPFS CID
 */
async function storeRecord(jsonRecord) {
  const jsonStr = JSON.stringify(jsonRecord, null, 2);
  const form    = new FormData();
  form.append('file', Buffer.from(jsonStr), {
    filename:    `moderation-${jsonRecord.contentId || Date.now()}.json`,
    contentType: 'application/json',
  });

  // Pinata metadata (helps you find records in the dashboard)
  form.append('pinataMetadata', JSON.stringify({
    name: `moderation-${jsonRecord.contentId || 'record'}`,
    keyvalues: {
      contentId:   jsonRecord.contentId || '',
      contentType: jsonRecord.contentType || '',
      decision:    jsonRecord.decision || '',
    },
  }));

  const response = await axios.post(
    `${PINATA_API_BASE}/pinning/pinFileToIPFS`,
    form,
    {
      maxBodyLength: Infinity,
      headers: { ...form.getHeaders(), ...authHeader() },
    }
  );

  const cid = response.data.IpfsHash;
  console.log(`[IPFS] Pinned record to Pinata. CID: ${cid}`);
  return cid;
}

/**
 * Retrieve a record from IPFS by CID, trying Pinata gateway first
 * then falling back to a public gateway.
 */
async function fetchRecord(cid) {
  for (const base of [PINATA_GATEWAY, PUBLIC_GATEWAY]) {
    try {
      const response = await axios.get(`${base}/${cid}`, { timeout: 8000 });
      return response.data;
    } catch (err) {
      // try next gateway
    }
  }
  throw new Error(`Could not fetch CID ${cid} from any gateway`);
}

function gatewayUrl(cid) {
  return `${PINATA_GATEWAY}/${cid}`;
}

module.exports = { storeRecord, fetchRecord, gatewayUrl };
