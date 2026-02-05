import { initializeWallet, fundWalletFromFaucet, getWalletBalance } from './lib/wallet';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  console.log('🚀 Funding server wallet...\n');

  // Initialize wallet
  const { serverAccount } = await initializeWallet();
  console.log(`Wallet address: ${serverAccount.address}\n`);

  // Check initial balance
  console.log('📊 Initial balances:');
  const initialBalance = await getWalletBalance();
  console.log(`  ETH: ${initialBalance.eth}`);
  console.log(`  USDC: ${initialBalance.usdc}\n`);

  // Fund with ETH
  console.log('💧 Requesting ETH from faucet...');
  await fundWalletFromFaucet('base-sepolia', 'eth');
  
  // Wait a bit for first transaction
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fund with USDC
  console.log('\n💧 Requesting USDC from faucet...');
  await fundWalletFromFaucet('base-sepolia', 'usdc');

  // Wait for transactions to process
  console.log('\n⏳ Waiting for transactions to confirm...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Check final balance
  console.log('\n📊 Final balances:');
  const finalBalance = await getWalletBalance();
  console.log(`  ETH: ${finalBalance.eth}`);
  console.log(`  USDC: ${finalBalance.usdc}`);

  console.log('\n✅ Wallet funding complete!');
}

main().catch(console.error);
