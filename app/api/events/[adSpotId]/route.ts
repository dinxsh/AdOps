import { NextRequest } from 'next/server';
import { getStoredEvents } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Polling endpoint for retrieving events from MongoDB
 * Returns all events for an ad spot, optionally filtered by timestamp
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ adSpotId: string }> }
) {
  const { adSpotId } = await params;
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get('since');

  console.log(`\n📊 [POLLING] Request for "${adSpotId}"${sinceParam ? ` since ${sinceParam}` : ' (all events)'}`);

  try {
    // Get events from MongoDB, optionally filtered by timestamp
    const since = sinceParam ? new Date(sinceParam) : undefined;

    // Handle demo spot mock data
    if (adSpotId === 'demo-spot-1') {
      const demoEvents = getDemoEvents(since);
      return Response.json({
        success: true,
        adSpotId,
        events: demoEvents,
        count: demoEvents.length,
        timestamp: new Date().toISOString(),
      });
    }

    const storedEvents = await getStoredEvents(adSpotId, since);

    // Extract just the event data (not the wrapper)
    const events = storedEvents.map(({ event }) => event);

    console.log(`   ✅ Returning ${events.length} event(s)`);
    if (events.length > 0) {
      console.log(`   📋 Event types: ${(events as Array<{ type: string }>).map((e) => e.type).join(', ')}`);
    }

    return Response.json({
      success: true,
      adSpotId,
      events,
      count: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Error fetching events:`, errorMessage);

    return Response.json(
      {
        success: false,
        error: errorMessage,
        adSpotId,
        events: [],
        count: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Mock events for the demo-spot-1 auction
 */
function getDemoEvents(since?: Date) {
  const now = new Date();
  // Start the "demo" 1 minute before now so there's always some history
  const startTime = new Date(now.getTime() - 60000);

  const allDemoEvents = [
    {
      type: 'agent_started',
      agentId: 'IceCo',
      brandName: 'IceCo',
      productName: 'CrystalPure Premium Water',
      timestamp: new Date(startTime.getTime() + 1000).toISOString(),
    },
    {
      type: 'agent_started',
      agentId: 'FizzUp',
      brandName: 'FizzUp',
      productName: 'FizzUp Energy',
      timestamp: new Date(startTime.getTime() + 2000).toISOString(),
    },
    {
      type: 'scraping_started',
      agentId: 'IceCo',
      url: 'http://localhost:3000/devnews',
      paymentMethod: 'x402',
      expectedCost: '$0.01 USDC',
      timestamp: new Date(startTime.getTime() + 5000).toISOString(),
    },
    {
      type: 'scraping_completed',
      agentId: 'IceCo',
      url: 'http://localhost:3000/devnews',
      contentLength: 12500,
      topics: ['AI', 'Next.js', 'React', 'TypeScript'],
      siteTitle: 'DevNews - Latest in Tech',
      timestamp: new Date(startTime.getTime() + 8000).toISOString(),
    },
    {
      type: 'analytics_payment',
      agentId: 'IceCo',
      amount: '0.01 USDC',
      paymentMethod: 'x402',
      timestamp: new Date(startTime.getTime() + 10000).toISOString(),
    },
    {
      type: 'analytics_received',
      agentId: 'IceCo',
      site: {
        monthlyVisits: 250000,
        dailyAverage: 8200,
        avgSessionDuration: '4:25',
        bounceRate: '32%',
      },
      audience: 'Software Engineers, Tech Leads, CTOs',
      adSpots: [
        { id: 'demo-spot-1', name: 'Main Banner', impressions: 150000, clickThroughRate: '2.5%', averageBid: '$0.50' }
      ],
      timestamp: new Date(startTime.getTime() + 12000).toISOString(),
    },
    {
      type: 'analysis_started',
      agentId: 'IceCo',
      analysisContext: {
        siteTopics: ['AI', 'Tech'],
        monthlyVisits: 250000,
        audience: 'Software Engineers',
        walletBalance: 150.00
      },
      timestamp: new Date(startTime.getTime() + 14000).toISOString(),
    },
    {
      type: 'analysis_completed',
      agentId: 'IceCo',
      shouldBid: true,
      relevanceScore: 9,
      reasoning: 'The target audience of DevNews aligns perfectly with IceCo\'s premium hydration message for tech professionals.',
      targetSpots: ['demo-spot-1'],
      budgetPerSpot: { 'demo-spot-1': 25.00 },
      strategy: 'Aggressive bidding to secure the main banner.',
      timestamp: new Date(startTime.getTime() + 18000).toISOString(),
    },
    {
      type: 'thinking',
      agentId: 'IceCo',
      thinking: 'Analyzing current auction state... Minimum bid is $0.10. I will start with $0.50.',
      strategy: 'Lead-in bid strategy',
      proposedAmount: 0.50,
      timestamp: new Date(startTime.getTime() + 20000).toISOString(),
    },
    {
      type: 'bid_placed',
      agentId: 'IceCo',
      amount: 0.50,
      transactionHash: '0x' + 'a'.repeat(40),
      timestamp: new Date(startTime.getTime() + 22000).toISOString(),
    },
    {
      type: 'reflection',
      agentId: 'IceCo',
      reflection: 'Bid successfully placed at $0.50. Monitoring for competitor response.',
      timestamp: new Date(startTime.getTime() + 24000).toISOString(),
    },
    {
      type: 'thinking',
      agentId: 'FizzUp',
      thinking: 'Competitive bid observed from IceCo ($0.50). Increasing bid to $0.75.',
      strategy: 'Aggressive capture',
      proposedAmount: 0.75,
      timestamp: new Date(startTime.getTime() + 27000).toISOString(),
    },
    {
      type: 'bid_placed',
      agentId: 'FizzUp',
      amount: 0.75,
      transactionHash: '0x' + 'b'.repeat(40),
      timestamp: new Date(startTime.getTime() + 30000).toISOString(),
    },
    {
      type: 'refund',
      agentId: 'IceCo',
      amount: 0.50,
      transactionHash: '0x' + 'c'.repeat(40),
      timestamp: new Date(startTime.getTime() + 31000).toISOString(),
    },
    {
      type: 'reflection',
      agentId: 'FizzUp',
      reflection: 'Successfully outbid competitor. Current leading bid is $0.75.',
      timestamp: new Date(startTime.getTime() + 33000).toISOString(),
    },
    {
      type: 'thinking',
      agentId: 'IceCo',
      thinking: 'FizzUp has outbid us at $0.75. Increasing our bid to $1.25.',
      strategy: 'Counter-bid aggressive',
      proposedAmount: 1.25,
      timestamp: new Date(startTime.getTime() + 36000).toISOString(),
    },
    {
      type: 'bid_placed',
      agentId: 'IceCo',
      amount: 1.25,
      transactionHash: '0x' + 'd'.repeat(40),
      timestamp: new Date(startTime.getTime() + 39000).toISOString(),
    },
    {
      type: 'refund',
      agentId: 'FizzUp',
      amount: 0.75,
      transactionHash: '0x' + 'e'.repeat(40),
      timestamp: new Date(startTime.getTime() + 40000).toISOString(),
    },
    {
      type: 'withdrawal',
      agentId: 'FizzUp',
      amount: 0.75,
      reasoning: 'Counter-bid exceeds maximum acquisition cost for this session.',
      transactionHash: '0x' + 'f'.repeat(40),
      timestamp: new Date(startTime.getTime() + 43000).toISOString(),
    },
    {
      type: 'auction_ended',
      winner: { agentId: 'IceCo' },
      finalBid: 1.25,
      reason: 'No further active bidders. IceCo takes the spot.',
      timestamp: new Date(startTime.getTime() + 45000).toISOString(),
    },
    {
      type: 'image_generation_update',
      agentId: 'IceCo',
      status: 'completed',
      message: 'Ad image generated successfully.',
      imageUrl: '/water-ad-demo.png',
      timestamp: new Date(startTime.getTime() + 50000).toISOString(),
    },
    {
      type: 'ad_image_ready',
      winner: { agentId: 'IceCo' },
      imageUrl: '/water-ad-demo.png',
      timestamp: new Date(startTime.getTime() + 52000).toISOString(),
    }
  ];

  // Filter events by timestamp if since is provided
  return allDemoEvents.filter(event => {
    const eventTime = new Date(event.timestamp);
    if (since && eventTime <= since) return false;
    return eventTime <= now;
  });
}
