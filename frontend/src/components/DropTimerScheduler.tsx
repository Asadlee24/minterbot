'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Timer, Zap, AlarmClock, CheckCircle2, XCircle, Play, Square,
  Clock, Eye, AlertTriangle, RefreshCw, Activity
} from 'lucide-react';
import { fetchScheduler, armScheduler, disarmScheduler, fetchSchedulerLogs, getSocket } from '../lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SchedulerStatus = 'IDLE' | 'ARMED' | 'CHECKING' | 'FIRING' | 'DONE' | 'FAILED';

interface SchedulerRecord {
  id: string;
  slug: string;
  expectedStartTime: string;
  chainId: number;
  quantity: number;
  mode: string;
  walletIds: string[];
  status: SchedulerStatus;
  monitoringActive: boolean;
  openSeaAvailable: boolean;
  lastCheckTimestamp?: string;
  nextCheckTimestamp?: string;
  firstAvailabilityTimestamp?: string;
  firingTimestamp?: string;
  completionTimestamp?: string;
  error?: string;
  updatedAt: string;
  createdAt: string;
}

interface SchedulerLogRecord {
  id: string;
  schedulerId: string;
  message: string;
  timestamp: string;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  isPast: boolean;
}

interface WalletInfo {
  id: string;
  address: string;
  label: string;
}

