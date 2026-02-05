import { NextRequest, NextResponse } from 'next/server';
import { getAdSpotRecord, updateAdSpotRecord } from '@/lib/db';
import { sendRefund } from '@/lib/wallet';
import { broadcastEvent } from '@/lib/events';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adSpotId: string }> }
) {
  const { adSpotId } = await params;
  const body = await request.json();
  const { agentId, walletAddress, reasoning } = body;

  if (!agentId || !walletAddress) {
    return NextResponse.json(
      { error: 'agentId and walletAddress are required' },
      { status: 400 }
    );
  }

  try {
    const bidRecord = await getAdSpotRecord(adSpotId);

    if (!bidRecord) {
      return NextResponse.json(
        { error: 'No auction found for this adSpotId' },
        { status: 404 }
      );
    }

    // Find the agent's last bid in history
    const agentBids = bidRecord.bidHistory.filter(bid => bid.agentId === agentId);

    if (agentBids.length === 0) {
      return NextResponse.json(
        { error: 'No bids found for this agent' },
        { status: 404 }
      );
    }

    const lastBid = agentBids[agentBids.length - 1];

    // Check if this agent is currently the highest bidder
    if (bidRecord.currentWinner?.agentId === agentId) {
      return NextResponse.json(
        { error: 'Cannot withdraw - you are currently winning. Wait to be outbid first.' },
        { status: 400 }
      );
    }

    // Verify the wallet address matches
    if (bidRecord.currentWinner?.walletAddress !== walletAddress &&
      !bidRecord.bidHistory.some(bid => bid.agentId === agentId)) {
      return NextResponse.json(
        { error: 'Wallet address does not match bid records' },
        { status: 403 }
      );
    }

    console.log(`🏳️ [${agentId}] Requesting withdrawal from auction for ${adSpotId}`);
    console.log(`   Reasoning: ${reasoning || 'No reasoning provided'}`);

    // Mark agent as withdrawn
    const withdrawnAgents = bidRecord.withdrawnAgents || [];
    if (!withdrawnAgents.includes(agentId)) {
      withdrawnAgents.push(agentId);
    }

    // Issue refund for their last bid amount
    const refundAmount = lastBid.amount;
    console.log(`💸 Issuing withdrawal refund of ${refundAmount} USDC to ${agentId}...`);

    const refundTxHash = await sendRefund(walletAddress, refundAmount);
    console.log(`✅ Withdrawal refund completed: ${refundTxHash}`);

    // Update bid record with withdrawal
    await updateAdSpotRecord(adSpotId, {
      withdrawnAgents,
    });

    // Broadcast withdrawal event
    broadcastEvent(adSpotId, {
      type: 'withdrawal',
      agentId,
      amount: refundAmount,
      reasoning: reasoning || 'Agent decided to stop bidding',
      transactionHash: refundTxHash,
      timestamp: new Date().toISOString(),
    });

    // Check if auction should end (only one active bidder remaining)
    const totalBidders = new Set(bidRecord.bidHistory.map(bid => bid.agentId)).size;
    const activeAgents = totalBidders - withdrawnAgents.length;

    if (activeAgents <= 1) {
      console.log(`🏁 Auction ending - only ${activeAgents} active bidder(s) remaining`);

      // Broadcast auction end event
      broadcastEvent(adSpotId, {
        type: 'auction_ended',
        winner: bidRecord.currentWinner,
        finalBid: bidRecord.currentBid,
        reason: 'All other bidders withdrew',
        timestamp: new Date().toISOString(),
      });

      // Mark auction as ended
      await updateAdSpotRecord(adSpotId, {
        auctionEnded: true,
        auctionEndReason: 'withdrawal',
      });
    }

    return NextResponse.json({
      success: true,
      refunded: refundAmount,
      transactionHash: refundTxHash,
      auctionEnded: activeAgents <= 1,
      message: activeAgents <= 1
        ? 'Refund issued. Auction has ended - opponent won!'
        : 'Refund issued. You have withdrawn from the auction.',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Refund request failed:`, errorMessage);
    return NextResponse.json(
      { error: `Failed to process refund: ${errorMessage}` },
      { status: 500 }
    );
  }
}

