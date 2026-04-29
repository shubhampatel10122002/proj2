# ⬡ Decentralized AI Content Moderation System
### Academic Prototype — Cloud Computing + Distributed Systems

---

##  Project Overview

A fully decentralized content moderation pipeline that uses **three cloud providers**, **peer-to-peer networking**, and **human-in-the-loop** decision logic to evaluate user-submitted text and images.

| Component | Technology | Cloud / Protocol |
|-----------|-----------|-----------------|
| Image Moderation | AWS Rekognition | ☁️ Amazon Web Services |
| Text Toxicity | Google Perspective API | ☁️ Google Cloud |
| Task Routing | Azure Queue Storage | ☁️ Microsoft Azure |
| Decentralized Storage | IPFS via Pinata | 🌐 Decentralized |
| P2P Mesh | libp2p GossipSub + mDNS | 🌐 Peer-to-Peer |
| Frontend | React (CRA) | 💻 Local |

---

##  System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React Frontend (port 3000)                  │
│         Submit Page  │  Moderator Dashboard  │  Audit Trail    │
└─────────────┬────────────────────────────────────────────────┘
              │ HTTP POST /submit/text|image
              ▼
┌─────────────────────────┐        libp2p GossipSub Mesh
│  Ingestion Node (3001)  │◄─────────────────────────────────┐
│  - Receive submissions  │         (all nodes talk          │
│  - Assign contentId     │          to all nodes via        │
│  - Push to Azure Queue  │          pub/sub events)         │
└────────────┬────────────┘                                   │
             │ Azure Queue: moderation-tasks                   │
             ▼                                                 │
┌────────────────────────────┐                                 │
│  AI Processing Node (3002) │                                 │
│  - Poll Azure Queue        │                                 │
│  - AWS Rekognition (image) │                                 │
│  - Perspective API (text)  │                                 │
│  - Score & classify        │                                 │
│  ┌─────────────────────┐   │                                 │
│  │  DECISION LOGIC     │   │                                 │
│  │  score >= 0.85 ─────┼───┼─► Azure Queue: final-decisions │
│  │  score <  0.40 ─────┼───┼─► Azure Queue: final-decisions │
│  │  0.40 ─ 0.85   ─────┼───┼─► Azure Queue: human-review    │
│  └─────────────────────┘   │                                 │
└────────────────────────────┘                                 │
             │                    │                             │
    final-decisions           human-review                     │
             │                    │                             │
             ▼                    ▼                             │
┌───────────────────┐  ┌──────────────────────┐                │
│ Storage Node(3004)│  │Human Review Node(3003)│                │
│ - IPFS via Infura │  │ - Dashboard API       │                │
│ - Pin JSON record │  │ - Accept decisions    │                │
│ - Return CID      │  │ - Forward to storage  │                │
└───────────────────┘  └──────────────────────┘                │
             │                    │                             │
             └────────────────────┴─────────────────►──────────┘
                        libp2p events propagate decisions to all peers
```

---

## Folder Structure

```
decentralized-moderation/
├── frontend/                    # React UI (port 3000)
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js               # Navigation + layout
│   │   ├── index.js
│   │   ├── index.css
│   │   └── pages/
│   │       ├── SubmitPage.js    # Content submission + status polling
│   │       ├── ModeratorPage.js # Human review dashboard
│   │       └── AuditPage.js     # IPFS audit trail viewer
│   └── package.json
│
├── ingestion-node/              # Ingestion Node (port 3001)
│   ├── server.js
│   ├── .env                     # (copy from .env.example)
│   └── package.json
│
├── ai-processing-node/          # AI Processing Node (port 3002)
│   ├── server.js
│   ├── .env
│   └── package.json
│
├── human-review-node/           # Human Review Node (port 3003)
│   ├── server.js
│   ├── .env
│   └── package.json
│
├── storage-node/                # Storage Node (port 3004)
│   ├── server.js
│   ├── .env
│   └── package.json
│
├── shared/                      # Shared utilities
│   ├── config.js                # Central config + thresholds
│   ├── azureQueue.js            # Azure Queue SDK wrapper
│   ├── p2pNode.js               # libp2p factory + pubsub helpers
│   ├── ipfsClient.js            # IPFS / Infura pinning client
│   └── package.json
│
├── .env.example                 # Template for all env variables
└── README.md
```

---

##  Port Assignments

| Service | HTTP Port | libp2p TCP Port |
|---------|-----------|-----------------|
| React Frontend | **3000** | — |
| Ingestion Node | **3001** | 10001 |
| AI Processing Node | **3002** | 10002 |
| Human Review Node | **3003** | 10003 |
| Storage Node | **3004** | 10004 |

---

##  Required API Keys / Services

### 1. AWS Rekognition (Image Moderation)
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new IAM User → Attach policy: `AmazonRekognitionFullAccess`
3. Generate Access Key ID and Secret Access Key
4. Cost: Free tier includes 5,000 image units/month

### 2. Google Perspective API (Text Toxicity)
1. Go to [Perspective API](https://developers.perspectiveapi.com/s/docs-get-started)
2. Enable the API in Google Cloud Console
3. Create an API Key in Credentials section
4. Cost: Free for research/academic use

### 3. Azure Queue Storage (Task Routing)
1. Go to [Azure Portal](https://portal.azure.com)
2. Create a Storage Account (LRS, Hot tier)
3. Go to Access Keys → copy Connection String
4. Cost: ~$0.004 per 10,000 operations (essentially free for demos)

### 4. Pinata IPFS (Decentralized Storage)
1. Go to [app.pinata.cloud](https://app.pinata.cloud) → Create account
2. Developers → API Keys → New Key
3. Enable the `pinFileToIPFS` permission, name it, and create
4. Copy the **JWT** shown once (you won't see it again)
5. Cost: Free tier includes 1 GB / 500 files — plenty for this demo

> Note: Infura's free IPFS tier was discontinued in 2024. Pinata is the
> drop-in replacement we use here.

---

## Local Setup Instructions

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- Git

### Step 1 — Clone and configure environment

```bash
git clone <repo-url>
cd decentralized-moderation

