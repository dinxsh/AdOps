import { IntelligentBiddingAgent } from "./shared/intelligent-agent";
import dotenv from "dotenv";
import { Hex } from "viem";

dotenv.config({ path: "agents/.env" });

const agentB = new IntelligentBiddingAgent({
  privateKey: process.env.AGENT_B_PRIVATE_KEY as Hex,
  agentName: process.env.AGENT_B_NAME || "FizzUp",
  maxBid: parseFloat(process.env.AGENT_B_MAX_BID || "15"),
  serverUrl: process.env.BID_SERVER_URL || "http://localhost:3000",
  geminiApiKey: process.env.BID_GEMINI_API_KEY || "",
  brandIdentity: {
    brandName: "FizzUp",
    productName: "FizzUp Energy Soda",
    industry: "Beverage - Energy Soda & Drinks",
    productDescription:
      "Bold-flavored energy soda packed with B-vitamins, natural caffeine, and electrolytes for sustained energy",
    targetAudience:
      "Active young adults (18-30), gamers, students, night shift workers, anyone needing an energy boost",
    brandPersonality:
      "Bold, energetic, vibrant, rebellious, fun, unapologetic, high-energy",
    marketingAngle:
      "Unleash Your Energy - Bold flavors that fuel your unstoppable life",
    visualStyle:
      "Bright electric colors (neon blue, electric green, vibrant orange, hot pink), dynamic action shots, explosive energy visuals, youth culture imagery, dramatic lighting with neon glow effects, motion and movement",
    keyMessages: [
      "Explosive energy boost",
      "Bold unique flavors",
      "Vitamins + Natural caffeine",
      "Fuel your passion",
      "Stay unstoppable",
    ],
  },
});

const adSpotId = process.env.AD_SPOT_ID || "homepage-banner-1";
agentB.start(adSpotId);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down Intelligent Agent B...");
  agentB.stop();
  process.exit(0);
});
