'use client';

import React from 'react';
import { Terminal, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

export interface ProgressData {
  taskId: string;
  status: 'STARTING' | 'AUTH' | 'FETCHING_CALLDATA' | 'SUBMITTING' | 'COMPLETED' | 'FAILED';
  completedCount: number;
  totalCount: number;
  logs: string[];
  txHashes: string[];
}

interface MintStatusFeedProps {
  progress: ProgressData | null;
}

export default function MintStatusFeed({ progress }: MintStatusFeedProps) {
  if (!progress) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-amber-900/10 text-center py-12">
        <Terminal className="w-8 h-8 text-stone-300 mx-auto mb-2" />
        <h3 className="font-serif font-bold text-lg text-stone-700">Live Mint Status Feed</h3>
        <p className="text-stone-500 text-xs mt-1">Ready for mint execution. Output logs and transaction hashes will stream live here.</p>
      </div>
    );
  }

  const isCompleted = progress.status === 'COMPLETED';
  const isFailed = progress.status === 'FAILED';
  const percent = progress.totalCount > 0 ? Math.round((progress.completedCount / progress.totalCount) * 100) : 0;

  return (
    <div className="glass-card rounded-2xl p-6 border border-amber-900/10 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[#C8922A]" />
          <h3 className="font-serif font-bold text-xl text-stone-900">Live Mint Monitor</h3>
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className="px-3 py-1 bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
          )}
          {isFailed && (
            <span className="px-3 py-1 bg-red-500/15 text-red-700 border border-red-500/30 rounded-full text-xs font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Failed
            </span>
          )}
          {!isCompleted && !isFailed && (
            <span className="px-3 py-1 bg-amber-500/15 text-amber-800 border border-amber-500/30 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress.status}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-stone-200/70 h-2.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-[#C8922A] to-yellow-500 h-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Log Feed Terminal Window */}
      <div className="bg-stone-950 rounded-xl p-4 font-mono text-xs text-stone-200 h-48 overflow-y-auto space-y-1 shadow-inner border border-stone-800">
        {progress.logs.map((log, idx) => (
          <div key={idx} className="leading-relaxed">
            {log}
          </div>
        ))}
      </div>

      {/* Submitted Transaction Links */}
      {progress.txHashes.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-semibold uppercase text-stone-600 mb-2">Submitted Transactions</h4>
          <div className="flex flex-wrap gap-2">
            {progress.txHashes.map((hash, i) => (
              <a
                key={i}
                href={`https://sepolia.basescan.org/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-stone-100 border border-stone-300 text-xs font-mono text-stone-800 hover:border-[#C8922A] hover:text-[#C8922A] flex items-center gap-1 transition-colors"
              >
                {hash.slice(0, 10)}...{hash.slice(-6)} <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
