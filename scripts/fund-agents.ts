import { CdpClient } from '@coinbase/cdp-sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import { Hex } from 'viem';

// Load both env files - CDP credentials and agent keys
dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'agents/.env' });

const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// ERC-20 ABI for balanceOf
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

async function getUSDCBalance(address: string): Promise<string> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const balance = await publicClient.readContract({
    address: USDC_BASE_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });

  // USDC has 6 decimals
  return (Number(balance) / 1_000_000).toFixed(2);
}

async function fundAgent(agentName: string, privateKey: Hex) {
  console.log(`\n🤖 Funding ${agentName}...`);

  // Derive address from private key
  const account = privateKeyToAccount(privateKey);
  console.log(`   Address: ${account.address}`);

  // Check initial balance
  const initialBalance = await getUSDCBalance(account.address);
  console.log(`   Initial USDC balance: ${initialBalance}`);

  // Initialize CDP client
  const cdp = new CdpClient();

  // Request USDC from faucet
  console.log(`   💧 Requesting USDC from faucet...`);

  try {
    const faucetTx = await cdp.evm.requestFaucet({
      network: 'base-sepolia',
      token: 'usdc',
      address: account.address,
    });

    console.log(`   ✅ Faucet transaction initiated`);
    console.log(`   Transaction hash: ${faucetTx.transactionHash}`);
  } catch (error: any) {
    console.error(`   ❌ Error requesting faucet: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Funding agent wallets with Base Sepolia USDC...\n');

  const agentAKey = process.env.AGENT_A_PRIVATE_KEY as Hex;
  const agentBKey = process.env.AGENT_B_PRIVATE_KEY as Hex;

  if (!agentAKey || !agentBKey) {
    console.error('❌ Agent private keys not found in agents/.env');
    process.exit(1);
  }

  // Fund Agent A
  await fundAgent('Agent A', agentAKey);

  // Wait between requests
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fund Agent B
  await fundAgent('Agent B', agentBKey);

  // Wait for transactions to process
  console.log('\n⏳ Waiting for transactions to confirm (15 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Check final balances
  console.log('\n📊 Final balances:');
  const accountA = privateKeyToAccount(agentAKey);
  const accountB = privateKeyToAccount(agentBKey);

  const finalBalanceA = await getUSDCBalance(accountA.address);
  const finalBalanceB = await getUSDCBalance(accountB.address);

  console.log(`   Agent A (${accountA.address}): ${finalBalanceA} USDC`);
  console.log(`   Agent B (${accountB.address}): ${finalBalanceB} USDC`);

  console.log('\n✅ Agent wallet funding complete!');
}

main().catch(console.error);
