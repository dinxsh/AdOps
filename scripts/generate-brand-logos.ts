import axios from 'axios';
import { withPaymentInterceptor } from 'x402-axios';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'agents/.env' });

const FREEPIK_API_URL = 'https://api.freepik.com/v1/x402/ai/mystic';
const FREEPIK_STATUS_URL = 'https://api.freepik.com/v1/ai/images';

interface LogoConfig {
  brandName: string;
  prompt: string;
}

const logos: LogoConfig[] = [
  {
    brandName: 'IceCo',
    prompt: 'Modern minimalist logo for "IceCo" premium water brand. Clean typography with ice crystal or water drop element. Cool color palette of blues, whites, and silver. Professional, elegant, sophisticated design. Vector style, simple geometric shapes, high-end branding aesthetic.',
  },
  {
    brandName: 'FizzUp',
    prompt: 'Bold energetic logo for "FizzUp" energy soda brand. Dynamic typography with lightning bolt or energy burst element. Vibrant electric colors - neon blue, electric green, orange. Edgy, youthful, high-energy design. Vector style, modern urban aesthetic, explosive visual impact.',
  },
];

async function generateLogo(config: LogoConfig): Promise<string> {
  console.log(`\n🎨 Generating logo for ${config.brandName}...`);
  console.log(`📝 Prompt: ${config.prompt}\n`);

  // Create wallet client for x402 payments (Base mainnet for Freepik)
  const wallet = createWalletClient({
    chain: base,
    transport: http(),
    account: privateKeyToAccount(process.env.AGENT_A_PRIVATE_KEY as `0x${string}`),
  });

  // Create axios instance with x402 payment interceptor
  const axiosWithPayment = withPaymentInterceptor(
    axios.create({
      headers: {
        'Content-Type': 'application/json',
        'x-freepik-api-key': process.env.FREEPIK_API_KEY,
      },
    }),
    wallet as any
  );

  try {
    // Make x402 payment call to Freepik
    const response = await axiosWithPayment.post(FREEPIK_API_URL, {
      prompt: config.prompt,
      model: 'realism',
      resolution: '1k',
      aspect_ratio: 'square_1_1', // Square for logos
    });

    console.log('📦 Response data:', JSON.stringify(response.data, null, 2));

    const taskId = response.data.data?.task_id || response.data.task_id || response.data.id;
    if (!taskId) {
      throw new Error(`No task ID in response: ${JSON.stringify(response.data)}`);
    }

    console.log(`✅ Task created: ${taskId}`);
    console.log(`⏳ Waiting for image generation...`);

    // Poll for completion
    let imageUrl = '';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (!imageUrl && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      try {
        const statusResponse = await axios.get(`${FREEPIK_STATUS_URL}/${taskId}`, {
          headers: {
            'x-freepik-api-key': process.env.FREEPIK_API_KEY,
          },
        });

        // Debug log on first check
        if (attempts === 1) {
          console.log('\n📊 Status response structure:', JSON.stringify(statusResponse.data, null, 2));
        }

        // Check different possible response structures
        const status = statusResponse.data.status || statusResponse.data.data?.status;
        const imageData = statusResponse.data.data?.generated?.[0] ||
                         statusResponse.data.generated?.[0] ||
                         statusResponse.data.data?.[0];

        if (status === 'SUCCESS' || status === 'success' || status === 'COMPLETED') {
          if (imageData?.url) {
            imageUrl = imageData.url;
            console.log(`\n✅ ${config.brandName} logo generated!`);
            console.log(`🔗 URL: ${imageUrl}\n`);
          }
        } else if (status === 'FAILED' || status === 'failed') {
          throw new Error(`Image generation failed: ${statusResponse.data.error || 'Unknown error'}`);
        } else {
          process.stdout.write('.');
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Task not found yet, keep waiting
          process.stdout.write('.');
        } else {
          throw error;
        }
      }
    }

    if (!imageUrl) {
      throw new Error('Timeout waiting for image generation');
    }

    return imageUrl;
  } catch (error: any) {
    console.error(`❌ Error generating ${config.brandName} logo:`, error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting brand logo generation...\n');
  console.log('This will use x402 payments on Base mainnet to call Freepik\'s AI API.\n');

  const results: Record<string, string> = {};

  for (const logo of logos) {
    try {
      const url = await generateLogo(logo);
      results[logo.brandName] = url;
    } catch (error) {
      console.error(`Failed to generate ${logo.brandName} logo, continuing...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎉 LOGO GENERATION COMPLETE\n');
  console.log('Brand Logos:');
  console.log('='.repeat(80) + '\n');

  for (const [brand, url] of Object.entries(results)) {
    console.log(`${brand}:`);
    console.log(`  ${url}\n`);
  }

  console.log('💡 Save these URLs to use in your frontend!\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
