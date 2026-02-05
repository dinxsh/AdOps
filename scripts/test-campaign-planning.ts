
import { IntelligentBiddingAgent } from "../agents/shared/intelligent-agent";
import dotenv from "dotenv";
import { Hex } from "viem";

dotenv.config({ path: "agents/.env" });

async function main() {
    console.log("🚀 Starting Campaign Planning Test...");

    const agent = new IntelligentBiddingAgent({
        privateKey: (process.env.AGENT_A_PRIVATE_KEY as Hex) || "0x0000000000000000000000000000000000000000000000000000000000000000",
        agentName: "TestAgent",
        maxBid: 10,
        serverUrl: "http://localhost:3000",
        geminiApiKey: process.env.BID_GEMINI_API_KEY || "",
    });

    const campaignDetails = {
        campaignName: "Summer Sale 2026",
        productDescription: "50% off on all summer apparel. Visit our store or shop online.",
        objective: "conversions",
        audienceDescription: "Young adults aged 18-30 looking for trendy summer fashion.",
        budgetTotal: 5000,
        budgetDaily: 500,
    };

    try {
        await agent.planCampaign(campaignDetails);
        console.log("✅ Test completed successfully.");
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

main();
