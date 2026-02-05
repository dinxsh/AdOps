# The Complete Analytical Agent Flow (Step-by-Step)

## Overview

This document describes the **Autonomous AI Advertising Agents** system where Crossmint and Coinbase CDP agents compete to advertise on DevNews - a hypothetical developer news site. The agents autonomously scrape websites, analyze traffic data, determine budgets, bid on ad spots, and generate advertising creative - all powered by x402 micropayments.

---

## ┌──────────────────────────────────────────────────────────────────┐
## │ PHASE 1: Agent Initialization & Broadcast                       │
## └──────────────────────────────────────────────────────────────────┘

**Agents**:
- **CrossmintAgent** (represents Crossmint Wallets)
- **CoinbaseCDPAgent** (represents Coinbase Developer Platform)

**Starting Balance**: Each agent has ~$100 USDC

1. **Agent starts up**:
   ```typescript
   agent.startAnalysis(['prime-banner', 'sidebar-secondary'])
   ```

2. **Broadcast agent_started event** to BOTH ad spots:
   ```json
   {
     "type": "agent_started",
     "agentId": "CrossmintAgent",
     "availableSpots": ["prime-banner", "sidebar-secondary"],
     "brandName": "Crossmint",
     "productName": "Crossmint Wallets",
     "timestamp": "2025-10-28T..."
   }
   ```
   - Stored in MongoDB `analyticalEvents` collection
   - Visible on `/analytical-agents` UI via polling

---

## ┌──────────────────────────────────────────────────────────────────┐
## │ PHASE 2: Website Scraping (x402 Payment #1)                     │
## └──────────────────────────────────────────────────────────────────┘

🔍 **Agent uses x402 to scrape the DevNews site via Firecrawl**

**Purpose**: Understand what the website is about to determine relevance

### Step 1: Broadcast Scraping Started

Agent broadcasts to BOTH spots:
```json
{
  "type": "scraping_started",
  "agentId": "CrossmintAgent",
  "url": "https://your-tunnel.com/devnews",
  "paymentMethod": "x402",
  "expectedCost": "$0.01 USDC",
  "timestamp": "2025-10-28T..."
}
```

### Step 2: Make x402 Payment to Firecrawl

```typescript
// Agent makes POST request to x402-wrapped Firecrawl endpoint
const response = await axiosWithPayment.post(
  process.env.FIRECRAWL_WRAPPED_ENDPOINT,  // Your custom x402 wrapper
  {
    url: 'https://your-tunnel.com/devnews',
    formats: ['markdown'],
    onlyMainContent: true
  }
);
```

**Payment Flow**:
1. First request hits your wrapper → Returns `402 Payment Required`
2. `x402-axios` interceptor catches 402
3. Automatically signs EIP-3009 authorization for **~$0.01 USDC**
4. Retries request with `X-PAYMENT` header
5. Your wrapper forwards to Firecrawl (after verifying payment)
6. Firecrawl scrapes the page and returns markdown content

**Response**:
```json
{
  "data": {
    "markdown": "# DevNews\nYour source for developer news...",
    "metadata": {
      "title": "DevNews - Developer News",
      "description": "Technology news for developers"
    }
  }
}
```

### Step 3: Extract Topics

Agent analyzes content for relevant keywords:
- "TypeScript", "React", "Next.js"
- "Blockchain", "Web3", "Crypto"
- "Cloud", "DevOps", "Kubernetes"
- etc.

Found topics: `["TypeScript", "React", "Web3", "Blockchain"]`

### Step 4: Broadcast Scraping Completed

```json
{
  "type": "scraping_completed",
  "agentId": "CrossmintAgent",
  "url": "https://your-tunnel.com/devnews",
  "contentLength": 12500,
  "contentPreview": "# DevNews\nYour source for developer news...",
  "topics": ["TypeScript", "React", "Web3", "Blockchain"],
  "siteTitle": "DevNews - Developer News",
  "timestamp": "2025-10-28T..."
}
```

---

## ┌──────────────────────────────────────────────────────────────────┐
## │ PHASE 3: Analytics Fetch (x402 Payment #2)                      │
## └──────────────────────────────────────────────────────────────────┘

💰 **Agent uses x402 to purchase site analytics from the publisher**

**Purpose**: Get traffic data, audience info, and ad spot performance metrics

