'use client';

import React from 'react';
import { Fuel, Activity } from 'lucide-react';

const chains = [
  { name: 'Base',          gwei: '0.005', color: 'bg-blue-500',   textColor: 'text-blue-700' },
  { name: 'Robinhood',     gwei: '0.01',  color: 'bg-amber-500',  textColor: 'text-amber-700' },
  { name: 'Sepolia',       gwei: '0.001', color: 'bg-violet-500', textColor: 'text-violet-700' },
  { name: 'Polygon',       gwei: '28.4',  color: 'bg-purple-500', textColor: 'text-purple-700' },
];

export default function GasTrackerBar() {
  return (
    <div className="glass-card rounded-2xl px-5 py-4 border border-amber-900/10 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-[#C8922A]/20 flex items-center justify-center text-[#C8922A]">
            <Fuel className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
              Gas Tracker
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                <Activity className="w-2.5 h-2.5" /> Live
              </span>
            </p>
            <p className="text-[11px] text-stone-400">Real-time Gwei estimates across chains</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chains.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-stone-200 shadow-sm"
            >
              <span className={`w-2 h-2 rounded-full ${c.color}`} />
              <span className="text-xs font-medium text-stone-500">{c.name}</span>
              <span className={`text-xs font-bold font-mono ${c.textColor}`}>{c.gwei} Gwei</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
