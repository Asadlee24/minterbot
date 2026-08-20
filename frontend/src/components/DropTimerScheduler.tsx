'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Timer, Zap, CheckCircle2, XCircle, Play, Square, Radio, RefreshCw } from 'lucide-react';
import { armScheduler, disarmScheduler, fetchScheduler, fetchWallets, getSocket, SchedulerArmPayload } from '../lib/api';

interface DropTimerProps {
  // Kept for parent compatibility. Scheduler execution is never triggered by this callback.
  onExecuteMint?: (payload: any) => Promise<void>;
  walletsCount: number;
}

type SchedulerStatus = 'IDLE' | 'ARMED' | 'CHECKING' | 'FIRING' | 'DONE' | 'FAILED';
type SchedulerData = {
  id: string;
  slug: string;
  expectedStartTime: string;
  chainId: number;
  quantity: number;
  mode: 'single' | 'self-funded' | 'sponsored';
  walletIds: string[];
  status: SchedulerStatus;
  monitoringState: string;
  availabilityState: string;
  lastCheckAt?: string;
  nextCheckAt?: string;
  firstAvailabilityAt?: string;
  firingAt?: string;
  completionAt?: string;
  error?: string;
  logs: string[];
  updatedAt: string;
};

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getCountdown(targetDate: Date): Countdown {
  const diff = Math.max(0, targetDate.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    total: diff
  };
}

