'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

interface TerminalLog {
  id?: string; // Unique identifier for React keys
  timestamp: string;
  type: 'info' | 'success' | 'payment' | 'error' | 'tool' | 'thinking';
  icon: string;
  message: string;
  details?: string;
  link?: {
    href: string;
    label: string;
  };
}

interface TerminalPanelProps {
  brandName: string;
  logs: TerminalLog[];
  color: 'blue' | 'green';
  logoPath: string;
}

const colorMap = {
  blue: {
    border: 'border-blue-900/50',
    header: 'bg-blue-950/30',
    text: 'text-blue-400',
    accent: 'text-blue-500',
  },
  green: {
    border: 'border-green-900/50',
    header: 'bg-green-950/30',
    text: 'text-green-400',
    accent: 'text-green-500',
  },
};

const logTypeStyles = {
  info: 'text-gray-400',
  success: 'text-green-400',
  payment: 'text-amber-400',
  error: 'text-red-400',
  tool: 'text-blue-400',
  thinking: 'text-purple-400',
};

export default function TerminalPanel({ brandName, logs, color, logoPath }: TerminalPanelProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const theme = colorMap[color];

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`flex flex-col h-full border ${theme.border} rounded-lg overflow-hidden bg-[#0a0a0a]`}>
      {/* Terminal Header */}
      <div className={`${theme.header} border-b ${theme.border} px-6 py-4 flex items-center gap-4`}>
        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#444444] bg-[#2a2a2a] flex-shrink-0">
          <Image
            src={logoPath}
            alt={brandName}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex flex-col">
          <span className={`text-base font-semibold ${theme.accent}`}>
            {brandName}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            Agent Terminal
          </span>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-600 flex items-center gap-2">
            <span className="animate-pulse">&gt;</span>
            <span>Waiting for agent to start...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div key={log.id || `${log.timestamp}-${index}`} className="flex flex-col gap-1">
                {/* Main log line */}
                <div className="flex items-start gap-3">
                  <span className="text-gray-600 flex-shrink-0">
                    [{formatTime(log.timestamp)}]
                  </span>
                  <span className="flex-shrink-0">{log.icon}</span>
                  <span className={logTypeStyles[log.type]}>
                    {log.message}
                  </span>
                </div>

                {/* Details (indented) */}
                {log.details && (
                  <div className="ml-[110px] text-gray-500 text-[11px] whitespace-pre-wrap">
                    {log.details}
                  </div>
                )}

                {/* Link (indented) */}
                {log.link && (
                  <div className="ml-[110px]">
                    <a
                      href={log.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-400 underline text-[11px]"
                    >
                      {log.link.label} →
                    </a>
                  </div>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
