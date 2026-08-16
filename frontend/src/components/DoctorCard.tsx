'use client';

import React, { useState } from 'react';
import { Activity, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { runDoctorCheck } from '../lib/api';

export default function DoctorCard() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const handleRunDoctor = async () => {
    setLoading(true);
    try {
      const res = await runDoctorCheck('0x4e59b44847b379578588920cA78FbF26c0B4956C', 84532);
      setReport(res?.report || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-amber-900/10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif font-bold text-2xl text-stone-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#C8922A]" /> Doctor Safety Check
          </h3>
          <p className="text-stone-500 text-sm">Validates RPC liveness, wallet balances, and EIP-7702 runtime verification.</p>
        </div>

        <button
          onClick={handleRunDoctor}
          disabled={loading}
          className="gold-gradient-btn px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Run Doctor Check
        </button>
      </div>

      {report && (
        <div className="space-y-3 pt-2">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-100/80 border border-stone-200">
            <span className="text-xs font-semibold uppercase text-stone-600">Overall System Health</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1 ${
                report.overallStatus === 'HEALTHY'
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : 'bg-amber-500/15 text-amber-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {report.overallStatus}
            </span>
          </div>

          {/* RPC Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {report.rpcChecks.map((rpc: any) => (
              <div key={rpc.chainId} className="p-3 rounded-xl bg-white/60 border border-stone-200 text-xs">
                <div className="font-semibold text-stone-900">{rpc.chainName}</div>
                <div className={rpc.ok ? 'text-emerald-600 font-mono mt-0.5' : 'text-red-600 font-mono mt-0.5'}>
                  {rpc.ok ? `Block #${rpc.blockNumber}` : 'RPC Error'}
                </div>
              </div>
            ))}
          </div>

          {/* Executor runtime verification */}
          {report.sponsoredChecks?.executorAddress && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-[#C8922A]/20 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-stone-900 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-[#C8922A]" /> EIP-7702 Executor Contract
                </span>
                <p className="text-stone-600 mt-0.5">{report.sponsoredChecks.details}</p>
              </div>
              <span className="font-mono text-stone-700 font-semibold">{report.sponsoredChecks.executorAddress.slice(0, 10)}...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
