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
    <div className="glass-card rounded-2xl px-5 py-3.5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
            <Fuel className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              Gas Tracker
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Activity className="w-2.5 h-2.5 animate-pulse" /> Live
              </span>
            </p>
            <p className="text-[11px] text-slate-500">Real-time Gwei network estimates across chains</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {chains.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm text-xs"
            >
              <span className={`w-2 h-2 rounded-full ${c.color}`} />
              <span className="text-slate-600 font-medium">{c.name}</span>
              <span className={`font-bold font-mono ${c.textColor}`}>{c.gwei} Gwei</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
