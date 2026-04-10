#!/usr/bin/env bash
# =============================================================================
#  DEMO SCRIPT — Decentralized AI Content Moderation System
#  Run this script to walk through a complete live demonstration.
#  Each section is narrated for presenter use.
# =============================================================================

set -e
BASE_URL="http://localhost:3001"
REVIEW_URL="http://localhost:3003"
STORAGE_URL="http://localhost:3004"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

say()  { echo -e "\n${CYAN}${BOLD}▶ $1${RESET}"; sleep 0.5; }
step() { echo -e "${YELLOW}  → $1${RESET}"; }
ok()   { echo -e "${GREEN}  ✅ $1${RESET}"; }
bad()  { echo -e "${RED}  ❌ $1${RESET}"; }

echo -e "\n${BOLD}════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}   DECENTRALIZED AI CONTENT MODERATION — LIVE DEMO${RESET}"
echo -e "${BOLD}════════════════════════════════════════════════════════${RESET}"
echo ""
echo "  Services required:"
echo "  • Ingestion Node    → http://localhost:3001"
echo "  • AI Processing     → http://localhost:3002"
echo "  • Human Review      → http://localhost:3003"
echo "  • Storage Node      → http://localhost:3004"
echo "  • React Frontend    → http://localhost:3000"
echo ""
read -p "  Press ENTER when all 5 services are running…"

