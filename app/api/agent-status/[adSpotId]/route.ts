import { NextRequest, NextResponse } from 'next/server';
import { broadcastEvent } from '@/lib/events';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adSpotId: string }> }
) {
  const { adSpotId } = await params;
  const body = await request.json();
  const { agentId, status } = body;

  if (!agentId || !status) {
    return NextResponse.json(
      { error: 'agentId and status are required' },
      { status: 400 }
    );
  }

  console.log(`🤖 [${agentId}] Status update: ${status}`);

  // Broadcast agent status event
  broadcastEvent(adSpotId, {
    type: 'agent_status',
    agentId,
    status, // 'thinking', 'idle', etc.
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}

