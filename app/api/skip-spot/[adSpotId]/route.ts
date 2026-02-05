import { NextRequest, NextResponse } from 'next/server';
import { broadcastEvent } from '@/lib/events';
import { getAdSpotRecord, updateAdSpotRecord } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Handle agent notification when they decide to skip bidding on a spot
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adSpotId: string }> }
) {
  const { adSpotId } = await params;

  try {
    const body = await request.json();
    const { agentId, reasoning, timestamp } = body;

    console.log(`🚫 [SKIP] Agent "${agentId}" skipping spot "${adSpotId}"`);
    console.log(`   Reason: ${reasoning}`);

    // Get current auction state
    const record = await getAdSpotRecord(adSpotId);

    // Broadcast skip event to frontend
    await broadcastEvent(adSpotId, {
      type: 'agent_skipped',
      agentId,
      adSpotId,
      reasoning,
      timestamp: timestamp || new Date().toISOString(),
    });

    // Add agent to skipped list
    const skippedAgents = record?.skippedAgents || [];
    if (!skippedAgents.includes(agentId)) {
      skippedAgents.push(agentId);

      await updateAdSpotRecord(adSpotId, {
        skippedAgents,
      });

      console.log(`✅ [SKIP] Updated skipped agents for "${adSpotId}":`, skippedAgents);
    }

    // Check if we should end the auction
    // If only 1 active bidder remains (or 0), declare winner
    const totalBidders = 2; // CoinbaseCDP and Crossmint
    const activeBidders = totalBidders - skippedAgents.length;

    console.log(`📊 [SKIP] Active bidders remaining for "${adSpotId}": ${activeBidders}`);

    if (activeBidders <= 1) {
      // Find the winning agent
      const allAgents = ['CoinbaseCDP', 'Crossmint'];
      const winner = allAgents.find(agent => !skippedAgents.includes(agent));

      if (winner) {
        console.log(`🏆 [SKIP] Only 1 active bidder - declaring "${winner}" winner of "${adSpotId}"`);

        await updateAdSpotRecord(adSpotId, {
          auctionEnded: true,
          auctionEndReason: `Only one active bidder remaining (${winner})`,
          winner,
        });

        // Broadcast auction ended
        await broadcastEvent(adSpotId, {
          type: 'auction_ended',
          winner,
          reason: `Only one active bidder remaining`,
          finalAmount: record?.currentBid || 0,
          timestamp: new Date().toISOString(),
        });

        console.log(`🎉 [SKIP] Auction ended for "${adSpotId}" - Winner: ${winner}`);
      } else {
        console.log(`⚠️ [SKIP] No active bidders for "${adSpotId}" - auction cannot proceed`);

        await updateAdSpotRecord(adSpotId, {
          auctionEnded: true,
          auctionEndReason: 'No active bidders',
        });

        await broadcastEvent(adSpotId, {
          type: 'auction_ended',
          reason: 'No active bidders',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Skip notification received',
      activeBidders
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [SKIP] Error processing skip for "${adSpotId}":`, error);
    return NextResponse.json(
      { error: 'Failed to process skip notification', details: errorMessage },
      { status: 500 }
    );
  }
}
