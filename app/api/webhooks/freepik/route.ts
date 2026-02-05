import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { broadcastEvent } from '@/lib/events';
import { validateWebhookSignature } from '@/lib/webhook-security';
import { storeTaskResult } from '@/lib/task-store';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // 1. Validate webhook signature (security) - optional in development
    const webhookId = request.headers.get('webhook-id');
    const webhookTimestamp = request.headers.get('webhook-timestamp');
    const webhookSignature = request.headers.get('webhook-signature');

    // Skip validation if headers missing (development/testing)
    if (webhookId && webhookTimestamp && webhookSignature && process.env.WEBHOOK_SECRET) {
      const isValid = validateWebhookSignature(
        webhookId,
        webhookTimestamp,
        webhookSignature,
        rawBody,
        process.env.WEBHOOK_SECRET
      );

      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
      console.log('✅ [webhook] Signature verified');
    } else {
      console.warn('⚠️  [webhook] Skipping signature validation (development mode)');
    }

    // 2. Extract task_id and image URL
    const webhookData = JSON.parse(rawBody);

    // Webhook structure can be: { task_id, status, generated: [...] } or { data: { task_id, status, generated: [...] } }
    const taskData = webhookData.data || webhookData;
    const { task_id, status, generated } = taskData;

    console.log(`📥 [webhook] Received: task_id=${task_id}, status=${status}`);
    console.log(`📥 [webhook] Full payload:`, JSON.stringify(webhookData, null, 2));

    // Store in task store for testing/polling
    // Note: generated array contains URL strings directly, not objects
    if (status === 'completed' && generated && generated.length > 0) {
      const imageUrl = generated[0];  // URL string directly
      storeTaskResult(task_id, {
        task_id,
        status: 'completed',
        imageUrl,
        generated
      });
      console.log(`🎨 [webhook] Image URL: ${imageUrl}`);
    } else if (status === 'failed' || status === 'error') {
      storeTaskResult(task_id, {
        task_id,
        status: 'failed',
        error: webhookData.error || 'Image generation failed'
      });
      console.error('❌ [webhook] Image generation failed:', webhookData);
    } else {
      console.log(`📊 [webhook] Status: ${status} (not completed yet)`);
    }

    // 3. Try to find ad spot by task_id and update with image URL
    // This is optional - task might be from standalone test
    if (status === 'completed' && generated && generated.length > 0) {
      const imageUrl = generated[0];  // URL string directly

      try {
        const { db } = await connectToDatabase();
        const result = await db.collection('adSpotRecords').findOneAndUpdate(
          { 'winnerAdImage.taskId': task_id },
          {
            $set: {
              'winnerAdImage.url': imageUrl,
              'winnerAdImage.generatedAt': new Date(),
              'status': 'displaying_ad'
            }
          },
          { returnDocument: 'after' }
        );

        if (result) {
          console.log(`✅ [webhook] Updated ad spot: ${result.adSpotId}`);

          // 4. Broadcast event to frontend via SSE
          broadcastEvent(result.adSpotId, {
            type: 'ad_image_ready',
            imageUrl,
            winner: result.currentWinner,
            prompt: result.winnerAdImage?.prompt
          });

          console.log(`📡 [webhook] Broadcasted ad_image_ready event for ${result.adSpotId}`);
        } else {
          console.log(`ℹ️  [webhook] No ad spot found for task_id (likely standalone test)`);
        }
      } catch (dbError) {
        console.warn('⚠️  [webhook] Database update failed (likely standalone test):', dbError);
      }
    }

    return NextResponse.json({ success: true, received: task_id });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing Freepik webhook:', errorMessage);
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
}

// GET endpoint to check task status (for polling)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const task_id = searchParams.get('task_id');

  if (!task_id) {
    return NextResponse.json(
      { error: 'task_id parameter required' },
      { status: 400 }
    );
  }

  const { getTaskResult } = await import('@/lib/task-store');
  const result = getTaskResult(task_id);

  if (!result) {
    return NextResponse.json(
      { error: 'Task not found', task_id },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