# Copy .env.example to each node directory
cp .env.example ingestion-node/.env
cp .env.example ai-processing-node/.env
cp .env.example human-review-node/.env
cp .env.example storage-node/.env

# Edit EACH .env file and fill in your API keys
nano ingestion-node/.env
```

### Step 2 — Install dependencies

```bash
# Shared utilities
cd shared && npm install && cd ..

# Each backend node
cd ingestion-node    && npm install && cd ..
cd ai-processing-node && npm install && cd ..
cd human-review-node  && npm install && cd ..
cd storage-node       && npm install && cd ..

# React frontend
cd frontend && npm install && cd ..
```

### Step 3 — Start all services (5 terminals)

**Terminal 1 — Ingestion Node**
```bash
cd ingestion-node && npm start
# → http://localhost:3001
```

**Terminal 2 — AI Processing Node**
```bash
cd ai-processing-node && npm start
# → http://localhost:3002
```

**Terminal 3 — Human Review Node**
```bash
cd human-review-node && npm start
# → http://localhost:3003
```

**Terminal 4 — Storage Node**
```bash
cd storage-node && npm start
# → http://localhost:3004
```

**Terminal 5 — React Frontend**
```bash
cd frontend && npm start
# → http://localhost:3000
```

---

##  API Reference

### Ingestion Node (port 3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/submit/text` | Submit text for moderation. Body: `{ text }` |
| POST | `/submit/image` | Submit image (multipart). Field: `image` |
| GET | `/status/:contentId` | Poll moderation result |
| PUT | `/status/:contentId` | Update status (internal use) |
| GET | `/submissions` | List all submissions |
| GET | `/health` | Health check |

### AI Processing Node (port 3002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze/text` | Direct text analysis. Body: `{ text }` |
| POST | `/analyze/image` | Direct image analysis. Body: `{ imageBase64 }` |
| GET | `/health` | Health check |

### Human Review Node (port 3003)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pending` | Get items awaiting human review |
| GET | `/pending/:id` | Full detail for one item |
| POST | `/decide/:id` | Submit decision. Body: `{ decision, reviewerName }` |
| GET | `/history` | Recently reviewed items |
| GET | `/health` | Health check |

### Storage Node (port 3004)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/records` | All IPFS-stored decisions |
| GET | `/records/:id` | Record by contentId |
| POST | `/store` | Direct store (testing) |
| GET | `/health` | Health check |

---

##  Sample Test Payloads

### Safe text
```bash
curl -X POST http://localhost:3001/submit/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Have a wonderful and productive day! I love learning about cloud computing."}'
```

### Toxic text (should auto-reject or go to review)
```bash
curl -X POST http://localhost:3001/submit/text \
  -H "Content-Type: application/json" \
  -d '{"text": "I hate you and everything you stand for. You are worthless garbage."}'
```

### Gray-zone text (should go to human review)
```bash
curl -X POST http://localhost:3001/submit/text \
  -H "Content-Type: application/json" \
  -d '{"text": "This politician is an absolute idiot and should resign immediately."}'
```

### Image (curl)
```bash
curl -X POST http://localhost:3001/submit/image \
  -F "image=@/path/to/your/image.jpg"
```

---

##  Sample IPFS Stored Record

This JSON is pinned to IPFS and retrievable by CID worldwide:

