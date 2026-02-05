import { NextRequest, NextResponse } from 'next/server';
import { getAdSpotRecord, updateAdSpotRecord } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { adSpotId, agentId, prompt } = await request.json();

  // Validate required fields
  if (!adSpotId || !agentId || !prompt) {
    return NextResponse.json(
      { error: 'adSpotId, agentId, and prompt are required' },
      { status: 400 }
    );
  }

  // Validate Freepik API key
  if (!process.env.FREEPIK_API_KEY) {
    console.error('FREEPIK_API_KEY not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // 1. Verify agent is the winner
    const record = await getAdSpotRecord(adSpotId);

    if (!record) {
      return NextResponse.json(
        { error: 'Ad spot not found' },
        { status: 404 }
      );
    }

    if (record.currentWinner?.agentId !== agentId) {
      return NextResponse.json(
        { error: 'Not the winner - only the winning agent can generate ad image' },
        { status: 403 }
      );
    }

    // Check if auction has ended
    if (!record.auctionEnded) {
      return NextResponse.json(
        { error: 'Auction still in progress - wait for auction to end before generating image' },
        { status: 400 }
      );
    }

    // 2. Forward to Freepik x402 endpoint
    // Agent's wallet (Base mainnet) handles payment via x402-axios

    // Construct webhook URL - use WEBHOOK_URL if set (production), otherwise localhost
    const webhookUrl = process.env.WEBHOOK_URL
      ? process.env.WEBHOOK_URL  // Use custom webhook URL as-is (e.g., ngrok URL)
      : `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/freepik`;  // Localhost for dev

    console.log(`[generate-ad-image] Using webhook URL: ${webhookUrl}`);

    const freepikResponse = await fetch('https://api.freepik.com/v1/x402/ai/mystic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-freepik-api-key': process.env.FREEPIK_API_KEY,
        // Forward X-PAYMENT header from agent request
        'X-PAYMENT': request.headers.get('X-PAYMENT') || ''
      },
      body: JSON.stringify({
        prompt,
        model: 'realism',
        resolution: '1k',
        aspect_ratio: 'widescreen_16_9',  // 16:9 for ad banner
        webhook_url: webhookUrl
      })
    });

    const responseText = await freepikResponse.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Freepik response:', responseText);
      return NextResponse.json(
        { error: 'Invalid response from Freepik API' },
        { status: 500 }
      );
    }

    // 3. If 402, return payment requirements to agent
    if (freepikResponse.status === 402) {
      console.log(`[generate-ad-image] Returning 402 payment requirements for ${agentId}`);
      return NextResponse.json(data, { status: 402 });
    }

    // Handle errors
    if (!freepikResponse.ok) {
      console.error('Freepik API error:', freepikResponse.status, data);
      return NextResponse.json(
        { error: data.error || 'Failed to generate image' },
        { status: freepikResponse.status }
      );
    }

    // 4. If 200, extract task_id and return to agent
    // Response structure: { data: { task_id, status, generated: [] } }
    const taskId = data.data?.task_id || data.task_id;

    if (!taskId) {
      console.error('No task_id in Freepik response:', data);
      return NextResponse.json(
        { error: 'Invalid response from Freepik - missing task_id' },
        { status: 500 }
      );
    }

    // MongoDB dot notation requires 'as any' because TypeScript doesn't support
    // string literal keys for nested object updates
    await updateAdSpotRecord(adSpotId, {
      'winnerAdImage.taskId': taskId,
      'winnerAdImage.prompt': prompt
    } as Record<string, unknown>);

    console.log(`✅ [generate-ad-image] Task created: ${taskId} for ${agentId}`);

    return NextResponse.json({
      taskId: taskId,
      status: 'pending'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating ad image:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to generate ad image: ' + errorMessage },
      { status: 500 }
    );
  }
}
