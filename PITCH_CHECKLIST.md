# Pitch Checklist - Autonomous AI Advertising Agents

## ✅ Pre-Pitch Setup

### 1. Environment Configuration

- [ ] Copy `.env.example` to `.env.local` and fill in all values
- [ ] Copy `agents/.env.example` to `agents/.env` and fill in all values
- [ ] Generate Solana keypairs for server and agents
- [ ] Set up MongoDB Atlas (free tier works)
- [ ] Get API keys:
  - [ ] Google Gemini API key
  - [ ] Firecrawl API key (optional - for scraping)
  - [ ] Freepik API key (for image generation)

### 2. Wallet Funding (Devnet)

- [ ] Fund server wallet with SOL (for transaction fees)
- [ ] Fund server wallet with USDC (for refunds)
- [ ] Fund Agent A wallet with USDC
- [ ] Fund Agent B wallet with USDC

**Devnet Faucets:**

- SOL: `solana airdrop 1 <PUBLIC_KEY> --url devnet`
- USDC: Use Jupiter or Solana devnet faucet

### 3. Dependencies

- [ ] Run `npm install`
- [ ] Verify all packages installed correctly
- [ ] Check for any TypeScript errors: `npm run lint`

### 4. Database Setup

- [ ] MongoDB Atlas cluster created
- [ ] Connection string in `.env.local`
- [ ] Database name set
- [ ] Test connection: `npm run check-db` (if script exists)

### 5. Testing

- [ ] Start server: `npm run dev`
- [ ] Start Agent A: `npm run agent:cdp`
- [ ] Start Agent B: `npm run agent:crossmint`
- [ ] Verify agents can connect to server
- [ ] Test bidding flow
- [ ] Test refund detection
- [ ] Test image generation (if Freepik configured)

## 🎯 Demo Flow

### Phase 1: Agent Discovery (2-3 min)

1. Agents start and discover ad spots
2. Agents scrape website (if Firecrawl configured)
3. Agents purchase analytics ($0.01 USDC)
4. Show terminal output of agent reasoning

### Phase 2: Bidding Competition (3-5 min)

1. Agents analyze opportunity
2. Agents place strategic bids
3. Show real-time UI updates
4. Demonstrate refund detection
5. Show agent re-evaluation after refund

### Phase 3: Winner & Creative (2-3 min)

1. Auction ends
2. Winner generates ad image
3. Display winning ad on mock publisher site
4. Show transaction history on Solscan

## 📊 Key Points to Highlight

### Technical Innovation

- ✅ **x402 Protocol**: HTTP 402 status code for micropayments
- ✅ **Economic Signals**: Refunds as coordination mechanism
- ✅ **Autonomous Agents**: Zero human intervention
- ✅ **Solana Integration**: Fast, cheap transactions
- ✅ **AI Reasoning**: Gemini-powered strategic decisions

### Business Value

- ✅ **Cost Efficiency**: Micropayments ($0.01-$100)
- ✅ **Real-time**: Instant payment settlement
- ✅ **Scalable**: Multiple agents, multiple services
- ✅ **Transparent**: All transactions on-chain

### Demo URLs

- **Analytical Agents Dashboard**: `http://localhost:3000/analytical-agents`
- **Mock Publisher Site**: `http://localhost:3000/devnews`
- **Auction Detail**: `http://localhost:3000/auction/prime-banner`

## 🚨 Common Issues & Fixes

### Issue: "Payment verification failed"

**Fix**:

- Check agent USDC balance
- Verify x402 facilitator URL
- Ensure network matches (devnet vs mainnet)

### Issue: "MongoDB connection failed"

**Fix**:

- Check connection string
- Verify IP whitelist in Atlas
- Test connection separately

### Issue: "Agent not bidding"

**Fix**:

- Check agent USDC balance
- Verify server is running
- Check agent logs for errors

### Issue: "Image generation failed"

**Fix**:

- Verify Freepik API key
- Check webhook URL configuration
- Ensure agent has USDC on mainnet

## 📝 Quick Start Commands

```bash
# Terminal 1: Server
npm run dev

# Terminal 2: Agent A
npm run agent:cdp

# Terminal 3: Agent B
npm run agent:crossmint

# Browser
open http://localhost:3000/analytical-agents
```

## 🎤 Talking Points

1. **Problem**: Traditional ad buying requires human negotiation, contracts, and upfront payments
2. **Solution**: Autonomous AI agents that discover, analyze, and bid on ad space using micropayments
3. **Innovation**: x402 protocol enables HTTP-based payments with economic signals
4. **Demo**: Watch two agents compete in real-time, making strategic decisions autonomously
5. **Future**: Agents can discover opportunities across the web, negotiate prices, and deliver results

## 🔗 Resources

- **x402 Protocol**: https://x402.org/
- **Solana Explorer**: https://solscan.io/
- **GitHub Repo**: (your repo URL)
- **Documentation**: See README.md and SOLANA_MIGRATION.md
