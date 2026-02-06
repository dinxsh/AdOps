import axios from "axios";
import { Buffer } from "buffer";
import { withPaymentInterceptor } from "x402-axios";
import { createSigner, type Signer } from "x402/types";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import bs58 from "bs58";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";
import { SOLANA_DEVNET_USDC } from "../../lib/x402-config";

export interface BrandIdentity {
  brandName: string;
  productName: string;
  industry: string;
  productDescription: string;
  targetAudience: string;
  brandPersonality: string;
  marketingAngle: string;
  visualStyle: string;
  keyMessages: string[];
}

interface BidContext {
  adSpotId: string;
  currentBid: number | null;
  timeRemaining: number | null;
  bidHistory: Array<{
    agentId: string;
    amount: number;
    timestamp: string;
  }>;
  myBalance: number;
  lastRefundAmount?: number;
}

export interface CampaignDetails {
  campaignName: string;
  productDescription: string;
  objective: string;
  audienceDescription: string;
  budgetTotal: number;
  budgetDaily: number;
}

export interface OptimizationContext {
  campaignId: string;
  now: string;
  remainingBudget: number;
  statsJson: string; // JSON string of per-channel stats
  creativesJson: string; // JSON string of active creatives
  recentActionsJson: string; // JSON string of previous actions
}

export interface AdEvent {
  eventId: string;
  type: "impression" | "click";
  campaignId: string;
  creativeId: string;
  timestamp: string;
  bidAmount: number;
}

export class IntelligentBiddingAgent {
  protected wallet: Keypair; // Solana Devnet for bidding
  protected mainnetWallet: Keypair; // Solana Mainnet for Freepik
  protected devnetSigner: Promise<Signer>; // x402 Signer for Devnet
  protected mainnetSigner: Promise<Signer>; // x402 Signer for Mainnet
  protected connection: Connection; // Solana Devnet connection
  protected mainnetConnection: Connection; // Solana Mainnet connection
  protected axiosWithPayment: Promise<
    ReturnType<typeof withPaymentInterceptor>
  >; // Solana Devnet
  protected axiosWithMainnetPayment: Promise<
    ReturnType<typeof withPaymentInterceptor>
  >; // Solana Mainnet
  protected agentName: string;
  protected maxBid: number;
  protected serverUrl: string;
  protected isActive: boolean = true;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private auctionEndMonitoringInterval: NodeJS.Timeout | null = null;
  protected model;
  protected bidHistory: BidContext["bidHistory"] = [];
  protected lastRefundAmount?: number;
  protected brandIdentity?: BrandIdentity;
  protected currentAdSpotId: string = "";
  protected lastBidAmount: number = 0;
  protected isInAIReasoning: boolean = false;
  protected refundPending: boolean = false;
  protected dryRun: boolean = false;

