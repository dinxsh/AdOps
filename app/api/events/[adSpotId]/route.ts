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
    const storedEvents = await getStoredEvents(adSpotId, since);

    // Extract just the event data (not the wrapper)
    const events = storedEvents.map(({ event }) => event);

    console.log(`   ✅ Returning ${events.length} event(s)`);
    if (events.length > 0) {
      console.log(`   📋 Event types: ${events.map((e: any) => e.type).join(', ')}`);
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
