import { NextRequest, NextResponse } from "next/server";
import { getAdSpotRecord, updateAdSpotRecord, addBidToHistory } from "@/lib/db";
import { sendRefund, getServerWalletClient } from "@/lib/wallet";
import {
  calculateCurrentBidPrice,
  parseBidAmount,
  AUCTION_DURATION_MS,
} from "@/lib/x402-config";
import { verify, settle } from "x402/facilitator";
import type { PaymentPayload, ExactEvmPayload } from "x402/types";
import { broadcastEvent } from "@/lib/events";

// Simple in-memory lock to prevent concurrent settlements
const settlementLocks = new Map<string, Promise<unknown>>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adSpotId: string }> }
) {
  const { adSpotId } = await params;

  try {
    // Get current bid state from MongoDB
    const bidRecord = await getAdSpotRecord(adSpotId);

    // Check if auction has ended
    if (bidRecord && bidRecord.status === "ended") {
      return NextResponse.json(
        { error: "Auction has ended" },
        { status: 410 } // Gone
      );
    }

    // Check if auction time has elapsed
    if (
      bidRecord &&
      bidRecord.auctionEndTime &&
      new Date() > bidRecord.auctionEndTime
    ) {
      // Mark auction as ended
      await updateAdSpotRecord(adSpotId, { status: "ended" });
      return NextResponse.json(
        { error: "Auction time has expired" },
        { status: 410 }
      );
    }

    // Get payment header and agent info
    const paymentHeader = request.headers.get("X-PAYMENT");
    const agentId = request.headers.get("X-Agent-ID") || "unknown";
    const proposedBidHeader = request.headers.get("X-Proposed-Bid");
    const strategyReasoning = request.headers.get("X-Strategy-Reasoning");

    // Parse request body for thinking/strategy
    let requestBody: Record<string, unknown> = {};
    try {
      requestBody = await request.json();
    } catch {
      // No body or invalid JSON
    }

    // If no payment, evaluate proposed bid and return 402 with negotiation
    if (!paymentHeader) {
      const currentBid = bidRecord?.currentBid || null;
      const proposedBid = proposedBidHeader
        ? parseFloat(proposedBidHeader)
        : null;

      // Calculate minimum required bid
      const minimumRequired = calculateCurrentBidPrice(currentBid);
      const minimumRequiredNum = parseBidAmount(minimumRequired);

      // Log agent's proposal and broadcast thinking event
      if (proposedBid) {
        console.log(`💭 [${agentId}] Proposed: $${proposedBid.toFixed(2)}`);
        if (strategyReasoning) {
          console.log(`   Reasoning: ${strategyReasoning}`);
        }

        // Broadcast thinking event
        broadcastEvent(adSpotId, {
          type: "thinking",
          agentId,
          thinking:
            (typeof requestBody.thinking === "string"
              ? requestBody.thinking
              : null) || strategyReasoning,
          strategy:
            typeof requestBody.strategy === "string"
              ? requestBody.strategy
              : undefined,
          proposedAmount: proposedBid,
          timestamp: new Date().toISOString(),
        });

        // Add a small delay to let the thinking bubble appear in the UI
        // before we process the payment and show the bid card
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Determine if proposal is acceptable
      const isProposalAcceptable =
        proposedBid && proposedBid >= minimumRequiredNum;

      // Build negotiation response
      const negotiationMessage = proposedBid
        ? isProposalAcceptable
          ? `Your proposal of $${proposedBid.toFixed(
              2
            )} is acceptable. Proceed with payment.`
          : `Your proposal of $${proposedBid.toFixed(
              2
            )} is too low. Current bid: $${
              currentBid?.toFixed(2) || "0.00"
            }. Minimum required: $${minimumRequiredNum.toFixed(2)}`
        : `No proposal detected. Current bid: $${
            currentBid?.toFixed(2) || "0.00"
          }. Minimum required: $${minimumRequiredNum.toFixed(2)}`;

      // If proposal exists and is too low, reject it immediately
      // This prevents x402-axios from paying more than the agent intended
      if (proposedBid && !isProposalAcceptable) {
        return NextResponse.json(
          {
            error: "Proposal rejected",
            negotiation: {
              yourProposal: proposedBid,
              currentBid: currentBid,
              minimumToWin: minimumRequiredNum,
              message: `Your proposal of $${proposedBid.toFixed(
                2
              )} is too low. Minimum required: $${minimumRequiredNum.toFixed(
                2
              )}. Please submit a new proposal.`,
              suggestion: minimumRequiredNum + 0.5,
            },
          },
          { status: 400 }
        ); // 400 Bad Request instead of 402
      }

      // If proposal is acceptable, use it as both min and max (exact amount)
      // If no proposal, allow range from minimum to min + $5
      const minAmount = proposedBid || minimumRequiredNum;
      const maxAmount = proposedBid || Math.min(50, minimumRequiredNum + 5);

      const paymentRequirements = {
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network:
              (process.env.SOLANA_NETWORK || "devnet") === "mainnet-beta"
                ? "solana"
                : "solana-devnet",
            minAmountRequired: (minAmount * 1_000_000).toString(),
            maxAmountRequired: (maxAmount * 1_000_000).toString(),
            asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC SPL Token
            payTo: process.env.ADDRESS,
            resource: `${request.nextUrl.origin}/api/bid/${adSpotId}`,
            description: `Bid on ${adSpotId}`,
            mimeType: "application/json",
            maxTimeoutSeconds: 60,
            extra: {
              name: "USDC",
              version: "2",
            },
          },
        ],
        negotiation: {
          yourProposal: proposedBid,
          currentBid: currentBid,
          minimumToWin: minimumRequiredNum,
          message: negotiationMessage,
          suggestion: minimumRequiredNum + 1.0,
          timeRemaining: bidRecord?.auctionEndTime
            ? Math.max(
                0,
                Math.floor(
                  (bidRecord.auctionEndTime.getTime() - Date.now()) / 1000
                )
              )
            : null,
          bidHistory: bidRecord?.bidHistory.slice(-5) || [],
        },
        error: "Payment required to place bid",
      };

      return NextResponse.json(paymentRequirements, { status: 402 });
    }

    // Payment received - parse, verify, and settle
    const payment: PaymentPayload = JSON.parse(
      Buffer.from(paymentHeader, "base64").toString("utf-8")
    );

    const currentBid = bidRecord?.currentBid || null;
    const requiredPrice = calculateCurrentBidPrice(currentBid);

    const network = process.env.SOLANA_NETWORK || "devnet";
    const usdcMint =
      network === "mainnet-beta"
        ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Same address for devnet/mainnet

    const paymentRequirements = {
      scheme: "exact" as const,
      network:
        network === "mainnet-beta" ? "solana" : ("solana-devnet" as const),
      maxAmountRequired: (parseBidAmount(requiredPrice) * 1_000_000).toString(),
      asset: usdcMint,
      payTo: process.env.ADDRESS as string,
      resource: `${request.nextUrl.origin}/api/bid/${adSpotId}`,
      description: `Bid ${requiredPrice} USDC on ${adSpotId}`,
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
    };

    // Step 1: Verify the payment
    console.log(`🔍 Verifying payment from ${agentId}...`);
    const walletClient = await getServerWalletClient();
    // x402 should support Solana Keypair as Signer
    const verifyResult = await verify(
      walletClient as any,
      payment,
      paymentRequirements
    );

    if (!verifyResult.isValid) {
      console.log(
        `❌ Payment verification failed: ${verifyResult.invalidReason}`
      );
      return NextResponse.json(
        { error: `Payment verification failed: ${verifyResult.invalidReason}` },
        { status: 402 }
      );
    }

    console.log(`✅ Payment verified from ${verifyResult.payer}`);

    // Step 2: Settle the payment on-chain (with lock to prevent concurrent settlements)
    console.log(`⛓️  Settling payment on-chain...`);

    // Wait for any pending settlement to complete first
    const lockKey = "settlement";
    if (settlementLocks.has(lockKey)) {
      console.log(`⏳ Waiting for previous settlement to complete...`);
      await settlementLocks.get(lockKey);
    }

    // Create new settlement promise and store it
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
      // Clean up lock after settlement completes
      settlementLocks.delete(lockKey);
    }

    if (!settleResult.success) {
      console.log(`❌ Payment settlement failed: ${settleResult.errorReason}`);
      return NextResponse.json(
        { error: `Payment settlement failed: ${settleResult.errorReason}` },
        { status: 402 }
      );
    }

    console.log(`✅ Payment settled! Tx: ${settleResult.transaction}`);

    const payerAddress = verifyResult.payer || "unknown";
    // Solana uses different payload structure than EVM
    // Extract amount from payment payload (Solana format)
    let bidAmount: number;
    if ("amount" in payment.payload) {
      // Solana payload format
      bidAmount = parseFloat(String(payment.payload.amount)) / 1_000_000;
    } else if (
      "authorization" in payment.payload &&
      "value" in (payment.payload as any).authorization
    ) {
      // EVM payload format (for compatibility)
      const exactPayload = payment.payload as ExactEvmPayload;
      bidAmount = parseFloat(exactPayload.authorization.value) / 1_000_000;
    } else {
      // Fallback: use maxAmountRequired from paymentRequirements
      bidAmount = parseFloat(paymentRequirements.maxAmountRequired) / 1_000_000;
    }
    const transactionHash = settleResult.transaction;

    console.log(`💰 Bid accepted from ${agentId}: ${bidAmount} USDC`);

    // Broadcast bid placed event
    broadcastEvent(adSpotId, {
      type: "bid_placed",
      agentId,
      amount: bidAmount,
      transactionHash,
      timestamp: new Date().toISOString(),
    });

    // Store previous winner for refund
    const previousWinner = bidRecord?.currentWinner;

    // Calculate auction end time (5 minutes from first bid)
    const auctionEndTime =
      bidRecord?.auctionEndTime || new Date(Date.now() + AUCTION_DURATION_MS);

    // Update bid record
    await updateAdSpotRecord(adSpotId, {
      adSpotId,
      currentBid: bidAmount,
      currentWinner: {
        agentId,
        walletAddress: payerAddress || "unknown",
        // externalId is not part of PaymentPayload standard but required by DB schema
        externalId: "externalId" in payment ? String(payment.externalId) : "",
        timestamp: new Date(),
      },
      status: "active",
      auctionStartTime: bidRecord?.auctionStartTime || new Date(),
      auctionEndTime,
    });

    // Add to bid history with transaction hash and strategy data
    await addBidToHistory(adSpotId, {
      agentId,
      walletAddress: payerAddress || "unknown",
      amount: bidAmount,
      timestamp: new Date(),
      txHash: transactionHash,
      thinking:
        typeof requestBody.thinking === "string"
          ? requestBody.thinking
          : undefined,
      strategy:
        typeof requestBody.strategy === "string"
          ? requestBody.strategy
          : undefined,
      reasoning: strategyReasoning || undefined,
    });

    // Refund previous bidder if exists
    if (previousWinner && bidRecord?.currentBid) {
      // Send refund asynchronously (don't block the response)
      // Add a small delay to avoid nonce conflicts with the settlement transaction
      setTimeout(async () => {
        try {
          console.log(
            `🔄 Refunding ${bidRecord.currentBid} USDC to ${previousWinner.agentId}...`
          );
          const network = (process.env.SOLANA_NETWORK || "devnet") as
            | "devnet"
            | "mainnet-beta";
          const refundTxHash = await sendRefund(
            previousWinner.walletAddress,
            bidRecord.currentBid,
            network
          );
          console.log(`✅ Refund completed successfully`);

          // Broadcast refund event
          broadcastEvent(adSpotId, {
            type: "refund",
            agentId: previousWinner.agentId,
            amount: bidRecord.currentBid,
            transactionHash: refundTxHash,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error("❌ Refund failed:", errorMessage);
          // Retry once after a delay if it fails
          setTimeout(async () => {
            try {
              console.log(`🔄 Retrying refund to ${previousWinner.agentId}...`);
              const network = (process.env.SOLANA_NETWORK || "devnet") as
                | "devnet"
                | "mainnet-beta";
              const refundTxHash = await sendRefund(
                previousWinner.walletAddress,
                bidRecord.currentBid,
                network
              );
              console.log(`✅ Refund retry successful`);

              // Broadcast refund event
              broadcastEvent(adSpotId, {
                type: "refund",
                agentId: previousWinner.agentId,
                amount: bidRecord.currentBid,
                transactionHash: refundTxHash,
                timestamp: new Date().toISOString(),
              });
            } catch (retryError) {
              const retryErrorMessage =
                retryError instanceof Error
                  ? retryError.message
                  : "Unknown error";
              console.error("❌ Refund retry failed:", retryErrorMessage);
            }
          }, 3000);
        }
      }, 2000); // Wait 2 seconds after settlement before refunding
    }

    // Calculate time remaining
    const timeRemaining = Math.max(
      0,
      Math.floor((auctionEndTime.getTime() - Date.now()) / 1000)
    );

    return NextResponse.json({
      success: true,
      message: `Bid placed for ad spot: ${bidAmount} USDC`,
      currentWinner: agentId,
      currentBid: bidAmount,
      auctionEndsIn: timeRemaining,
      auctionEndTime: auctionEndTime.toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error processing bid:", errorMessage);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