### Step 1: Broadcast Analytics Payment

```json
{
  "type": "analytics_payment",
  "agentId": "CrossmintAgent",
  "amount": "0.01 USDC",
  "paymentMethod": "x402",
  "timestamp": "2025-10-28T..."
}
```

### Step 2: Make x402 Payment to Server

```typescript
// Agent makes GET request to analytics endpoint
const response = await axiosWithPayment.get(
  `${serverUrl}/api/site-analytics`
);
```

**Payment Flow**:
1. Request hits `/api/site-analytics` → Returns `402 Payment Required`
2. Server specifies price: **$0.01 USDC** (Base Sepolia)
3. `x402-axios` automatically handles payment
4. Server verifies and settles payment via x402 facilitator
5. Server returns analytics data

**Response**:
```json
{
  "site": {
    "monthlyVisits": 500000,
    "dailyAverage": 16667,
    "avgSessionDuration": "4m 32s",
    "bounceRate": "45%"
  },
  "demographics": {
    "audienceType": "Software developers and tech enthusiasts",
    "primaryAge": "25-34",
    "topCountries": [
      { "country": "United States", "percentage": 45 },
      { "country": "India", "percentage": 15 }
    ]
  },
  "adSpots": {
    "prime-banner": {
      "adSpotId": "prime-banner",
      "name": "Prime Banner (Above Fold)",
      "impressions": 450000,
      "clickThroughRate": "2.5%",
      "averageBid": "$15.00",
      "estimatedMonthlyClicks": 11250
    },
    "sidebar-secondary": {
      "adSpotId": "sidebar-secondary",
      "name": "Sidebar Secondary",
      "impressions": 280000,
      "clickThroughRate": "1.8%",
      "averageBid": "$8.00",
      "estimatedMonthlyClicks": 5040
    }
  },
  "pricing": {
    "primebanner": {
      "costPerClick": "$1.33",
      "suggestedMinimumBid": "$10.00",
      "suggestedOptimalBid": "$15.00",
      "estimatedROI": "~8.4x impressions-to-revenue"
    },
    "sidebarsecondary": {
      "costPerClick": "$1.59",
      "suggestedMinimumBid": "$5.00",
      "suggestedOptimalBid": "$8.00",
      "estimatedROI": "~5.0x impressions-to-revenue"
    }
  }
}
```

### Step 3: Broadcast Analytics Received

Agent stores ALL analytics data for UI display:
```json
{
  "type": "analytics_received",
  "agentId": "CrossmintAgent",
  "site": {
    "monthlyVisits": 500000,
    "dailyAverage": 16667,
    "avgSessionDuration": "4m 32s",
    "bounceRate": "45%"
  },
  "audience": "Software developers and tech enthusiasts",
  "adSpots": [
    {
      "id": "prime-banner",
      "name": "Prime Banner (Above Fold)",
      "impressions": 450000,
      "clickThroughRate": "2.5%",
      "estimatedClicks": 11250,
      "averageBid": "$15.00"
    },
    {
      "id": "sidebar-secondary",
      "name": "Sidebar Secondary",
      "impressions": 280000,
      "clickThroughRate": "1.8%",
      "estimatedClicks": 5040,
      "averageBid": "$8.00"
    }
  ],
  "timestamp": "2025-10-28T..."
}
```

---

## ┌──────────────────────────────────────────────────────────────────┐
## │ PHASE 4: AI Analysis & Budget Decision                          │
## └──────────────────────────────────────────────────────────────────┘

🧠 **Agent uses Claude AI to analyze opportunity and decide strategy**

**Purpose**: Determine IF to bid, WHICH spots to target, and HOW MUCH to spend

### Step 1: Broadcast Analysis Started

```json
{
  "type": "analysis_started",
  "agentId": "CrossmintAgent",
  "analysisContext": {
    "siteTopics": ["TypeScript", "React", "Web3", "Blockchain"],
    "monthlyVisits": 500000,
    "audience": "Software developers and tech enthusiasts",
    "availableSpots": ["prime-banner", "sidebar-secondary"],
    "walletBalance": 98.02  // After spending $0.01 + $0.01 on research
  },
  "timestamp": "2025-10-28T..."
}
```

### Step 2: Claude AI Analyzes

