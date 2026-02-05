import { AnalyticalBiddingAgent } from "./shared/analytical-agent";
import dotenv from "dotenv";

dotenv.config({ path: "agents/.env" });

console.log("\n✨ Initializing Crossmint Agent...\n");

const crossmintAgent = new AnalyticalBiddingAgent({
  privateKey: process.env.AGENT_B_PRIVATE_KEY as string,
  agentName: "Crossmint",
  maxBid: null, // No hard limit - will be calculated based on analysis
  serverUrl: process.env.BID_SERVER_URL || "http://localhost:3000",
  geminiApiKey: process.env.BID_GEMINI_API_KEY || "",
  tunnelUrl: process.env.TUNNEL_URL, // Optional: expose localhost to Firecrawl via Cloudflare Tunnel
  brandIdentity: {
    brandName: "Crossmint",
    productName: "Crossmint Server Wallets",
    industry: "Wallet Infrastructure & Stablecoin Payments",
    productDescription:
      "Wallet infrastructure & stablecoin payments for modern apps - Ship production-ready wallets in minutes, not months",
    targetAudience:
      "App developers, mobile developers, gaming studios, NFT platforms, Web3 startups, fintech innovators",
    brandPersonality:
      "Modern, developer-friendly, innovative, fast-moving, accessible, builder-focused",
    marketingAngle:
      "Ship wallets in minutes, not months - No crypto knowledge required, built for developers who ship fast",
    visualStyle:
      "Bold modern branding with vibrant gradients (purple, pink, blue), dynamic and energetic design, developer tools imagery (VSCode, terminals, APIs), fast-paced tech aesthetic, mobile-first visuals",
    keyMessages: [
      "No crypto knowledge required",
      "Production-ready in minutes",
      "Stablecoin-first approach",
      "Scale to millions of users",
      "Email & social login support",
      "NFT custody built-in",
    ],
  },
});

// Start analytical agent - it will scrape, analyze, and decide autonomously
const availableSpots = ["prime-banner", "sidebar-secondary"];
console.log(`🎯 Target ad spots: ${availableSpots.join(", ")}`);
console.log(`📊 Agent will analyze site and decide strategy autonomously\n`);

crossmintAgent.startAnalysis(availableSpots);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down Crossmint Agent...");
  crossmintAgent.stop();
  process.exit(0);
});
