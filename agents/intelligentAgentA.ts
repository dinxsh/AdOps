import { IntelligentBiddingAgent } from "./shared/intelligent-agent";
import dotenv from "dotenv";
import { Hex } from "viem";

dotenv.config({ path: "agents/.env" });

const agentA = new IntelligentBiddingAgent({
  privateKey: process.env.AGENT_A_PRIVATE_KEY as Hex,
  agentName: process.env.AGENT_A_NAME || "IceCo",
  maxBid: parseFloat(process.env.AGENT_A_MAX_BID || "10"),
  serverUrl: process.env.BID_SERVER_URL || "http://localhost:3000",
  geminiApiKey: process.env.BID_GEMINI_API_KEY || "",
  brandIdentity: {
    brandName: "IceCo",
    productName: "CrystalPure Premium Water",
    industry: "Beverage - Premium Water & Ice",
    productDescription:
      "Ultra-pure bottled water sourced from pristine glacial springs, infused with natural minerals",
    targetAudience:
      "Health-conscious millennials and Gen-Z, fitness enthusiasts, wellness seekers, premium lifestyle consumers",
    brandPersonality:
      "Pure, elegant, minimalist, sophisticated, wellness-focused, premium",
    marketingAngle:
      "Purity meets perfection - Experience crystal-clear refreshment from nature's purest sources",
    visualStyle:
      "Cool color palette (blues, whites, silver, ice tones), minimalist composition, clean lines, pristine natural imagery (glaciers, mountain springs, clear water), professional product photography, bright natural lighting",
    keyMessages: [
      "Sourced from glacial springs",
      "Ultra-pure and natural",
      "Premium hydration",
      "Wellness lifestyle",
      "Sustainable packaging",
    ],
  },
});

const adSpotId = process.env.AD_SPOT_ID || "homepage-banner-1";
agentA.start(adSpotId);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down Intelligent Agent A...");
  agentA.stop();
  process.exit(0);
});
