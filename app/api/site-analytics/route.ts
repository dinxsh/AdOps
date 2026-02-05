import { NextRequest, NextResponse } from "next/server";
import { verify, settle } from "x402/facilitator";
import type { PaymentPayload } from "x402/types";
import { getServerWalletClient } from "@/lib/wallet";

// Simple in-memory lock to prevent concurrent settlements
const settlementLocks = new Map<string, Promise<unknown>>();

export async function GET(request: NextRequest) {
  // Check for payment header
  const paymentHeader = request.headers.get("X-PAYMENT");
  const agentId = request.headers.get("X-Agent-ID") || "unknown";

  // No payment → return 402 with payment requirements
  if (!paymentHeader) {
    const analyticsPrice = 0.01; // $0.01 USDC
    const priceInUnits = (analyticsPrice * 1_000_000).toString(); // USDC has 6 decimals

    const paymentRequirements = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network:
            (process.env.SOLANA_NETWORK || "devnet") === "mainnet-beta"
              ? "solana"
              : "solana-devnet",
          minAmountRequired: priceInUnits,
          maxAmountRequired: priceInUnits,
          asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC SPL Token
          payTo: process.env.ADDRESS,
          resource: `${request.nextUrl.origin}/api/site-analytics`,
          description: "Access DevNews site analytics and traffic data",
          mimeType: "application/json",
          maxTimeoutSeconds: 60,
          extra: {
            name: "USDC",
            version: "2",
          },
        },
      ],
      error: "Payment required to access site analytics",
      info: {
        siteName: "DevNews",
        price: "$0.01 USDC",
        description:
          "Get detailed traffic metrics, demographics, and ad spot performance data",
      },
    };

    return NextResponse.json(paymentRequirements, { status: 402 });
  }

  // Payment received - verify and settle
  try {
    const payment: PaymentPayload = JSON.parse(
      Buffer.from(paymentHeader, "base64").toString("utf-8")
    );

    const network = process.env.SOLANA_NETWORK || "devnet";
    const paymentRequirements = {
      scheme: "exact" as const,
      network:
        network === "mainnet-beta" ? "solana" : ("solana-devnet" as const),
      maxAmountRequired: (0.01 * 1_000_000).toString(),
      asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC SPL Token
      payTo: process.env.ADDRESS as string,
      resource: `${request.nextUrl.origin}/api/site-analytics`,
      description: "Access DevNews site analytics",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
    };

    // Step 1: Verify the payment
    console.log(`🔍 [analytics] Verifying payment from ${agentId}...`);
    const walletClient = await getServerWalletClient();
    const verifyResult = await verify(
      walletClient as any,
      payment,
      paymentRequirements
    );

    if (!verifyResult.isValid) {
      console.log(
        `❌ [analytics] Payment verification failed: ${verifyResult.invalidReason}`
      );
      return NextResponse.json(
        { error: `Payment verification failed: ${verifyResult.invalidReason}` },
        { status: 402 }
      );
    }

    console.log(`✅ [analytics] Payment verified from ${verifyResult.payer}`);

    // Step 2: Settle the payment on-chain
    console.log(`⛓️  [analytics] Settling payment on-chain...`);

    // Wait for any pending settlement to complete
    const lockKey = "analytics-settlement";
    if (settlementLocks.has(lockKey)) {
      console.log(`⏳ [analytics] Waiting for previous settlement...`);
      await settlementLocks.get(lockKey);
    }

    // Create and store settlement promise
    const settlementPromise = settle(
      walletClient as any,
      payment,
      paymentRequirements
    );
    settlementLocks.set(lockKey, settlementPromise);

    let settleResult;
    try {
      settleResult = await settlementPromise;
    } finally {
      settlementLocks.delete(lockKey);
    }

    if (!settleResult.success) {
      console.log(
        `❌ [analytics] Settlement failed: ${settleResult.errorReason}`
      );
      return NextResponse.json(
        { error: `Payment settlement failed: ${settleResult.errorReason}` },
        { status: 402 }
      );
    }

    console.log(
      `✅ [analytics] Payment settled! Tx: ${settleResult.transaction}`
    );
    console.log(`📊 [analytics] Returning data to ${agentId}`);
  } catch (error) {
    console.error(`❌ [analytics] Error processing payment:`, error);
    return NextResponse.json(
      { error: "Payment processing error" },
      { status: 500 }
    );
  }

  // Payment successful → return analytics data
  // Optimized analytics data - realistic but strong metrics to incentivize bidding
  const analytics = {
    site: {
      name: "DevNews",
      tagline: "Technology News for Developers",
      description:
        "Aggregated technology news, tutorials, and insights for software engineers, DevOps professionals, and tech leaders.",
      monthlyVisits: 4500000,
      dailyAverage: 150000,
      pageviews: 13500000,
      uniqueVisitors: 3200000,
      avgSessionDuration: "5m 15s",
      bounceRate: "28%",
      returningVisitorRate: "68%",
    },
    demographics: {
      topCountries: [
        { country: "United States", percentage: 38 },
        { country: "India", percentage: 15 },
        { country: "United Kingdom", percentage: 9 },
        { country: "Germany", percentage: 7 },
        { country: "Canada", percentage: 6 },
      ],
      audienceType:
        "Software Engineers (48%), DevOps Engineers (23%), Tech Leaders (18%), Data Scientists (8%), Other (3%)",
      primaryAge: "25-44 years old (78%)",
      mobileVsDesktop: "30% mobile, 70% desktop",
      topInterests: [
        "Cloud computing",
        "AI/Machine Learning",
        "DevOps & CI/CD",
        "Blockchain & Web3",
        "Open Source",
        "Programming languages",
        "Developer tools",
      ],
    },
    contentCategories: {
      topCategories: [
        { name: "AI & Machine Learning", percentage: 28 },
        { name: "Cloud & Infrastructure", percentage: 22 },
        { name: "Developer Tools", percentage: 18 },
        { name: "Open Source", percentage: 15 },
        { name: "Web3 & Blockchain", percentage: 10 },
        { name: "Programming Languages", percentage: 7 },
      ],
    },
    adSpots: {
      "prime-banner": {
        adSpotId: "prime-banner",
        name: "Prime Banner",
        position: "Top of page, above all content",
        impressions: 4500000, // Monthly (matches site visits)
        clickThroughRate: "3.5%",
        averageBid: "$15.00",
        currentBid: null, // Will be populated if auction is active
        dimensions: "970x120 (desktop), 320x50 (mobile)",
        visibility: "100% (above fold)",
        viewableImpressions: 4410000, // 98% viewability
        averageDwellTime: "3.8s",
        estimatedMonthlyClicks: 157500,
      },
      "sidebar-secondary": {
        adSpotId: "sidebar-secondary",
        name: "Sidebar Secondary",
        position: 'Right sidebar, below "Most Recent" section',
        impressions: 2925000, // Monthly (65% of prime - better scroll-through rate)
        clickThroughRate: "1.8%",
        averageBid: "$6.00",
        currentBid: null, // Will be populated if auction is active
        dimensions: "300x250",
        visibility: "75% (requires scroll)",
        viewableImpressions: 2193750, // 75% viewability
        averageDwellTime: "2.1s",
        estimatedMonthlyClicks: 52650,
      },
    },
    pricing: {
      primeBanner: {
        costPerImpression: "$0.0033",
        costPerClick: "$0.10",
        suggestedMinimumBid: "$12.00",
        suggestedOptimalBid: "$15.00 - $22.00",
        estimatedROI: "250% - 400% for SaaS/developer tools",
      },
      sidebarSecondary: {
        costPerImpression: "$0.0021",
        costPerClick: "$0.11",
        suggestedMinimumBid: "$5.00",
        suggestedOptimalBid: "$6.00 - $10.00",
        estimatedROI: "180% - 350% for SaaS/developer tools",
      },
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(analytics);
}
