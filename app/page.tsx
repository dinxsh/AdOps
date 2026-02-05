'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [adSpotId, setAdSpotId] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adSpotId.trim()) {
      router.push(`/auction/${encodeURIComponent(adSpotId.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="bg-[#2a2a2a] border border-[#333333] rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-[#ffffff] text-2xl font-semibold mb-2">X402 Ad Bid</h1>
            <p className="text-[#888888] text-sm">Enter an Ad Spot ID to view the auction</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={adSpotId}
              onChange={(e) => setAdSpotId(e.target.value)}
              placeholder="Enter Ad Spot ID"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333333] text-[#ffffff] placeholder-[#666666] rounded focus:outline-none focus:border-[#555555]"
            />
            <button
              type="submit"
              disabled={!adSpotId.trim()}
              className="w-full px-4 py-3 bg-[#ffffff] text-[#1a1a1a] font-medium rounded hover:bg-[#e0e0e0] disabled:bg-[#333333] disabled:text-[#666666] disabled:cursor-not-allowed transition-colors"
            >
              View Auction
            </button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => router.push('/auction/demo-spot-1')}
              className="text-sm text-[#888888] hover:text-[#ffffff] transition-colors"
            >
              Or try demo auction →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
