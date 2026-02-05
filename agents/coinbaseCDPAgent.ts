import { AnalyticalBiddingAgent } from "./shared/analytical-agent";
import dotenv from "dotenv";

dotenv.config({ path: "agents/.env" });

console.log("\n🏦 Initializing Coinbase Developer Platform Agent...\n");

const coinbaseCDPAgent = new AnalyticalBiddingAgent({
  privateKey: process.env.AGENT_A_PRIVATE_KEY as string,
  agentName: "CoinbaseCDP",
  maxBid: null, // No hard limit - will be calculated based on analysis
  serverUrl: process.env.BID_SERVER_URL || "http://localhost:3000",
  geminiApiKey: process.env.BID_GEMINI_API_KEY || "",
  tunnelUrl: process.env.TUNNEL_URL, // Optional: expose localhost to Firecrawl via Cloudflare Tunnel
  brandIdentity: {
    brandName: "Coinbase Developer Platform",
    productName: "CDP Server Wallets",
    industry: "Blockchain Infrastructure & Crypto Services",
    productDescription:
      "Trusted crypto infrastructure to power your business - Enterprise-grade server wallets with built-in security, compliance, and scalability",
    targetAudience:
      "Web3 developers, blockchain engineers, fintech companies, DeFi builders, enterprise developers integrating crypto payments",
    brandPersonality:
      "Professional, trustworthy, enterprise-grade, reliable, developer-first, institutional",
    marketingAngle:
      "Build faster with battle-tested infrastructure trusted by thousands of developers worldwide",
    visualStyle:
      "Professional Coinbase blue branding (#0052FF), clean modern design, developer-focused imagery (code snippets, APIs, dashboards), tech-forward aesthetic, trust-building elements (security badges, uptime stats)",
    keyMessages: [
      "Trusted by thousands of developers",
      "Enterprise-grade security and compliance",
      "Easy integration with comprehensive APIs",
      "Built on Coinbase infrastructure",
      "Scale from prototype to production",
      "99.99% uptime SLA",
    ],
  },
});

// Start analytical agent - it will scrape, analyze, and decide autonomously
const availableSpots = ["prime-banner", "sidebar-secondary"];
console.log(`🎯 Target ad spots: ${availableSpots.join(", ")}`);
console.log(`📊 Agent will analyze site and decide strategy autonomously\n`);

coinbaseCDPAgent.startAnalysis(availableSpots);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down Coinbase CDP Agent...");
  coinbaseCDPAgent.stop();
  process.exit(0);
});
