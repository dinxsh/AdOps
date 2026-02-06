
import { IntelligentBiddingAgent, OptimizationContext } from "../agents/shared/intelligent-agent";
import dotenv from "dotenv";
import { Hex } from "viem";

dotenv.config({ path: "agents/.env" });

async function main() {
    console.log("🚀 Starting Dry-Run Campaign Optimization...");

    const agent = new IntelligentBiddingAgent({
        privateKey: (process.env.AGENT_A_PRIVATE_KEY as Hex) || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        agentName: "DryRunOptimizer",
        maxBid: 100,
        serverUrl: "http://localhost:3000",
        geminiApiKey: process.env.BID_GEMINI_API_KEY || "",
        dryRun: true // ENABLE DRY-RUN MODE
    });

    // Mock Data for Cycle 1
    const context1: OptimizationContext = {
        campaignId: "camp_dry_run_01",
        now: new Date().toISOString(),
        remainingBudget: 5000,
        statsJson: JSON.stringify({
            "search-ads": { impressions: 10000, clicks: 300, ctr: 0.03, spend: 1000, conversions: 10 },
            "display-network": { impressions: 50000, clicks: 200, ctr: 0.004, spend: 500, conversions: 1 }
        }, null, 2),
        creativesJson: JSON.stringify([
            { id: "cr_A", status: "active", type: "text", ctr: 0.03 },
            { id: "cr_B", status: "active", type: "image", ctr: 0.005 }
        ], null, 2),
        recentActionsJson: "[]"
    };

    console.log("\n▶️  Cycle 1: Initial Optimization");
    await agent.optimizeCampaign(context1);

    // Mock Data for Cycle 2 (simulating time passing and performance changes)
    const context2: OptimizationContext = {
        campaignId: "camp_dry_run_01",
        now: new Date(Date.now() + 86400000).toISOString(), // +1 day
        remainingBudget: 4800, // Spent 200 (simulated)
        statsJson: JSON.stringify({
            "search-ads": { impressions: 12000, clicks: 350, ctr: 0.029, spend: 1200, conversions: 12 }, // Slight dip
            "display-network": { impressions: 60000, clicks: 150, ctr: 0.0025, spend: 600, conversions: 0 } // Dropped further
        }, null, 2),
        creativesJson: JSON.stringify([
            { id: "cr_A", status: "active", type: "text", ctr: 0.029 },
            { id: "cr_B", status: "active", type: "image", ctr: 0.0025 }
        ], null, 2),
        recentActionsJson: JSON.stringify([
            { type: "optimization", details: "Cycle 1 actions would be listed here", timestamp: context1.now }
        ], null, 2)
    };

    console.log("\n▶️  Cycle 2: Follow-up Optimization (Day 2)");
    await agent.optimizeCampaign(context2);

    console.log("\n✅ Dry-Run Complete.");
    console.log("Check logs above for 'SIMULATED x402 Payment' and strategy explanations.");
}

main().catch(console.error);
