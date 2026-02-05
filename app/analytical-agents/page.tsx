'use client';

import { useEffect, useState, useMemo } from 'react';
import TerminalPanel from '@/app/components/TerminalPanel';

interface StreamingMessage {
  id: string;
  type: 'agent_started' | 'scraping_started' | 'scraping_completed' | 'analytics_payment' | 'analytics_received' |
        'analysis_started' | 'analysis_completed' | 'agent_status' | 'thinking' | 'bid' | 'reflection' |
        'refund' | 'withdrawal' | 'agent_skipped' | 'agent_error' | 'auction_ended' | 'ad_image_ready' | 'image_generation_update';
  agentId?: string;
  timestamp: string;
  // Agent started fields
  availableSpots?: string[];
  brandName?: string;
  productName?: string;
  // Scraping fields
  url?: string;
  contentLength?: number;
  contentPreview?: string;
  siteTitle?: string;
  topics?: string[];
  paymentMethod?: string;
  expectedCost?: string;
  // Analytics fields
  amount?: string | number;
  site?: {
    monthlyVisits: number;
    dailyAverage: number;
    avgSessionDuration: string;
    bounceRate: string;
  };
  monthlyVisits?: number;
  audience?: string;
  adSpots?: Array<{
    id: string;
    name: string;
    impressions: number;
    clickThroughRate: string;
    estimatedClicks: number;
    averageBid: string;
  }>;
  analysisContext?: {
    siteTopics: string[];
    monthlyVisits: number;
    audience: string;
    availableSpots: string[];
    walletBalance: number;
  };
  // Analysis fields
  shouldBid?: boolean;
  relevanceScore?: number;
  reasoning?: string;
  targetSpots?: string[];
  budgetPerSpot?: { [key: string]: number };
  strategy?: string;
  // Agent status fields
  status?: string;
  // Bidding fields
  thinking?: string;
  proposedAmount?: number;
  transactionHash?: string;
  reflection?: string;
  refundAmount?: number;
  // Image generation fields
  status?: string;
  message?: string;
  imageUrl?: string;
  taskId?: string;
  // Skip fields
  adSpotId?: string;
  // Error fields
  phase?: string;
  error?: string;
  // Auction end fields
  winner?: { agentId: string; address?: string };
  finalBid?: number;
  endReason?: string;
  isLoading?: boolean;
}

