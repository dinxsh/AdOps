import { initializeWallet, fundWalletFromFaucet, getWalletBalance } from '../lib/wallet';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  console.log('🚀 Funding server wallet...\n');

  // Initialize wallet (returns { address, balance })
  const walletInfo = await initializeWallet();
  console.log(`Wallet address: ${walletInfo.address}\n`);

  // Check initial balance
  console.log('📊 Initial balances:');
  // Re-fetch to be sure or use returned
  const initialBalance = await getWalletBalance();
  console.log(`  SOL: ${initialBalance.sol}`);
  console.log(`  USDC: ${initialBalance.usdc}\n`);

  // Fund with SOL (was ETH)
  console.log('💧 Requesting SOL from faucet...');
  await fundWalletFromFaucet('devnet', 'sol');

  // Wait a bit for first transaction
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fund with USDC - Not automatically supported on devnet easily without complex script
  // But we call the function which logs warning
  console.log('\n💧 Requesting USDC from faucet...');
  await fundWalletFromFaucet('devnet', 'usdc');

  // Wait for transactions to process
  console.log('\n⏳ Waiting for transactions to confirm...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check final balance
  console.log('\n📊 Final balances:');
  const finalBalance = await getWalletBalance();
  console.log(`  SOL: ${finalBalance.sol}`);
  console.log(`  USDC: ${finalBalance.usdc}`);

  console.log('\n✅ Wallet funding complete!');
}

main().catch(console.error);
