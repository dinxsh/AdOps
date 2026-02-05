import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
} from "@solana/spl-token";
import bs58 from "bs58";
import { SOLANA_DEVNET_USDC, SOLANA_MAINNET_USDC } from "./x402-config";

let connection: Connection;
let serverKeypair: Keypair | null = null;

// Initialize Solana connection
export function getConnection(): Connection {
  if (connection) {
    return connection;
  }

  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    (process.env.SOLANA_NETWORK === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com");

  connection = new Connection(rpcUrl, "confirmed");
  console.log(`✅ Solana connection initialized: ${rpcUrl}`);
  return connection;
}

// Initialize server wallet from private key
export function getServerKeypair(): Keypair {
  if (serverKeypair) {
    return serverKeypair;
  }

  const privateKey = process.env.SERVER_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("SERVER_WALLET_PRIVATE_KEY not set in environment");
  }

  // Support both base58 encoded and hex format
  let secretKey: Uint8Array;
  try {
    // Try base58 first (Solana standard)
    secretKey = bs58.decode(privateKey);
  } catch {
    // If that fails, try hex (for compatibility)
    if (privateKey.startsWith("0x")) {
      secretKey = new Uint8Array(Buffer.from(privateKey.slice(2), "hex"));
    } else {
      secretKey = new Uint8Array(Buffer.from(privateKey, "hex"));
    }
  }

  serverKeypair = Keypair.fromSecretKey(secretKey);
  console.log(
    `✅ Server wallet initialized: ${serverKeypair.publicKey.toBase58()}`
  );
  return serverKeypair;
}

// Get server wallet client for x402 (returns Keypair as Signer)
export async function getServerWalletClient(): Promise<Keypair> {
  return getServerKeypair();
}

// Get wallet balance (SOL and USDC)
export async function getWalletBalance(): Promise<{
  sol: string;
  usdc: string;
}> {
  const conn = getConnection();
  const keypair = getServerKeypair();
  const publicKey = keypair.publicKey;

  // Get SOL balance
  const solBalance = await conn.getBalance(publicKey);

  // Get USDC balance (SPL token)
  const network = process.env.SOLANA_NETWORK || "devnet";
  const usdcMint =
    network === "mainnet-beta" ? SOLANA_MAINNET_USDC : SOLANA_DEVNET_USDC;
  const usdcMintPubkey = new PublicKey(usdcMint);

  let usdcBalance = 0;
  try {
    const tokenAccount = await getAssociatedTokenAddress(
      usdcMintPubkey,
      publicKey
    );
    const accountInfo = await getAccount(conn, tokenAccount);
    usdcBalance = Number(accountInfo.amount);
  } catch (error) {
    // Token account doesn't exist, balance is 0
    usdcBalance = 0;
  }

  return {
    sol: (solBalance / 1e9).toFixed(6), // SOL has 9 decimals
    usdc: (usdcBalance / 1e6).toFixed(6), // USDC has 6 decimals
  };
}

// Send USDC refund (SPL token transfer)
export async function sendRefund(
  toAddress: string,
  amountUSDC: number,
  network: "devnet" | "mainnet-beta" = "devnet"
): Promise<string> {
  const conn = getConnection();
  const fromKeypair = getServerKeypair();
  const toPubkey = new PublicKey(toAddress);

  console.log(
    `💸 Sending USDC refund of ${amountUSDC} USDC to ${toAddress}...`
  );

  // Get USDC mint address
  const usdcMint =
    network === "mainnet-beta" ? SOLANA_MAINNET_USDC : SOLANA_DEVNET_USDC;
  const usdcMintPubkey = new PublicKey(usdcMint);

  // Get associated token addresses
  const fromTokenAccount = await getAssociatedTokenAddress(
    usdcMintPubkey,
    fromKeypair.publicKey
  );
  const toTokenAccount = await getAssociatedTokenAddress(
    usdcMintPubkey,
    toPubkey
  );

  // USDC has 6 decimals
  const amountInAtomicUnits = BigInt(Math.floor(amountUSDC * 1_000_000));

  // Create transfer instruction
  const transferInstruction = createTransferInstruction(
    fromTokenAccount,
    toTokenAccount,
    fromKeypair.publicKey,
    amountInAtomicUnits
  );

  // Create and send transaction
  const transaction = new Transaction().add(transferInstruction);

  // Get recent blockhash
  const { blockhash } = await conn.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKeypair.publicKey;

  // Sign and send transaction
  const signature = await sendAndConfirmTransaction(
    conn,
    transaction,
    [fromKeypair],
    { commitment: "confirmed" }
  );

  const explorerUrl =
    network === "mainnet-beta"
      ? `https://solscan.io/tx/${signature}`
      : `https://solscan.io/tx/${signature}?cluster=devnet`;

  console.log(`✅ Refund sent! Tx: ${explorerUrl}`);

  return signature;
}

// Initialize wallet (for compatibility with existing code)
export async function initializeWallet() {
  const keypair = getServerKeypair();
  const balance = await getWalletBalance();

  return {
    address: keypair.publicKey.toBase58(),
    balance,
  };
}