interface DropTimerProps {
  wallets: WalletInfo[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCountdown(targetDate: Date): Countdown {
  const now = new Date().getTime();
  const diff = targetDate.getTime() - now;
  const absDiff = Math.abs(diff);
  return {
    days: Math.floor(absDiff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((absDiff % (1000 * 60)) / 1000),
    total: diff,
    isPast: diff < 0
  };
}

// ─── Status Config ────────────────────────────────────────────────────────────

const statusConfig: Record<SchedulerStatus, {
  label: string; bg: string; border: string; text: string; dot: string; pulse?: boolean;
}> = {
  IDLE:     { label: 'Not scheduled',           bg: 'bg-slate-900/60', border: 'border-white/10',     text: 'text-slate-400',   dot: 'bg-slate-500' },
  ARMED:    { label: 'Armed — awaiting start',  bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400',   dot: 'bg-amber-400',   pulse: true },
  CHECKING: { label: 'Monitoring OpenSea...',   bg: 'bg-cyan-500/10',  border: 'border-cyan-500/30',  text: 'text-cyan-400',    dot: 'bg-cyan-400',    pulse: true },
  FIRING:   { label: 'Minting now!',            bg: 'bg-purple-500/10',border: 'border-purple-500/30',text: 'text-purple-300', dot: 'bg-purple-400',  pulse: true },
  DONE:     { label: 'Done — mint executed',    bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',text: 'text-emerald-400',dot: 'bg-emerald-400' },
  FAILED:   { label: 'Failed — see log',        bg: 'bg-rose-500/10',   border: 'border-rose-500/30',  text: 'text-rose-400',    dot: 'bg-rose-400' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DropTimerScheduler({ wallets }: DropTimerProps) {
  // ── Form state (only used before arming) ──
  const [slug, setSlug]       = useState('');
  const [dropTime, setDropTime] = useState('');
  const [chainId, setChainId] = useState(84532);
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode]       = useState<'single' | 'self-funded' | 'sponsored'>('self-funded');

  // ── Backend state ──
  const [scheduler, setScheduler]   = useState<SchedulerRecord | null>(null);
  const [logs, setLogs]             = useState<SchedulerLogRecord[]>([]);
  const [countdown, setCountdown]   = useState<Countdown | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);

  // Countdown display ticker — purely for UI, never controls execution
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  // Background poll interval as Socket.IO fallback
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch backend state ───────────────────────────────────────────────────

  const refreshState = useCallback(async () => {
    try {
      const [schedRes, logsRes] = await Promise.all([
        fetchScheduler(),
        fetchSchedulerLogs(50)
      ]);
      setScheduler(schedRes.scheduler);
      setLogs(logsRes.logs || []);
      setBackendConnected(true);
      setError(null);
    } catch (err: any) {
      setBackendConnected(false);
      setError(`Backend unreachable: ${err.message}`);
    }
  }, []);

  // ── Mount: load scheduler + set up Socket.IO + fallback poll ─────────────

  useEffect(() => {
    refreshState();

    // Socket.IO real-time updates
    const socket = getSocket();
    if (socket) {
      socket.on('scheduler_update', (data: { scheduler: SchedulerRecord | null; logs: SchedulerLogRecord[] }) => {
        setScheduler(data.scheduler);
        setLogs(data.logs || []);
        setBackendConnected(true);
      });
    }

    // Fallback polling every 5s in case socket is unavailable
    pollRef.current = setInterval(refreshState, 5000);

    return () => {
      if (socket) socket.off('scheduler_update');
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshState]);

  // ── Countdown ticker (display only) ──────────────────────────────────────

  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    const activeScheduler = scheduler && ['ARMED', 'CHECKING', 'FIRING'].includes(scheduler.status)
      ? scheduler
      : null;

    if (!activeScheduler) {
      setCountdown(null);
      return;
    }

    const target = new Date(activeScheduler.expectedStartTime);
    const tick = () => setCountdown(getCountdown(target));
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [scheduler]);

  // ── Arm ───────────────────────────────────────────────────────────────────

  const handleArm = async () => {
    if (!slug.trim())   return setError('Enter a collection slug.');
    if (!dropTime)      return setError('Set a drop date and time first.');
    if (wallets.length === 0) return setError('Generate or import at least 1 wallet first.');

    const expectedDate = new Date(dropTime);
    if (expectedDate <= new Date()) {
      return setError('Set a drop time in the future.');
    }

    setLoading(true);
    setError(null);

    try {
      const res = await armScheduler({
        slug: slug.trim().toLowerCase(),
        expectedStartTime: expectedDate.toISOString(),
        chainId,
        quantity,
        mode,
        walletIds: wallets.map((w) => w.id)
      });
      if (res?.scheduler) {
        setScheduler(res.scheduler);
        await refreshState();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to arm scheduler');
    } finally {
      setLoading(false);
    }
  };

  // ── Disarm ────────────────────────────────────────────────────────────────

  const handleDisarm = async () => {
    setLoading(true);
    try {
      const res = await disarmScheduler();
      if (res?.scheduler) {
        setScheduler(res.scheduler);
        await refreshState();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to disarm scheduler');
    } finally {
      setLoading(false);
    }
  };

  // ── Reset (after DONE / FAILED) ──────────────────────────────────────────

  const handleReset = async () => {
    setLoading(true);
    try {
      await disarmScheduler();
      setScheduler(null);
      await refreshState();
    } catch (err: any) {
      setError(err.message || 'Failed to reset scheduler');
    } finally {
      setLoading(false);
    }
  };

  const status: SchedulerStatus = scheduler?.status || 'IDLE';
  const cfg = statusConfig[status];
  const isActive = ['ARMED', 'CHECKING', 'FIRING'].includes(status);
  const isEditable = status === 'IDLE' || status === 'DONE' || status === 'FAILED';

  return (
    <div className="glass-card rounded-2xl shadow-xl overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
            <AlarmClock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-lg text-slate-100 tracking-tight">Auto-Mint Scheduler</h2>
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md uppercase">
                Backend Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">
              State persisted on server — survives browser refresh & disconnections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Backend connection indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-white/10 text-[11px] font-mono text-slate-400">
            <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-500 animate-pulse'}`} />
            {backendConnected ? 'Online' : 'Offline'}
          </div>
          {/* Status badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
            {cfg.label}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="flex-1 font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 font-bold text-base leading-none ml-1">×</button>
          </div>
        )}

        {/* ── Configuration Form (only when not active) ── */}
        {!isActive && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Collection Slug</label>
                <input
                  id="scheduler-slug"
                  type="text"
                  placeholder="pudgypenguins"
                  value={scheduler?.slug || slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl dark-input text-sm text-slate-100 placeholder:text-slate-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Expected Start Time</label>
                <input
                  id="scheduler-droptime"
                  type="datetime-local"
                  value={scheduler?.expectedStartTime
                    ? new Date(scheduler.expectedStartTime).toISOString().slice(0, 16)
                    : dropTime}
                  onChange={(e) => setDropTime(e.target.value)}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl dark-input text-sm text-slate-100 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Chain</label>
                <select
                  id="scheduler-chain"
                  value={scheduler?.chainId || chainId}
                  onChange={(e) => setChainId(parseInt(e.target.value))}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl dark-input text-sm text-slate-100 disabled:opacity-50"
                >
                  <option value={4663} className="bg-slate-900 text-slate-200">Robinhood Chain (Mainnet)</option>
                  <option value={46630} className="bg-slate-900 text-slate-200">Robinhood Testnet</option>
                  <option value={84532} className="bg-slate-900 text-slate-200">Base Sepolia (Testnet)</option>
                  <option value={8453} className="bg-slate-900 text-slate-200">Base Mainnet</option>
                  <option value={1} className="bg-slate-900 text-slate-200">Ethereum Mainnet</option>
                  <option value={42161} className="bg-slate-900 text-slate-200">Arbitrum One</option>
                  <option value={137} className="bg-slate-900 text-slate-200">Polygon Mainnet</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Mint Execution Mode</label>
                <select
                  id="scheduler-mode"
                  value={scheduler?.mode || mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl dark-input text-sm text-slate-100 disabled:opacity-50"
                >
                  <option value="single" className="bg-slate-900 text-slate-200">Single Wallet</option>
                  <option value="self-funded" className="bg-slate-900 text-slate-200">Self-Funded Multi-Wallet</option>
                  <option value="sponsored" className="bg-slate-900 text-slate-200">Sponsored (EIP-7702)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Quantity per Wallet</label>
                <input
                  id="scheduler-quantity"
                  type="number"
                  min={1}
                  max={10}
                  value={scheduler?.quantity || quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl dark-input text-sm text-slate-100 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Active Scheduler Summary ── */}
        {isActive && scheduler && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-2 text-xs text-slate-300">
            <div className="flex justify-between items-center"><span className="text-slate-400 font-medium">Target Collection</span><span className="font-mono font-bold text-amber-400">{scheduler.slug}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400 font-medium">Chain ID</span><span className="font-mono text-cyan-400">{scheduler.chainId}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400 font-medium">Execution Mode</span><span className="capitalize font-semibold text-slate-200">{scheduler.mode}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400 font-medium">Active Wallets</span><span className="font-semibold text-slate-200">{scheduler.walletIds.length} wallets</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400 font-medium">Mint Qty</span><span className="font-semibold text-slate-200">{scheduler.quantity} per wallet</span></div>
            {scheduler.lastCheckTimestamp && (
              <div className="flex justify-between items-center"><span className="text-slate-400 font-medium">Last OpenSea Check</span><span className="font-mono text-slate-400">{new Date(scheduler.lastCheckTimestamp).toLocaleTimeString()}</span></div>
            )}
          </div>
        )}

        {/* ── Countdown Cards ── */}
        {countdown && isActive && (
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 via-slate-900/40 to-transparent p-6">
            {scheduler?.openSeaAvailable ? (
              <div className="flex items-center justify-center gap-2 mb-5">
                <Zap className="w-5 h-5 text-purple-400 animate-pulse" />
                <p className="text-center text-xs font-bold text-purple-300 uppercase tracking-widest">
                  PUBLIC MINT DETECTED — Executing Mint...
                </p>
              </div>
            ) : countdown.isPast ? (
              <p className="text-center text-xs font-semibold text-amber-400 mb-5">
                Expected time reached — monitoring OpenSea availability aggressively...
              </p>
            ) : (
              <p className="text-center text-xs font-medium text-slate-400 mb-5">
                Countdown to expected start time
              </p>
            )}
            <div className="grid grid-cols-4 gap-3">
              {[
                { v: countdown.days,    l: 'Days' },
                { v: countdown.hours,   l: 'Hours' },
                { v: countdown.minutes, l: 'Min' },
                { v: countdown.seconds, l: 'Sec' },
              ].map(({ v, l }) => (
                <div key={l} className="flex flex-col items-center bg-slate-950/80 rounded-2xl py-4 border border-white/10 shadow-lg">
                  <span className={`font-heading font-extrabold text-3xl sm:text-4xl tabular-nums leading-none ${countdown.isPast ? 'text-amber-400' : 'text-slate-100'}`}>
                    {String(v).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{l}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-4 font-mono">
              ⚡ Early Public-Mint Detection active — backend polls continuously and mints early if OpenSea opens early.
            </p>
          </div>
        )}

        {/* ── Status Banners ── */}
        {status === 'FIRING' && (
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 px-4 py-3 flex items-center gap-3">
            <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 animate-pulse" />
            <span className="text-sm text-purple-300 font-semibold">Broadcasting mint transactions to blockchain...</span>
          </div>
        )}

        {status === 'DONE' && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="text-sm text-emerald-300 font-semibold">Mint executed successfully! Check status feed for tx hashes.</span>
          </div>
        )}

        {status === 'FAILED' && scheduler?.error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-rose-300 font-semibold">Scheduler execution halted.</p>
              <p className="text-xs text-rose-400 mt-0.5 font-mono">{scheduler.error}</p>
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-2">
          {(status === 'IDLE' || status === 'DONE' || status === 'FAILED') && (
            <button
              id="scheduler-arm-btn"
              onClick={handleArm}
              disabled={loading || wallets.length === 0}
              className="gold-gradient-btn px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              Arm Scheduler
            </button>
          )}
          {(status === 'ARMED' || status === 'CHECKING') && (
            <button
              id="scheduler-disarm-btn"
              onClick={handleDisarm}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white flex items-center gap-2 hover:bg-rose-500 shadow-lg transition-colors disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
              Disarm Scheduler
            </button>
          )}
          {(status === 'DONE' || status === 'FAILED') && (
            <button
              id="scheduler-reset-btn"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            id="scheduler-refresh-btn"
            onClick={refreshState}
            disabled={loading}
            title="Refresh scheduler state"
            className="ml-auto p-2 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 font-medium">
            {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} ready
          </span>
        </div>

        {/* ── Activity Log (persisted on backend) ── */}
        {logs.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scheduler Activity Log</p>
            </div>
            <div className="bg-slate-950 rounded-xl px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto border border-white/10">
              {logs.map((entry) => (
                <p
                  key={entry.id}
                  className={`text-[11px] font-mono leading-relaxed ${
                    entry.message.includes('❌') || entry.message.includes('Error') || entry.message.includes('FAILED')
                      ? 'text-rose-400'
                      : entry.message.includes('✅') || entry.message.includes('DONE')
                      ? 'text-emerald-400'
                      : entry.message.includes('🔥') || entry.message.includes('FIRING')
                      ? 'text-purple-300'
                      : entry.message.includes('⏳') || entry.message.includes('Monitoring')
                      ? 'text-cyan-300'
                      : entry.message.includes('⚠️')
                      ? 'text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  <span className="text-slate-600 mr-2">
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  {entry.message}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
