# ⬡ Decentralized AI Content Moderation System
### Cloud Computing + Distributed Systems — Academic Project

---

## Project Overview

A decentralized content-moderation pipeline that combines **three cloud
PaaS services**, a **peer-to-peer network** of cooperating nodes, and a
**human-in-the-loop** decision layer to evaluate user-submitted text
and images.

| Component | Technology | Cloud / Protocol |
|---|---|---|
| Image Moderation | AWS Rekognition | ☁️ Amazon Web Services |
| Text Toxicity | Google Perspective API | ☁️ Google Cloud |
| Task Routing | Azure Queue Storage | ☁️ Microsoft Azure |
| Decentralized Storage | IPFS via Pinata | 🌐 Decentralized |
| P2P Mesh | libp2p GossipSub + mDNS | 🌐 Peer-to-Peer |
| Frontend | React | 💻 Local |

---

## System Architecture

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
│ - IPFS via Pinata │  │ - Dashboard API       │                │
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
│   ├── ipfsClient.js            # IPFS / Pinata pinning client
│   └── package.json
│
├── .env.example                 # Template for all env variables
├── package.json                 # Root launcher (npm start runs all 5 services)
└── README.md
```

---

## Port Assignments

| Service | HTTP Port | libp2p TCP Port |
|---|---|---|
| React Frontend | **3000** | — |
| Ingestion Node | **3001** | 10001 |
| AI Processing Node | **3002** | 10002 |
| Human Review Node | **3003** | 10003 |
| Storage Node | **3004** | 10004 |

---

## Required Cloud Credentials

### 1. AWS Rekognition (Image Moderation)
1. AWS Console → IAM → Users → Create user
2. Attach policy: `AmazonRekognitionFullAccess`
3. Security credentials → Create access key
4. Free tier: 5,000 image units/month for 12 months

### 2. Google Perspective API (Text Toxicity)
1. https://developers.perspectiveapi.com/s/docs-get-started — apply for access
2. Google Cloud Console → enable the Perspective Comment Analyzer API
3. APIs & Services → Credentials → Create API key
4. Free for research and academic use

### 3. Azure Queue Storage (Task Routing)
1. Azure Portal → Create a Storage Account (LRS, Hot tier)
2. Security + networking → Access keys → copy Connection string
3. Cost: ~$0.004 per 10,000 operations (effectively free for demo volume)

### 4. Pinata IPFS (Decentralized Storage)
1. https://app.pinata.cloud → Create account
2. Developers → API Keys → New Key (enable `pinFileToIPFS` scope)
3. Copy the JWT shown once at creation time
4. Free tier: 1 GB storage / 500 files

---

## P2P Mesh (libp2p)

Implemented in `shared/p2pNode.js`. Each backend node runs a real
libp2p host with:

- **TCP** transport on ports 10001–10004
- **Noise** encryption + **Yamux** stream multiplexing
- **mDNS** local peer discovery (no central rendezvous server)
- **GossipSub** pubsub on the topic `moderation-events`

Events published on the mesh:

| Event | Published by | Consumed by |
|---|---|---|
| `content-submitted` | Ingestion | All peers (logging / observability) |
| `review-required` | Human Review | All peers |
| `moderation-complete` | AI Processor / Human Review | Ingestion (status update) |
| `record-stored` | Storage | All peers |

When all four backend nodes are running, each console prints
`[libp2p][...] Discovered peer:` and `Connected to peer:` lines as the
mesh forms over mDNS.

---

## Three PaaS Services from Three Different Clouds

| Cloud | Service | Role |
|---|---|---|
| **Amazon AWS** | Rekognition | Managed ML vision API — image moderation |
| **Google Cloud** | Perspective API | Managed NLP toxicity classifier — text moderation |
| **Microsoft Azure** | Queue Storage | Managed message queue — reliable async coordination between nodes |

Each is a fully managed PaaS service: no infrastructure to operate,
pay-per-use pricing, accessible over HTTPS REST APIs.

---

## Local Setup Instructions

### Prerequisites
- Node.js ≥ 20.x
- npm ≥ 10.x
- Git

### Step 1 — Clone and configure environment

```bash
git clone <repo-url>
cd decentralized-moderation

# Copy .env.example to each node and fill in your credentials
cp .env.example ingestion-node/.env
cp .env.example ai-processing-node/.env
cp .env.example human-review-node/.env
cp .env.example storage-node/.env