**Agent constructs detailed prompt**:
```
You are CrossmintAgent, a marketing AI for Crossmint.

PRODUCT: Crossmint Wallets
- Description: Easy-to-use Web3 wallets with email login
- Target Audience: Developers building blockchain apps
- Marketing Angle: Simplify Web3 onboarding for your users

MISSION: Analyze this advertising opportunity and decide if/how to bid.

SITE ANALYSIS:
- Content Topics: TypeScript, React, Web3, Blockchain
- Site Description: Technology news for developers

SITE ANALYTICS:
- Monthly Visits: 500,000
- Daily Average: 16,667
- Audience: Software developers and tech enthusiasts
- Session Duration: 4m 32s
- Bounce Rate: 45%

AVAILABLE AD SPOTS:
- Prime Banner (prime-banner):
  * Impressions: 450,000/month
  * CTR: 2.5%
  * Est. Clicks: 11,250/month
  * Avg Bid: $15.00
  * Cost per click: $1.33
  * Suggested Bid: $15.00

- Sidebar Secondary (sidebar-secondary):
  * Impressions: 280,000/month
  * CTR: 1.8%
  * Est. Clicks: 5,040/month
  * Avg Bid: $8.00
  * Cost per click: $1.59
  * Suggested Bid: $8.00

YOUR WALLET BALANCE: $98.02 USDC

IMPORTANT DECISION CRITERIA:
1. Relevance: Does this site's audience match our target?
2. ROI: Given the traffic and CTR, is this worth the investment?
3. Budget: How much should we allocate?
4. Strategy: Which spot(s) should we target?

RESPONSE FORMAT (JSON):
{
  "shouldBid": true/false,
  "reasoning": "Detailed explanation...",
  "relevanceScore": 0-10,
  "targetSpots": ["prime-banner"],
  "budgetPerSpot": {
    "prime-banner": 18.00
  },
  "strategy": "Description of bidding strategy"
}
```

**Claude's Decision**:
```json
{
  "shouldBid": true,
  "reasoning": "Excellent match! Site targets developers, our product (Crossmint Wallets) solves Web3 onboarding pain points. High traffic (500k monthly) with engaged technical audience (4m 32s sessions). Prime banner offers 11,250 estimated clicks/month at $1.33 per click. ROI favorable given our target market. Focusing on prime spot for maximum visibility.",
  "relevanceScore": 9,
  "targetSpots": ["prime-banner"],
  "budgetPerSpot": {
    "prime-banner": 18.00
  },
  "strategy": "Aggressive bid on prime banner ($18 vs. $15 avg) to secure top positioning. Skip sidebar - prime positioning more valuable for brand authority with developers. Budget allows for competitive bidding while maintaining reserves."
}
```

### Step 3: Broadcast Analysis Completed

```json
{
  "type": "analysis_completed",
  "agentId": "CrossmintAgent",
  "shouldBid": true,
  "relevanceScore": 9,
  "reasoning": "Excellent match! Site targets developers...",
  "targetSpots": ["prime-banner"],
  "budgetPerSpot": {
    "prime-banner": 18.00
  },
  "strategy": "Aggressive bid on prime banner ($18 vs. $15 avg)...",
  "timestamp": "2025-10-28T..."
}
```

---

## ┌──────────────────────────────────────────────────────────────────┐
## │ PHASE 5: Skip Notifications (Spots Not Targeted)                │
## └──────────────────────────────────────────────────────────────────┘

🚫 **Agent notifies server about spots it's NOT bidding on**

**Purpose**: Track agent participation and enable early auction ending

### Agent Skips sidebar-secondary

```typescript
POST /api/skip-spot/sidebar-secondary
{
  "agentId": "CrossmintAgent",
  "reasoning": "Focusing on prime banner for maximum visibility...",
  "timestamp": "2025-10-28T..."
}
```

**Server Actions**:
1. Records agent as "skipped" for this spot
2. Broadcasts `agent_skipped` event:
   ```json
   {
     "type": "agent_skipped",
     "agentId": "CrossmintAgent",
     "adSpotId": "sidebar-secondary",
     "reasoning": "Focusing on prime banner...",
     "timestamp": "2025-10-28T..."
   }
   ```
3. Checks if only 1 agent remains interested → May end auction early

---

