'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface AdSpotDisplayProps {
  adSpotId: string;
}

export default function AdSpotDisplay({ adSpotId }: AdSpotDisplayProps) {
  const [adData, setAdData] = useState<{
    imageUrl?: string;
    winner?: string;
    prompt?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch current ad spot state
    const fetchAdState = async () => {
      const response = await fetch(`/api/status?adSpotId=${adSpotId}`);
      const data = await response.json();

      setAdData({
        imageUrl: data.winnerAdImage?.url,
        winner: data.currentWinner?.agentId,
        prompt: data.winnerAdImage?.prompt
      });
      setLoading(false);
    };

    fetchAdState();

    // Poll for new events (using MongoDB polling instead of SSE)
    let lastFetched: string | null = null;
    let isPolling = true;

    const pollEvents = async () => {
      if (!isPolling) return;

      try {
        const url = lastFetched
          ? `/api/events/${encodeURIComponent(adSpotId)}?since=${encodeURIComponent(lastFetched)}`
          : `/api/events/${encodeURIComponent(adSpotId)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success && result.events) {
          // Look for ad_image_ready events
          result.events.forEach((event: any) => {
            if (event.type === 'ad_image_ready') {
              setAdData({
                imageUrl: event.imageUrl,
                winner: event.winner?.agentId || event.agentId,
                prompt: event.prompt
              });
            }
          });

          // Update timestamp for next poll
          lastFetched = result.timestamp;
        }
      } catch (error) {
        console.error('Error polling events:', error);
      }
    };

    // Start polling every 2 seconds
    const pollInterval = setInterval(pollEvents, 2000);

    return () => {
      isPolling = false;
      clearInterval(pollInterval);
    };
  }, [adSpotId]);

  if (loading) {
    return (
      <div className="w-full h-64 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
        <p className="text-[#888888]">Loading ad spot...</p>
      </div>
    );
  }

  if (!adData?.imageUrl) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="relative rounded-lg overflow-hidden border-2 border-[#444444]">
          <div className="absolute top-2 right-2 bg-[#1a1a1a] text-[#888888] px-2 py-1 rounded text-xs font-medium border border-[#444444] z-10">
            AD SPACE
          </div>
          <div className="relative w-full" style={{ maxHeight: '256px' }}>
            <Image
              src="/x402-button-xl.png"
              alt="x402 - Ad spot available"
              width={1200}
              height={600}
              className="w-full h-auto object-contain"
              style={{ maxHeight: '256px' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative w-full rounded-lg overflow-hidden border-2 border-[#444444]">
        <div className="absolute top-2 right-2 bg-[#1a1a1a] text-[#888888] px-2 py-1 rounded text-xs font-medium border border-[#444444] z-10">
          AD SPACE
        </div>
        <div className="relative w-full" style={{ maxHeight: '320px' }}>
          <Image
            src={adData.imageUrl}
            alt={`Ad by ${adData.winner}`}
            width={1200}
            height={800}
            className="w-full h-auto object-contain"
            style={{ maxHeight: '320px' }}
            unoptimized
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 z-10">
          <p className="text-xs">
            <span className="font-semibold">Advertiser:</span> {adData.winner}
          </p>
          {adData.prompt && (
            <p className="text-xs mt-1 opacity-75">
              <span className="font-semibold">Prompt:</span> {adData.prompt}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
