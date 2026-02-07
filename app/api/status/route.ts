import { NextRequest, NextResponse } from 'next/server';
import { getAdSpotRecord } from '@/lib/db';
import { AUCTION_DURATION_MS } from '@/lib/x402-config';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const adSpotId = searchParams.get('adSpotId');

  if (!adSpotId) {
    return NextResponse.json({ error: 'adSpotId is required' }, { status: 400 });
  }

  try {
    if (adSpotId === 'demo-spot-1') {
      return NextResponse.json({
        adSpotId,
        currentBid: 1.25,
        currentWinner: 'IceCo',
        timeRemaining: 300,
        auctionEnded: false,
        winnerAdImage: '/water-ad-demo.png',
        bidHistory: [
          {
            agentId: 'IceCo',
            amount: 0.50,
            timestamp: new Date(Date.now() - 40000).toISOString(),
            txHash: '0x' + 'a'.repeat(40),
            reflection: 'Bid successfully placed at $0.50. Monitoring for competitor response.'
          },
          {
            agentId: 'FizzUp',
            amount: 0.75,
            timestamp: new Date(Date.now() - 30000).toISOString(),
            txHash: '0x' + 'b'.repeat(40),
            reflection: 'Successfully outbid competitor. Current leading bid is $0.75.'
          },
          {
            agentId: 'IceCo',
            amount: 1.25,
            timestamp: new Date(Date.now() - 20000).toISOString(),
            txHash: '0x' + 'd'.repeat(40),
            reflection: 'FizzUp has outbid us at $0.75. Increasing our bid to $1.25.'
          }
        ],
      });
    }

    const bidRecord = await getAdSpotRecord(adSpotId);

    if (!bidRecord) {
      return NextResponse.json({
        adSpotId,
        currentBid: null,
        timeRemaining: null,
        bidHistory: [],
        auctionEnded: false,
        winnerAdImage: null,
      });
    }

    // Calculate time remaining
    const auctionEndTime = new Date(bidRecord.auctionStartTime.getTime() + AUCTION_DURATION_MS);
    const timeRemaining = Math.max(0, Math.floor((auctionEndTime.getTime() - Date.now()) / 1000));

    return NextResponse.json({
      adSpotId,
      currentBid: bidRecord.currentBid,
      currentWinner: bidRecord.currentWinner,
      timeRemaining,
      auctionEnded: bidRecord.auctionEnded || false,
      winnerAdImage: bidRecord.winnerAdImage || null,
      bidHistory: bidRecord.bidHistory.map((bid) => ({
        agentId: bid.agentId,
        amount: bid.amount,
        timestamp: bid.timestamp,
        txHash: bid.txHash,
        thinking: bid.thinking,
        strategy: bid.strategy,
        reasoning: bid.reasoning,
        reflection: bid.reflection,
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching auction status:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch auction status' },
      { status: 500 }
    );
  }
}