  constructor(config: {
    privateKey: string; // Base58 or hex encoded private key
    agentName: string;
    maxBid: number;
    serverUrl: string;
    geminiApiKey: string;
    geminiApiKey: string;
    brandIdentity?: BrandIdentity;
    dryRun?: boolean;
  }) {
    this.agentName = config.agentName;
    this.maxBid = config.maxBid;
    this.serverUrl = config.serverUrl;
    this.brandIdentity = config.brandIdentity;
    this.dryRun = config.dryRun || false;

    if (this.dryRun) {
      console.log(`⚠️ [${this.agentName}] RUNNING IN DRY-RUN MODE: Payments will be simulated.`);
    }

    // Parse private key (support both base58 and hex)
    let secretKey: Uint8Array;
    try {
      // Try base58 first (Solana standard)
      secretKey = bs58.decode(config.privateKey);
    } catch {
      // If that fails, try hex (for compatibility)
      if (config.privateKey.startsWith("0x")) {
        secretKey = new Uint8Array(
          Buffer.from(config.privateKey.slice(2), "hex")
        );
      } else {
        secretKey = new Uint8Array(Buffer.from(config.privateKey, "hex"));
      }
    }

    // Create wallet keypair for BIDDING (Solana Devnet)
    this.wallet = Keypair.fromSecretKey(secretKey);

    // Create wallet keypair for FREEPIK (Solana Mainnet) - same keypair, different network
    this.mainnetWallet = Keypair.fromSecretKey(secretKey);

    // Create Solana connections
    const devnetRpc =
      process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com";
    const mainnetRpc =
      process.env.SOLANA_MAINNET_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

    this.connection = new Connection(devnetRpc, "confirmed");
    this.mainnetConnection = new Connection(mainnetRpc, "confirmed");

    // Create x402 Signers from Solana Keypairs
    // x402's createSigner properly wraps Solana Keypair to match Signer interface
    // createSigner takes (network, privateKey) where network is "solana" or "solana-devnet"
    const devnetPrivateKey = bs58.encode(this.wallet.secretKey);
    const mainnetPrivateKey = bs58.encode(this.mainnetWallet.secretKey);

    this.devnetSigner = createSigner("solana-devnet", devnetPrivateKey);
    this.mainnetSigner = createSigner("solana", mainnetPrivateKey);

    // Create axios client with x402 payment interceptor (Solana Devnet for bidding)
    this.axiosWithPayment = this.devnetSigner.then((signer) =>
      withPaymentInterceptor(
        axios.create({
          headers: { "X-Agent-ID": this.agentName },
        }),
        signer
      )
    );

    // Create axios client for Freepik (Solana Mainnet)
    this.axiosWithMainnetPayment = this.mainnetSigner.then((signer) =>
      withPaymentInterceptor(
        axios.create({
          headers: { "X-Agent-ID": this.agentName },
        }),
        signer
      )
    );

    // Initialize LLM with Google Gemini
    const googleProvider = createGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
    });
    this.model = googleProvider("gemini-1.5-flash");

    console.log(`🧠 ${this.agentName} initialized with AI reasoning (Gemini)`);
    console.log(
      `   Bidding Wallet (Solana Devnet): ${this.wallet.publicKey.toBase58()}`
    );
    console.log(
      `   Freepik Wallet (Solana Mainnet): ${this.mainnetWallet.publicKey.toBase58()}`
    );
  }

  private createGenerateAdImageTool() {
    return tool({
      description:
        "Generate an advertisement image using AI based on a creative prompt. ONLY call this AFTER the auction has ended AND you have won. This generates the actual ad image that will be displayed on the website.",
      parameters: z.object({
        prompt: z
          .string()
          .describe(
            'Detailed creative prompt for the image generation AI. Be specific about visual elements, style, composition, lighting, and mood. Example: "A sleek modern smartphone on a minimalist white desk with soft natural lighting, professional product photography, high detail, clean composition"'
          ),
      }),
      execute: async ({ prompt }: { prompt: string }) => {
        try {
          console.log(
            `\n🎨 [${this.agentName}] Generating ad image with prompt: "${prompt}"`
          );
          console.log(`💰 Using Solana MAINNET wallet for Freepik payment`);

          // Broadcast starting event
          try {
            await axios.post(
              `${this.serverUrl}/api/bid/${this.currentAdSpotId}/image-status`,
              {
                agentId: this.agentName,
                status: "started",
                message: `Generating ad image: "${prompt.substring(
                  0,
                  100
                )}..."`,
              }
            );
          } catch (error) {
            console.warn(`Failed to broadcast image start event:`, error);
          }

          // Call server endpoint (which forwards to Freepik with x402)
          // Use MAINNET axios client for Freepik payments
          const mainnetClient = await this.axiosWithMainnetPayment;
          const response = await mainnetClient.post(
            `${this.serverUrl}/api/generate-ad-image`,
            {
              adSpotId: this.currentAdSpotId,
              agentId: this.agentName,
              prompt: prompt,
            }
          );

          const taskId = response.data.taskId;
          console.log(
            `✅ [${this.agentName}] Image generation task created: ${taskId}`
          );
          console.log(
            `⏳ [${this.agentName}] Polling for image completion (max 2 minutes)...`
          );

          // Broadcast task created event
          try {
            await axios.post(
              `${this.serverUrl}/api/bid/${this.currentAdSpotId}/image-status`,
              {
                agentId: this.agentName,
                status: "progress",
                message: `Image generation in progress... (task: ${taskId})`,
                taskId,
              }
            );
          } catch (e) {
            console.warn(`Failed to broadcast progress event:`, e);
          }

          // Poll our task-status endpoint which checks Freepik API
          let imageUrl = "";
          for (let i = 0; i < 40; i++) {
            await new Promise((resolve) => setTimeout(resolve, 3000));

            try {
              const statusResponse = await axios.get(
                `${this.serverUrl}/api/task-status?task_id=${taskId}`
              );

              // Response structure matches Freepik API: { data: { task_id, status, generated: [] } }
              const taskData = statusResponse.data.data || statusResponse.data;
              const status = taskData.status;
              const generated = taskData.generated;

              // Check completion by looking for images in generated array (same as working examples)
              if (generated && generated.length > 0) {
                imageUrl = generated[0];
                console.log(
                  `\n🎉 [${this.agentName}] Image generated successfully!`
                );
                console.log(`🔗 Image URL: ${imageUrl}`);

                // Broadcast completion event
                try {
                  await axios.post(
                    `${this.serverUrl}/api/bid/${this.currentAdSpotId}/image-status`,
                    {
                      agentId: this.agentName,
                      status: "completed",
                      message: `Ad image generated successfully!`,
                      imageUrl,
                      taskId,
                    }
                  );
                } catch (e) {
                  console.warn(`Failed to broadcast completion event:`, e);
                }

                return `SUCCESS! Image generated and URL stored: ${imageUrl}. The ad image is now ready for display.`;
              } else if (
                status === "FAILED" ||
                status === "failed" ||
                status === "ERROR" ||
                status === "error"
              ) {
                console.error(`❌ [${this.agentName}] Image generation failed`);

                // Broadcast failure event
                try {
                  await axios.post(
                    `${this.serverUrl}/api/bid/${this.currentAdSpotId}/image-status`,
                    {
                      agentId: this.agentName,
                      status: "failed",
                      message: `Image generation failed: ${status}`,
                    }
                  );
                } catch (e) {
                  console.warn(`Failed to broadcast failure event:`, e);
                }

                return `ERROR: Image generation failed. Status: ${status}`;
              }

              // Broadcast periodic progress updates
              if (i % 5 === 0) {
                console.log(`   Status: ${status} (${i * 3}s elapsed)`);
                try {
                  await axios.post(
                    `${this.serverUrl}/api/bid/${this.currentAdSpotId}/image-status`,
                    {
                      agentId: this.agentName,
                      status: "progress",
                      message: `Still generating... ${i * 3
                        }s elapsed (status: ${status})`,
                    }
                  );
                } catch {
                  // Silently ignore broadcast errors
                }
              }
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              const status = (error as { response?: { status?: number } })
                ?.response?.status;
              if (status !== 404) {
                console.error(
                  `⚠️  [${this.agentName}] Error checking status:`,
                  errorMessage
                );
              }
            }
          }

          console.error(
            `❌ [${this.agentName}] Timeout waiting for image generation`
          );

          // Broadcast timeout event
          try {
            await axios.post(
              `${this.serverUrl}/api/bid/${this.currentAdSpotId}/image-status`,
              {
                agentId: this.agentName,
                status: "failed",
                message: `Timeout waiting for image generation (2 minutes)`,
              }
            );
          } catch (e) {
            console.warn(`Failed to broadcast timeout event:`, e);
          }

          return `ERROR: Timeout waiting for image generation after 2 minutes`;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `❌ [${this.agentName}] Image generation error:`,
            errorMessage
          );

          // Broadcast error event
          try {
            await axios.post(
              `${this.serverUrl}/api/bid/${this.currentAdSpotId}/image-status`,
              {
                agentId: this.agentName,
                status: "failed",
                message: `Error: ${errorMessage}`,
              }
            );
          } catch (e) {
            console.warn(`Failed to broadcast error event:`, e);
          }

          return `ERROR: ${errorMessage}`;
        }
      },
    });
  }

  private createBiddingTools() {
    const getBalanceTool = tool({
      description: "Returns your current USDC balance and maximum bid limit",
      parameters: z.object({}),
      execute: async () => {
        console.log(`\n💵 [${this.agentName}] Checking balance...`);
        const balance = await this.getUSDCBalance();
        const result = {
          success: true,
          data: {
            balance,
            maxBid: this.maxBid,
          },
        };
        console.log(
          `✅ [${this.agentName}] Balance retrieved:`,
          JSON.stringify(result)
        );
        return JSON.stringify(result);
      },
    });

    const getAuctionStateTool = tool({
      description:
        "Returns the current state of the auction including current bid, winner, time remaining, and bid history. The adSpotId parameter is optional - if not provided, uses the current auction.",
      parameters: z.object({
        adSpotId: z
          .string()
          .optional()
          .describe("The adSpotId being auctioned (optional)"),
      }),
      execute: async ({ adSpotId }: { adSpotId?: string }) => {
        // Use the provided adSpotId or fall back to current ad spot
        const spotId = adSpotId || this.currentAdSpotId;
        console.log(
          `\n🔍 [${this.agentName}] Fetching auction state for ${spotId}...`
        );
        try {
          const response = await axios.get(
            `${this.serverUrl}/api/status?adSpotId=${encodeURIComponent(
              spotId
            )}`
          );

          const data = response.data;

          // Transform to expected format
          const result = {
            success: true,
            data: {
              winningBid: data.currentBid || 0,
              winningBidder: data.currentWinner?.agentId || null,
              timeRemaining: data.timeRemaining
                ? `${Math.floor(data.timeRemaining / 60)}:${(
                  data.timeRemaining % 60
                )
                  .toString()
                  .padStart(2, "0")}`
                : null,
              bidHistory: data.bidHistory || [],
            },
          };
          console.log(
            `✅ [${this.agentName}] Auction state retrieved:`,
            JSON.stringify(result)
          );
          return JSON.stringify(result);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `❌ [${this.agentName}] Failed to get auction state:`,
            errorMessage
          );
          return JSON.stringify({ success: false, error: errorMessage });
        }
      },
    });

    const placeBidTool = tool({
      description:
        "CRITICAL: This tool MUST be executed to actually place a bid. Do NOT simulate or guess the response. This makes a real HTTP request with payment to place your bid on the blockchain. Returns one of: 1) success=true if bid accepted, 2) proposalRejected=true if your amount is too low (you MUST bid higher or withdraw), 3) overBudget=true if you exceeded your max budget (you MUST withdraw using the withdraw tool), 4) needsNegotiation=true if payment is required. ALWAYS check the actual response and adjust accordingly. If you get overBudget or cannot afford to continue, you MUST call the withdraw tool to exit gracefully. The adSpotId parameter is optional - if not provided, uses the current auction.",
      parameters: z.object({
        adSpotId: z
          .string()
          .optional()
          .describe("The adSpotId to bid on (optional)"),
        proposedAmount: z
          .number()
          .describe("The amount you want to bid in USDC"),
        reasoning: z
          .string()
          .describe("Your strategic reasoning for this bid amount"),
      }),
      execute: async ({ adSpotId, proposedAmount, reasoning }: { adSpotId?: string; proposedAmount: number; reasoning: string }) => {
        try {
          // Use the provided adSpotId or fall back to current ad spot
          const spotId = adSpotId || this.currentAdSpotId;

          // BUDGET VALIDATION: Check if bid exceeds maximum budget
          const maxAllowedBid = this.maxBid - 0.08; // Reserve for image generation
          if (proposedAmount > maxAllowedBid) {
            console.log(
              `❌ [${this.agentName}] Bid ${proposedAmount.toFixed(
                2
              )} exceeds max budget ${maxAllowedBid.toFixed(2)}`
            );
            return JSON.stringify({
              success: false,
              overBudget: true,
              proposedAmount: proposedAmount,
              maxAllowedBid: maxAllowedBid,
              totalBudget: this.maxBid,
              message: `Your proposed bid of $${proposedAmount.toFixed(
                2
              )} exceeds your maximum budget of $${maxAllowedBid.toFixed(
                2
              )} (total budget: $${this.maxBid
                }, minus $0.08 for image generation). You must EITHER bid less OR use the withdraw tool to exit the auction.`,
            });
          }

          console.log(`\n💭 [${this.agentName}] Thinking: ${reasoning}`);
          console.log(
            `💰 [${this.agentName}] Proposing bid: $${proposedAmount.toFixed(
              2
            )}`
          );
          console.log(
            `🌐 [${this.agentName}] Sending to: ${this.serverUrl}/api/bid/${spotId}`
          );

          // First request with proposed bid (no payment yet)
          const devnetClient = await this.axiosWithPayment;
          const response = await devnetClient.post(
            `${this.serverUrl}/api/bid/${spotId}`,
            {
              thinking: reasoning,
              strategy: "intelligent",
            },
            {
              headers: {
                "X-Proposed-Bid": proposedAmount.toString(),
                "X-Strategy-Reasoning": reasoning,
              },
            }
          );

          console.log(
            `📡 [${this.agentName}] Server response status: ${response.status}`
          );
          console.log(
            `📡 [${this.agentName}] Server response data:`,
            JSON.stringify(response.data)
          );

          if (response.status === 200 && response.data.success) {
            // Track the bid amount we just placed
            this.lastBidAmount = response.data.currentBid;

            const result = {
              success: true,
              data: {
                message: `Bid accepted at $${response.data.currentBid}`,
                currentBid: response.data.currentBid,
                auctionEndsIn: response.data.auctionEndsIn,
                transactionHash: response.data.transactionHash,
              },
            };
            console.log(
              `✅ [${this.agentName}] Returning success:`,
              JSON.stringify(result)
            );
            return JSON.stringify(result);
          }

          return JSON.stringify({ success: false, message: "Bid failed" });
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const axiosError = error as {
            response?: { status?: number; data?: unknown };
          };
          console.error(
            `❌ [${this.agentName}] Bid request error:`,
            errorMessage
          );
          console.error(`   Status:`, axiosError.response?.status);
          console.error(`   Data:`, axiosError.response?.data);

          // Handle 400 Bad Request (proposal rejected as too low)
          if (axiosError.response?.status === 400) {
            const rejection = axiosError.response.data as {
              negotiation?: {
                yourProposal?: number;
                minimumToWin?: number;
                currentBid?: number;
                message?: string;
                suggestion?: number;
              };
            };
            return JSON.stringify({
              success: false,
              proposalRejected: true,
              yourProposal: rejection.negotiation?.yourProposal || null,
              minimumRequired: rejection.negotiation?.minimumToWin || null,
              currentBid: rejection.negotiation?.currentBid || null,
              message: rejection.negotiation?.message || "Proposal too low",
              suggestion: rejection.negotiation?.suggestion || null,
            });
          }

          // Handle 402 Payment Required (needs payment)
          if (axiosError.response?.status === 402) {
            const paymentReq = axiosError.response.data as {
              negotiation?: {
                minimumToWin?: number;
                currentBid?: number;
                message?: string;
                suggestion?: number;
              };
            };
            return JSON.stringify({
              success: false,
              needsNegotiation: true,
              minimumRequired: paymentReq.negotiation?.minimumToWin || null,
              currentBid: paymentReq.negotiation?.currentBid || null,
              message:
                paymentReq.negotiation?.message || "Negotiation required",
              suggestion: paymentReq.negotiation?.suggestion || null,
            });
          }

          return JSON.stringify({ success: false, message: errorMessage });
        }
      },
    });

    const createMockCampaignTool = tool({
      description: "Create a new ad campaign on the internal ad network.",
      parameters: z.object({
        name: z.string().describe("Campaign name"),
        budget: z.number().describe("Total budget for this campaign"),
        goals: z.array(z.string()).describe("List of campaign goals (e.g., 'brand_awareness', 'conversions')"),
        bidStrategy: z.string().describe("Bidding strategy (e.g., 'cpc', 'cpm')"),
      }),
      execute: async ({ name, budget, goals, bidStrategy }: { name: string; budget: number; goals: string[]; bidStrategy: string }) => {
        const campaignId = `camp_${Math.random().toString(36).substring(7)}`;
        console.log(`\n📢 [${this.agentName}] Creating Mock Campaign: ${name} (${campaignId})`);
        console.log(`   Budget: $${budget}, Strategy: ${bidStrategy}`);
        return JSON.stringify({ success: true, campaignId, status: "active", details: { name, budget, goals } });
      },
    });

    const updateMockCampaignTool = tool({
      description: "Update an existing campaign's parameters (bids, budget, creative).",
      parameters: z.object({
        campaignId: z.string().describe("The ID of the campaign to update"),
        updates: z.object({
          bidAmount: z.number().optional(),
          budget: z.number().optional(),
          creativeId: z.string().optional(),
          status: z.enum(["active", "paused", "stopped"]).optional(),
        }).describe("Parameters to update"),
        reasoning: z.string().describe("Why are you making these updates?"),
      }),
      execute: async ({ campaignId, updates, reasoning }: { campaignId: string; updates: { bidAmount?: number; budget?: number; creativeId?: string; status?: "active" | "paused" | "stopped" }; reasoning: string }) => {
        console.log(`\n🔄 [${this.agentName}] Updating Campaign ${campaignId}`);
        console.log(`   Reasoning: ${reasoning}`);
        console.log(`   Updates: ${JSON.stringify(updates)}`);
        return JSON.stringify({ success: true, campaignId, updatedFields: Object.keys(updates) });
      },
    });

    const fetchStatsTool = tool({
      description: "Fetch performance statistics for a campaign.",
      parameters: z.object({
        campaignId: z.string().describe("The campaign ID"),
      }),
      execute: async ({ campaignId }: { campaignId: string }) => {
        // Mock data usually returns valid stats
        const stats = {
          impressions: Math.floor(Math.random() * 10000),
          clicks: Math.floor(Math.random() * 500),
          ctr: (Math.random() * 0.05).toFixed(4),
          spend: (Math.random() * 50).toFixed(2),
          conversions: Math.floor(Math.random() * 20),
        };
        console.log(`\n📊 [${this.agentName}] Stats for ${campaignId}: ${JSON.stringify(stats)}`);
        return JSON.stringify({ success: true, campaignId, stats });
      },
    });

    const openX402SessionTool = tool({
      description: "Open a secure x402 payment session for a service.",
      parameters: z.object({
        serviceId: z.string().describe("The service identifier (e.g., 'freepik-gen', 'firecrawl-scrape')"),
        budgetCap: z.number().describe("Max spend allowed in this session"),
      }),
      execute: async ({ serviceId, budgetCap }: { serviceId: string; budgetCap: number }) => {
        const sessionId = `x402_sess_${Math.random().toString(36).substring(7)}`;
        console.log(`\n💳 [${this.agentName}] Opening x402 Session for ${serviceId}`);
        console.log(`   Cap: $${budgetCap}, Session: ${sessionId}`);
        return JSON.stringify({ success: true, sessionId, status: "open", remainingBudget: budgetCap });
      },
    });

    const payPerEventTool = tool({
      description: "Execute a micropayment for a specific event/action within a session.",
      parameters: z.object({
        sessionId: z.string().describe("Active x402 session ID"),
        amount: z.number().describe("Amount to pay"),
        eventType: z.string().describe("Type of event being paid for (e.g., 'impression', 'api_call')"),
        simulate: z.boolean().optional().describe("If true, simulates payment without actual cost (for dry runs)"),
      }),
      execute: async ({ sessionId, amount, eventType, simulate }: { sessionId: string; amount: number; eventType: string; simulate?: boolean }) => {
        if (simulate || this.dryRun) {
          console.log(`\n🧪 [${this.agentName}] SIMULATED x402 Payment: $${amount} for ${eventType}`);
          console.log(`   Session: ${sessionId}`);
          console.log(`   (No actual funds were transferred)`);
          return JSON.stringify({ success: true, txHash: `0xSIMULATED_${Math.random().toString(16).substring(2)}`, status: "settled", simulated: true });
        }

        console.log(`\n💸 [${this.agentName}] x402 Payment: $${amount} for ${eventType}`);
        console.log(`   Session: ${sessionId}`);
        return JSON.stringify({ success: true, txHash: `0x${Math.random().toString(16).substring(2)}`, status: "settled" });
      },
    });

    const logActionTool = tool({
      description: "Log an action or decision for explainability/debugging.",
      parameters: z.object({
        actionType: z.string(),
        details: z.string(),
        reasoning: z.string(),
      }),
      execute: async ({ actionType, details, reasoning }: { actionType: string; details: string; reasoning: string }) => {
        console.log(`\n📝 [${this.agentName}] LOG: [${actionType}] ${details}`);
        console.log(`   Reasoning: ${reasoning}`);
        return JSON.stringify({ success: true, logged: true });
      },
    });

    // Convert array to object (ToolSet) for Vercel AI SDK
    return {
      get_my_balance: getBalanceTool,
      get_auction_state: getAuctionStateTool,
      place_bid: placeBidTool,
      create_mock_campaign: createMockCampaignTool,
      update_mock_campaign: updateMockCampaignTool,
      fetch_stats: fetchStatsTool,
      open_x402_session: openX402SessionTool,
      pay_per_event: payPerEventTool,
      log_action: logActionTool,
    };
  }

  async getUSDCBalance(): Promise<number> {
    try {
      const usdcMint = new PublicKey(SOLANA_DEVNET_USDC);
      const tokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        this.wallet.publicKey
      );
      const accountInfo = await getAccount(this.connection, tokenAccount);

      // USDC has 6 decimals
      return Number(accountInfo.amount) / 1_000_000;
    } catch {
      // Token account doesn't exist, balance is 0
      return 0;
    }
  }

  async planCampaign(details: CampaignDetails): Promise<void> {
    console.log(`\n📋 [${this.agentName}] Planning campaign for: ${details.campaignName}`);

    const prompt = `
You are an expert AdOps Campaign Manager.
A new campaign has been created with the following details:

Name: ${details.campaignName}
Product description: ${details.productDescription}
Objective: ${details.objective}
Target audience: ${details.audienceDescription}
Total budget: $${details.budgetTotal}
Daily budget: $${details.budgetDaily}

Step 1: Produce a media plan JSON with:
channels[]: name, budget_share (0–1), bid_strategy (cpc or cpm), max_bid.
creative_variants[]: headline, body, cta, target_url.

Step 2: For each channel, use the 'create_mock_campaign' tool to initialize it.
Step 3: Use the 'log_action' tool to explain your media mix choices.

Constraint: Total budget_share must sum to 1.0 across all channels.
`;

    try {
      // Reuse the existing tool creation method but we only need a subset ideally,
      // but for simplicity we can expose the relevant ones.
      // We need create_mock_campaign and log_action.
      const tools = this.createBiddingTools();

      console.log(`\n🧠 [${this.agentName}] Generating media plan...`);
      const response = await generateText({
        model: this.model,
        tools: tools,
        prompt: prompt,
        maxSteps: 10, // Allow multi-step for creating multiple campaigns
      });

      console.log(`\n✅ [${this.agentName}] Campaign planning complete.`);
      console.log(response.text);
    } catch (error) {
      console.error(`❌ [${this.agentName}] Campaign planning failed:`, error);
    }
  }

  async optimizeCampaign(context: OptimizationContext): Promise<void> {
    console.log(`\n🧠 [${this.agentName}] Optimizing campaign ${context.campaignId}...`);

    // Construct the optimization prompt
    const prompt = `
You are in optimization mode for campaign ${context.campaignId}.
Here are the latest stats and state:

Current time: ${context.now}
Remaining total budget: $${context.remainingBudget}

Per-channel stats (JSON):
${context.statsJson}

Active creatives (JSON):
${context.creativesJson}

Previous actions taken (JSON):
${context.recentActionsJson}

Your task:
Analyze performance (CTR, CPC, conversions).
Decide what to do this cycle: pause weak creatives, raise/lower bids, shift budget between channels, or generate at most 2 new creative variants.

Execute via tools: update_mock_campaign, create_mock_campaign.
Log your reasoning with log_action.

Hard constraints:
- Never push total expected spend above remaining_budget ($${context.remainingBudget}).
- Never increase any bid above reasonable market rates.
- Never increase any bid above reasonable market rates.
- If data is too noisy or insufficient, make no-op adjustments and log that decision.
${this.dryRun ? "- DRY RUN ACTIVE: Always set 'simulate: true' when calling pay_per_event. Explain in log_action that this is a simulation." : ""}
`;

    try {
      const tools = this.createBiddingTools();

      // Add generate_ad_image tool for optimization phase if needed
      // Note: In strict mode we probably wouldn't want to call mainnet image gen during optimization 
      // without user approval, but for this mock workflow it maps to the user's request "generate at most 2 new creative variants"
      // We'll stick to 'tools' which has mock campaign tools. 
      // The user request mentions "any creative tools" - we'll assume updated mock campaign handles creative ID swaps
      // or we could add a specific mock creative tool if needed. For now standard tools are sufficient.

      const response = await generateText({
        model: this.model,
        tools: tools,
        prompt: prompt,
        maxSteps: 10
      });

      console.log(`\n✅ [${this.agentName}] Optimization cycle complete.`);
      console.log(response.text);

    } catch (error) {
      console.error(`❌ [${this.agentName}] Optimization failed:`, error);
    }
  }

  async processEventPayment(event: AdEvent): Promise<{ success: boolean; message: string; txHash?: string }> {
    console.log(`\n💸 [${this.agentName}] Processing payment for event: ${event.type} (${event.eventId})`);

    const SAFETY_THRESHOLD = 10.0; // Hard safety cap for a single event

    // 1. Calculate Fair Amount (simplistic validation)
    // Ensure the event bid provided matches or is lower than what we expect.
    // In a real system we might cross-reference with active bids in a DB.
    // Here we trust the input but validate it against our max caps.
    const fairAmount = event.bidAmount;

    // 2. Safety Constraint Check
    if (fairAmount > this.maxBid) {
      const msg = `PAYMENT BLOCKED: Amount $${fairAmount} exceeds agent max bid $${this.maxBid}`;
      console.error(`❌ [${this.agentName}] ${msg}`);
      await this.logAction("payment_blocked", msg, "Safety violation");
      return { success: false, message: msg };
    }

    if (fairAmount > SAFETY_THRESHOLD) {
      const msg = `PAYMENT BLOCKED: Amount $${fairAmount} exceeds safety threshold $${SAFETY_THRESHOLD}`;
      console.error(`❌ [${this.agentName}] ${msg}`);
      await this.logAction("payment_blocked", msg, "Safety violation");
      return { success: false, message: msg };
    }

    // 3. Budget Check
    // We would need to fetch the current remaining budget relative to the campaign ideally.
    // For this method, we'll fetch the wallet balance as a proxy for 'remaining funds' 
    // or rely on a passed-in check. Let's start with wallet balance check.
    const currentBalance = await this.getUSDCBalance();

    // In a real campaign contexts, we also check specific campaign budget allocation.
    // Assuming 'fairAmount' is the cost.

    if (currentBalance < fairAmount) {
      const msg = `PAYMENT FAILED: Insufficient funds. Balance: $${currentBalance}, Needed: $${fairAmount}`;
      console.error(`❌ [${this.agentName}] ${msg}`);
      await this.logAction("payment_failed", msg, "Insufficient funds");
      return { success: false, message: msg };
    }

    // 4. Execute Payment (Simulation)
    // In strict mode, we would call the x402 payment tool or logic here.
    // re-using payPerEvent logic but programmatically.
    try {
      console.log(`   ✅ Validated. Executing payment of $${fairAmount}...`);

      // Simulating the transaction execution
      const mockTxHash = `0x${Math.random().toString(16).substring(2)}`;

      // Log the successful payment linked to metadata
      await this.logAction(
        "payment_sent",
        `Paid $${fairAmount} for ${event.type}`,
        `Campaign: ${event.campaignId}, Creative: ${event.creativeId}, Event: ${event.eventId}`
      );

      console.log(`   🎉 Payment successful! Tx: ${mockTxHash}`);
      return { success: true, message: "Payment settled", txHash: mockTxHash };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [${this.agentName}] Payment execution error:`, errorMessage);
      return { success: false, message: errorMessage };
    }
  }

  // Helper just for internal logging
  private async logAction(actionType: string, details: string, reasoning: string) {
    // Direct console log for now as 'tool' logic might be complex to call internally without 'callTool' wrapper from AI SDK
    // But we can replicate the side effect:
    console.log(`\n📝 [${this.agentName}] LOG: [${actionType}] ${details}`);
    console.log(`   Reasoning: ${reasoning}`);
  }

  async decideBidStrategy(adSpotId: string): Promise<void> {
    try {
      // Clear refund pending flag at start of new decision
      this.refundPending = false;
      this.isInAIReasoning = true;

      const balance = await this.getUSDCBalance();

      // START monitoring BEFORE the AI chat begins
      // This ensures we catch refunds that arrive during reflection
      await this.startRefundMonitoring(adSpotId);

      const refundContext = this.lastRefundAmount
        ? `\n\n🚨 URGENT: You were just outbid! You received a refund of $${this.lastRefundAmount.toFixed(
          2
        )} USDC. This means another agent bid higher than you. You MUST respond quickly or risk losing this valuable ad spot! Analyze why you lost and adjust your strategy immediately.`
        : "";

      const brandContext = this.brandIdentity
        ? `You are the marketing AI for ${this.brandIdentity.brandName}, representing ${this.brandIdentity.productName}.

Brand Identity:
- Product: ${this.brandIdentity.productName} - ${this.brandIdentity.productDescription}
- Industry: ${this.brandIdentity.industry}
- Target Audience: ${this.brandIdentity.targetAudience}
- Brand Personality: ${this.brandIdentity.brandPersonality}
- Marketing Angle: ${this.brandIdentity.marketingAngle}
- Visual Style: ${this.brandIdentity.visualStyle}

Your Mission: Win valuable ad space to promote ${this.brandIdentity.productName} and reach your target audience (${this.brandIdentity.targetAudience}).`
        : `You are ${this.agentName}, an autonomous advertising agent competing for ad space on a website.`;

      const prompt = `${brandContext}

Your Goal: Win the ad spot auction "${adSpotId}" by placing strategic marketing bids.

Available Tools (for bidding only):
1. get_my_balance - Check your USDC balance
2. get_auction_state - See current bid and auction status (includes timeRemaining)
3. place_bid - Place a bid for the ad spot (costs USDC on Solana Devnet)
4. withdraw - Withdraw from auction if not worth continuing
5. create_mock_campaign - Initialize internal tracking
6. update_mock_campaign - Adjust parameters
7. fetch_stats - Check performance
8. open_x402_session - Manage payment sessions
9. pay_per_event - Execute payments
10. log_action - Record your reasoning (USE THIS FREQUENTLY)

Note: generate_ad_image tool is NOT available during bidding - you will receive a separate prompt for image generation AFTER winning.

Total Marketing Budget: $${this.maxBid.toFixed(2)} USDC
- Ad spot bidding: Up to ~$${(this.maxBid - 0.08).toFixed(
        2
      )} USDC (Solana Devnet)
- Creative production: ~$0.08 USDC (Solana Mainnet - for winning ad image)
- Current wallet balance: $${balance.toFixed(2)} USDC

⚠️  IMPORTANT: Your TOTAL budget is $${this.maxBid.toFixed(
        2
      )}. If you win, you'll need ~$0.08 for image generation, so bid strategically to stay within budget!

Bidding Instructions:
1. Use get-auction-state to see the current auction status
2. Use get-my-balance to confirm your funds
3. Analyze the situation:
   - What's the current bid?
   - Who's winning?
   - How much time is left?
   - What's the bidding pattern?
4. Decide on a strategic bid amount and reasoning
5. Use place-bid to submit your bid
6. CRITICAL: Check the response from place-bid:
   - If proposalRejected=true: Your bid was too low. Bid higher or withdraw.
   - If overBudget=true: You exceeded your budget. You MUST call withdraw tool immediately.
   - If success=true: Bid accepted! Provide your strategic analysis.
7. Provide a final strategic analysis of your actions and the outcome

⚠️  ERROR HANDLING - You MUST respond to these situations:
- **proposalRejected**: The server rejected your bid as too low. Check minimumRequired and either bid that amount (if within budget) OR call withdraw tool.
- **overBudget**: You tried to bid more than your max budget ($${(
          this.maxBid - 0.08
        ).toFixed(2)}). You MUST call the withdraw tool - do NOT try to bid again.
- **Payment failed**: If the blockchain payment fails, the tool will return an error. Try again with same or adjusted amount.

Bidding Strategy Options:
- Start conservative to test the waters
- Jump high to intimidate competitors
- Bid just above minimum to save money
- Wait for the right moment
- Bluff with aggressive early bids
- **WITHDRAW** if bid gets too high or exceeds your budget

${refundContext}

⚠️  CRITICAL - Image Generation Timing:
- NEVER call generate_ad_image during your bidding strategy
- DO NOT call generate_ad_image after placing a bid, even if you are winning
- The monitorAuctionEnd system will automatically trigger image generation when the auction ends
- You will receive a separate prompt ONLY when it's time to generate the image
- Your ONLY job right now is to place strategic bids or withdraw

After the Auction ENDS (you will get a new prompt):
- You will be notified with a "CONGRATULATIONS!" message
- ONLY THEN should you call generate_ad_image to create your ${this.brandIdentity ? "brand advertisement" : "advertisement"
        }
${this.brandIdentity
          ? `- Follow your brand guidelines: ${this.brandIdentity.visualStyle}
- Emphasize: ${this.brandIdentity.marketingAngle}
- Appeal to: ${this.brandIdentity.targetAudience}
- Showcase your product: ${this.brandIdentity.productName}`
          : "- Be creative with your image prompt - this is your chance to shine!"
        }
- Your ad will be displayed on the website for all visitors to see
- This is a key marketing opportunity to ${this.brandIdentity
          ? `promote ${this.brandIdentity.productName} and build brand awareness`
          : "attract attention"
        }

TOOL USAGE RULES:
- Prefer tool calls over free-form text for ANY state change or payment.
- Use 'log_action' to explain your strategy instead of just outputting text.
- If you are deciding to bid, use 'place_bid'.
- If you are modifying your internal tracking, use 'update_mock_campaign'.

Think step by step and make your move!`;

      console.log(`\n🧠 [${this.agentName}] Starting AI reasoning...`);

      // Notify server that agent is actively thinking
      try {
        await axios.post(`${this.serverUrl}/api/agent-status/${adSpotId}`, {
          agentId: this.agentName,
          status: "thinking",
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Non-critical, continue even if this fails
      }

      const tools = this.createBiddingTools();
      const response = await generateText({
        model: this.model,
        tools,
        prompt,
        maxSteps: 10,
      });

      console.log(`\n✅ [${this.agentName}] AI decision complete`);
      console.log(response.text);

      // Check if agent decided NOT to bid (by looking for keywords in response)
      const lowerResponse = response.text.toLowerCase();
      const decidedNotToBid =
        lowerResponse.includes("not to place") ||
        lowerResponse.includes("decided not to bid") ||
        lowerResponse.includes("not placing a bid") ||
        lowerResponse.includes("withdrawing from") ||
        lowerResponse.includes("accept this loss") ||
        lowerResponse.includes("cannot continue bidding") ||
        lowerResponse.includes("cannot continue to bid") ||
        lowerResponse.includes("unable to continue") ||
        lowerResponse.includes("unable to bid") ||
        lowerResponse.includes("withdraw from") ||
        lowerResponse.includes("preserve our budget") ||
        lowerResponse.includes("exceeds our budget") ||
        lowerResponse.includes("exceeds our total budget") ||
        lowerResponse.includes("over budget") ||
        lowerResponse.includes("overbudget") ||
        lowerResponse.includes("exceed my budget") ||
        lowerResponse.includes("beyond my budget") ||
        lowerResponse.includes("decision is to withdraw") ||
        lowerResponse.includes("must withdraw");

      if (decidedNotToBid) {
        console.log(
          `\n🏳️ [${this.agentName}] Decided to withdraw from auction`
        );

        // Request refund from server
        try {
          const refundResponse = await axios.post(
            `${this.serverUrl}/api/refund-request/${adSpotId}`,
            {
              agentId: this.agentName,
              walletAddress: this.wallet.publicKey.toBase58(),
              reasoning: response.text,
            }
          );

          console.log(
            `✅ [${this.agentName}] Withdrawal processed:`,
            refundResponse.data.message
          );

          if (refundResponse.data.auctionEnded) {
            console.log(
              `🏁 [${this.agentName}] Auction has ended. Opponent won!`
            );
            this.isActive = false;
            this.stopRefundMonitoring();
            return;
          }
        } catch (error: unknown) {
          const axiosError = error as {
            response?: { data?: { error?: string } };
          };
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `❌ [${this.agentName}] Withdrawal failed:`,
            axiosError.response?.data?.error || errorMessage
          );
        }
      } else {
        // Extract and send the reflection from the response
        const reflection = response.text;
        if (reflection && reflection.length > 50) {
          try {
            await axios.post(
              `${this.serverUrl}/api/bid/${adSpotId}/reflection`,
              {
                agentId: this.agentName,
                reflection: reflection,
              }
            );
            console.log(
              `📝 [${this.agentName}] Reflection submitted to server`
            );
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.error(
              `❌ [${this.agentName}] Failed to submit reflection:`,
              errorMessage
            );
          }
        }

        // Monitoring already started before AI chat (line 610)
        // No need to start again here
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const axiosError = error as { response?: { status?: number } };
      console.error(`❌ [${this.agentName}] AI reasoning error:`, errorMessage);

      // Fallback to simple bid if AI fails
      if (axiosError.response?.status === 410) {
        console.log(`🏁 [${this.agentName}] Auction ended`);
        this.isActive = false;
        this.stopRefundMonitoring();
      }
    } finally {
      // Mark that we're done with AI reasoning
      this.isInAIReasoning = false;

      // Check if a refund arrived while we were thinking
      if (this.refundPending && this.isActive) {
        console.log(
          `\n⚡ [${this.agentName}] Refund was received during analysis! Immediately re-evaluating...`
        );
        this.refundPending = false;

        // Immediately re-evaluate without delay since we were outbid
        setImmediate(() => {
          if (this.isActive) {
            this.decideBidStrategy(this.currentAdSpotId);
          }
        });
      }
    }
  }

  async startRefundMonitoring(adSpotId: string) {
    if (this.monitoringInterval) {
      return;
    }

    console.log(`👀 [${this.agentName}] Monitoring for refunds...`);

    // Get initial balance BEFORE starting interval to establish correct baseline
    let previousBalance = await this.getUSDCBalance();
    console.log(`   📊 Baseline balance: ${previousBalance.toFixed(2)} USDC`);

    this.monitoringInterval = setInterval(async () => {
      if (!this.isActive) {
        this.stopRefundMonitoring();
        return;
      }

      const currentBalance = await this.getUSDCBalance();

      if (currentBalance > previousBalance) {
        const refundAmount = currentBalance - previousBalance;

        console.log(
          `\n🔔 [${this.agentName}] REFUND DETECTED: ${refundAmount.toFixed(
            2
          )} USDC`
        );

        // Check if we're still the winning bidder
        // If we are, this refund is from our own bid upgrade - ignore it
        try {
          const response = await axios.get(
            `${this.serverUrl}/api/status?adSpotId=${adSpotId}`
          );
          const state = response.data;

          const currentWinner =
            state.currentWinner?.agentId || state.currentWinner;

          if (currentWinner === this.agentName) {
            console.log(
              `   ✅ Still winning! This was a refund from my own bid upgrade. Continuing to monitor...`
            );
            previousBalance = currentBalance;
            return;
          }

          // We're not winning - we were actually outbid!
          this.lastRefundAmount = refundAmount;
          console.log(
            `   ❌ I've been outbid! Time to reconsider my strategy... 🤔`
          );

          this.stopRefundMonitoring();

          // Check if we're currently in AI reasoning (e.g., writing reflection)
          if (this.isInAIReasoning) {
            console.log(
              `   ⚠️  Currently analyzing previous bid - will respond immediately after!`
            );
            this.refundPending = true;
            // The finally block in decideBidStrategy will handle immediate re-evaluation
          } else {
            // Not currently thinking, so start new evaluation with small delay
            const delay = Math.random() * (3000 - 1000) + 1000;
            console.log(
              `⏳ [${this.agentName}] Thinking for ${Math.floor(
                delay / 1000
              )}s...`
            );

            setTimeout(() => {
              if (this.isActive) {
                this.decideBidStrategy(adSpotId);
              }
            }, delay);
          }
        } catch (error) {
          console.error(
            `❌ [${this.agentName}] Failed to check auction state:`,
            error
          );
        }
      }

      previousBalance = currentBalance;
    }, 2000);
  }

  stopRefundMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log(`🛑 [${this.agentName}] Stopped refund monitoring`);
    }
  }

  monitorAuctionEnd(adSpotId: string) {
    if (this.auctionEndMonitoringInterval) {
      return; // Already monitoring
    }

    console.log(`👀 [${this.agentName}] Monitoring for auction end...`);

    this.auctionEndMonitoringInterval = setInterval(async () => {
      try {
        // Get auction state
        const response = await axios.get(
          `${this.serverUrl}/api/status?adSpotId=${adSpotId}`
        );
        const state = response.data;

        // Check if auction ended and this agent won
        if (
          state.auctionEnded &&
          state.currentWinner?.agentId === this.agentName
        ) {
          // Check if we already generated an image
          if (!state.winnerAdImage?.url) {
            console.log(
              `\n🎉 [${this.agentName}] WE WON THE AUCTION! Generating ad image...`
            );

            // Stop all monitoring
            this.stopRefundMonitoring();
            this.stopAuctionEndMonitoring();

            // Ask LLM to generate creative prompt and call generate_ad_image tool
            const brandGuidedPrompt = this.brandIdentity
              ? `🎉 CONGRATULATIONS! You just won the ad spot auction "${adSpotId}" for ${this.brandIdentity.brandName
              }!

Now it's time to create a compelling advertisement for ${this.brandIdentity.productName
              } that will be displayed on the website.

Your Brand Guidelines:
- Product: ${this.brandIdentity.productName} - ${this.brandIdentity.productDescription
              }
- Target Audience: ${this.brandIdentity.targetAudience}
- Brand Personality: ${this.brandIdentity.brandPersonality}
- Marketing Angle: ${this.brandIdentity.marketingAngle}
- Visual Style: ${this.brandIdentity.visualStyle}
- Key Messages: ${this.brandIdentity.keyMessages.join(", ")}

Your task:
1. Create an advertisement concept that embodies your brand personality and appeals to your target audience
2. Craft a detailed image generation prompt that includes:
   - Your product (${this.brandIdentity.productName})
   - Visual style matching your brand (${this.brandIdentity.visualStyle})
   - Elements that convey your marketing angle (${this.brandIdentity.marketingAngle
              })
   - Atmosphere that resonates with ${this.brandIdentity.targetAudience}
3. Call the generate_ad_image tool with your brand-aligned creative prompt

Make it authentic to ${this.brandIdentity.brandName
              }! This ad should clearly communicate what ${this.brandIdentity.productName
              } is and why your target audience should care.`
              : `🎉 CONGRATULATIONS! You just won the ad spot auction "${adSpotId}"!

Now it's time to create an amazing advertisement image that will be displayed on the website for all visitors to see.

Your task:
1. Think of a creative, eye-catching concept for your ad image
2. Create a detailed, descriptive prompt for the image generation AI
3. Call the generate_ad_image tool with your creative prompt

Make it memorable! This is your chance to showcase your brand and creativity to the world.

Example prompts for inspiration:
- "A futuristic tech startup office with holographic displays showing data visualizations, diverse team collaborating happily, bright natural lighting, professional photography style"
- "An eco-friendly bamboo product floating in a lush green rainforest with morning mist and sunbeams, product photography, high detail"
- "A sleek luxury sports car driving through a neon-lit cyberpunk city at night with wet reflections on the street, cinematic lighting"

Be creative and specific! What will your winning ad look like?`;

            const prompt = brandGuidedPrompt;

            // Generate image using Vercel AI SDK
            const imageGenTool = this.createGenerateAdImageTool();
            const response = await generateText({
              model: this.model,
              tools: {
                generate_ad_image: imageGenTool,
              },
              prompt,
              maxSteps: 5,
            });
            console.log(
              `✨ [${this.agentName}] Image generation response:`,
              response.text
            );

            this.isActive = false;
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `❌ [${this.agentName}] Error monitoring auction end:`,
          errorMessage
        );
      }
    }, 5000); // Check every 5 seconds
  }

  stopAuctionEndMonitoring() {
    if (this.auctionEndMonitoringInterval) {
      clearInterval(this.auctionEndMonitoringInterval);
      this.auctionEndMonitoringInterval = null;
      console.log(`🛑 [${this.agentName}] Stopped auction end monitoring`);
    }
  }

  async start(adSpotId: string) {
    console.log(
      `\n🚀 [${this.agentName}] Starting intelligent bidding for ${adSpotId}`
    );

    this.currentAdSpotId = adSpotId;

    const balance = await this.getUSDCBalance();
    console.log(
      `💵 [${this.agentName}] Initial balance: ${balance.toFixed(2)} USDC`
    );

    // Start monitoring for auction end (to auto-generate image when winning)
    this.monitorAuctionEnd(adSpotId);

    await this.decideBidStrategy(adSpotId);
  }

  stop() {
    console.log(`🛑 [${this.agentName}] Stopping agent...`);
    this.isActive = false;
    this.stopRefundMonitoring();
    this.stopAuctionEndMonitoring();
  }
}
