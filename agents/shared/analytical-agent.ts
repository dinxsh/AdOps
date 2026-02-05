import { IntelligentBiddingAgent } from "./intelligent-agent";
import type { BrandIdentity } from "./intelligent-agent";
import { Hex } from "viem";
import { broadcastEvent } from "../../lib/events";
import { generateText } from "ai";

interface SiteAnalysisResult {
  content: string;
  metadata: {
    title?: string;
    description?: string;
    keywords?: string;
  };
  topics: string[];
  relevanceScore: number; // 0-10
  audienceMatch: string; // Description of audience
}

interface AnalyticsData {
  site: {
    monthlyVisits: number;
    dailyAverage: number;
    avgSessionDuration: string;
    bounceRate: string;
  };
  demographics: {
    audienceType: string;
    primaryAge: string;
    topCountries: Array<{ country: string; percentage: number }>;
  };
  adSpots: {
    [key: string]: {
      adSpotId: string;
      name: string;
      impressions: number;
      clickThroughRate: string;
      averageBid: string;
      estimatedMonthlyClicks: number;
    };
  };
  pricing: {
    [key: string]: {
      costPerClick: string;
      suggestedMinimumBid: string;
      suggestedOptimalBid: string;
      estimatedROI?: string;
    };
  };
}

interface BudgetDecision {
  shouldBid: boolean;
  reasoning: string;
  targetSpots: string[]; // Can target multiple spots
  budgetPerSpot: { [spotId: string]: number };
  strategy: string;
}

export class AnalyticalBiddingAgent extends IntelligentBiddingAgent {
  private siteAnalysis?: SiteAnalysisResult;
  private analyticsData?: AnalyticsData;
  private budgetDecision?: BudgetDecision;
  private availableSpots: string[] = [];
  private tunnelUrl?: string;
  private eventSequence: number = 0; // Track event sequence for gap detection

  /**
   * Broadcast event to ALL available ad spots (not just primary)
   * AWAITS all broadcasts to ensure events are stored before continuing
   * Includes sequence number for gap detection
   */
  private async broadcastToAllSpots(
    event: Record<string, unknown>
  ): Promise<void> {
    this.eventSequence++;
    const eventWithSeq = {
      ...event,
      eventSequence: this.eventSequence,
    };

    console.log(
      `📡 [${this.agentName}] Broadcasting [${this.eventSequence}] ${event.type} to ${this.availableSpots.length} spot(s)...`
    );
    await Promise.all(
      this.availableSpots.map((spotId) => broadcastEvent(spotId, eventWithSeq))
    );
    console.log(
      `✅ [${this.agentName}] Event [${this.eventSequence}] ${event.type} broadcast complete`
    );
  }

  constructor(config: {
    privateKey: Hex;
    agentName: string;
    maxBid?: number | null; // Optional/null for analytical agents
    serverUrl: string;
    geminiApiKey: string;
    brandIdentity?: BrandIdentity;
    tunnelUrl?: string; // Optional tunnel URL (Cloudflare/ngrok) for exposing localhost
  }) {
    // Pass default maxBid if null (will be overridden by analysis)
    super({
      ...config,
      maxBid: config.maxBid || 1000, // High default, will be calculated dynamically
      geminiApiKey: config.geminiApiKey,
    });

    this.tunnelUrl = config.tunnelUrl;
  }

