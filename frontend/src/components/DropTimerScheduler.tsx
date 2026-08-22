'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Timer, Zap, AlarmClock, CheckCircle2, XCircle, Play, Square,
  Clock, Eye, AlertTriangle, RefreshCw, Activity
} from 'lucide-react';
import { fetchScheduler, armScheduler, disarmScheduler, fetchSchedulerLogs, getSocket } from '../lib/api';
import { sendDesktopNotification } from '../lib/notifications';

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
  IDLE:     { label: 'Not scheduled',           bg: 'bg-stone-100',  border: 'border-stone-200',  text: 'text-stone-600',  dot: 'bg-stone-400' },
  ARMED:    { label: 'Armed — awaiting start',  bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-500',   pulse: true },
  CHECKING: { label: 'Monitoring OpenSea...',   bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800',   dot: 'bg-blue-500',    pulse: true },
  FIRING:   { label: 'Minting now!',            bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', dot: 'bg-purple-500',  pulse: true },
  DONE:     { label: 'Done — mint executed',    bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-800',dot: 'bg-emerald-500' },
  FAILED:   { label: 'Failed — see log',        bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-800',   dot: 'bg-rose-500' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DropTimerScheduler({ wallets }: DropTimerProps) {
  // ── Form state ──
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

  const countdownRef = useRef<NodeJS.Timeout | null>(null);
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

    const socket = getSocket();
    if (socket) {
      socket.on('scheduler_update', (data: { scheduler: SchedulerRecord | null; logs: SchedulerLogRecord[] }) => {
        setScheduler(data.scheduler);
        setLogs(data.logs || []);
        setBackendConnected(true);
      });
    }

    pollRef.current = setInterval(refreshState, 5000);

    return () => {
      if (socket) socket.off('scheduler_update');
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshState]);

  // ── Desktop Notification on status change ────────────────────────────────
  const prevStatusRef = useRef<SchedulerStatus | null>(null);

  useEffect(() => {
    if (scheduler && scheduler.status !== prevStatusRef.current) {
      if (scheduler.status === 'FIRING') {
        sendDesktopNotification('🚀 Public Mint Live!', `Mint triggered for ${scheduler.slug} across ${scheduler.walletIds.length} wallet(s)!`);
      } else if (scheduler.status === 'DONE') {
        sendDesktopNotification('🎉 Auto-Mint Completed!', `Scheduler successfully finished minting ${scheduler.slug}!`);
      } else if (scheduler.status === 'FAILED') {
        sendDesktopNotification('❌ Scheduler Execution Failed', scheduler.error || `Scheduler failed for ${scheduler.slug}`);
      }
      prevStatusRef.current = scheduler.status;
    }
  }, [scheduler]);

  // ── Countdown ticker ──────────────────────────────────────────────────────

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

  // ── Reset ─────────────────────────────────────────────────────────────────

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
    <div className="glass-card rounded-2xl shadow-sm overflow-hidden border border-stone-200">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200 bg-stone-50/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C8922A] shadow-sm flex-shrink-0">
            <AlarmClock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading font-bold text-base sm:text-lg text-stone-900 tracking-tight">Auto-Mint Scheduler</h2>
              <span className="text-[10px] font-mono font-bold text-[#C8922A] bg-amber-500/10 border border-[#C8922A]/30 px-2 py-0.5 rounded-md uppercase">
                Backend Engine
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-stone-500">
              State persisted on server — survives browser refresh & disconnects
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Backend connection indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[10px] sm:text-[11px] font-mono text-stone-600 shadow-sm">
            <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            {backendConnected ? 'Online' : 'Offline'}
          </div>
          {/* Status badge */}
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
            {cfg.label}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" />
            <span className="flex-1 font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 font-bold text-base leading-none ml-1">×</button>
          </div>
        )}

        {/* ── Configuration Form (only when not active) ── */}
        {!isActive && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">Collection Slug</label>
                <input
                  id="scheduler-slug"
                  type="text"
                  placeholder="pudgypenguins"
                  value={scheduler?.slug || slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl light-input text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">Expected Start Time</label>
                <input
                  id="scheduler-droptime"
                  type="datetime-local"
                  value={scheduler?.expectedStartTime
                    ? new Date(scheduler.expectedStartTime).toISOString().slice(0, 16)
                    : dropTime}
                  onChange={(e) => setDropTime(e.target.value)}
                  disabled={!isEditable || loading}
                  className="w-full px-3 py-2.5 rounded-xl light-input text-xs sm:text-sm text-stone-900 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">Target Chain</label>
                <select
                  id="scheduler-chain"
                  value={scheduler?.chainId || chainId}
                  onChange={(e) => setChainId(parseInt(e.target.value))}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl light-input text-xs sm:text-sm text-stone-900 disabled:opacity-50"
                >
                  <option value={4663}>Robinhood Chain (Mainnet)</option>
                  <option value={46630}>Robinhood Testnet</option>
                  <option value={84532}>Base Sepolia (Testnet)</option>
                  <option value={8453}>Base Mainnet</option>
                  <option value={1}>Ethereum Mainnet</option>
                  <option value={42161}>Arbitrum One</option>
                  <option value={137}>Polygon Mainnet</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">Mint Execution Mode</label>
                <select
                  id="scheduler-mode"
                  value={scheduler?.mode || mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl light-input text-xs sm:text-sm text-stone-900 disabled:opacity-50"
                >
                  <option value="single">Single Wallet</option>
                  <option value="self-funded">Self-Funded Multi-Wallet</option>
                  <option value="sponsored">Sponsored (EIP-7702)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">Quantity per Wallet</label>
                <input
                  id="scheduler-quantity"
                  type="number"
                  min={1}
                  max={10}
                  value={scheduler?.quantity || quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  disabled={!isEditable || loading}
                  className="w-full px-3.5 py-2.5 rounded-xl light-input text-xs sm:text-sm text-stone-900 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Active Scheduler Summary ── */}
        {isActive && scheduler && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 sm:p-4 space-y-2 text-xs text-stone-700">
            <div className="flex justify-between items-center"><span className="text-stone-500 font-medium">Target Collection</span><span className="font-mono font-bold text-[#C8922A]">{scheduler.slug}</span></div>
            <div className="flex justify-between items-center"><span className="text-stone-500 font-medium">Chain ID</span><span className="font-mono font-semibold text-stone-800">{scheduler.chainId}</span></div>
            <div className="flex justify-between items-center"><span className="text-stone-500 font-medium">Execution Mode</span><span className="capitalize font-semibold text-stone-800">{scheduler.mode}</span></div>
            <div className="flex justify-between items-center"><span className="text-stone-500 font-medium">Active Wallets</span><span className="font-semibold text-stone-800">{scheduler.walletIds.length} wallets</span></div>
            <div className="flex justify-between items-center"><span className="text-stone-500 font-medium">Mint Qty</span><span className="font-semibold text-stone-800">{scheduler.quantity} per wallet</span></div>
          </div>
        )}

        {/* ── Countdown Cards ── */}
        {countdown && isActive && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/60 to-transparent p-4 sm:p-6 shadow-sm">
            {scheduler?.openSeaAvailable ? (
              <div className="flex items-center justify-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-purple-600 animate-pulse" />
                <p className="text-center text-xs font-bold text-purple-700 uppercase tracking-widest">
                  PUBLIC MINT DETECTED — Executing Mint...
                </p>
              </div>
            ) : countdown.isPast ? (
              <p className="text-center text-xs font-semibold text-amber-700 mb-4">
                Expected time reached — monitoring OpenSea availability aggressively...
              </p>
            ) : (
              <p className="text-center text-xs font-semibold text-stone-500 mb-4 uppercase tracking-wider">
                Countdown to expected start time
              </p>
            )}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {[
                { v: countdown.days,    l: 'Days' },
                { v: countdown.hours,   l: 'Hours' },
                { v: countdown.minutes, l: 'Min' },
                { v: countdown.seconds, l: 'Sec' },
              ].map(({ v, l }) => (
                <div key={l} className="flex flex-col items-center bg-white rounded-xl sm:rounded-2xl py-2.5 sm:py-4 border border-stone-200 shadow-sm">
                  <span className={`font-heading font-extrabold text-xl sm:text-3xl md:text-4xl tabular-nums leading-none ${countdown.isPast ? 'text-amber-600' : 'text-stone-900'}`}>
                    {String(v).padStart(2, '0')}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1.5 sm:mt-2">{l}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] sm:text-[11px] text-stone-500 mt-3 sm:mt-4 font-mono">
              ⚡ Early Public-Mint Detection active — backend polls continuously and mints early if OpenSea opens early.
            </p>
          </div>
        )}

        {/* ── Status Banners ── */}
        {status === 'FIRING' && (
          <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 flex items-center gap-3">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0 animate-pulse" />
            <span className="text-xs sm:text-sm text-purple-800 font-semibold">Broadcasting mint transactions to blockchain...</span>
          </div>
        )}

        {status === 'DONE' && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm text-emerald-800 font-semibold">Mint executed successfully! Check status feed for tx hashes.</span>
          </div>
        )}

        {status === 'FAILED' && scheduler?.error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-3">
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm text-rose-800 font-semibold">Scheduler execution halted.</p>
              <p className="text-[11px] text-rose-600 mt-0.5 font-mono">{scheduler.error}</p>
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2">
          {(status === 'IDLE' || status === 'DONE' || status === 'FAILED') && (
            <button
              id="scheduler-arm-btn"
              onClick={handleArm}
              disabled={loading || wallets.length === 0}
              className="gold-gradient-btn px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />}
              Arm Scheduler
            </button>
          )}
          {(status === 'ARMED' || status === 'CHECKING') && (
            <button
              id="scheduler-disarm-btn"
              onClick={handleDisarm}
              disabled={loading}
              className="px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 text-white flex items-center gap-2 hover:bg-rose-700 shadow-md transition-colors disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />}
              Disarm Scheduler
            </button>
          )}
          {(status === 'DONE' || status === 'FAILED') && (
            <button
              id="scheduler-reset-btn"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            id="scheduler-refresh-btn"
            onClick={refreshState}
            disabled={loading}
            title="Refresh scheduler state"
            className="ml-auto p-2 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="text-xs text-stone-500 font-medium hidden sm:inline">
            {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} ready
          </span>
        </div>

        {/* ── Activity Log ── */}
        {logs.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-stone-500" />
              <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Scheduler Activity Log</p>
            </div>
            <div className="bg-stone-900 rounded-xl p-3 sm:p-4 space-y-1.5 max-h-48 overflow-y-auto border border-stone-800">
              {logs.map((entry) => (
                <p
                  key={entry.id}
                  className={`text-[10px] sm:text-[11px] font-mono leading-relaxed ${
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
                      : 'text-stone-300'
                  }`}
                >
                  <span className="text-stone-500 mr-1.5 sm:mr-2">
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
