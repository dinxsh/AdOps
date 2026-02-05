# 📝 Technical Specification: Autonomous AI Advertising Agents with x402

## 🔖 Project Overview

**Case Study: Using x402 for Agent-Based Advertising**

This project demonstrates how x402 enables autonomous AI agents to act as full-service advertising representatives for brands. Using **Crossmint** and **Coinbase CDP** as example brands, agents independently research websites, analyze traffic data, determine budgets, compete in auctions, and generate advertising creative - all through x402 micropayments.

x402 enables agents to detect state changes through **economic signals**: when an agent gets outbid, the refund signals them to re-evaluate. When an agent needs data, they pay for it. When they win, they pay to generate creative. All communication happens over HTTP with x402 payments. No polling, no webhooks, no external event coordination.

The system is fully observable: humans can view agents competing in real-time on a public dashboard at `/analytical-agents`, but cannot interfere with agent decision-making.

---

## 🧠 How It Works (Concept)

### The Players

**Two AI Agents**:
1. **CrossmintAgent** - Represents Crossmint Wallets, targeting developers building blockchain apps
2. **CoinbaseCDPAgent** - Represents Coinbase Developer Platform, targeting Web3 developers

**The Venue**:
- **DevNews** (`/devnews`) - A hypothetical developer news website
- **Two Ad Spots**:
  - `prime-banner` - Premium above-the-fold banner (450k monthly impressions, 2.5% CTR)
  - `sidebar-secondary` - Secondary sidebar spot (280k monthly impressions, 1.8% CTR)

### The Flow

#### 1. **Research Phase** (x402 Payments to External Services)

**Agent A (CrossmintAgent)** starts:
- Calls **Firecrawl** via x402 to scrape `/devnews` ($0.01 USDC on Base Mainnet)
- Receives markdown content, extracts topics: ["TypeScript", "React", "Web3", "Blockchain"]
- Analyzes: "Is this site relevant to my product (Crossmint Wallets)?"

#### 2. **Analytics Phase** (x402 Payment to Publisher)

- Calls `/api/site-analytics` → Server responds `402 Payment Required` ($0.01 USDC on Base Sepolia)
- Agent pays, receives detailed metrics:
  ```json
  {
    "monthlyVisits": 500000,
    "audience": "Software developers and tech enthusiasts",
    "adSpots": {
      "prime-banner": {
        "impressions": 450000,
        "clickThroughRate": "2.5%",
        "averageBid": "$15.00"
      }
    }
  }
  ```

#### 3. **AI Decision Phase** (Claude LLM)

- Agent uses **Claude 3.5 Sonnet** to analyze:
  - Relevance: 9/10 (perfect developer audience)
  - ROI: Strong (500k visits, 11,250 estimated clicks on prime banner)
  - Budget: $18.00 for prime banner (above $15 average for competitive edge)
  - Strategy: "Focus on prime banner only - maximum visibility for brand authority"
- Decision: **BID on `prime-banner`, SKIP `sidebar-secondary`**

#### 4. **Competition Phase** (x402 Payments for Bidding)

- **CrossmintAgent** proposes $18 bid → Server responds `402` → Agent pays $18 → Now leading
- **CoinbaseCDPAgent** analyzes same site, decides to bid $22 → Pays $22 → Now leading
- Server **refunds $18 to CrossmintAgent** (economic signal = outbid)
- **CrossmintAgent** detects refund, re-evaluates, decides $22 exceeds $18 budget → Withdraws
- **Auction ends** - CoinbaseCDPAgent wins

#### 5. **Creative Generation Phase** (x402 Payment to Freepik)

- **CoinbaseCDPAgent** calls `/api/generate-ad-image`:
  - Provides detailed prompt about Coinbase developer tools
  - Server forwards to **Freepik x402 API** → `402 Payment Required` (~$0.10 USDC on Base Mainnet)
  - Agent pays, Freepik generates 16:9 banner image
  - Image is displayed on `/devnews` in the prime banner spot

---

## 🤖 How the Agents Work

Agents are built using:
- **LlamaIndex ReActAgent** framework for tool orchestration
- **Claude 3.5 Sonnet** for reasoning and decision-making
- **x402-axios** for automatic payment handling on Base Sepolia (bidding)
- **Viem** wallet client for Base Mainnet payments (external services)

### Key Agent Capabilities

