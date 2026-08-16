'use client';

import React from 'react';
import { Fuel, ShieldCheck, Cpu, Zap, Activity } from 'lucide-react';

export default function GasTrackerBar() {
  return (
    <div className="glass-card rounded-2xl p-4 border border-amber-900/10 shadow-sm bg-gradient-to-r from-amber-500/5 via-stone-50/50 to-amber-500/5">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Engine Status Badge */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-[#C8922A]/30 flex items-center justify-center text-[#C8922A]">
            <Fuel className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
              Live Network Gas Tracker <Activity className="w-3 h-3 text-emerald-600 animate-pulse" />
            </h4>
            <p className="text-[11px] text-stone-500 font-mono">Real-time Multi-Chain Gwei Estimator</p>
          </div>
        </div>

        {/* Right: Chain Gas Tickers */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-white/80 border border-stone-200 shadow-2xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-stone-700">Base:</span>
            <span className="font-bold text-emerald-700">0.005 Gwei</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/80 border border-amber-300/60 shadow-2xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-semibold text-stone-700">Robinhood:</span>
            <span className="font-bold text-amber-700">0.01 Gwei</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/80 border border-stone-200 shadow-2xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="font-semibold text-stone-700">Sepolia:</span>
            <span className="font-bold text-blue-700">0.001 Gwei</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/80 border border-stone-200 shadow-2xs hidden lg:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="font-semibold text-stone-700">Polygon:</span>
            <span className="font-bold text-purple-700">28.4 Gwei</span>
          </div>
        </div>
      </div>
    </div>
  );
}
