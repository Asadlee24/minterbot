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

function cleanLog(line: string): string {
  // Strip [BRACKET_TAGS] and leading symbols from log lines
  return line
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/^[#\-\*>\s]+/, '')
    .trim();
}

export default function MintStatusFeed({ progress }: MintStatusFeedProps) {
  if (!progress) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-amber-900/10 flex flex-col items-center justify-center py-14 text-center space-y-2">
        <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center mb-1">
          <Terminal className="w-5 h-5 text-stone-400" />
        </div>
        <p className="font-medium text-stone-700 text-sm">Mint Status Monitor</p>
        <p className="text-stone-400 text-xs max-w-xs">
          Transaction logs and hashes will appear here once you run a mint session.
        </p>
      </div>
    );
  }

  const isCompleted = progress.status === 'COMPLETED';
  const isFailed = progress.status === 'FAILED';
  const percent = progress.totalCount > 0
    ? Math.round((progress.completedCount / progress.totalCount) * 100)
    : 0;

  return (
    <div className="glass-card rounded-2xl border border-amber-900/10 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-[#C8922A]/20 flex items-center justify-center text-[#C8922A]">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900">Mint Monitor</p>
            <p className="text-xs text-stone-400">{progress.completedCount}/{progress.totalCount} transactions</p>
          </div>
        </div>

        <div>
          {isCompleted && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
          )}
          {isFailed && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> Failed
            </span>
          )}
          {!isCompleted && !isFailed && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Progress bar */}
        <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#C8922A] to-yellow-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Log feed */}
        <div className="bg-stone-950 rounded-xl px-4 py-3 h-44 overflow-y-auto space-y-1">
          {progress.logs.map((log, idx) => {
            const clean = cleanLog(log);
            const isSuccess = log.includes('SUCCESS') || log.includes('success') || log.includes('executed');
            const isError   = log.includes('ERROR') || log.includes('Error') || log.includes('failed');
            const isNotice  = log.includes('NOTICE') || log.includes('BALANCE') || log.includes('ACCOUNT');
            return (
              <p key={idx} className={`text-[11px] font-mono leading-relaxed ${
                isSuccess ? 'text-emerald-400' :
                isError   ? 'text-red-400' :
                isNotice  ? 'text-amber-300' :
                'text-stone-400'
              }`}>
                {clean}
              </p>
            );
          })}
        </div>

        {/* Transaction hashes */}
        {progress.txHashes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 mb-2">Transactions</p>
            <div className="flex flex-wrap gap-2">
              {progress.txHashes.map((hash, i) => (
                <a
                  key={i}
                  href={`https://sepolia.basescan.org/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-xs font-mono text-stone-700 hover:border-[#C8922A] hover:text-[#C8922A] transition-colors"
                >
                  {hash.slice(0, 8)}...{hash.slice(-6)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