# Edit each .env file with your AWS / GCP / Azure / Pinata credentials
```

### Step 2 — Install dependencies

```bash
npm install              # installs concurrently at the root
npm run install:all      # installs shared/, all 4 nodes, and frontend
```

### Step 3 — Start all services

One command from the repo root:

```bash
npm start
```

This launches all 4 backend nodes plus the React frontend in a single
terminal with colour-coded prefixed logs (via `concurrently`). Press
`Ctrl+C` once to stop them all.

If you prefer 5 separate terminals:

**Terminal 1 — Ingestion Node**
```bash
cd ingestion-node && npm start    # → http://localhost:3001
```

**Terminal 2 — AI Processing Node**
```bash
cd ai-processing-node && npm start  # → http://localhost:3002
```

**Terminal 3 — Human Review Node**
```bash
cd human-review-node && npm start   # → http://localhost:3003
```

**Terminal 4 — Storage Node**
```bash
cd storage-node && npm start        # → http://localhost:3004
```

**Terminal 5 — React Frontend**
```bash
cd frontend && npm start            # → http://localhost:3000
```

---

## API Reference

### Ingestion Node (port 3001)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/submit/text` | Submit text for moderation. Body: `{ text }` |
| POST | `/submit/image` | Submit image (multipart). Field: `image` |
| GET | `/status/:contentId` | Poll moderation result |
| PUT | `/status/:contentId` | Update status (internal use) |
| GET | `/submissions` | List all submissions |
| GET | `/health` | Health check |

### AI Processing Node (port 3002)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/analyze/text` | Direct text analysis. Body: `{ text }` |
| POST | `/analyze/image` | Direct image analysis. Body: `{ imageBase64 }` |
| GET | `/health` | Health check |

### Human Review Node (port 3003)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/pending` | Items awaiting human review |
| GET | `/pending/:id` | Full detail for one item |
| POST | `/decide/:id` | Submit decision. Body: `{ decision, reviewerName }` |
| GET | `/history` | Recently reviewed items |
| GET | `/health` | Health check |

### Storage Node (port 3004)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/records` | All IPFS-stored decisions |
| GET | `/records/:id` | Record by contentId |
| POST | `/store` | Direct store (testing) |
| GET | `/health` | Health check |

---

## Sample Test Payloads

### Safe text
```bash
curl -X POST http://localhost:3001/submit/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Have a wonderful and productive day! I love learning about cloud computing."}'
```

### Toxic text (auto-rejected)
```bash
curl -X POST http://localhost:3001/submit/text \
  -H "Content-Type: application/json" \
  -d '{"text": "I hate you and everything you stand for. You are worthless garbage."}'
```

### Gray-zone text (routed to human review)
```bash
curl -X POST http://localhost:3001/submit/text \
  -H "Content-Type: application/json" \
  -d '{"text": "This politician is an absolute idiot and should resign immediately."}'
```

### Image
```bash
curl -X POST http://localhost:3001/submit/image \
  -F "image=@/path/to/your/image.jpg"
```

---

## Sample IPFS-Stored Record

Each finalized decision is pinned to IPFS as a structured JSON
document, retrievable globally by its CID:

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

## Decision Logic (Human-in-the-Loop)

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
|---|---|---|
| ≥ 0.85 | Auto-reject as Harmful | AI Autonomous |
| 0.40 – 0.85 | Route to Human Review | Human-in-the-loop |
| < 0.40 (text) / ≤ 0.15 (image) | Auto-approve as Safe | AI Autonomous |

---

## Why This Is Decentralized

| Aspect | Centralized App | This System |
|---|---|---|
| Single point of failure | ❌ Yes | ✅ No — 4 independent nodes |
| Data storage | ❌ One database | ✅ IPFS (content-addressed, global) |
| Communication | ❌ HTTP only | ✅ libp2p GossipSub mesh + Azure Queue |
| Node dependency | ❌ All in one process | ✅ Each node runs independently |
| Audit trail | ❌ Internal DB only | ✅ Immutable IPFS records |

---

## Architecture Roles Summary

| Node | Port | Cloud Service | Role |
|---|---|---|---|
| Ingestion | 3001 | Azure Queue (write) | Content intake |
| AI Processing | 3002 | AWS Rekognition + Google Perspective | Automated analysis |
| Human Review | 3003 | Azure Queue (read/write) | Gray-zone decisions |
| Storage | 3004 | IPFS / Pinata | Immutable audit trail |
| Frontend | 3000 | — | Submit, Moderator, and Audit UIs |
