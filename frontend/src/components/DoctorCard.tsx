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
    <div className="glass-card rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-xl text-slate-900 flex items-center gap-2">
              System Doctor
            </h3>
            <p className="text-xs text-slate-500">Validates RPC liveness, wallet balances & EIP-7702 runtime verification</p>
          </div>
        </div>

        <button
          onClick={handleRunDoctor}
          disabled={loading}
          className="blue-gradient-btn px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Run Diagnostics
        </button>
      </div>

      {report && (
        <div className="space-y-3 pt-2">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-semibold uppercase text-slate-600">Overall System Health</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 ${
                report.overallStatus === 'HEALTHY'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {report.overallStatus}
            </span>
          </div>

          {/* RPC Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {report.rpcChecks.map((rpc: any) => (
              <div key={rpc.chainId} className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm text-xs space-y-1">
                <div className="font-semibold text-slate-800">{rpc.chainName}</div>
                <div className={rpc.ok ? 'text-emerald-600 font-mono text-[11px] font-bold' : 'text-rose-600 font-mono text-[11px] font-bold'}>
                  {rpc.ok ? `Block #${rpc.blockNumber}` : 'RPC Error'}
                </div>
              </div>
            ))}
          </div>

          {/* Executor runtime verification */}
          {report.sponsoredChecks?.executorAddress && (
            <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-purple-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" /> EIP-7702 Executor Contract
                </span>
                <p className="text-purple-700 mt-0.5">{report.sponsoredChecks.details}</p>
              </div>
              <span className="font-mono text-purple-900 font-bold bg-white px-2.5 py-1 rounded-lg border border-purple-200 shadow-sm">
                {report.sponsoredChecks.executorAddress.slice(0, 8)}...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
