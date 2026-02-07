/**
 * Test script to verify ez402-wrapped Firecrawl endpoint
 * Tests scraping a public URL to isolate ngrok issues
 */

import axios from 'axios';
import { createWalletClient, http, publicActions } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { withPaymentInterceptor } from 'x402-axios';
import dotenv from 'dotenv';

dotenv.config({ path: 'agents/.env' });

const TEST_URL = 'https://developers.cloudflare.com/agents/x402/';
const FIRECRAWL_WRAPPED_ENDPOINT = process.env.FIRECRAWL_WRAPPED_ENDPOINT!;

async function testFirecrawlScrape() {
  console.log('\n🧪 Testing ez402-wrapped Firecrawl endpoint\n');
  console.log(`📍 Target URL: ${TEST_URL}`);
  console.log(`🔗 Ez402 endpoint: ${FIRECRAWL_WRAPPED_ENDPOINT}\n`);

  // Setup wallet for x402 payments
  const privateKey = process.env.AGENT_A_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error('AGENT_A_PRIVATE_KEY not found in .env');
  }

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  }).extend(publicActions);

  // Setup axios with x402 payment interceptor (matching intelligent-agent pattern)
  const axiosWithPayment = withPaymentInterceptor(
    axios.create({
      headers: { 'X-Agent-ID': 'TestAgent' }
    }),
    walletClient as unknown as Parameters<typeof withPaymentInterceptor>[1]
  );

  try {
    console.log('💰 Making x402 payment and requesting scrape...\n');

    const response = await axiosWithPayment.post(FIRECRAWL_WRAPPED_ENDPOINT, {
      url: TEST_URL,
      formats: ['markdown'],
      onlyMainContent: true,
      includeTags: ['article', 'main', 'h1', 'h2', 'h3', 'p'],
      removeBase64Images: true,
    });

    console.log('✅ Scrape successful!\n');
    console.log('📊 Response status:', response.status);
    console.log('📄 Response data keys:', Object.keys(response.data));

    if (response.data.data) {
      const data = response.data.data;
      console.log('\n📝 Scraped content:');
      console.log('   Title:', data.metadata?.title || 'N/A');
      console.log('   Description:', data.metadata?.description || 'N/A');
      console.log('   Markdown length:', data.markdown?.length || 0, 'chars');

      if (data.markdown) {
        console.log('\n📖 First 500 chars of markdown:');
        console.log('---');
        console.log(data.markdown.substring(0, 500));
        console.log('---\n');
      }
    }

    console.log('✅ Test PASSED - Firecrawl scraping works with public URLs!\n');
    return true;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const axiosError = error as { response?: { status: number; data: unknown } };
    console.error('❌ Test FAILED\n');

    if (axiosError.response) {
      console.error('Status:', axiosError.response.status);
      console.error('Data:', JSON.stringify(axiosError.response.data, null, 2));
    } else {
      console.error('Error:', errorMessage);
    }

    console.log('\n❌ This indicates an issue with the ez402 wrapper or Firecrawl API itself\n');
    return false;
  }
}

// Run the test
testFirecrawlScrape()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
