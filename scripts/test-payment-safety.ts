
import { IntelligentBiddingAgent, AdEvent } from "../agents/shared/intelligent-agent";
import dotenv from "dotenv";
import { Hex } from "viem";

dotenv.config({ path: "agents/.env" });

async function main() {
    console.log("🚀 Starting Payment Safety Test...");

    const agent = new IntelligentBiddingAgent({
        privateKey: (process.env.AGENT_A_PRIVATE_KEY as Hex) || "0x0000000000000000000000000000000000000000000000000000000000000000",
        agentName: "SafetyAgent",
        maxBid: 5, // Low max bid for testing
        serverUrl: "http://localhost:3000",
        geminiApiKey: process.env.BID_GEMINI_API_KEY || "",
    });

    // Mocking getUSDCBalance to return a fixed amount
    agent.getUSDCBalance = async () => 100;

    // Test Case 1: Valid Payment
    console.log("\n--- Test Case 1: Valid Payment ---");
    const validEvent: AdEvent = {
        eventId: "evt_1",
        type: "impression",
        campaignId: "camp_1",
        creativeId: "cr_1",
        timestamp: new Date().toISOString(),
        bidAmount: 2.5
    };
    await agent.processEventPayment(validEvent);

    // Test Case 2: Safety Violation (Exceeds Safety Threshold)
    console.log("\n--- Test Case 2: Safety Violation (High Value) ---");
    const unsafeEvent: AdEvent = {
        eventId: "evt_2",
        type: "click",
        campaignId: "camp_1",
        creativeId: "cr_1",
        timestamp: new Date().toISOString(),
        bidAmount: 15.0 // Exceeds safety threshold of 10.0
    };
    await agent.processEventPayment(unsafeEvent);

    // Test Case 3: Max Bid Violation
    console.log("\n--- Test Case 3: Max Bid Violation ---");
    const maxBidEvent: AdEvent = {
        eventId: "evt_3",
        type: "click",
        campaignId: "camp_1",
        creativeId: "cr_1",
        timestamp: new Date().toISOString(),
        bidAmount: 6.0 // Exceeds maxBid of 5.0
    };
    await agent.processEventPayment(maxBidEvent);

    // Test Case 4: Insufficient Funds
    console.log("\n--- Test Case 4: Insufficient Funds ---");
    agent.getUSDCBalance = async () => 1.0; // Mock low balance
    const poorEvent: AdEvent = {
        eventId: "evt_4",
        type: "impression",
        campaignId: "camp_1",
        creativeId: "cr_1",
        timestamp: new Date().toISOString(),
        bidAmount: 2.0
    };
    await agent.processEventPayment(poorEvent);
}

main();
