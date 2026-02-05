export const facilitatorConfig = {
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
};

export function calculateCurrentBidPrice(currentBid: number | null): string {
  if (!currentBid) {
    const startingBid = parseFloat(process.env.STARTING_BID_USDC || "1");
    return `$${startingBid.toFixed(2)}`;
  }

  const increment = parseFloat(process.env.BID_INCREMENT_USDC || "1");
  const nextBid = currentBid + increment;

  return `$${nextBid.toFixed(2)}`;
}

export function parseBidAmount(priceString: string): number {
  // Remove $ sign and parse as float
  return parseFloat(priceString.replace("$", ""));
}

export const AUCTION_DURATION_MS =
  parseInt(process.env.AUCTION_DURATION_MINUTES || "5") * 60 * 1000;

// Solana USDC SPL Token addresses
// Devnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC on Solana Devnet)
// Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC on Solana Mainnet)
export const SOLANA_DEVNET_USDC =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOLANA_MAINNET_USDC =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Freepik x402 Configuration (Solana Mainnet)
export const FREEPIK_X402_CONFIG = {
  network: "solana", // Solana Mainnet
  usdcAddress: SOLANA_MAINNET_USDC,
  facilitatorUrl: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
};