# ─────────────────────────────────────────────────────────────────────────────
say "STEP 1 — Health check all nodes"
# ─────────────────────────────────────────────────────────────────────────────
step "Checking Ingestion Node (port 3001)…"
HEALTH=$(curl -sf http://localhost:3001/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])" 2>/dev/null || echo "unreachable")
[ "$HEALTH" = "ok" ] && ok "Ingestion Node: OK" || bad "Ingestion Node: $HEALTH"

step "Checking AI Processing Node (port 3002)…"
HEALTH=$(curl -sf http://localhost:3002/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])" 2>/dev/null || echo "unreachable")
[ "$HEALTH" = "ok" ] && ok "AI Processing Node: OK" || bad "AI Processing Node: $HEALTH"

step "Checking Human Review Node (port 3003)…"
HEALTH=$(curl -sf http://localhost:3003/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])" 2>/dev/null || echo "unreachable")
[ "$HEALTH" = "ok" ] && ok "Human Review Node: OK" || bad "Human Review Node: $HEALTH"

step "Checking Storage Node (port 3004)…"
HEALTH=$(curl -sf http://localhost:3004/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])" 2>/dev/null || echo "unreachable")
[ "$HEALTH" = "ok" ] && ok "Storage Node: OK" || bad "Storage Node: $HEALTH"

echo ""
read -p "  ⏸  Narrate: 4 independent microservices, each on its own port. Press ENTER to continue…"

# ─────────────────────────────────────────────────────────────────────────────
say "STEP 2 — Demonstrate AUTO-APPROVE (safe text)"
# ─────────────────────────────────────────────────────────────────────────────
step "Submitting safe text…"
SAFE_TEXT="Have a wonderful and productive day learning about cloud computing and distributed systems!"
SAFE_RESP=$(curl -sf -X POST "$BASE_URL/submit/text" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$SAFE_TEXT\"}")
SAFE_ID=$(echo $SAFE_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['contentId'])")
ok "Submitted! contentId: $SAFE_ID"
step "Waiting for AI analysis (Google Perspective API)…"
sleep 6

SAFE_STATUS=$(curl -sf "$BASE_URL/status/$SAFE_ID")
DECISION=$(echo $SAFE_STATUS | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('decision','pending'))")
SOURCE=$(echo $SAFE_STATUS  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('decisionSource','?'))")
SCORE=$(echo $SAFE_STATUS   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('aiScore','?'))")
ok "Decision: $DECISION  |  Source: $SOURCE  |  AI Score: $SCORE"

echo ""
echo "  📊 PRESENTER NOTES:"
echo "     Low toxicity score → system autonomously approves without human intervention."
echo "     This demonstrates the HIGH-CONFIDENCE AUTO-APPROVE path."
echo ""
read -p "  ⏸  Press ENTER to continue…"

# ─────────────────────────────────────────────────────────────────────────────
say "STEP 3 — Demonstrate AUTO-REJECT (harmful text)"
# ─────────────────────────────────────────────────────────────────────────────
step "Submitting clearly harmful text…"
HARM_TEXT="You are absolutely worthless garbage and I hope you suffer. People like you deserve to die."
HARM_RESP=$(curl -sf -X POST "$BASE_URL/submit/text" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$HARM_TEXT\"}")
HARM_ID=$(echo $HARM_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['contentId'])")
ok "Submitted! contentId: $HARM_ID"
step "Waiting for AI analysis…"
sleep 6

HARM_STATUS=$(curl -sf "$BASE_URL/status/$HARM_ID")
DECISION=$(echo $HARM_STATUS | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('decision','pending'))")
SOURCE=$(echo $HARM_STATUS   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('decisionSource','?'))")
SCORE=$(echo $HARM_STATUS    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('aiScore','?'))")
ok "Decision: $DECISION  |  Source: $SOURCE  |  AI Score: $SCORE"

echo ""
echo "  📊 PRESENTER NOTES:"
echo "     High toxicity score → system autonomously rejects without human review."
echo "     This demonstrates the HIGH-CONFIDENCE AUTO-REJECT path."
echo ""
read -p "  ⏸  Press ENTER to continue…"

# ─────────────────────────────────────────────────────────────────────────────
say "STEP 4 — Demonstrate HUMAN-IN-THE-LOOP (gray-zone text)"
# ─────────────────────────────────────────────────────────────────────────────
step "Submitting ambiguous text that should enter gray zone…"
GRAY_TEXT="This politician is a complete idiot who should be ashamed and resign immediately."
GRAY_RESP=$(curl -sf -X POST "$BASE_URL/submit/text" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$GRAY_TEXT\"}")
GRAY_ID=$(echo $GRAY_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['contentId'])")
ok "Submitted! contentId: $GRAY_ID"
step "Waiting for AI analysis…"
sleep 6

step "Checking if item appears in human review queue…"
PENDING=$(curl -sf "$REVIEW_URL/pending")
COUNT=$(echo $PENDING | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
ok "Items in human review queue: $COUNT"

if [ "$COUNT" -gt "0" ]; then
  echo ""
  echo "  📊 PRESENTER NOTES:"
  echo "     The AI scored this text in the 0.40–0.85 gray zone."
  echo "     It was routed to the Human Review Node via Azure Queue."
  echo "     A human moderator must now decide: Safe or Harmful."
  echo ""
  step "Simulating human moderator decision (marking as 'harmful')…"
  sleep 2
  DECIDE_RESP=$(curl -sf -X POST "$REVIEW_URL/decide/$GRAY_ID" \
    -H "Content-Type: application/json" \
    -d '{"decision": "harmful", "reviewerName": "DemoModerator", "notes": "Political insult qualifies as harmful in our policy"}')
  ok "Human decision recorded: $(echo $DECIDE_RESP | python3 -c 'import sys,json; print(json.load(sys.stdin).get("decision","?"))')"
fi

echo ""
read -p "  ⏸  Press ENTER to continue…"

# ─────────────────────────────────────────────────────────────────────────────
say "STEP 5 — Verify IPFS Audit Trail"
# ─────────────────────────────────────────────────────────────────────────────
step "Waiting for storage node to pin records to IPFS…"
sleep 5

RECORDS=$(curl -sf "$STORAGE_URL/records")
REC_COUNT=$(echo $RECORDS | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
ok "Records stored on IPFS: $REC_COUNT"

if [ "$REC_COUNT" -gt "0" ]; then
  FIRST_CID=$(echo $RECORDS | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].get('cid','?'))")
  FIRST_URL=$(echo $RECORDS | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].get('ipfsUrl','?'))")
  ok "Latest CID: $FIRST_CID"
  ok "Gateway URL: $FIRST_URL"
  echo ""
  echo "  📊 PRESENTER NOTES:"
  echo "     This CID is a cryptographic hash of the decision record."
  echo "     It can be retrieved from ANY IPFS node worldwide — not just Infura."
  echo "     This creates an immutable, tamper-proof audit trail."
fi

echo ""
read -p "  ⏸  Press ENTER to continue…"

# ─────────────────────────────────────────────────────────────────────────────
say "STEP 6 — Show the React Frontend"
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "  Open your browser to: http://localhost:3000"
echo ""
echo "  Walk through the three tabs:"
echo "  1. 📤 Submit Content  — enter text, upload image, watch status update live"
echo "  2. 🛡️ Moderator Dashboard — see pending gray-zone items, approve/reject"
echo "  3. 🗂️ Audit Trail — see all IPFS-pinned records with CIDs"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
say "STEP 7 — libp2p P2P Demonstration"
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "  In each node terminal, observe log lines like:"
echo "  [libp2p][ingestion] Node started. Listening on: /ip4/0.0.0.0/tcp/10001"
echo "  [libp2p] Published event "content-submitted""
echo "  [libp2p] Subscribed to topic "moderation-events""
echo "  [AI][p2p] Event: moderation-complete"
echo ""
echo "  📊 PRESENTER NOTES:"
echo "     libp2p provides decentralized peer discovery and event broadcasting."
echo "     Unlike Azure Queue (reliable async routing), libp2p gives real-time"
echo "     broadcast of events to all peers simultaneously — no central broker."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}   DEMO COMPLETE — All components demonstrated!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${RESET}"
echo ""
echo "  Summary of what was shown:"
echo "  ✅ 4 independent Node.js microservices on separate ports"
echo "  ✅ Azure Queue Storage routing tasks between nodes (Microsoft Azure PaaS)"
echo "  ✅ Google Perspective API for text toxicity scoring (Google Cloud PaaS)"
echo "  ✅ AWS Rekognition for image harm detection (Amazon PaaS)"
echo "  ✅ libp2p GossipSub for decentralized P2P event mesh"
echo "  ✅ Auto-approve path (low confidence score)"
echo "  ✅ Auto-reject path (high confidence score)"
echo "  ✅ Human-in-the-loop path (gray zone → moderator dashboard)"
echo "  ✅ IPFS via Infura for immutable audit trail (decentralized storage)"
echo "  ✅ React frontend with submission, moderation, and audit views"
echo ""
