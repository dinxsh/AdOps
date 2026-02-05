# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

**Server (.env.local):**

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

**Agents (agents/.env):**

```bash
cp agents/.env.example agents/.env
# Edit agents/.env with your values
```

### 3. Generate Keypairs

```bash
# Generate server keypair
node -e "const {Keypair} = require('@solana/web3.js'); const bs58 = require('bs58'); const kp = Keypair.generate(); console.log('Server Private:', bs58.encode(kp.secretKey)); console.log('Server Public:', kp.publicKey.toBase58());"

# Generate agent keypairs (run twice)
node -e "const {Keypair} = require('@solana/web3.js'); const bs58 = require('bs58'); const kp = Keypair.generate(); console.log('Agent Private:', bs58.encode(kp.secretKey)); console.log('Agent Public:', kp.publicKey.toBase58());"
```

### 4. Fund Wallets (Devnet)

```bash
# Install Solana CLI (if not installed)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Fund server wallet
solana airdrop 1 <SERVER_PUBLIC_KEY> --url devnet

# Fund agents
solana airdrop 1 <AGENT_A_PUBLIC_KEY> --url devnet
solana airdrop 1 <AGENT_B_PUBLIC_KEY> --url devnet
```

### 5. Run the Demo

**Terminal 1:**

```bash
npm run dev
```

**Terminal 2:**

```bash
npm run agent:cdp
```

**Terminal 3:**

```bash
npm run agent:crossmint
```

**Browser:**

- Open http://localhost:3000/analytical-agents
- Watch the agents compete!

## 📋 Minimum Requirements

- ✅ MongoDB Atlas account (free tier)
- ✅ Google Gemini API key
- ✅ Freepik API key (for image generation)
- ✅ Solana devnet wallets funded with SOL and USDC

## 🎯 What You'll See

1. **Agents Start**: Both agents initialize and discover ad spots
2. **Research Phase**: Agents scrape website and purchase analytics
3. **Bidding Phase**: Agents compete with strategic bids
4. **Refund Detection**: Outbid agents detect refunds and re-evaluate
5. **Winner**: Winning agent generates ad image
6. **Display**: Ad appears on mock publisher site

## 🐛 Troubleshooting

**"Payment verification failed"**
→ Check agent USDC balance on Solana devnet

**"MongoDB connection failed"**
→ Verify connection string and IP whitelist in Atlas

**"Agent not bidding"**
→ Check server is running and agent has USDC

See [PITCH_CHECKLIST.md](./PITCH_CHECKLIST.md) for more details.
