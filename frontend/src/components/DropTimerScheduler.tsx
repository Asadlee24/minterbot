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
  IDLE:     { label: 'Not scheduled',           bg: 'bg-stone-100',   border: 'border-stone-200',   text: 'text-stone-500',   dot: 'bg-stone-400' },
  ARMED:    { label: 'Armed — awaiting start',  bg: 'bg-amber-50',    border: 'border-amber-300',   text: 'text-amber-700',   dot: 'bg-amber-500',   pulse: true },
  CHECKING: { label: 'Monitoring OpenSea...',   bg: 'bg-blue-50',     border: 'border-blue-300',    text: 'text-blue-700',    dot: 'bg-blue-500',    pulse: true },
  FIRING:   { label: 'Minting now!',            bg: 'bg-violet-50',   border: 'border-violet-300',  text: 'text-violet-700',  dot: 'bg-violet-500',  pulse: true },
  DONE:     { label: 'Done — mint executed',    bg: 'bg-emerald-50',  border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  FAILED:   { label: 'Failed — see log',        bg: 'bg-red-50',      border: 'border-red-300',     text: 'text-red-700',     dot: 'bg-red-500' },
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
    if (wallets.length === 0) return setError('Generate or import at least one wallet first.');
    if (new Date(dropTime) <= new Date()) return setError('Expected start time must be in the future.');

    setLoading(true);
    setError(null);
    try {
      await armScheduler({
        slug: slug.trim().toLowerCase(),
        expectedStartTime: new Date(dropTime).toISOString(),
        chainId,
        quantity,
        mode,
        walletIds: wallets.map((w) => w.id)
      });
      await refreshState();
    } catch (err: any) {
      setError(`Failed to arm scheduler: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Disarm ────────────────────────────────────────────────────────────────

  const handleDisarm = async () => {
    setLoading(true);
    setError(null);
    try {
      await disarmScheduler();
      await refreshState();
    } catch (err: any) {
      setError(`Failed to disarm: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Reset (local form only) ───────────────────────────────────────────────

  const handleReset = () => {
    setSlug('');
    setDropTime('');
    setError(null);
  };

  // ── Derived UI state ──────────────────────────────────────────────────────

  const status: SchedulerStatus = scheduler?.status || 'IDLE';
  const cfg = statusConfig[status];
  const isActive = ['ARMED', 'CHECKING', 'FIRING'].includes(status);
  const isEditable = !isActive && status !== 'DONE';

  return (
    <div className="glass-card rounded-2xl border border-amber-900/10 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-[#C8922A]/20 flex items-center justify-center text-[#C8922A]">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-stone-900 text-sm">Auto-Mint Scheduler</h2>
            <p className="text-stone-400 text-xs">
              {backendConnected
                ? 'Backend-driven — survives browser refresh'
                : 'Connecting to backend...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Backend connection indicator */}
          <div className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-emerald-400' : 'bg-red-400'}`} title={backendConnected ? 'Backend connected' : 'Backend offline'} />
          {/* Status badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
            {cfg.label}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 font-bold text-base leading-none ml-1">×</button>
          </div>
        )}

        {/* ── Configuration Form (only when not active) ── */}
        {!isActive && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Collection Slug</label>
                <input
                  id="scheduler-slug"
                  type="text"
                  placeholder="pudgypenguins"
                  value={scheduler?.slug || slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={!isEditable || loading}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] placeholder:text-stone-300 disabled:opacity-50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Expected Start Time</label>
                <input
                  id="scheduler-droptime"
                  type="datetime-local"
                  value={scheduler?.expectedStartTime
                    ? new Date(scheduler.expectedStartTime).toISOString().slice(0, 16)
                    : dropTime}
                  onChange={(e) => setDropTime(e.target.value)}
                  disabled={!isEditable || loading}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Target Chain</label>
                <select
                  id="scheduler-chain"
                  value={scheduler?.chainId || chainId}
                  onChange={(e) => setChainId(parseInt(e.target.value))}
                  disabled={!isEditable || loading}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50 transition-colors"
                >
                  <option value={4663}>Robinhood Chain (Mainnet)</option>
                  <option value={46630}>Robinhood Testnet</option>
                  <option value={84532}>Base Sepolia (Testnet)</option>
                  <option value={8453}>Base Mainnet</option>
                  <option value={1}>Ethereum</option>
                  <option value={42161}>Arbitrum One</option>
                  <option value={137}>Polygon</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Mint Mode</label>
                <select
                  id="scheduler-mode"
                  value={scheduler?.mode || mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  disabled={!isEditable || loading}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50 transition-colors"
                >
                  <option value="single">Single Wallet</option>
                  <option value="self-funded">Self-Funded Multi-Wallet</option>
                  <option value="sponsored">Sponsored (EIP-7702)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Quantity per Wallet</label>
                <input
                  id="scheduler-quantity"
                  type="number"
                  min={1}
                  max={10}
                  value={scheduler?.quantity || quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  disabled={!isEditable || loading}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50 transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Active Scheduler Summary ── */}
        {isActive && scheduler && (
          <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-3 space-y-1.5 text-xs text-stone-600">
            <div className="flex justify-between"><span className="text-stone-400">Collection</span><span className="font-mono font-medium">{scheduler.slug}</span></div>
            <div className="flex justify-between"><span className="text-stone-400">Chain</span><span>{scheduler.chainId}</span></div>
            <div className="flex justify-between"><span className="text-stone-400">Mode</span><span className="capitalize">{scheduler.mode}</span></div>
            <div className="flex justify-between"><span className="text-stone-400">Wallets</span><span>{scheduler.walletIds.length}</span></div>
            <div className="flex justify-between"><span className="text-stone-400">Qty/wallet</span><span>{scheduler.quantity}</span></div>
            {scheduler.lastCheckTimestamp && (
              <div className="flex justify-between"><span className="text-stone-400">Last check</span><span>{new Date(scheduler.lastCheckTimestamp).toLocaleTimeString()}</span></div>
            )}
            {scheduler.nextCheckTimestamp && (
              <div className="flex justify-between"><span className="text-stone-400">Next check</span><span>{new Date(scheduler.nextCheckTimestamp).toLocaleTimeString()}</span></div>
            )}
          </div>
        )}

        {/* ── Countdown (display only — does NOT control execution) ── */}
        {countdown && isActive && (
          <div className="rounded-2xl border border-[#C8922A]/20 bg-gradient-to-b from-amber-500/5 to-transparent p-5">
            {scheduler?.openSeaAvailable ? (
              <div className="flex items-center justify-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-violet-500 animate-pulse" />
                <p className="text-center text-xs font-semibold text-violet-600 uppercase tracking-widest">
                  PUBLIC MINT DETECTED — Firing mint...
                </p>
              </div>
            ) : countdown.isPast ? (
              <p className="text-center text-xs font-medium text-amber-600 mb-4">
                Expected time passed — monitoring for availability...
              </p>
            ) : (
              <p className="text-center text-xs font-medium text-stone-400 mb-4">
                Expected public mint start in
              </p>
            )}
            <div className="grid grid-cols-4 gap-3">
              {[
                { v: countdown.days,    l: 'Days' },
                { v: countdown.hours,   l: 'Hours' },
                { v: countdown.minutes, l: 'Min' },
                { v: countdown.seconds, l: 'Sec' },
              ].map(({ v, l }) => (
                <div key={l} className="flex flex-col items-center bg-white rounded-2xl py-4 border border-stone-100 shadow-sm">
                  <span className={`font-mono font-bold text-4xl tabular-nums leading-none ${countdown.isPast ? 'text-amber-600' : 'text-stone-900'}`}>
                    {String(v).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mt-2">{l}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] text-stone-300 mt-3">
              ⚡ Countdown is display only — backend polls OpenSea independently and fires mint on early detection
            </p>
          </div>
        )}

        {/* ── Firing banner ── */}
        {status === 'FIRING' && (
          <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 flex items-center gap-3">
            <Zap className="w-4 h-4 text-violet-500 flex-shrink-0 animate-pulse" />
            <span className="text-sm text-violet-700 font-medium">Sending transactions to chain — {scheduler?.walletIds.length} wallet(s)...</span>
          </div>
        )}

        {/* ── Done banner ── */}
        {status === 'DONE' && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span className="text-sm text-emerald-700 font-medium">Mint executed. Check the Status Feed for transaction details.</span>
          </div>
        )}

        {/* ── Failed banner ── */}
        {status === 'FAILED' && scheduler?.error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-3">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700 font-medium">Scheduler failed.</p>
              <p className="text-xs text-red-500 mt-0.5 font-mono">{scheduler.error}</p>
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-3">
          {(status === 'IDLE' || status === 'DONE' || status === 'FAILED') && (
            <button
              id="scheduler-arm-btn"
              onClick={handleArm}
              disabled={loading || wallets.length === 0}
              className="gold-gradient-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              Arm Scheduler
            </button>
          )}
          {(status === 'ARMED' || status === 'CHECKING') && (
            <button
              id="scheduler-disarm-btn"
              onClick={handleDisarm}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-stone-900 text-white flex items-center gap-2 hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
              Disarm
            </button>
          )}
          {(status === 'DONE' || status === 'FAILED') && (
            <button
              id="scheduler-reset-btn"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-600 hover:border-stone-300 bg-white/70 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            id="scheduler-refresh-btn"
            onClick={refreshState}
            disabled={loading}
            title="Refresh scheduler state"
            className="ml-auto p-2 rounded-lg border border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 bg-white/70 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-stone-400">
            {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} ready
          </span>
        </div>

        {/* ── Monitoring state indicator ── */}
        {status === 'CHECKING' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
            <Eye className="w-3.5 h-3.5 text-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-xs text-blue-700">
              Polling OpenSea for public mint availability — adaptive interval
              {scheduler?.openSeaAvailable && (
                <span className="ml-2 font-semibold text-violet-700">• DETECTED</span>
              )}
            </span>
          </div>
        )}

        {/* ── Activity Log (from backend — survives browser refresh) ── */}
        {logs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3 h-3 text-stone-400" />
              <p className="text-xs font-medium text-stone-400">Activity log</p>
              <span className="text-[10px] text-stone-300">(persisted on backend)</span>
            </div>
            <div className="bg-stone-950 rounded-xl px-4 py-3 space-y-1 max-h-48 overflow-y-auto">
              {logs.map((entry) => (
                <p
                  key={entry.id}
                  className={`text-[11px] font-mono leading-relaxed ${
                    entry.message.includes('❌') || entry.message.includes('Error') || entry.message.includes('FAILED') || entry.message.includes('failed')
                      ? 'text-red-400'
                      : entry.message.includes('✅') || entry.message.includes('DONE') || entry.message.includes('completed') || entry.message.includes('executed')
                      ? 'text-emerald-400'
                      : entry.message.includes('🔥') || entry.message.includes('FIRING') || entry.message.includes('Minting') || entry.message.includes('Sending')
                      ? 'text-violet-300'
                      : entry.message.includes('⏳') || entry.message.includes('Monitoring') || entry.message.includes('Polling')
                      ? 'text-blue-300'
                      : entry.message.includes('⚠️') || entry.message.includes('Recovery') || entry.message.includes('warning')
                      ? 'text-amber-300'
                      : 'text-stone-400'
                  }`}
                >
                  <span className="text-stone-600 mr-2">
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
