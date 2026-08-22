'use client';

import React from 'react';
import { Fuel, Activity } from 'lucide-react';

const chains = [
  { name: 'Base',          gwei: '0.005', color: 'bg-blue-500',   textColor: 'text-blue-700' },
  { name: 'Robinhood',     gwei: '0.01',  color: 'bg-amber-500',  textColor: 'text-amber-700' },
  { name: 'Sepolia',       gwei: '0.001', color: 'bg-purple-500', textColor: 'text-purple-700' },
  { name: 'Polygon',       gwei: '28.4',  color: 'bg-pink-500',   textColor: 'text-pink-700' },
];

export default function GasTrackerBar() {
  return (
    <div className="glass-card rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C8922A] shadow-sm flex-shrink-0">
            <Fuel className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2 tracking-tight">
              Gas Tracker
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Activity className="w-2.5 h-2.5 animate-pulse" /> Live
              </span>
            </p>
            <p className="text-[10px] sm:text-[11px] text-stone-500">Real-time Gwei network estimates across chains</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
          {chains.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between sm:justify-start gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white border border-stone-200 shadow-sm text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${c.color}`} />
                <span className="text-stone-600 font-medium text-[11px] sm:text-xs">{c.name}</span>
              </div>
              <span className={`font-bold font-mono text-[11px] sm:text-xs ${c.textColor}`}>{c.gwei} Gwei</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