  /**
   * Scrape website using Firecrawl via x402-wrapped endpoint
   */
  private async scrapeWebsite(
    url: string,
    adSpotId: string
  ): Promise<SiteAnalysisResult> {
    console.log(
      `\n🕷️  [${this.agentName}] Scraping ${url} with Firecrawl (via x402)...`
    );

    // Broadcast scraping started to ALL spots (paying $0.01 USDC via x402)
    await this.broadcastToAllSpots({
      type: "scraping_started",
      agentId: this.agentName,
      url,
      paymentMethod: "x402",
      expectedCost: "$0.01 USDC",
      timestamp: new Date().toISOString(),
    });

    try {
      // Use x402-wrapped Firecrawl endpoint
      // Note: Firecrawl v2 API doesn't support custom headers for target URL
      const response = await this.axiosWithPayment.post(
        process.env.FIRECRAWL_WRAPPED_ENDPOINT!,
        {
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          includeTags: ["article", "main", "h1", "h2", "h3", "p"],
          removeBase64Images: true,
        }
      );

      const data = response.data.data;
      const markdown = data.markdown || "";
      const metadata = data.metadata || {};

      // Extract topics from content
      const topics = this.extractTopics(markdown);

      console.log(`✅ [${this.agentName}] Site scraped successfully`);
      console.log(`   📄 Content length: ${markdown.length} chars`);
      console.log(`   🏷️  Topics found: ${topics.join(", ")}`);

      // Broadcast scraping completed to ALL spots with content preview
      const contentPreview =
        markdown.substring(0, 500) + (markdown.length > 500 ? "..." : "");
      await this.broadcastToAllSpots({
        type: "scraping_completed",
        agentId: this.agentName,
        url,
        contentLength: markdown.length,
        contentPreview,
        topics,
        siteTitle: metadata.title || "Unknown",
        timestamp: new Date().toISOString(),
      });

      return {
        content: markdown,
        metadata: {
          title: metadata.title,
          description: metadata.description,
          keywords: metadata.keywords,
        },
        topics,
        relevanceScore: 0, // Will be calculated by AI
        audienceMatch: "", // Will be determined by AI
      };
    } catch (error: any) {
      console.error(`❌ [${this.agentName}] Firecrawl error:`, error.message);

      // Broadcast error event
      await this.broadcastToAllSpots({
        type: "agent_error",
        agentId: this.agentName,
        phase: "scraping",
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to scrape website: ${error.message}`);
    }
  }

  /**
   * Extract key topics from markdown content
   */
  private extractTopics(markdown: string): string[] {
    const topics = new Set<string>();
    const keywords = [
      "AI",
      "Machine Learning",
      "Cloud",
      "DevOps",
      "Kubernetes",
      "TypeScript",
      "JavaScript",
      "Python",
      "Rust",
      "Go",
      "Web3",
      "Blockchain",
      "Crypto",
      "NFT",
      "DeFi",
      "API",
      "Database",
      "PostgreSQL",
      "MongoDB",
      "Redis",
      "Docker",
      "CI/CD",
      "GitHub",
      "GitLab",
      "React",
      "Next.js",
      "Vue",
      "Angular",
      "Serverless",
      "Edge Computing",
      "Microservices",
      "Security",
      "Authentication",
      "OAuth",
      "Open Source",
      "SaaS",
      "Enterprise",
    ];

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      if (regex.test(markdown)) {
        topics.add(keyword);
      }
    });

    return Array.from(topics);
  }

  /**
   * Fetch site analytics with x402 payment
   */
  private async fetchAnalytics(adSpotId: string): Promise<AnalyticsData> {
    console.log(
      `\n💰 [${this.agentName}] Fetching site analytics (will pay $0.01 USDC via x402)...`
    );

    // Broadcast analytics payment started to ALL spots
    await this.broadcastToAllSpots({
      type: "analytics_payment",
      agentId: this.agentName,
      amount: "0.01 USDC",
      paymentMethod: "x402",
      timestamp: new Date().toISOString(),
    });

    try {
      // Use axios with payment interceptor (Base Sepolia)
      const response = await this.axiosWithPayment.get(
        `${this.serverUrl}/api/site-analytics`
      );

      console.log(`✅ [${this.agentName}] Analytics received!`);
      console.log(
        `   👥 Monthly visits: ${response.data.site.monthlyVisits.toLocaleString()}`
      );
      console.log(`   🎯 Audience: ${response.data.demographics.audienceType}`);

      const analyticsData = response.data as AnalyticsData;

      // Broadcast analytics received with FULL data to ALL spots
      await this.broadcastToAllSpots({
        type: "analytics_received",
        agentId: this.agentName,
        site: {
          monthlyVisits: analyticsData.site.monthlyVisits,
          dailyAverage: analyticsData.site.dailyAverage,
          avgSessionDuration: analyticsData.site.avgSessionDuration,
          bounceRate: analyticsData.site.bounceRate,
        },
        audience: analyticsData.demographics.audienceType,
        adSpots: Object.entries(analyticsData.adSpots).map(
          ([spotId, spot]) => ({
            id: spotId,
            name: spot.name,
            impressions: spot.impressions,
            clickThroughRate: spot.clickThroughRate,
            estimatedClicks: spot.estimatedMonthlyClicks,
            averageBid: spot.averageBid,
          })
        ),
        timestamp: new Date().toISOString(),
      });

      return response.data as AnalyticsData;
    } catch (error: any) {
      console.error(
        `❌ [${this.agentName}] Analytics fetch error:`,
        error.message
      );

      // Broadcast error event
      await this.broadcastToAllSpots({
        type: "agent_error",
        agentId: this.agentName,
        phase: "analytics",
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to fetch analytics: ${error.message}`);
    }
  }

  /**
   * AI-powered analysis and decision making
   */
  private async analyzeAndDecide(adSpotId: string): Promise<BudgetDecision> {
    console.log(`\n🧠 [${this.agentName}] Analyzing opportunity with AI...`);

    if (!this.siteAnalysis || !this.analyticsData) {
      throw new Error("Missing site analysis or analytics data");
    }

    const balance = await this.getUSDCBalance();

    // Broadcast analysis started with context data to ALL spots
    await this.broadcastToAllSpots({
      type: "analysis_started",
      agentId: this.agentName,
      analysisContext: {
        siteTopics: this.siteAnalysis.topics,
        monthlyVisits: this.analyticsData.site.monthlyVisits,
        audience: this.analyticsData.demographics.audienceType,
        availableSpots: Object.keys(this.analyticsData.adSpots),
        walletBalance: balance,
      },
      timestamp: new Date().toISOString(),
    });

    const analysisPrompt = `You are ${this.agentName}, a marketing AI for ${
      this.brandIdentity?.brandName
    }.

PRODUCT: ${this.brandIdentity?.productName}
- Description: ${this.brandIdentity?.productDescription}
- Target Audience: ${this.brandIdentity?.targetAudience}
- Marketing Angle: ${this.brandIdentity?.marketingAngle}

MISSION: Analyze this advertising opportunity and decide if/how to bid.

SITE ANALYSIS:
- Content Topics: ${this.siteAnalysis.topics.join(", ")}
- Site Description: ${
      this.siteAnalysis.metadata.description || "Technology news for developers"
    }

SITE ANALYTICS:
- Monthly Visits: ${this.analyticsData.site.monthlyVisits.toLocaleString()}
- Daily Average: ${this.analyticsData.site.dailyAverage.toLocaleString()}
- Audience: ${this.analyticsData.demographics.audienceType}
- Session Duration: ${this.analyticsData.site.avgSessionDuration}
- Bounce Rate: ${this.analyticsData.site.bounceRate}

AVAILABLE AD SPOTS:
${Object.entries(this.analyticsData.adSpots)
  .map(
    ([spotId, spot]) => `
- ${spot.name} (${spotId}):
  * Impressions: ${spot.impressions.toLocaleString()}/month
  * CTR: ${spot.clickThroughRate}
  * Est. Clicks: ${spot.estimatedMonthlyClicks.toLocaleString()}/month
  * Avg Bid: ${spot.averageBid}
  * Cost per click: ${
    this.analyticsData!.pricing[spotId.replace("-", "")]
      ? this.analyticsData!.pricing[spotId.replace("-", "")]!.costPerClick
      : "N/A"
  }
  * Suggested Bid: ${
    this.analyticsData!.pricing[spotId.replace("-", "")]
      ? this.analyticsData!.pricing[spotId.replace("-", "")]!
          .suggestedOptimalBid
      : "N/A"
  }
`
  )
  .join("\n")}

YOUR WALLET BALANCE: $${balance.toFixed(2)} USDC

IMPORTANT DECISION CRITERIA:
1. **Relevance**: Does this site's audience match our target (${
      this.brandIdentity?.targetAudience
    })?
2. **ROI**: Given the traffic and CTR, is this worth the investment?
3. **Budget**: How much should we allocate? (You have $${balance.toFixed(
      2
    )} available)
4. **Strategy**: Which spot(s) should we target? Prime, secondary, both, or neither?

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no thoughts, no markdown - JUST THE JSON OBJECT.

RESPONSE FORMAT (JSON):
{
  "shouldBid": true/false,
  "reasoning": "Detailed explanation of your decision",
  "relevanceScore": 0-10,
  "targetSpots": ["prime-banner", "sidebar-secondary"],
  "budgetPerSpot": {
    "prime-banner": 15.00,
    "sidebar-secondary": 7.00
  },
  "strategy": "Description of your bidding strategy"
}

Return ONLY the JSON object above. Do not include any other text.`;

    try {
      // Use Vercel AI SDK to generate analysis
      const { text } = await generateText({
        model: this.model,
        prompt: analysisPrompt,
      });
      const response = { text };

      // Extract JSON from response (handle markdown code blocks and "Thought:" prefixes)
      let jsonText = response.text.trim();

      console.log(
        `\n🔍 [${this.agentName}] Raw AI response length: ${jsonText.length} chars`
      );
      console.log(`   First 100 chars: ${jsonText.substring(0, 100)}...`);

      // Remove markdown code blocks
      if (jsonText.includes("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
      } else if (jsonText.includes("```")) {
        jsonText = jsonText.replace(/```\n?/g, "").replace(/```\n?$/g, "");
      }

      // Find the JSON object by counting braces
      const jsonStart = jsonText.indexOf("{");
      if (jsonStart === -1) {
        throw new Error("No JSON object found in response");
      }

      // Count braces to find the matching closing brace
      let braceCount = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < jsonText.length; i++) {
        if (jsonText[i] === "{") braceCount++;
        if (jsonText[i] === "}") {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i;
            break;
          }
        }
      }

      if (jsonEnd === -1) {
        throw new Error("No matching closing brace found");
      }

      jsonText = jsonText.substring(jsonStart, jsonEnd + 1).trim();

      console.log(`   ✅ Extracted JSON (${jsonText.length} chars)`);

      const decision = JSON.parse(jsonText);

      console.log(`\n📊 [${this.agentName}] ANALYSIS COMPLETE`);
      console.log(`   🎯 Should bid: ${decision.shouldBid ? "YES" : "NO"}`);
      console.log(`   ⭐ Relevance score: ${decision.relevanceScore}/10`);
      console.log(
        `   💡 Reasoning: ${
          decision.reasoning
            ? decision.reasoning.substring(0, 200) + "..."
            : "N/A"
        }`
      );

      if (decision.shouldBid) {
        console.log(`   🎪 Target spots: ${decision.targetSpots.join(", ")}`);
        console.log(`   💵 Budget allocation:`);
        Object.entries(decision.budgetPerSpot).forEach(([spot, budget]) => {
          console.log(`      • ${spot}: $${budget}`);
        });
        console.log(`   📋 Strategy: ${decision.strategy}`);
      }

      // Broadcast analysis completed to ALL spots
      await this.broadcastToAllSpots({
        type: "analysis_completed",
        agentId: this.agentName,
        shouldBid: decision.shouldBid,
        relevanceScore: decision.relevanceScore,
        reasoning: decision.reasoning,
        targetSpots: decision.targetSpots,
        budgetPerSpot: decision.budgetPerSpot,
        strategy: decision.strategy,
        timestamp: new Date().toISOString(),
      });

      return decision;
    } catch (error: any) {
      console.error(`❌ [${this.agentName}] AI analysis error:`, error.message);

      // Broadcast error event
      await this.broadcastToAllSpots({
        type: "agent_error",
        agentId: this.agentName,
        phase: "analysis",
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      // Fallback decision: don't bid if analysis fails
      return {
        shouldBid: false,
        reasoning: `Analysis failed: ${error.message}. Defaulting to not bidding for safety.`,
        targetSpots: [],
        budgetPerSpot: {},
        strategy: "No bidding due to analysis failure",
      };
    }
  }

  /**
   * Notify server that agent is skipping a spot
   */
  private async notifySkippedSpot(
    adSpotId: string,
    reasoning: string
  ): Promise<void> {
    try {
      console.log(
        `🚫 [${this.agentName}] Notifying server about skipping "${adSpotId}"`
      );

      const response = await this.axiosWithPayment.post(
        `${this.serverUrl}/api/skip-spot/${adSpotId}`,
        {
          agentId: this.agentName,
          reasoning: reasoning,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Agent-ID": this.agentName,
          },
        }
      );

      if (response.status === 200) {
        console.log(
          `✅ [${this.agentName}] Server notified about skipping "${adSpotId}"`
        );
      }
    } catch (error: any) {
      console.error(
        `❌ [${this.agentName}] Failed to notify skip for "${adSpotId}":`,
        error.message
      );
    }
  }

  /**
   * Start the analytical agent with pre-analysis phase
   */
  async startAnalysis(adSpotIds: string[]): Promise<void> {
    console.log(`\n🚀 [${this.agentName}] Starting analytical agent...`);
    console.log(`   📍 Available spots: ${adSpotIds.join(", ")}`);

    this.availableSpots = adSpotIds;

    // Use first spot for initial event broadcasting
    const primarySpot = adSpotIds[0] || "prime-banner";

    // Set current ad spot for AI tools to use
    this.currentAdSpotId = primarySpot;

    console.log(`\n✅ [${this.agentName}] Starting analysis phase...`);
    console.log(`   💡 View live at: http://localhost:3000/analytical-agents`);
    console.log(
      `   📖 All events stored in MongoDB and will replay when browser connects\n`
    );

    // Broadcast agent started event to ALL spots
    await this.broadcastToAllSpots({
      type: "agent_started",
      agentId: this.agentName,
      availableSpots: adSpotIds,
      brandName: this.brandIdentity?.brandName,
      productName: this.brandIdentity?.productName,
      timestamp: new Date().toISOString(),
    });

    try {
      // Phase 1: Scrape the site
      // Use tunnel URL if available (for Firecrawl to access localhost), otherwise use serverUrl
      const baseUrl = this.tunnelUrl || this.serverUrl;
      console.log(
        `   🌐 Using ${
          this.tunnelUrl ? "tunnel URL" : "server URL"
        }: ${baseUrl}`
      );
      this.siteAnalysis = await this.scrapeWebsite(
        `${baseUrl}/devnews`,
        primarySpot
      );

      // Phase 2: Fetch analytics (with x402 payment)
      this.analyticsData = await this.fetchAnalytics(primarySpot);

      // Phase 3: AI analysis and decision
      this.budgetDecision = await this.analyzeAndDecide(primarySpot);

      // Phase 4: Handle skipped spots and start bidding if decision is positive
      const targetSpots = this.budgetDecision?.targetSpots || [];
      const skippedSpots = adSpotIds.filter(
        (spot) => !targetSpots.includes(spot)
      );

      // Notify server about ANY skipped spots
      if (skippedSpots.length > 0) {
        console.log(
          `\n🚫 [${this.agentName}] Skipping ${
            skippedSpots.length
          } spot(s): ${skippedSpots.join(", ")}`
        );
        for (const skippedSpot of skippedSpots) {
          await this.notifySkippedSpot(
            skippedSpot,
            this.budgetDecision.reasoning
          );
        }
      }

      if (
        this.budgetDecision.shouldBid &&
        this.budgetDecision.targetSpots.length > 0
      ) {
        console.log(
          `\n✅ [${this.agentName}] Analysis complete - Starting bidding phase!`
        );

        // Start bidding on first target spot
        const firstSpot = this.budgetDecision.targetSpots[0];
        console.log(`   🎯 Initially targeting: ${firstSpot}`);

        // Update maxBid based on analysis
        const maxBudget = Math.max(
          ...Object.values(this.budgetDecision.budgetPerSpot)
        );
        (this as any).maxBid = maxBudget;

        await this.startBidding(firstSpot);
      } else {
        console.log(
          `\n⛔ [${this.agentName}] Decision: NOT BIDDING on ANY spots`
        );
        console.log(`   Reason: ${this.budgetDecision.reasoning}`);
      }
    } catch (error: any) {
      console.error(`\n❌ [${this.agentName}] Startup error:`, error.message);
      console.error(`   Agent will not participate in bidding.`);
    }
  }

  /**
   * Start bidding on a specific ad spot (delegates to parent class)
   */
  private async startBidding(adSpotId: string): Promise<void> {
    // Delegate to parent class start method
    await super.start(adSpotId);
  }
}
