import DevNewsAdSpot from '../components/DevNewsAdSpot';
import Image from 'next/image';
import Link from 'next/link';

export default function DevNewsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Prime Banner Ad Spot */}
      <div className="w-full bg-[#000] border-b border-[#222] py-4">
        <div className="container mx-auto px-4 max-w-7xl">
          <DevNewsAdSpot adSpotId="prime-banner" isPrime={true} />
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-[#222] py-6 bg-[#000]">
        <div className="container mx-auto px-4 max-w-7xl">
          <h1 className="text-4xl font-bold tracking-tight">DevNews</h1>
          <p className="text-[#888] text-sm mt-1">Technology News for Developers</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Left Column: Hero + Article Grid */}
          <div>
            {/* Hero Article */}
            <article className="mb-12">
              <div className="text-[10px] font-bold tracking-wider text-[#888] mb-3 uppercase">
                Today&apos;s Deal
              </div>
              <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden mb-4 border border-[#222]">
                <Image
                  src="/example1.webp"
                  alt="Hero article"
                  fill
                  className="object-cover"
                />
              </div>
              <h2 className="text-3xl font-bold mb-2 leading-tight">
                The Rise of AI-Powered Development Tools: How Claude and GitHub Copilot Are Changing Software Engineering
              </h2>
              <p className="text-[#aaa] text-lg mb-3 leading-relaxed">
                As artificial intelligence continues to advance, developer tools are becoming increasingly sophisticated. We explore how AI assistants are reshaping the way software is built.
              </p>
              <div className="text-xs text-[#666]">
                <span className="font-semibold text-[#888]">SARAH CHEN</span>
              </div>
            </article>

            {/* Article Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Article 1 */}
              <article>
                <div className="text-[10px] font-bold tracking-wider text-[#888] mb-2 uppercase">
                  Cloud Infrastructure
                </div>
                <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-3 border border-[#222]">
                  <Image
                    src="/example2.webp"
                    alt="Article 2"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold mb-2 leading-tight">
                  Kubernetes 1.30 Released: New Features for Enterprise Scale
                </h3>
                <div className="text-xs text-[#666]">
                  <span className="font-semibold text-[#888]">MIKE RODRIGUEZ</span>
                </div>
              </article>

              {/* Article 2 */}
              <article>
                <div className="text-[10px] font-bold tracking-wider text-[#888] mb-2 uppercase">
                  Web3 & Blockchain
                </div>
                <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-3 border border-[#222]">
                  <Image
                    src="/example3.webp"
                    alt="Article 3"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold mb-2 leading-tight">
                  x402 Protocol Brings Microtransactions to the Web: Pay-Per-API-Call Infrastructure
                </h3>
                <div className="text-xs text-[#666]">
                  <span className="font-semibold text-[#888]">ALEX KIM</span>
                </div>
              </article>

              {/* Article 3 */}
              <article>
                <div className="text-[10px] font-bold tracking-wider text-[#888] mb-2 uppercase">
                  Developer Tools
                </div>
                <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-3 border border-[#222]">
                  <Image
                    src="/example4.webp"
                    alt="Article 4"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold mb-2 leading-tight">
                  Rust Adoption Accelerates in Systems Programming: Why Developers Are Making the Switch
                </h3>
                <div className="text-xs text-[#666]">
                  <span className="font-semibold text-[#888]">EMMA TAYLOR</span>
                </div>
              </article>

              {/* Article 4 */}
              <article>
                <div className="text-[10px] font-bold tracking-wider text-[#888] mb-2 uppercase">
                  Open Source
                </div>
                <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-3 border border-[#222]">
                  <Image
                    src="/example5.webp"
                    alt="Article 5"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold mb-2 leading-tight">
                  The State of Open Source in 2025: Funding Models That Actually Work
                </h3>
                <div className="text-xs text-[#666]">
                  <span className="font-semibold text-[#888]">JORDAN LEE</span>
                </div>
              </article>
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="space-y-8">
            {/* Most Recent Section */}
            <div>
              <div className="text-[10px] font-bold tracking-wider text-[#888] mb-4 uppercase border-b border-[#222] pb-2">
                Most Recent
              </div>
              <div className="space-y-6">
                {/* Recent 1 */}
                <div className="flex gap-3">
                  <div className="relative w-20 h-20 rounded overflow-hidden flex-shrink-0 border border-[#222]">
                    <Image
                      src="/example6.webp"
                      alt="Recent 1"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold leading-tight mb-1">
                      Building Real-Time Collaborative Apps with WebSockets and Redis
                    </h4>
                    <p className="text-[10px] text-[#666] uppercase font-semibold">
                      Lisa Wang
                    </p>
                  </div>
                </div>

                {/* Recent 2 */}
                <div className="flex gap-3">
                  <div className="relative w-20 h-20 rounded overflow-hidden flex-shrink-0 border border-[#222]">
                    <Image
                      src="/example7.webp"
                      alt="Recent 2"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold leading-tight mb-1">
                      TypeScript 5.5: What&apos;s New for Enterprise Development
                    </h4>
                    <p className="text-[10px] text-[#666] uppercase font-semibold">
                      Carlos Santos
                    </p>
                  </div>
                </div>

                {/* Recent 3 */}
                <div className="flex gap-3">
                  <div className="relative w-20 h-20 rounded overflow-hidden flex-shrink-0 border border-[#222]">
                    <Image
                      src="/example1.webp"
                      alt="Recent 3"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold leading-tight mb-1">
                      Scaling PostgreSQL to 10M Requests Per Second: A Case Study
                    </h4>
                    <p className="text-[10px] text-[#666] uppercase font-semibold">
                      Ahmed Hassan
                    </p>
                  </div>
                </div>

                {/* Recent 4 */}
                <div className="flex gap-3">
                  <div className="relative w-20 h-20 rounded overflow-hidden flex-shrink-0 border border-[#222]">
                    <Image
                      src="/example2.webp"
                      alt="Recent 4"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold leading-tight mb-1">
                      The Return of Monoliths: When Microservices Are the Wrong Choice
                    </h4>
                    <p className="text-[10px] text-[#666] uppercase font-semibold">
                      Nina Patel
                    </p>
                  </div>
                </div>

                {/* Recent 5 */}
                <div className="flex gap-3">
                  <div className="relative w-20 h-20 rounded overflow-hidden flex-shrink-0 border border-[#222]">
                    <Image
                      src="/example3.webp"
                      alt="Recent 5"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold leading-tight mb-1">
                      Edge Computing Explained: Why Your Next App Should Run Closer to Users
                    </h4>
                    <p className="text-[10px] text-[#666] uppercase font-semibold">
                      Tom Anderson
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Ad Spot */}
            <div className="mt-8">
              <DevNewsAdSpot adSpotId="sidebar-secondary" isPrime={false} />
            </div>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#222] py-8 mt-16 bg-[#000]">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-[#666]">
              &copy; 2025 DevNews. All rights reserved.
            </div>
            <div className="flex gap-4 text-xs text-[#888]">
              <Link href="/api/site-analytics" className="hover:text-white transition-colors">
                Site Analytics API
              </Link>
              <Link href="/analytical-agents" className="hover:text-white transition-colors">
                🤖 See Agents in Action
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
