'use client';

import { use, useEffect, useState, useMemo } from 'react';
import AdSpotDisplay from '@/app/components/AdSpotDisplay';
import TerminalPanel from '@/app/components/TerminalPanel';

interface Winner {
  agentId: string;
  address?: string;
}

interface StreamingMessage {
  id: string;
  type: 'thinking' | 'bid' | 'reflection' | 'refund' | 'withdrawal' | 'auction_ended' | 'ad_image_ready' | 'image_generation_update';
  agentId?: string;
  timestamp: string;
  thinking?: string;
  strategy?: string;
  proposedAmount?: number;
  amount?: number;
  transactionHash?: string;
  reflection?: string;
  refundAmount?: number;
  reasoning?: string;
  winner?: Winner;
  finalBid?: number;
  endReason?: string;
  isLoading?: boolean;
  imageUrl?: string;
  status?: string; // For image generation: 'started', 'progress', 'completed', 'failed'
  message?: string; // For image generation status messages
  taskId?: string;
}

export default function AuctionPageStreaming({ params }: { params: Promise<{ adSpotId: string }> }) {
  const { adSpotId } = use(params);
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [currentBid, setCurrentBid] = useState<number | null>(null);

  useEffect(() => {
    // Load initial state from status API
    const loadInitialState = async () => {
      try {
        const response = await fetch(`/api/status?adSpotId=${encodeURIComponent(adSpotId)}`);
        const data = await response.json();

        setCurrentBid(data.currentBid);

        // Load existing messages from history
        if (data.bidHistory) {
          const historicalMessages: StreamingMessage[] = [];
          data.bidHistory.forEach((bid: { agentId: string; timestamp: string; amount: number; txHash: string; reflection?: string }) => {
            historicalMessages.push({
              id: `${bid.agentId}-bid-${bid.timestamp}`,
              type: 'bid',
              agentId: bid.agentId,
              timestamp: bid.timestamp,
              amount: bid.amount,
              transactionHash: bid.txHash,
              reflection: bid.reflection,
              isLoading: !bid.reflection,
            });
          });
          setMessages(historicalMessages);
        }
      } catch (error) {
        console.error('Failed to load initial state:', error);
      }
    };

    loadInitialState();

    // Poll for new events using MongoDB polling
    let lastFetched: string | null = null;
    let isPolling = true;
    const seenEventIds = new Set<string>();

    const processEvent = (data: any) => {
      // Create unique ID for deduplication
      const eventId = `${data.type}-${data.agentId || 'system'}-${data.timestamp}-${data.transactionHash || Date.now()}`;

      if (seenEventIds.has(eventId)) {
        return; // Skip duplicate
      }
      seenEventIds.add(eventId);

      switch (data.type) {
        case 'agent_status':
          // No longer needed - we show everything in terminal
          break;

        case 'thinking':
          setMessages(prev => [...prev, {
            id: `${data.agentId}-thinking-${Date.now()}`,
            type: 'thinking',
            agentId: data.agentId,
            timestamp: data.timestamp,
            thinking: data.thinking,
            strategy: data.strategy,
            proposedAmount: data.proposedAmount,
          }]);
          break;

        case 'bid_placed':
          // Keep the thinking bubble and add bid card below it
          // Check if this bid already exists (prevent duplicates)
          setMessages(prev => {
            const bidExists = prev.some(msg =>
              msg.type === 'bid' &&
              msg.agentId === data.agentId &&
              msg.transactionHash === data.transactionHash
            );

            if (bidExists) {
              return prev; // Don't add duplicate
            }

            return [...prev, {
              id: `${data.agentId}-bid-${Date.now()}`,
              type: 'bid',
              agentId: data.agentId,
              timestamp: data.timestamp,
              amount: data.amount,
              transactionHash: data.transactionHash,
              isLoading: true, // Waiting for reflection
            }];
          });
          setCurrentBid(data.amount);
          break;

        case 'reflection':
          // Update the corresponding bid with reflection
          setMessages(prev => prev.map(msg => {
            if (msg.type === 'bid' && msg.agentId === data.agentId && msg.isLoading) {
              return {
                ...msg,
                reflection: data.reflection,
                isLoading: false,
              };
            }
            return msg;
          }));
          break;

        case 'refund':
          // Add refund notification
          setMessages(prev => [...prev, {
            id: `${data.agentId}-refund-${Date.now()}`,
            type: 'refund',
            agentId: data.agentId,
            timestamp: data.timestamp,
            refundAmount: data.amount,
            transactionHash: data.transactionHash,
          }]);
          break;

        case 'withdrawal':
          // Add withdrawal notification
          setMessages(prev => [...prev, {
            id: `${data.agentId}-withdrawal-${Date.now()}`,
            type: 'withdrawal',
            agentId: data.agentId,
            timestamp: data.timestamp,
            refundAmount: data.amount,
            reasoning: data.reasoning,
            transactionHash: data.transactionHash,
          }]);
          break;

        case 'auction_ended':
          // Add auction ended notification
          setMessages(prev => [...prev, {
            id: `auction-ended-${Date.now()}`,
            type: 'auction_ended',
            timestamp: data.timestamp,
            winner: data.winner,
            finalBid: data.finalBid,
            endReason: data.reason,
          }]);
          break;

        case 'ad_image_ready':
          // Add ad image ready notification
          setMessages(prev => [...prev, {
            id: `ad-image-ready-${Date.now()}`,
            type: 'ad_image_ready',
            timestamp: data.timestamp || new Date().toISOString(),
            agentId: data.winner?.agentId,
            imageUrl: data.imageUrl,
          }]);
          break;

        case 'image_generation_update':
          // Add image generation status update
          setMessages(prev => [...prev, {
            id: `image-gen-${Date.now()}`,
            type: 'image_generation_update',
            timestamp: data.timestamp || new Date().toISOString(),
            agentId: data.agentId,
            status: data.status,
            message: data.message,
            imageUrl: data.imageUrl,
            taskId: data.taskId,
          }]);
          break;
      }
    };

    const pollEvents = async () => {
      if (!isPolling) return;

      try {
        const url = lastFetched
          ? `/api/events/${encodeURIComponent(adSpotId)}?since=${encodeURIComponent(lastFetched)}`
          : `/api/events/${encodeURIComponent(adSpotId)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success && result.events) {
          // Process each event
          result.events.forEach((event: any) => {
            processEvent(event);
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

  const getBrandName = (agentId: string) => {
    if (agentId === 'IceCo' || agentId === 'AgentA') return 'IceCo';
    if (agentId === 'FizzUp' || agentId === 'AgentB') return 'FizzUp';
    return agentId;
  };

  // Convert streaming messages to terminal logs
  const messageToTerminalLog = (msg: StreamingMessage) => {
    const logs: Array<{
      timestamp: string;
      type: 'info' | 'success' | 'payment' | 'error' | 'tool' | 'thinking';
      icon: string;
      message: string;
      details?: string;
      link?: { href: string; label: string };
    }> = [];

    switch (msg.type) {
      case 'thinking':
        logs.push({
          timestamp: msg.timestamp,
          type: 'thinking',
          icon: '🧠',
          message: 'THINKING',
          details: msg.thinking,
        });
        if (msg.strategy) {
          logs.push({
            timestamp: msg.timestamp,
            type: 'info',
            icon: '📋',
            message: 'STRATEGY',
            details: msg.strategy,
          });
        }
        if (msg.proposedAmount) {
          logs.push({
            timestamp: msg.timestamp,
            type: 'info',
            icon: '💭',
            message: `PROPOSED BID: $${msg.proposedAmount.toFixed(2)} USDC`,
          });
        }
        break;

      case 'bid':
        logs.push({
          timestamp: msg.timestamp,
          type: 'payment',
          icon: '💳',
          message: 'INITIATING x402 PAYMENT',
          details: `Amount: $${msg.amount?.toFixed(2)} USDC`,
        });
        logs.push({
          timestamp: msg.timestamp,
          type: 'success',
          icon: '✓',
          message: `BID PLACED: $${msg.amount?.toFixed(2)} USDC`,
          link: msg.transactionHash ? {
            href: `https://sepolia.basescan.org/tx/${msg.transactionHash}`,
            label: 'View transaction on Basescan'
          } : undefined,
        });
        if (msg.reflection) {
          logs.push({
            timestamp: msg.timestamp,
            type: 'info',
            icon: '📊',
            message: 'POST-BID ANALYSIS',
            details: msg.reflection,
          });
        }
        break;

      case 'refund':
        logs.push({
          timestamp: msg.timestamp,
          type: 'payment',
          icon: '💸',
          message: `REFUND RECEIVED: $${msg.refundAmount?.toFixed(2)} USDC`,
          details: 'Outbid by competitor. Re-evaluating strategy...',
          link: msg.transactionHash ? {
            href: `https://sepolia.basescan.org/tx/${msg.transactionHash}`,
            label: 'View refund transaction'
          } : undefined,
        });
        break;

      case 'withdrawal':
        logs.push({
          timestamp: msg.timestamp,
          type: 'info',
          icon: '🏳️',
          message: 'WITHDRAWING FROM AUCTION',
          details: msg.reasoning,
          link: msg.transactionHash ? {
            href: `https://sepolia.basescan.org/tx/${msg.transactionHash}`,
            label: 'View refund transaction'
          } : undefined,
        });
        break;

      case 'image_generation_update':
        // Image generation progress updates
        const statusIcons = {
          started: '🎨',
          progress: '⏳',
          completed: '✅',
          failed: '❌'
        };
        const statusTypes = {
          started: 'info' as const,
          progress: 'tool' as const,
          completed: 'success' as const,
          failed: 'error' as const
        };
        logs.push({
          timestamp: msg.timestamp,
          type: statusTypes[msg.status as keyof typeof statusTypes] || 'info',
          icon: statusIcons[msg.status as keyof typeof statusIcons] || '🎨',
          message: msg.status === 'started' ? 'GENERATING AD IMAGE' :
                   msg.status === 'progress' ? 'IMAGE GENERATION IN PROGRESS' :
                   msg.status === 'completed' ? 'AD IMAGE GENERATED' :
                   'IMAGE GENERATION FAILED',
          details: msg.message,
        });
        break;

      case 'ad_image_ready':
        logs.push({
          timestamp: msg.timestamp,
          type: 'success',
          icon: '🎨',
          message: 'AD IMAGE READY',
          details: 'Creative assets ready. Ad is now live!',
        });
        break;

      case 'auction_ended':
        // Auction ended messages appear in both terminals
        logs.push({
          timestamp: msg.timestamp,
          type: msg.winner?.agentId === msg.agentId ? 'success' : 'info',
          icon: msg.winner?.agentId === msg.agentId ? '🏆' : '🏁',
          message: msg.winner?.agentId === msg.agentId ? 'AUCTION WON!' : 'AUCTION ENDED',
          details: `${msg.endReason}\nFinal Bid: $${msg.finalBid?.toFixed(2)}`,
        });
        break;
    }

    return logs;
  };

  // Split messages by agent
  const { iceCoLogs, fizzUpLogs } = useMemo(() => {
    const iceCoLogs: Array<{
      timestamp: string;
      type: 'info' | 'success' | 'payment' | 'error' | 'tool' | 'thinking';
      icon: string;
      message: string;
      details?: string;
      link?: { href: string; label: string };
    }> = [];
    const fizzUpLogs: Array<{
      timestamp: string;
      type: 'info' | 'success' | 'payment' | 'error' | 'tool' | 'thinking';
      icon: string;
      message: string;
      details?: string;
      link?: { href: string; label: string };
    }> = [];

    messages.forEach(msg => {
      const brandName = getBrandName(msg.agentId || '');
      if (brandName === 'IceCo' || msg.type === 'auction_ended') {
        iceCoLogs.push(...messageToTerminalLog(msg));
      }
      if (brandName === 'FizzUp' || msg.type === 'auction_ended') {
        fizzUpLogs.push(...messageToTerminalLog(msg));
      }
    });

    return { iceCoLogs, fizzUpLogs };
  }, [messages]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      {/* AD BANNER AT TOP */}
      <div className="w-full bg-[#2a2a2a] border-b border-[#333333]">
        <div className="max-w-6xl mx-auto p-4">
          <AdSpotDisplay adSpotId={adSpotId} />
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#2a2a2a] border-b border-[#333333] px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[#ffffff] text-xl font-semibold">
                {adSpotId}
              </h1>
              <p className="text-[#888888] text-sm">Ad Spot Auction</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[#888888] text-xs uppercase tracking-wide">Current Bid</div>
                <div className="text-[#ffffff] text-2xl font-bold">
                  ${currentBid?.toFixed(2) || '0.00'}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Dual Terminal View */}
      <div className="flex-1 overflow-hidden px-6 py-6">
        <div className="max-w-7xl mx-auto h-full">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* IceCo Terminal */}
            <TerminalPanel
              brandName="IceCo"
              logs={iceCoLogs}
              color="blue"
              logoPath="/iceco.png"
            />

            {/* FizzUp Terminal */}
            <TerminalPanel
              brandName="FizzUp"
              logs={fizzUpLogs}
              color="green"
              logoPath="/fizzup.png"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


