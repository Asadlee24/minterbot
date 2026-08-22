'use client';

import React from 'react';
import { Fuel, Activity } from 'lucide-react';

const chains = [
  { name: 'Base',          gwei: '0.005', color: 'bg-blue-400',   glow: 'shadow-[0_0_8px_rgba(96,165,250,0.5)]', textColor: 'text-blue-400' },
  { name: 'Robinhood',     gwei: '0.01',  color: 'bg-amber-400',  glow: 'shadow-[0_0_8px_rgba(251,191,36,0.5)]', textColor: 'text-amber-400' },
  { name: 'Sepolia',       gwei: '0.001', color: 'bg-purple-400', glow: 'shadow-[0_0_8px_rgba(192,132,252,0.5)]', textColor: 'text-purple-400' },
  { name: 'Polygon',       gwei: '28.4',  color: 'bg-pink-400',   glow: 'shadow-[0_0_8px_rgba(244,114,182,0.5)]', textColor: 'text-pink-400' },
];

export default function GasTrackerBar() {
  return (
    <div className="glass-card rounded-2xl px-5 py-3.5 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
            <Fuel className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100 flex items-center gap-2 tracking-tight">
              Gas Tracker
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Activity className="w-2.5 h-2.5 animate-pulse" /> Live
              </span>
            </p>
            <p className="text-[11px] text-slate-400">Real-time Gwei network estimates</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {chains.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 hover:border-white/20 transition-all text-xs"
            >
              <span className={`w-2 h-2 rounded-full ${c.color} ${c.glow}`} />
              <span className="text-slate-400 font-medium">{c.name}</span>
              <span className={`font-bold font-mono ${c.textColor}`}>{c.gwei} Gwei</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
