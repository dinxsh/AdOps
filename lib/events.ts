// Event storage for real-time auction updates
// Events are stored in MongoDB and polled by frontend

import { storeEvent } from './db';

// Event type definitions
export type AuctionEventType =
  | 'agent_started'
  | 'scraping_started'
  | 'scraping_completed'
  | 'analytics_payment'
  | 'analytics_received'
  | 'analysis_started'
  | 'analysis_completed'
  | 'agent_status'
  | 'thinking'
  | 'bid_placed'
  | 'reflection'
  | 'refund'
  | 'withdrawal'
  | 'agent_skipped'
  | 'agent_error'
  | 'auction_ended'
  | 'ad_image_ready'
  | 'image_generating';

/**
 * Store an event in MongoDB
 * Frontend polls MongoDB directly - no SSE broadcasting needed
 */
export async function broadcastEvent(adSpotId: string, event: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const agentId = event.agentId || 'system';

  try {
    console.log(`\n💾 [${timestamp}] [${agentId}] Storing event for "${adSpotId}": ${event.type}`);
    await storeEvent(adSpotId, event);
    console.log(`   ✅ Event stored in MongoDB - will be polled by frontend\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`\n❌ [${timestamp}] [${agentId}] Failed to store "${event.type}" for "${adSpotId}":`, errorMessage, '\n');
  }
}

