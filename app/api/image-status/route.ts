import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'Missing taskId' },
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
    // Query Freepik's status endpoint
    const response = await fetch(`https://api.freepik.com/v1/ai/mystic/${taskId}`, {
      headers: {
        'x-freepik-api-key': process.env.FREEPIK_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Freepik API error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch image status from Freepik' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // If completed, update database
    if (data.status === 'completed' && data.generated?.[0]?.url) {
      const { db } = await connectToDatabase();
      const result = await db.collection('adSpotRecords').updateOne(
        { 'winnerAdImage.taskId': taskId },
        {
          $set: {
            'winnerAdImage.url': data.generated[0].url,
            'winnerAdImage.generatedAt': new Date(),
            'status': 'displaying_ad'
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`✅ [image-status] Updated ad spot with image for task: ${taskId}`);
      }
    }

    return NextResponse.json(data);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching image status:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch image status: ' + errorMessage },
      { status: 500 }
    );
  }
}
