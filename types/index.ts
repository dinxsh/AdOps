import { ObjectId } from 'mongodb';

// Winner Ad Image - generated via Freepik after auction
export interface WinnerAdImage {
  url: string; // Freepik CDN URL
  prompt: string; // AI-generated prompt
  taskId: string; // Freepik task ID
  generatedAt: Date;
  freepikTxHash?: string; // Payment tx for image generation
}

// Ad Spot Record - for ad bidding auctions
export interface AdSpotRecord {
  _id?: ObjectId;
  adSpotId: string; // e.g., "homepage-banner-1"
  currentBid: number; // USDC amount
  currentWinner: {
    agentId: string;
    walletAddress: string;
    externalId: string; // x402 external ID
    timestamp: Date;
  } | null;
  bidHistory: {
    agentId: string;
    walletAddress: string;
    amount: number;
    timestamp: Date;
    txHash?: string;
    thinking?: string;
    strategy?: string;
    reasoning?: string;
    reflection?: string;
  }[];
  auctionStartTime: Date;
  auctionEndTime: Date;
  status: 'active' | 'ended' | 'displaying_ad';
  withdrawnAgents?: string[]; // List of agents who withdrew
  skippedAgents?: string[]; // List of agents who decided not to bid
  auctionEnded?: boolean; // True if auction ended early
  auctionEndReason?: string; // Why auction ended (withdrawal, timeout, no bidders, etc.)
  winner?: string; // Winner agent ID
  winnerAdImage?: WinnerAdImage;
  createdAt: Date;
  updatedAt: Date;
}

// Legacy interface for backwards compatibility (deprecated)
export interface BidRecord extends Omit<AdSpotRecord, 'adSpotId'> {
  basename: string;
}

export interface AgentConfig {
  name: string;
  privateKey: `0x${string}`;
  walletAddress: string;
  maxBid: number;
}

export interface BidEvent {
  type: 'bid' | 'refund' | 'auction_end' | 'transfer_complete';
  agentId: string;
  amount: number;
  timestamp: Date;
  message: string;
}

export interface AdImageReadyEvent {
  type: 'ad_image_ready';
  imageUrl: string;
  winner: {
    agentId: string;
    walletAddress: string;
  };
  prompt: string;
  timestamp: Date;
}