```json
{
  "contentId": "f3a2b1c0-9d8e-7f6a-5b4c-3d2e1f0a9b8c",
  "contentType": "text",
  "contentPreview": "Have a wonderful and productive day!",
  "aiProvider": "Google Perspective API",
  "moderationScore": 0.03,
  "aiDetails": {
    "toxicity": 0.03,
    "severeToxicity": 0.01,
    "identityAttack": 0.01,
    "insult": 0.02,
    "threat": 0.01
  },
  "decision": "safe",
  "decisionSource": "AI",
  "decisionReason": "Low toxicity score — content appears safe",
  "confidence": 0.03,
  "reviewerName": null,
  "submittedAt": "2024-01-15T10:23:11.000Z",
  "processedAt": "2024-01-15T10:23:12.847Z",
  "storedAt": "2024-01-15T10:23:13.211Z",
  "status": "approved",
  "schemaVersion": "1.0",
  "systemName": "Decentralized AI Content Moderation"
}
```

---

##  Decision Logic (Human-in-the-Loop)

```
                        Content Submitted
                              │
                    AI Analysis (Rekognition / Perspective)
                              │
                   ┌──────────┴──────────┐
                   │    Score ≥ 0.85?    │
                   └──────────┬──────────┘
                    Yes        │         No
             ┌─────────────────┼──────────────────┐
             ▼                 │                  ▼
      Auto-Reject          0.40 ─ 0.85        Auto-Approve
      (Harmful)         Gray Zone             (Safe)
                              │
                    Human Moderator Reviews
                              │
                    Mark: Safe or Harmful
                              │
                    Store to IPFS + Broadcast
```

| Score Range | Action | Source |
|-------------|--------|--------|
| ≥ 0.85 | Auto-reject as Harmful | AI Autonomous |
| 0.40 – 0.85 | Route to Human Review | Human-in-the-loop |
| < 0.40 (text) / ≤ 0.15 (image) | Auto-approve as Safe | AI Autonomous |

---

##  Why This Is Decentralized (Not Centralized)

| Aspect | Centralized App | This System |
|--------|----------------|-------------|
| Single point of failure | ❌ Yes | ✅ No — 4 independent nodes |
| Data storage | ❌ One database | ✅ IPFS (content-addressed, global) |
| Communication | ❌ HTTP only | ✅ libp2p GossipSub mesh (mDNS-discovered) + Azure Queue |
| Node dependency | ❌ All in one process | ✅ Each node runs independently |
| Audit trail | ❌ Internal DB only | ✅ Immutable IPFS records |

---

##  P2P Mesh (libp2p)

Implemented in `shared/p2pNode.js`. Each backend node runs a real libp2p
host with:

- **TCP transport** on ports 10001–10004
- **Noise** encryption + **Yamux** stream multiplexing
- **mDNS** local peer discovery (no central rendezvous server)
- **GossipSub** pubsub on the topic `moderation-events`

Events broadcast to all peers:

| Event | Published by | Consumed by |
|---|---|---|
| `content-submitted` | Ingestion | Others (logging) |
| `review-required` | Human Review | Others (logging) |
| `moderation-complete` | AI Processor / Human Review | Ingestion (status update) |
| `record-stored` | Storage | Others (logging) |

When all four nodes are running, watch the console — you'll see
`[libp2p] Discovered peer:` and `Connected to peer:` lines as the mesh
forms over mDNS.

---

##  Three PaaS Services from Three Different Clouds

1. **AWS Rekognition** (Amazon)
   - Managed ML vision API
   - No infrastructure to manage
   - Pay-per-image

2. **Google Perspective API** (Google Cloud)
   - Managed NLP toxicity detection
   - Research-grade ML models
   - REST API, no setup

3. **Azure Queue Storage** (Microsoft Azure)
   - Managed message queue PaaS
   - Enables reliable async coordination
   - Survives node restarts

---

##  Future Work / Improvements

- [ ] Replace in-memory state with Redis for persistence
- [ ] Add JWT authentication for the moderator dashboard
- [ ] Add Kademlia DHT for cross-network peer discovery (mDNS works for localhost only)
- [ ] WebSocket real-time updates in the frontend
- [ ] Multi-language text support via Perspective API
- [ ] Batch image processing with S3 triggers
- [ ] Docker Compose for one-command startup
- [ ] Kubernetes Helm chart for cloud deployment
- [ ] Dashboard analytics / moderation metrics
- [ ] Appeal mechanism for users to contest decisions

---

##  Architecture Roles Summary

| Node | Port | Cloud Service | Role |
|------|------|---------------|------|
| Ingestion | 3001 | Azure Queue (write) | Content intake |
| AI Processing | 3002 | AWS + Google APIs | Automated analysis |
| Human Review | 3003 | Azure Queue (read/write) | Gray-zone decisions |
| Storage | 3004 | IPFS / Pinata | Immutable audit trail |
| Frontend | 3000 | — | UI for all roles |
