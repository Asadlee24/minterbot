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
  explorerUrl?: string;
  chainId?: number;
}

interface MintStatusFeedProps {
  progress: ProgressData | null;
}

const explorerMap: Record<number, string> = {
  1:     'https://etherscan.io/tx',
  8453:  'https://basescan.org/tx',
  4663:  'https://explorer.robinhood.com/tx',
  46630: 'https://testnet.robinhoodchain.blockscout.com/tx',
  42161: 'https://arbiscan.io/tx',
  137:   'https://polygonscan.com/tx',
  84532: 'https://sepolia.basescan.org/tx'
};

function getTxExplorerUrl(hash: string, progress: ProgressData): string {
  for (const log of progress.logs) {
    if (log.includes(hash)) {
      const match = log.match(/(https:\/\/[^\s]+\/tx\/0x[a-fA-F0-9]+)/i);
      if (match) return match[1];
    }
  }
  if (progress.explorerUrl) {
    const base = progress.explorerUrl.replace(/\/$/, '');
    return `${base}/${hash}`;
  }
  if (progress.chainId && explorerMap[progress.chainId]) {
    return `${explorerMap[progress.chainId]}/${hash}`;
  }
  return `https://sepolia.basescan.org/tx/${hash}`;
}

function cleanLog(line: string): string {
  return line
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/^[#\-\*>\s]+/, '')
    .trim();
}

export default function MintStatusFeed({ progress }: MintStatusFeedProps) {
  if (!progress) {
    return (
      <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center py-14 text-center space-y-3 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center mb-1 text-slate-500">
          <Terminal className="w-6 h-6" />
        </div>
        <p className="font-heading font-bold text-slate-200 text-base">Mint Status Monitor</p>
        <p className="text-slate-400 text-xs max-w-xs">
          Transaction logs and verified blockchain hashes will stream here during mint sessions.
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
    <div className="glass-card rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <p className="font-heading font-bold text-slate-100 text-sm">Mint Monitor</p>
            <p className="text-xs text-slate-400">{progress.completedCount}/{progress.totalCount} transactions processed</p>
          </div>
        </div>

        <div>
          {isCompleted && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
          )}
          {isFailed && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5" /> Failed
            </span>
          )}
          {!isCompleted && !isFailed && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Progress bar */}
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/10">
          <div
            className="bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 h-full rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Log feed */}
        <div className="bg-slate-950 rounded-xl p-4 h-48 overflow-y-auto space-y-1.5 border border-white/10">
          {progress.logs.map((log, idx) => {
            const clean = cleanLog(log);
            const isSuccess = log.includes('SUCCESS') || log.includes('success') || log.includes('executed') || log.includes('broadcasted successfully');
            const isError   = log.includes('ERROR') || log.includes('Error') || log.includes('failed');
            const isNotice  = log.includes('NOTICE') || log.includes('BALANCE') || log.includes('ACCOUNT');
            return (
              <p key={idx} className={`text-[11px] font-mono leading-relaxed ${
                isSuccess ? 'text-emerald-400' :
                isError   ? 'text-rose-400' :
                isNotice  ? 'text-amber-300' :
                'text-slate-400'
              }`}>
                {clean}
              </p>
            );
          })}
        </div>

        {/* Transaction hashes */}
        {progress.txHashes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Verified Hashes</p>
            <div className="flex flex-wrap gap-2">
              {progress.txHashes.map((hash, i) => (
                <a
                  key={i}
                  href={getTxExplorerUrl(hash, progress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-cyan-300 hover:border-cyan-400 transition-colors"
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
