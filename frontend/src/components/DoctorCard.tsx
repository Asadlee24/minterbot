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
    <div className="glass-card rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-xl text-slate-100 flex items-center gap-2">
              System Doctor
            </h3>
            <p className="text-xs text-slate-400">Validates RPC liveness, wallet balances & EIP-7702 runtime verification</p>
          </div>
        </div>

        <button
          onClick={handleRunDoctor}
          disabled={loading}
          className="cyan-gradient-btn px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Run Diagnostics
        </button>
      </div>

      {report && (
        <div className="space-y-3 pt-2">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-white/10">
            <span className="text-xs font-semibold uppercase text-slate-400">Overall System Health</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 ${
                report.overallStatus === 'HEALTHY'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {report.overallStatus}
            </span>
          </div>

          {/* RPC Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {report.rpcChecks.map((rpc: any) => (
              <div key={rpc.chainId} className="p-3 rounded-xl bg-slate-900/60 border border-white/10 text-xs space-y-1">
                <div className="font-semibold text-slate-200">{rpc.chainName}</div>
                <div className={rpc.ok ? 'text-emerald-400 font-mono text-[11px]' : 'text-rose-400 font-mono text-[11px]'}>
                  {rpc.ok ? `Block #${rpc.blockNumber}` : 'RPC Error'}
                </div>
              </div>
            ))}
          </div>

          {/* Executor runtime verification */}
          {report.sponsoredChecks?.executorAddress && (
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" /> EIP-7702 Executor Contract
                </span>
                <p className="text-slate-400 mt-0.5">{report.sponsoredChecks.details}</p>
              </div>
              <span className="font-mono text-purple-300 font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-white/10">
                {report.sponsoredChecks.executorAddress.slice(0, 8)}...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