export default function AnalyticalAgentsPage() {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [seenEventIds] = useState(new Set<string>()); // Deduplication
  const [connectionStatus, setConnectionStatus] = useState<{[key: string]: 'connecting' | 'connected' | 'disconnected'}>({});
  const [eventGaps, setEventGaps] = useState<{agentId: string, missing: number[]}[]>([]);
  const [replayStatus, setReplayStatus] = useState<{[key: string]: {loading: boolean, count: number}}>({});
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  // Helper function to process incoming events
  const processEvent = (data: any, adSpotId: string, timestamp: string) => {
    // Log ALL incoming events with detailed info
    console.log(`\n📥 [${timestamp}] [BROWSER] Received event from "${adSpotId}"`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Agent: ${data.agentId || 'system'}`);
    console.log(`   Full data:`, data);

    // Create a unique ID for deduplication
    const dedupeKey = `${data.agentId || 'system'}-${data.type}-${data.timestamp}`;
    if (seenEventIds.has(dedupeKey)) {
      console.log(`   🔄 DUPLICATE - ignoring (already processed)\n`);
      return;
    }
    seenEventIds.add(dedupeKey);

    // Track historical vs new events
    const isHistorical = new Date(data.timestamp) < new Date(timestamp);
    if (isHistorical) {
      console.log(`   📖 Historical event (from database)`);
    } else {
      console.log(`   🔴 NEW event (just stored)`);
      setLiveEventCount(prev => prev + 1);
    }

    console.log(`   ✅ Processing and rendering...\n`);

    // Create a unique ID for React
    const msgId = `${data.agentId || 'system'}-${data.type}-${data.timestamp}-${Math.random()}`;

        switch (data.type) {
          case 'agent_started':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'agent_started',
              agentId: data.agentId,
              timestamp: data.timestamp,
              availableSpots: data.availableSpots,
              brandName: data.brandName,
              productName: data.productName,
            }]);
            break;

          case 'scraping_started':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'scraping_started',
              agentId: data.agentId,
              timestamp: data.timestamp,
              url: data.url,
              paymentMethod: data.paymentMethod,
              expectedCost: data.expectedCost,
            }]);
            break;

          case 'scraping_completed':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'scraping_completed',
              agentId: data.agentId,
              timestamp: data.timestamp,
              url: data.url,
              contentLength: data.contentLength,
              contentPreview: data.contentPreview,
              siteTitle: data.siteTitle,
              topics: data.topics,
            }]);
            break;

          case 'analytics_payment':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'analytics_payment',
              agentId: data.agentId,
              timestamp: data.timestamp,
              amount: data.amount,
              paymentMethod: data.paymentMethod,
            }]);
            break;

          case 'analytics_received':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'analytics_received',
              agentId: data.agentId,
              timestamp: data.timestamp,
              site: data.site,
              audience: data.audience,
              adSpots: data.adSpots,
            }]);
            break;

          case 'analysis_started':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'analysis_started',
              agentId: data.agentId,
              timestamp: data.timestamp,
              analysisContext: data.analysisContext,
            }]);
            break;

          case 'analysis_completed':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'analysis_completed',
              agentId: data.agentId,
              timestamp: data.timestamp,
              shouldBid: data.shouldBid,
              relevanceScore: data.relevanceScore,
              reasoning: data.reasoning,
              targetSpots: data.targetSpots,
              budgetPerSpot: data.budgetPerSpot,
              strategy: data.strategy,
            }]);
            break;

          case 'agent_status':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'agent_status',
              agentId: data.agentId,
              timestamp: data.timestamp,
              status: data.status,
            }]);
            break;

          case 'thinking':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'thinking',
              agentId: data.agentId,
              timestamp: data.timestamp,
              thinking: data.thinking,
              proposedAmount: data.proposedAmount,
            }]);
            break;

          case 'bid_placed':
            setMessages(prev => {
              const bidExists = prev.some(msg =>
                msg.type === 'bid' &&
                msg.agentId === data.agentId &&
                msg.transactionHash === data.transactionHash
              );

              if (bidExists) return prev;

              return [...prev, {
                id: msgId,
                type: 'bid',
                agentId: data.agentId,
                timestamp: data.timestamp,
                amount: parseFloat(data.amount),
                transactionHash: data.transactionHash,
                isLoading: true,
              }];
            });
            break;

          case 'reflection':
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
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'refund',
              agentId: data.agentId,
              timestamp: data.timestamp,
              refundAmount: data.amount,
              transactionHash: data.transactionHash,
            }]);
            break;

          case 'withdrawal':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'withdrawal',
              agentId: data.agentId,
              timestamp: data.timestamp,
              refundAmount: data.amount,
              reasoning: data.reasoning,
              transactionHash: data.transactionHash,
            }]);
            break;

          case 'agent_skipped':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'agent_skipped',
              agentId: data.agentId,
              timestamp: data.timestamp,
              reasoning: data.reasoning,
              adSpotId: data.adSpotId,
            }]);
            break;

          case 'agent_error':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'agent_error',
              agentId: data.agentId,
              timestamp: data.timestamp,
              phase: data.phase,
              error: data.error,
            }]);
            break;

          case 'auction_ended':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'auction_ended',
              timestamp: data.timestamp,
              winner: data.winner,
              finalBid: data.finalBid,
              endReason: data.reason,
            }]);
            break;

          case 'image_generation_update':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'image_generation_update',
              timestamp: data.timestamp || new Date().toISOString(),
              agentId: data.agentId,
              status: data.status,
              message: data.message,
              imageUrl: data.imageUrl,
              taskId: data.taskId,
            }]);
            break;

          case 'ad_image_ready':
            setMessages(prev => [...prev, {
              id: msgId,
              type: 'ad_image_ready',
              timestamp: data.timestamp || new Date().toISOString(),
              agentId: data.winner?.agentId,
              imageUrl: data.imageUrl,
            }]);
            break;
        }
  };

  // Polling logic - replaces SSE
  useEffect(() => {
    const lastFetched: { [key: string]: string | null } = {
      'prime-banner': null,
      'sidebar-secondary': null,
    };

    let isPolling = true;

    const pollEvents = async (adSpotId: string) => {
      if (!isPolling) return;

      try {
        setConnectionStatus(prev => ({ ...prev, [adSpotId]: 'connecting' }));

        // Build URL with optional 'since' parameter
        const url = lastFetched[adSpotId]
          ? `/api/events/${encodeURIComponent(adSpotId)}?since=${encodeURIComponent(lastFetched[adSpotId]!)}`
          : `/api/events/${encodeURIComponent(adSpotId)}`;

        console.log(`\n🔄 [POLLING] Fetching events for "${adSpotId}"${lastFetched[adSpotId] ? ` since ${lastFetched[adSpotId]}` : ' (initial load)'}`);

        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
          console.error(`   ❌ Polling error:`, result.error);
          setConnectionStatus(prev => ({ ...prev, [adSpotId]: 'disconnected' }));
          return;
        }

        setConnectionStatus(prev => ({ ...prev, [adSpotId]: 'connected' }));

        const { events, timestamp: serverTimestamp } = result;
        console.log(`   ✅ Received ${events.length} event(s)`);

        // Process each event
        events.forEach((event: any) => {
          processEvent(event, adSpotId, serverTimestamp);
        });

        // Update last fetched timestamp
        lastFetched[adSpotId] = serverTimestamp;

      } catch (error) {
        console.error(`   ❌ Polling failed for "${adSpotId}":`, error);
        setConnectionStatus(prev => ({ ...prev, [adSpotId]: 'disconnected' }));
      }
    };

    // Initial fetch for both spots
    console.log('\n🚀 [POLLING] Starting event polling system...');
    pollEvents('prime-banner');
    pollEvents('sidebar-secondary');

    // Poll every 2 seconds
    const interval = setInterval(() => {
      pollEvents('prime-banner');
      pollEvents('sidebar-secondary');
    }, 2000);

    return () => {
      console.log('\n🛑 [POLLING] Stopping event polling system');
      isPolling = false;
      clearInterval(interval);
    };
  }, []);

  // Convert streaming messages to terminal logs
  const messageToTerminalLog = (msg: StreamingMessage) => {
    const logs: Array<{
      id?: string;
      timestamp: string;
      type: 'info' | 'success' | 'payment' | 'error' | 'tool' | 'thinking';
      icon: string;
      message: string;
      details?: string;
      link?: { href: string; label: string };
    }> = [];

    switch (msg.type) {
      case 'agent_started':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'info',
          icon: '🚀',
          message: 'AGENT STARTED',
          details: `Brand: ${msg.brandName}\nProduct: ${msg.productName}\nTargeting: ${msg.availableSpots?.join(', ')}`,
        });
        break;

      case 'scraping_started':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'payment',
          icon: '💳',
          message: `x402 PAYMENT: ${msg.expectedCost || 'USDC'}`,
          details: `Service: Firecrawl Web Scraping\nTarget: ${msg.url}`,
        });
        break;

      case 'scraping_completed':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'success',
          icon: '✓',
          message: 'SITE DATA RECEIVED',
          details: `Title: ${msg.siteTitle}\nLength: ${msg.contentLength?.toLocaleString()} chars\nTopics: ${msg.topics?.join(', ')}\n\nPreview:\n${msg.contentPreview}`,
        });
        break;

      case 'analytics_payment':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'payment',
          icon: '💳',
          message: `x402 PAYMENT: ${msg.amount}`,
          details: `Service: Site Analytics API\nMethod: ${msg.paymentMethod}`,
        });
        break;

      case 'analytics_received':
        const adSpotsInfo = msg.adSpots?.map(spot =>
          `  • ${spot.name}: ${spot.impressions.toLocaleString()} impr/mo, ${spot.clickThroughRate} CTR, ${spot.estimatedClicks.toLocaleString()} clicks, avg bid ${spot.averageBid}`
        ).join('\n') || '';

        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'success',
          icon: '📊',
          message: 'FULL ANALYTICS RECEIVED',
          details: `Monthly Visits: ${msg.site?.monthlyVisits.toLocaleString()}\nDaily Average: ${msg.site?.dailyAverage.toLocaleString()}\nSession Duration: ${msg.site?.avgSessionDuration}\nBounce Rate: ${msg.site?.bounceRate}\nAudience: ${msg.audience}\n\nAd Spots:\n${adSpotsInfo}`,
        });
        break;

      case 'analysis_started':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'thinking',
          icon: '🧠',
          message: 'AI ANALYSIS STARTED',
          details: msg.analysisContext ?
            `Analyzing Data:\n• Topics: ${msg.analysisContext.siteTopics.join(', ')}\n• Monthly Visits: ${msg.analysisContext.monthlyVisits.toLocaleString()}\n• Audience: ${msg.analysisContext.audience}\n• Available Spots: ${msg.analysisContext.availableSpots.join(', ')}\n• Wallet Balance: $${msg.analysisContext.walletBalance.toFixed(2)} USDC` :
            'Evaluating relevance, ROI, and budget allocation...',
        });
        break;

      case 'analysis_completed':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: msg.shouldBid ? 'success' : 'info',
          icon: msg.shouldBid ? '✓' : '⊘',
          message: msg.shouldBid ? 'DECISION: BID' : 'DECISION: SKIP',
          details: `Relevance: ${msg.relevanceScore}/10\n${msg.reasoning}\n\nStrategy: ${msg.strategy}${
            msg.targetSpots && msg.targetSpots.length > 0
              ? `\n\nTarget Spots: ${msg.targetSpots.join(', ')}\nBudget: ${Object.entries(msg.budgetPerSpot || {}).map(([spot, amount]) => `${spot}: $${amount}`).join(', ')}`
              : ''
          }`,
        });
        break;

      case 'agent_status':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'thinking',
          icon: '🤔',
          message: `STATUS: ${msg.status?.toUpperCase()}`,
          details: `Agent is currently ${msg.status}...`,
        });
        break;

      case 'thinking':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'thinking',
          icon: '💭',
          message: 'STRATEGIC THINKING',
          details: msg.thinking,
        });
        if (msg.proposedAmount) {
          logs.push({
            id: `${msg.id}-1`,
            timestamp: msg.timestamp,
            type: 'info',
            icon: '💰',
            message: `PROPOSED BID: $${msg.proposedAmount.toFixed(2)} USDC`,
          });
        }
        break;

      case 'bid':
        const bidAmount = typeof msg.amount === 'number' ? msg.amount : parseFloat(msg.amount || '0');
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'payment',
          icon: '💳',
          message: 'INITIATING x402 PAYMENT',
          details: `Amount: $${bidAmount.toFixed(2)} USDC`,
        });
        logs.push({
          id: `${msg.id}-1`,
          timestamp: msg.timestamp,
          type: 'success',
          icon: '✓',
          message: `BID PLACED: $${bidAmount.toFixed(2)} USDC`,
          link: msg.transactionHash ? {
            href: `https://sepolia.basescan.org/tx/${msg.transactionHash}`,
            label: 'View transaction on Basescan'
          } : undefined,
        });
        if (msg.reflection) {
          logs.push({
            id: `${msg.id}-2`,
            timestamp: msg.timestamp,
            type: 'info',
            icon: '📝',
            message: 'POST-BID ANALYSIS',
            details: msg.reflection,
          });
        }
        break;

      case 'refund':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'payment',
          icon: '💸',
          message: `REFUND RECEIVED: $${msg.refundAmount?.toFixed(2)} USDC`,
          details: 'Outbid by competitor. Re-evaluating...',
          link: msg.transactionHash ? {
            href: `https://sepolia.basescan.org/tx/${msg.transactionHash}`,
            label: 'View refund transaction'
          } : undefined,
        });
        break;

      case 'withdrawal':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'info',
          icon: '🏳️',
          message: 'WITHDRAWING',
          details: msg.reasoning,
          link: msg.transactionHash ? {
            href: `https://sepolia.basescan.org/tx/${msg.transactionHash}`,
            label: 'View refund transaction'
          } : undefined,
        });
        break;

      case 'agent_skipped':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'info',
          icon: '⊘',
          message: `SKIPPING AD SPOT: ${msg.adSpotId}`,
          details: msg.reasoning,
        });
        break;

      case 'agent_error':
        logs.push({
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'error',
          icon: '❌',
          message: `ERROR IN ${msg.phase?.toUpperCase()} PHASE`,
          details: msg.error,
        });
        break;

      case 'image_generation_update':
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
          id: `${msg.id}-0`,
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
          id: `${msg.id}-0`,
          timestamp: msg.timestamp,
          type: 'success',
          icon: '🎨',
          message: 'AD IMAGE READY',
          details: 'Creative assets ready. Ad is now live!',
        });
        break;

      case 'auction_ended':
        logs.push({
          id: `${msg.id}-0`,
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

  // Detect event gaps
  useEffect(() => {
    const agentSequences: {[agentId: string]: number[]} = {};

    messages.forEach(msg => {
      if (msg.agentId && (msg as any).eventSequence) {
        if (!agentSequences[msg.agentId]) {
          agentSequences[msg.agentId] = [];
        }
        agentSequences[msg.agentId].push((msg as any).eventSequence);
      }
    });

    const gaps: {agentId: string, missing: number[]}[] = [];
    Object.entries(agentSequences).forEach(([agentId, sequences]) => {
      if (sequences.length === 0) return;

      sequences.sort((a, b) => a - b);
      const missing: number[] = [];

      for (let i = sequences[0]; i <= sequences[sequences.length - 1]; i++) {
        if (!sequences.includes(i)) {
          missing.push(i);
        }
      }

      if (missing.length > 0) {
        gaps.push({ agentId, missing });
      }
    });

    setEventGaps(gaps);
  }, [messages]);

  // Split messages by agent
  const { coinbaseLogs, crossmintLogs } = useMemo(() => {
    console.log(`[RENDER] Processing ${messages.length} messages into terminal logs`);

    const coinbaseLogs: Array<{
      id?: string;
      timestamp: string;
      type: 'info' | 'success' | 'payment' | 'error' | 'tool' | 'thinking';
      icon: string;
      message: string;
      details?: string;
      link?: { href: string; label: string };
    }> = [];
    const crossmintLogs: Array<{
      id?: string;
      timestamp: string;
      type: 'info' | 'success' | 'payment' | 'error' | 'tool' | 'thinking';
      icon: string;
      message: string;
      details?: string;
      link?: { href: string; label: string };
    }> = [];

    messages.forEach((msg, idx) => {
      const agentId = msg.agentId || '';
      console.log(`[RENDER] Message ${idx + 1}/${messages.length}:`, msg.type, 'from', agentId);

      // Route to Coinbase terminal
      if (agentId === 'CoinbaseCDP' || msg.type === 'auction_ended') {
        const logs = messageToTerminalLog(msg);
        console.log(`[RENDER] Adding ${logs.length} log(s) to Coinbase terminal for`, msg.type);
        coinbaseLogs.push(...logs);
      }

      // Route to Crossmint terminal
      if (agentId === 'Crossmint' || msg.type === 'auction_ended') {
        const logs = messageToTerminalLog(msg);
        console.log(`[RENDER] Adding ${logs.length} log(s) to Crossmint terminal for`, msg.type);
        crossmintLogs.push(...logs);
      }
    });

    console.log(`[RENDER] Final counts - Coinbase: ${coinbaseLogs.length}, Crossmint: ${crossmintLogs.length}`);
    return { coinbaseLogs, crossmintLogs };
  }, [messages]);

  const handleRefreshEvents = async () => {
    console.log('[REFRESH] Reloading page to fetch latest events...');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      {/* Event Gap Warning Banner */}
      {eventGaps.length > 0 && (
        <div className="bg-amber-900/20 border-b border-amber-700/50 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-amber-500 text-lg">⚠️</span>
              <div className="text-sm">
                <span className="text-amber-400 font-semibold">Missing Events Detected:</span>
                {eventGaps.map(gap => (
                  <span key={gap.agentId} className="text-amber-300 ml-2">
                    {gap.agentId} (events {gap.missing.join(', ')})
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleRefreshEvents}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded transition-colors"
            >
              Refresh Events
            </button>
          </div>
        </div>
      )}

      {/* Replay Status Banner */}
      {Object.values(replayStatus).some(s => s.loading) && (
        <div className="bg-blue-900/20 border-b border-blue-700/50 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-blue-500 text-lg animate-pulse">📖</span>
            <div className="text-sm">
              <span className="text-blue-400 font-semibold">Loading Historical Events from Database...</span>
              <span className="text-blue-300 ml-2">
                {Object.entries(replayStatus).map(([spotId, status]) => (
                  status.loading && status.count > 0 ? (
                    <span key={spotId} className="ml-2">
                      {spotId}: {status.count} events loaded
                    </span>
                  ) : null
                ))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#2a2a2a] border-b border-[#333333] px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[#ffffff] text-xl font-semibold">
                Analytical Agents - DevNews Ad Spots
              </h1>
              <p className="text-[#888888] text-sm">Autonomous analysis, bidding, and creative generation</p>
            </div>
            <div className="flex items-center gap-6">
              {/* Connection Status */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${connectionStatus['prime-banner'] === 'connected' ? 'bg-green-500' : connectionStatus['prime-banner'] === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-[#888888]">Prime Banner</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${connectionStatus['sidebar-secondary'] === 'connected' ? 'bg-green-500' : connectionStatus['sidebar-secondary'] === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-[#888888]">Sidebar Secondary</span>
                </div>
              </div>

              {/* Event Counter */}
              <div className="flex flex-col gap-1 text-xs text-[#888888] font-mono bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333333]">
                <div>📊 Total: {messages.length} events</div>
                <div className="flex gap-3">
                  <span>CDP: {coinbaseLogs.length}</span>
                  <span>Cross: {crossmintLogs.length}</span>
                  <span className="text-green-400">🔴 Live: {liveEventCount}</span>
                </div>
              </div>

              {/* Debug Toggle */}
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[#888888] px-3 py-2 rounded border border-[#444444] transition-colors"
              >
                {showDebug ? '🔍 Hide Debug' : '🔍 Show Debug'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div className="bg-[#1e1e1e] border-b border-[#333333] px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-xs font-mono">
              <div className="text-[#ffffff] font-semibold mb-3">🔍 Debug Panel - Event Flow Tracker</div>

              {/* Connection Times */}
              <div className="mb-4 p-3 bg-[#2a2a2a] rounded border border-[#444444]">
                <div className="text-[#888888] mb-2">SSE Connections:</div>
                <div className="space-y-1 text-[#aaaaaa]">
                  {['prime-banner', 'sidebar-secondary'].map(spotId => (
                    <div key={spotId} className="flex justify-between">
                      <span>{spotId}:</span>
                      <span className={connectionStatus[spotId] === 'connected' ? 'text-green-400' : 'text-yellow-400'}>
                        {connectionStatus[spotId] || 'not connected'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Breakdown */}
              <div className="mb-4 p-3 bg-[#2a2a2a] rounded border border-[#444444]">
                <div className="text-[#888888] mb-2">Event Breakdown by Agent:</div>
                <div className="space-y-1 text-[#aaaaaa]">
                  {['CoinbaseCDP', 'Crossmint'].map(agentId => {
                    const agentEvents = messages.filter(m => m.agentId === agentId);
                    return (
                      <div key={agentId} className="flex justify-between">
                        <span>{agentId}:</span>
                        <span className="text-blue-400">{agentEvents.length} events</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Events */}
              <div className="p-3 bg-[#2a2a2a] rounded border border-[#444444]">
                <div className="text-[#888888] mb-2">Last 10 Events Received:</div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {messages.slice(-10).reverse().map((msg, idx) => (
                    <div key={idx} className="text-[10px] p-2 bg-[#1a1a1a] rounded border border-[#333333]">
                      <div className="flex justify-between mb-1">
                        <span className="text-purple-400">{msg.type}</span>
                        <span className="text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-gray-400">Agent: {msg.agentId || 'system'}</div>
                      {msg.reasoning && (
                        <div className="text-gray-500 mt-1 truncate">
                          Reasoning: {msg.reasoning.substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-gray-600 italic">No events yet - waiting for agent to start...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dual Terminal View */}
      <div className="flex-1 overflow-hidden px-6 py-6">
        <div className="max-w-7xl mx-auto h-full">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* Coinbase CDP Terminal */}
            <TerminalPanel
              brandName="Coinbase CDP"
              logs={coinbaseLogs}
              color="blue"
              logoPath="/coinbase.png"
            />

            {/* Crossmint Terminal */}
            <TerminalPanel
              brandName="Crossmint"
              logs={crossmintLogs}
              color="green"
              logoPath="/crossmint.png"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