const statusConfig: Record<SchedulerStatus, { label: string; bg: string; border: string; text: string; dot: string }> = {
  IDLE: { label: 'Not scheduled', bg: 'bg-stone-100', border: 'border-stone-200', text: 'text-stone-500', dot: 'bg-stone-400' },
  ARMED: { label: 'Scheduled — armed', bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
  CHECKING: { label: 'Monitoring OpenSea', bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', dot: 'bg-violet-500' },
  FIRING: { label: 'Firing — minting now', bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' },
  DONE: { label: 'Done — mint executed', bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  FAILED: { label: 'Failed — see log', bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' }
};

export default function DropTimerScheduler({ walletsCount, onExecuteMint: _onExecuteMint }: DropTimerProps) {
  const [slug, setSlug] = useState('');
  const [dropTime, setDropTime] = useState('');
  const [chainId, setChainId] = useState(84532);
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<SchedulerArmPayload['mode']>('self-funded');
  const [scheduler, setScheduler] = useState<SchedulerData | null>(null);
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScheduler = async () => {
    try {
      const data = await fetchScheduler();
      setScheduler(data.scheduler || null);
      if (data.scheduler) {
        setSlug(data.scheduler.slug);
        setChainId(data.scheduler.chainId);
        setQuantity(data.scheduler.quantity);
        setMode(data.scheduler.mode);
        const date = new Date(data.scheduler.expectedStartTime);
        if (Number.isFinite(date.getTime())) {
          const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setDropTime(local);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load scheduler');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadScheduler();
    const poll = window.setInterval(() => void loadScheduler(), 5000);
    const socket = getSocket();
    const onSchedulerUpdate = (data: SchedulerData) => setScheduler(data);
    if (socket) socket.on('scheduler_update', onSchedulerUpdate);

    return () => {
      window.clearInterval(poll);
      if (socket) socket.off('scheduler_update', onSchedulerUpdate);
    };
  }, []);

  useEffect(() => {
    if (!scheduler?.expectedStartTime) {
      setCountdown(null);
      return;
    }
    const update = () => setCountdown(getCountdown(new Date(scheduler.expectedStartTime)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [scheduler?.expectedStartTime]);

  const status: SchedulerStatus = scheduler?.status || 'IDLE';
  const cfg = statusConfig[status];
  const active = status === 'ARMED' || status === 'CHECKING';
  const canArm = !active && status !== 'FIRING' && walletsCount > 0;
  const expectedReached = !!countdown && countdown.total <= 0;
  const availabilityLabel = useMemo(() => {
    if (!scheduler) return 'Waiting for scheduler';
    if (scheduler.availabilityState === 'AVAILABLE') return 'PUBLIC MINT DETECTED';
    if (scheduler.availabilityState === 'ERROR') return 'OpenSea check error — retrying';
    if (scheduler.availabilityState === 'UNAVAILABLE') return 'Public mint not available yet';
    return 'Waiting for first OpenSea check';
  }, [scheduler]);

  const handleArm = async () => {
    setError(null);
    if (!slug.trim()) return setError('Enter a collection slug.');
    if (!dropTime) return setError('Set an expected/latest public mint time first.');
    if (walletsCount === 0) return setError('Generate or import at least one wallet first.');
    if (new Date(dropTime).getTime() <= Date.now()) return setError('Expected start time must be in the future.');

    setActionLoading(true);
    try {
      const walletData = await fetchWallets(true);
      const walletIds = (walletData.wallets || []).map((wallet: { id: string }) => wallet.id);
      if (!walletIds.length) throw new Error('No wallets available on the backend.');

      const payload: SchedulerArmPayload = {
        slug: slug.trim(),
        expectedStartTime: new Date(dropTime).toISOString(),
        chainId,
        quantity,
        mode,
        walletIds
      };
      const data = await armScheduler(payload);
      setScheduler(data.scheduler);
    } catch (err: any) {
      setError(err.message || 'Failed to arm scheduler');
      await loadScheduler();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisarm = async () => {
    setError(null);
    setActionLoading(true);
    try {
      const data = await disarmScheduler();
      setScheduler(data.scheduler || null);
    } catch (err: any) {
      setError(err.message || 'Failed to disarm scheduler');
      await loadScheduler();
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setScheduler(null);
    setError(null);
    setSlug('');
    setDropTime('');
  };

  return (
    <div className="glass-card rounded-2xl border border-amber-900/10 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-[#C8922A]/20 flex items-center justify-center text-[#C8922A]"><Timer className="w-4 h-4" /></div>
          <div>
            <h2 className="font-semibold text-stone-900 text-sm">Auto-Mint Scheduler</h2>
            <p className="text-stone-400 text-xs">Backend-owned OpenSea monitoring — refresh-safe</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${active ? 'animate-pulse' : ''}`} />{cfg.label}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Collection Slug</label>
            <input type="text" placeholder="pudgypenguins" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={active || status === 'FIRING'} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] placeholder:text-stone-300 disabled:opacity-50" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Expected / Latest Public Mint Time</label>
            <input type="datetime-local" value={dropTime} onChange={(e) => setDropTime(e.target.value)} disabled={active || status === 'FIRING'} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Chain</label>
            <select value={chainId} onChange={(e) => setChainId(Number(e.target.value))} disabled={active || status === 'FIRING'} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50">
              <option value={4663}>Robinhood Chain</option>
              <option value={46630}>Robinhood Testnet</option>
              <option value={84532}>Base Sepolia</option>
              <option value={8453}>Base Mainnet</option>
              <option value={1}>Ethereum</option>
              <option value={42161}>Arbitrum One</option>
              <option value={137}>Polygon</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Quantity</label>
            <input type="number" min={1} max={100} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} disabled={active || status === 'FIRING'} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Mint Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as SchedulerArmPayload['mode'])} disabled={active || status === 'FIRING'} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50">
              <option value="single">Single wallet</option>
              <option value="self-funded">Self-funded multi-wallet</option>
              <option value="sponsored">Sponsored / EIP-7702</option>
            </select>
          </div>
        </div>

        {scheduler && active && countdown && (
          <div className="rounded-2xl border border-[#C8922A]/20 bg-gradient-to-b from-amber-500/5 to-transparent p-5">
            <p className="text-center text-xs font-medium text-stone-400 mb-1">{expectedReached ? 'Expected time reached — countdown is bypassed' : 'Expected time reference'}</p>
            <p className="text-center text-[11px] text-stone-400 mb-4">Backend continues checking OpenSea and will fire as soon as the public stage is actually available.</p>
            <div className="grid grid-cols-4 gap-3">
              {[{ v: countdown.days, l: 'Days' }, { v: countdown.hours, l: 'Hours' }, { v: countdown.minutes, l: 'Min' }, { v: countdown.seconds, l: 'Sec' }].map(({ v, l }) => (
                <div key={l} className="flex flex-col items-center bg-white rounded-2xl py-4 border border-stone-100 shadow-sm">
                  <span className="font-mono font-bold text-4xl text-stone-900 tabular-nums leading-none">{String(v).padStart(2, '0')}</span>
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mt-2">{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {scheduler && (active || status === 'FIRING') && (
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${scheduler.availabilityState === 'AVAILABLE' ? 'bg-emerald-50 border-emerald-100' : 'bg-stone-50 border-stone-100'}`}>
            {scheduler.availabilityState === 'AVAILABLE' ? <Zap className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Radio className="w-4 h-4 text-violet-500 flex-shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800">{status === 'FIRING' ? 'PUBLIC MINT DETECTED — Firing mint...' : availabilityLabel}</p>
              <p className="text-[11px] text-stone-500">Last check: {scheduler.lastCheckAt ? new Date(scheduler.lastCheckAt).toLocaleTimeString() : 'waiting'}{scheduler.firstAvailabilityAt ? ` · First detected: ${new Date(scheduler.firstAvailabilityAt).toLocaleTimeString()}` : ''}</p>
            </div>
          </div>
        )}

        {status === 'DONE' && <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-sm text-emerald-700 font-medium">Mint execution completed. Transaction progress is available in the Status Feed and persisted logs.</span></div>}
        {status === 'FAILED' && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-3"><XCircle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-700 font-medium">Scheduler failed. It will not automatically replay the mint.</span></div>}
        {status === 'FIRING' && <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center gap-3"><Zap className="w-4 h-4 text-blue-500" /><span className="text-sm text-blue-700 font-medium">Existing mint engine is executing the persisted wallet configuration.</span></div>}

        <div className="flex items-center gap-3">
          {canArm && <button onClick={handleArm} disabled={actionLoading || loading} className="gold-gradient-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"><Play className="w-3.5 h-3.5 fill-current" /> {actionLoading ? 'Arming...' : 'Arm Scheduler'}</button>}
          {active && <button onClick={handleDisarm} disabled={actionLoading} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-stone-900 text-white flex items-center gap-2 hover:bg-stone-800 disabled:opacity-50"><Square className="w-3.5 h-3.5 fill-current" /> {actionLoading ? 'Disarming...' : 'Disarm'}</button>}
          {(status === 'DONE' || status === 'FAILED') && <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-600 hover:border-stone-300 bg-white/70">Reset</button>}
          <button onClick={() => void loadScheduler()} disabled={loading} className="ml-auto p-2.5 rounded-xl border border-stone-200 bg-white/70 text-stone-500 hover:text-stone-800" title="Refresh backend scheduler state"><RefreshCw className="w-4 h-4" /></button>
          <span className="text-xs text-stone-400">{walletsCount} wallet{walletsCount !== 1 ? 's' : ''} ready</span>
        </div>

        {scheduler && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-stone-400">Persisted activity log</p>
              <span className="text-[10px] text-stone-400">Updated {new Date(scheduler.updatedAt).toLocaleTimeString()}</span>
            </div>
            <div className="bg-stone-950 rounded-xl px-4 py-3 space-y-1 max-h-48 overflow-y-auto">
              {(scheduler.logs || []).slice(0, 50).map((line, i) => (
                <p key={`${scheduler.id}-${i}`} className={`text-[11px] font-mono leading-relaxed ${line.toLowerCase().includes('failed') || line.toLowerCase().includes('error') ? 'text-red-400' : line.toLowerCase().includes('detected') || line.toLowerCase().includes('completed') ? 'text-emerald-400' : line.toLowerCase().includes('firing') ? 'text-blue-300' : 'text-stone-400'}`}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