| Capability              | Implementation                                          |
|------------------------|---------------------------------------------------------|
| **Website Scraping**   | x402 payment to Firecrawl API (Base Mainnet)           |
| **Analytics Purchase** | x402 payment to publisher `/api/site-analytics` (Base Sepolia) |
| **AI Analysis**        | Claude LLM with brand identity and budget constraints   |
| **Strategic Bidding**  | Proposal → 402 → Payment → Settlement (Base Sepolia)    |
| **Creative Generation**| x402 payment to Freepik AI (Base Mainnet)              |
| **Economic Signals**   | Refund detection triggers re-evaluation                 |

### Agent Tools

Each agent has access to custom tools:
1. **scrapeWebsite()** - Firecrawl integration via x402
2. **fetchAnalytics()** - Publisher API via x402
3. **analyzeAndDecide()** - Claude AI for budget decisions
4. **place_bid()** - x402 payment for auction bids (inherited)
5. **get_auction_state()** - Check current bid status (inherited)
6. **withdraw()** - Exit auction gracefully (inherited)

---

## 🧱 Server Behavior

### Core Endpoints

#### 1. `GET /api/site-analytics` (x402-protected)

**Purpose**: Sell site analytics to agents

**Flow**:
1. Agent makes GET request (no payment)
2. Server responds `402 Payment Required`:
   ```json
   {
     "accepts": [{
       "scheme": "exact",
       "network": "base-sepolia",
       "token": "0x036CbD...",
       "price": { "min": 0.01, "max": 0.01 }
     }]
   }
   ```
3. Agent's x402-axios intercepts, pays $0.01 USDC
4. Server verifies and settles payment via x402 facilitator
5. Server returns analytics data

#### 2. `POST /api/bid/[adSpotId]` (x402-protected)

**Purpose**: Accept agent bids with x402 payments

**Flow**:
1. Agent proposes bid via `X-Proposed-Bid` header
2. Server validates: Is proposal >= minimum to win?
3. If invalid → `400 Bad Request` (rejected, no 402)
4. If valid → `402 Payment Required` with exact price
5. Agent pays proposed amount via x402
6. Server settles, updates winner, refunds previous bidder
7. Refund triggers economic signal to outbid agent

#### 3. `POST /api/skip-spot/[adSpotId]` (no payment)

**Purpose**: Track agents that decide not to bid

**Flow**:
1. Agent notifies: "I analyzed this spot and decided to skip it"
2. Server records agent participation status
3. Checks: If only 1 agent interested → May end auction early
4. Broadcasts `agent_skipped` event for UI

#### 4. `POST /api/generate-ad-image` (x402-protected, proxied)

**Purpose**: Forward image generation to Freepik with agent's payment

**Flow**:
1. Agent (winner only) requests image generation
2. Server validates winner status and auction ended
3. Server forwards to Freepik x402 endpoint with agent's payment
4. Freepik responds `402` → Server passes to agent
5. Agent pays (~$0.10) → Server forwards payment
6. Freepik generates image asynchronously
7. Webhook updates server when complete
8. Ad is displayed on `/devnews`

---

## 🧾 MongoDB Schema

### Collection: `adSpotRecords`

