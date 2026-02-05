import { NextRequest, NextResponse } from 'next/server';
import { broadcastEvent } from '@/lib/events';
import { updateAdSpotRecord, getAdSpotRecord } from '@/lib/db';
import type { WinnerAdImage } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adSpotId: string }> }
) {
  const { adSpotId } = await params;
  const body = await request.json();

  const { agentId, status, message, imageUrl, taskId } = body;

  console.log(`[image-status] ${adSpotId} - ${agentId}: ${status}`);

  // If image generation completed, save to database
  if (status === 'completed' && imageUrl) {
    try {
      // Get current record to verify winner
      const record = await getAdSpotRecord(adSpotId);

      if (record && record.currentWinner?.agentId === agentId) {
        console.log(`[image-status] Saving image URL to database for ${adSpotId}`);

        const updatedImage: WinnerAdImage = {
          ...record.winnerAdImage!,
          url: imageUrl,
          generatedAt: new Date(),
        };

        await updateAdSpotRecord(adSpotId, {
          winnerAdImage: updatedImage,
          status: 'displaying_ad'
        });

        console.log(`✅ [image-status] Image URL saved to database`);

        // Broadcast ad_image_ready event (this is what triggers the UI update)
        broadcastEvent(adSpotId, {
          type: 'ad_image_ready',
          imageUrl,
          winner: record.currentWinner,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn(`[image-status] Agent ${agentId} is not the winner for ${adSpotId}`);
      }
    } catch (error) {
      console.error(`[image-status] Failed to save image to database:`, error);
    }
  }

  // Broadcast progress/status update to SSE clients
  broadcastEvent(adSpotId, {
    type: 'image_generation_update',
    agentId,
    status, // 'started', 'progress', 'completed', 'failed'
    message,
    imageUrl,
    taskId,
    timestamp: new Date().toISOString()
  });

  return NextResponse.json({ success: true });
}
