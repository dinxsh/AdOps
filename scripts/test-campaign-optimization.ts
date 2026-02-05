
import { IntelligentBiddingAgent, OptimizationContext } from "../agents/shared/intelligent-agent";
import dotenv from "dotenv";
import { Hex } from "viem";

dotenv.config({ path: "agents/.env" });

async function main() {
    console.log("🚀 Starting Campaign Optimization Test...");

    const agent = new IntelligentBiddingAgent({
        privateKey: (process.env.AGENT_A_PRIVATE_KEY as Hex) || "0x0000000000000000000000000000000000000000000000000000000000000000",
        agentName: "OptimizerAgent",
        maxBid: 50,
        serverUrl: "http://localhost:3000",
        geminiApiKey: process.env.BID_GEMINI_API_KEY || "",
    });

    // Mock Data
    const stats = {
        "search-ads": { impressions: 15000, clicks: 450, ctr: 0.03, spend: 1200, conversions: 25 },
        "social-media": { impressions: 8000, clicks: 120, ctr: 0.015, spend: 600, conversions: 5 },
        "display-network": { impressions: 20000, clicks: 100, ctr: 0.005, spend: 400, conversions: 2 }
    };

    const creatives = [
        { id: "cr_1", status: "active", type: "text", ctr: 0.035 },
        { id: "cr_2", status: "active", type: "image", ctr: 0.004 }, // Low performer
        { id: "cr_3", status: "paused", type: "video", ctr: 0.0 }
    ];

    const recentActions = [
        { type: "bid_adjustment", channel: "search-ads", details: "Increased bid by 10%", timestamp: "2023-10-26T10:00:00Z" }
    ];

    const context: OptimizationContext = {
        campaignId: "camp_summer_2026",
        now: new Date().toISOString(),
        remainingBudget: 2800, // Total budget 5000 - spend 2200
        statsJson: JSON.stringify(stats, null, 2),
        creativesJson: JSON.stringify(creatives, null, 2),
        recentActionsJson: JSON.stringify(recentActions, null, 2)
    };

    try {
        await agent.optimizeCampaign(context);
        console.log("✅ Test completed successfully.");
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

main();