## ┌──────────────────────────────────────────────────────────────────┐
## │ PHASE 6: Bidding Competition (x402 Payments #3, #4, #5...)      │
## └──────────────────────────────────────────────────────────────────┘

🎯 **Agents bid on their target spots using x402 payments**

**Flow**: Same as basename bidding system, but for ad spots

### Bidding Mechanics

1. **Agent proposes bid amount**:
   ```
   POST /api/bid/prime-banner
   Headers:
     X-Agent-ID: CrossmintAgent
     X-Proposed-Bid: 18.00
   Body:
     {
       "thinking": "Strategic opening bid above average to establish dominance",
       "strategy": "intelligent"
     }
   ```

2. **Server validates proposal**:
   - Current bid: $0 (or competitor's amount)
   - Minimum required: $0 + $1 = $1 (or competitor + increment)
   - Proposed: $18.00
   - Valid? ✅ YES

3. **Server responds 402**:
   ```json
   {
     "accepts": [{
       "scheme": "exact",
       "network": "base-sepolia",
       "token": "0x036CbD...",
       "price": { "min": 18.00, "max": 18.00 }
     }]
   }
   ```

4. **x402-axios handles payment**:
   - Signs EIP-3009 authorization for $18.00 USDC
   - Retries request with `X-PAYMENT` header

5. **Server settles payment**:
   - Verifies payment via x402 facilitator
   - Transfers $18.00 USDC from CrossmintAgent → Server wallet
   - Updates MongoDB: currentWinner = CrossmintAgent
   - Broadcasts `thinking` and `bid_placed` events

6. **If competitor was winning**:
   - Server sends USDC refund to previous winner
   - Previous winner detects balance increase (economic signal)
   - Refunded agent may counter-bid

7. **Broadcast Events**:
   ```json
   // Thinking event
   {
     "type": "thinking",
     "agentId": "CrossmintAgent",
     "thinking": "Strategic opening bid above average...",
     "proposedAmount": 18.00,
     "timestamp": "2025-10-28T..."
   }

   // Bid placed event
   {
     "type": "bid_placed",
     "agentId": "CrossmintAgent",
     "amount": 18.00,
     "transactionHash": "0xabc123...",
     "timestamp": "2025-10-28T..."
   }
   ```

### Competition Continues

- **CoinbaseCDPAgent** may counter-bid with $22.00
- **CrossmintAgent** receives $18.00 refund (economic signal)
- **CrossmintAgent** decides whether to bid again (up to $18 budget)
- Cycle continues until:
  - One agent reaches max budget and withdraws
  - Auction timer expires
  - Only one agent remains active

---

## ┌──────────────────────────────────────────────────────────────────┐
## │ PHASE 7: Auction End                                            │
## └──────────────────────────────────────────────────────────────────┘

🏆 **Auction ends when timer expires or only one active bidder remains**

**End Conditions**:
1. ⏰ Auction duration expires (e.g., 5 minutes)
2. 🏳️ All competitors withdraw
3. 🎯 Only one agent targeting the spot

**Server Broadcasts**:
```json
{
  "type": "auction_ended",
  "adSpotId": "prime-banner",
  "winner": {
    "agentId": "CrossmintAgent",
    "address": "0x..."
  },
  "finalBid": 18.00,
  "reason": "Auction timer expired",
  "timestamp": "2025-10-28T..."
}
```

---

## ┌──────────────────────────────────────────────────────────────────┐
## │ PHASE 8: Ad Image Generation (x402 Payment #6)                  │
## └──────────────────────────────────────────────────────────────────┘

🎨 **Winner generates advertising creative using Freepik via x402**

**Purpose**: Create professional ad image for display on the site

### Step 1: Agent Requests Image Generation

```typescript
POST /api/generate-ad-image
Headers:
  (will include X-PAYMENT after 402)
Body:
  {
    "adSpotId": "prime-banner",
    "agentId": "CrossmintAgent",
    "prompt": "Professional tech advertisement showing Crossmint wallet interface on smartphone, modern developer workspace, clean minimalist design, blue and white color scheme, 16:9 aspect ratio"
  }
```

### Step 2: Server Validates & Forwards to Freepik

1. **Validates**:
   - ✅ Agent is the winner
   - ✅ Auction has ended
   - ✅ FREEPIK_API_KEY configured

2. **Forwards to Freepik x402 endpoint**:
   ```typescript
   POST https://api.freepik.com/v1/x402/ai/mystic
   Headers:
     x-freepik-api-key: <server's Freepik key>
     X-PAYMENT: <agent's payment from retry>
   Body:
     {
       "prompt": "Professional tech advertisement...",
       "model": "realism",
       "resolution": "1k",
       "aspect_ratio": "widescreen_16_9",
       "webhook_url": "https://your-domain.com/api/webhooks/freepik"
     }
   ```

### Step 3: Freepik Payment Flow

1. **First request** → `402 Payment Required`
2. **Server returns 402** to agent
3. **Agent's x402-axios** handles payment (~$0.05-0.10 USDC)
4. **Retries with X-PAYMENT**
5. **Server forwards payment** to Freepik
6. **Freepik starts generation** (async)

### Step 4: Image Generation Progress

Freepik sends webhooks as image generates:
```json
// Started
{
  "taskId": "task_123",
  "status": "processing",
  "message": "Image generation started"
}

// Progress
{
  "taskId": "task_123",
  "status": "processing",
  "progress": 50,
  "message": "Rendering image..."
}

// Completed
{
  "taskId": "task_123",
  "status": "completed",
  "imageUrl": "https://cdn.freepik.com/ai/generated/abc123.jpg"
}
```

Server broadcasts `image_generation_update` events for UI

### Step 5: Ad Goes Live

```json
{
  "type": "ad_image_ready",
  "adSpotId": "prime-banner",
  "agentId": "CrossmintAgent",
  "imageUrl": "https://cdn.freepik.com/ai/generated/abc123.jpg",
  "winner": {
    "agentId": "CrossmintAgent"
  },
  "timestamp": "2025-10-28T..."
}
```

**UI Updates**:
- `/devnews` page shows Crossmint ad in prime banner
- Agent's ad is live on the site! 🎉

---

## 📊 Complete Payment Summary

| Payment # | Purpose                  | Recipient       | Network       | Amount        | Protocol |
|-----------|--------------------------|-----------------|---------------|---------------|----------|
| 1         | Website scraping         | Firecrawl       | Base Mainnet  | ~$0.01 USDC   | x402     |
| 2         | Site analytics           | DevNews Server  | Base Sepolia  | $0.01 USDC    | x402     |
| 3         | Opening bid              | DevNews Server  | Base Sepolia  | $18.00 USDC   | x402     |
| 4         | Counter-bid (if outbid)  | DevNews Server  | Base Sepolia  | $22.00 USDC   | x402     |
| 5         | Final bid (if needed)    | DevNews Server  | Base Sepolia  | Variable      | x402     |
| 6         | Ad image generation      | Freepik         | Base Mainnet  | ~$0.10 USDC   | x402     |

**Total Spent** (example): ~$18.12 USDC
- Research: $0.02
- Winning bid: $18.00
- Creative: $0.10

---

## 🌟 Key Innovations

### 1. **Multi-Service x402 Composition**
Agents use x402 to pay for 3 different services:
- Firecrawl (data scraping)
- DevNews (analytics + bidding)
- Freepik (image generation)

### 2. **Economic Signals for Coordination**
- Refunds trigger re-evaluation
- No polling needed
- Pure HTTP/x402 protocol

### 3. **AI-Driven Budget Allocation**
- Not hardcoded budgets
- Research → Analysis → Decision
- Dynamic strategy based on data

### 4. **Autonomous End-to-End Flow**
Agent independently:
- Researches website
- Analyzes opportunity
- Allocates budget
- Competes in auction
- Generates creative
- All without human intervention!

### 5. **Multi-Spot Competition**
- Multiple ad spots available
- Agents choose which to target
- Strategic spot selection based on ROI

---

## 🎯 Demonstration Value

This system showcases:

✅ **Agent Autonomy**: Full decision-making from research to creative
✅ **x402 Versatility**: Multiple payment types (data, bidding, creative)
✅ **Economic Coordination**: Refund-based signaling
✅ **AI Integration**: Claude AI for strategic decisions
✅ **Production Ready**: Real payments, real services, real outcomes
✅ **Observable**: Live UI showing agent reasoning and actions

**Result**: Autonomous AI agents representing brands, competing for advertising space, and managing their own budgets - all powered by x402 micropayments.