```typescript
{
  adSpotId: "prime-banner",
  currentBid: 22.00,
  currentWinner: {
    agentId: "CoinbaseCDPAgent",
    walletAddress: "0xdef...",
    timestamp: ISODate
  },
  auctionEnded: true,
  auctionEndReason: "Competitor withdrew",
  winnerAdImage: {
    url: "https://cdn.freepik.com/ai/generated/abc123.jpg",
    prompt: "Professional tech advertisement...",
    taskId: "task_123",
    generatedAt: ISODate
  },
  bidHistory: [
    {
      agentId: "CrossmintAgent",
      amount: 18.00,
      timestamp: ISODate,
      txHash: "0xabc...",
      thinking: "Strategic opening bid...",
      strategy: "intelligent"
    },
    {
      agentId: "CoinbaseCDPAgent",
      amount: 22.00,
      timestamp: ISODate,
      txHash: "0xdef...",
      thinking: "Counter-bidding to secure prime positioning",
      strategy: "intelligent"
    }
  ],
  skippedBy: ["CrossmintAgent"],  // Agents that analyzed but chose not to bid
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### Collection: `analyticalEvents`

```typescript
{
  adSpotId: "prime-banner",
  event: {
    type: "analysis_completed",
    agentId: "CrossmintAgent",
    shouldBid: true,
    relevanceScore: 9,
    reasoning: "Excellent match! Site targets developers...",
    targetSpots: ["prime-banner"],
    budgetPerSpot: {
      "prime-banner": 18.00
    },
    strategy: "Aggressive bid on prime banner...",
    timestamp: ISODate,
    eventSequence: 15
  },
  timestamp: ISODate
}
```

---

## 💸 Multi-Network Architecture

The system uses **two different blockchain networks** for different purposes:

| Purpose                    | Network       | Token        | Use Case                          |
|---------------------------|---------------|--------------|-----------------------------------|
| **External Services**     | Base Mainnet  | USDC         | Firecrawl scraping, Freepik images |
| **Bidding & Analytics**   | Base Sepolia  | USDC (test)  | Ad spot bidding, analytics purchase |

**Why Two Networks?**

1. **Base Sepolia** (testnet):
   - Free test USDC for development
   - Perfect for bidding demo ($1-100 range)
   - No real money risk

2. **Base Mainnet** (production):
   - Real services require real payments
   - Firecrawl charges $0.01-0.50 per scrape
   - Freepik charges ~$0.10 per image

### Wallet Configuration

**Agent Wallets**:
- Single wallet per agent (e.g., `0xabc...` for CrossmintAgent)
- Has USDC on **both** networks
- x402-axios handles Sepolia payments (bidding)
- Direct viem calls handle Mainnet payments (services)

**Server Wallet** (CDP Server Wallet v2):
- Receives bid payments on Base Sepolia
- Sends refunds on Base Sepolia
- Does NOT handle external service payments (agents pay directly)

---

## 🖥️ Frontend Dashboard (Observability)

**Purpose**: The frontend is purely observational - it visualizes autonomous agent activity. Users cannot interact with or influence agent decisions.

### Page: `/analytical-agents`

**Real-Time Display**:
- Terminal-style logs showing agent activity
- Live event stream via MongoDB polling (every 2 seconds)
- Separate panels for each agent (CrossmintAgent | CoinbaseCDPAgent)

**Events Shown**:
1. `agent_started` - Agent begins analysis
2. `scraping_started` - Paying Firecrawl to scrape site
3. `scraping_completed` - Content received, topics extracted
4. `analytics_payment` - Paying publisher for analytics
5. `analytics_received` - Traffic data, ad spot metrics
6. `analysis_started` - AI begins decision-making
7. `analysis_completed` - Budget decision made
8. `agent_skipped` - Agent decides not to bid on a spot
9. `thinking` - Agent's reasoning before bid
10. `bid_placed` - x402 payment settled, bid recorded
11. `reflection` - Agent's post-bid analysis
12. `refund` - Agent received refund (outbid signal)
13. `withdrawal` - Agent exits auction
14. `auction_ended` - Winner declared
15. `image_generation_update` - Freepik progress
16. `ad_image_ready` - Creative displayed on site

### Page: `/devnews`

**Mock Publisher Site**:
- Shows two ad spots: `prime-banner` and `sidebar-secondary`
- Displays placeholder until auction winner generates image
- Updates automatically when winning agent's ad is ready
- Demonstrates the end result: AI-generated ads displayed on real sites

---

## 📊 Example Agent Decision Flow

### CrossmintAgent's Journey

1. **Starting Balance**: $100.00 USDC

2. **Research** (Base Mainnet):
   - Pays Firecrawl $0.01 → Balance: $99.99
   - Learns: Site is about TypeScript, React, Web3

3. **Analytics** (Base Sepolia):
   - Pays DevNews $0.01 → Balance: $99.98
   - Learns: 500k monthly visits, developer audience

4. **Analysis**:
   - Claude AI: "9/10 relevance, target prime banner, budget $18"

5. **Bidding** (Base Sepolia):
   - Proposes $18 → Pays $18 → Balance: $81.98
   - Now winning prime banner

6. **Outbid**:
   - Receives $18 refund → Balance: $99.98
   - Economic signal detected!

7. **Re-evaluation**:
   - Claude AI: "Competitor bid $22, exceeds my $18 budget"
   - Decision: WITHDRAW

8. **Final Balance**: $99.98 USDC (spent $0.02 on research)

### CoinbaseCDPAgent's Journey

1. **Starting Balance**: $100.00 USDC

2. **Research**: $0.01 → Balance: $99.99

3. **Analytics**: $0.01 → Balance: $99.98

4. **Analysis**:
   - Claude AI: "8/10 relevance, target prime banner, budget $25"

5. **Bidding**:
   - Sees CrossmintAgent bid $18
   - Proposes $22 → Pays $22 → Balance: $77.98
   - Now winning

6. **Auction Ends**:
   - Competitor withdrew
   - Won for $22!

7. **Creative Generation** (Base Mainnet):
   - Pays Freepik $0.10 → Balance: $77.88
   - Receives professional ad image

8. **Final Balance**: $77.88 USDC (spent $22.12 total)
   - Research: $0.02
   - Winning bid: $22.00
   - Creative: $0.10

---

## 🌟 Key Innovations

### 1. **Multi-Service x402 Composition**

Agents seamlessly use three different x402-enabled services:
- **Firecrawl** (Base Mainnet) - Data scraping
- **DevNews APIs** (Base Sepolia) - Analytics + Bidding
- **Freepik** (Base Mainnet) - Image generation

Same agent, same wallet, multiple services, all coordinated via x402.

### 2. **Research-Driven Budgeting**

Unlike traditional systems with hardcoded budgets:
- Agents **invest in research** ($0.01 scraping + $0.01 analytics)
- **Analyze data** using AI
- **Dynamically allocate budget** based on findings
- Real cost-benefit analysis in every decision

### 3. **Economic Signal Coordination**

No polling, no webhooks, pure x402:
- Refund = outbid signal
- Agent detects balance increase → Re-evaluates
- Makes new strategic decision
- HTTP + payments = complete coordination

### 4. **AI-Powered Strategy**

Every decision uses Claude AI:
- "Is this site relevant to my brand?" (relevance score)
- "What's the ROI?" (clicks, costs, estimated value)
- "How much should I spend?" (budget allocation)
- "Which spot is most valuable?" (strategic positioning)

Not rules-based - actual reasoning with brand identity context.

### 5. **End-to-End Autonomy**

From first research to final creative, agents:
- ✅ Pay for their own data
- ✅ Make their own decisions
- ✅ Compete strategically
- ✅ Generate their own ads
- ✅ Manage their own budgets
- ❌ No human intervention at any step

---

## 🎯 What This Demonstrates

### For x402:

**Versatility**: Same protocol handles:
- Micropayments ($0.01 analytics)
- Moderate payments ($1-25 bids)
- Service payments ($0.10 creative)

**Composability**: Agents combine multiple x402 services seamlessly

**Coordination**: Economic signals (refunds) enable agent-to-agent interaction

### For AI Agents:

**Economic Actors**: Agents aren't just tools - they're autonomous economic entities that:
- Invest in information
- Analyze ROI
- Compete strategically
- Manage budgets

**Practical Utility**: This isn't a toy demo:
- Real websites
- Real analytics
- Real competition
- Real advertising outcomes

**Observable Intelligence**: Humans can watch agents think:
- "Strategic opening bid above average to establish dominance"
- "Counter-bid detected, re-evaluating within budget constraints"
- "Competitor bid exceeds allocated budget - withdrawing gracefully"

### For the Future:

**Agent-to-Agent Commerce**: Brands hire AI agents who:
- Research opportunities independently
- Pay for data and services
- Compete in marketplaces
- Deliver tangible results (ads, leads, conversions)

**New Business Models**:
- Publishers sell analytics access via x402 (passive revenue)
- Agents discover opportunities dynamically (not pre-negotiated)
- Marketplaces coordinate via payments (not contracts)

---

## 🚀 Try It Yourself

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Start Crossmint agent
npm run analytical:crossmint

# Terminal 3: Start Coinbase agent
npm run analytical:cdp

# Browser: Watch competition
open http://localhost:3000/analytical-agents

# See results
open http://localhost:3000/devnews
```

**What You'll See**:
- Agents scraping website (x402 payment to Firecrawl)
- Agents buying analytics (x402 payment to server)
- AI analysis and budget decisions
- Competitive bidding with refunds
- Winner generating ad image (x402 payment to Freepik)
- Final ad displayed on DevNews site

All autonomous. All coordinated via x402. All observable in real-time.
