'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Zap, AlarmClock, CheckCircle2, XCircle, Play, Square, ChevronRight, Clock } from 'lucide-react';

interface DropTimerProps {
  onExecuteMint: (payload: any) => Promise<void>;
  walletsCount: number;
}

type SchedulerStatus = 'idle' | 'armed' | 'firing' | 'done' | 'failed';

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getCountdown(targetDate: Date): Countdown {
  const now = new Date().getTime();
  const target = targetDate.getTime();
  const diff = Math.max(0, target - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, total: diff };
}

export default function DropTimerScheduler({ onExecuteMint, walletsCount }: DropTimerProps) {
  const [dropTime, setDropTime] = useState('');
  const [slug, setSlug] = useState('');
  const [chainId, setChainId] = useState(84532);
  const [status, setStatus] = useState<SchedulerStatus>('idle');
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const firedRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 30));
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleArm = () => {
    if (!dropTime) {
      alert('Please set a drop date & time first!');
      return;
    }
    if (!slug.trim()) {
      alert('Please enter a collection slug!');
      return;
    }
    if (walletsCount === 0) {
      alert('Please generate or import at least 1 wallet first!');
      return;
    }

    const target = new Date(dropTime);
    if (target <= new Date()) {
      alert('Drop time must be in the future!');
      return;
    }

    firedRef.current = false;
    setStatus('armed');
    addLog(`🎯 Scheduler ARMED — Target: ${target.toLocaleString()}`);
    addLog(`📦 Collection: ${slug} | Chain ID: ${chainId}`);
    addLog(`👛 ${walletsCount} wallet(s) ready to fire`);
  };

  const handleDisarm = useCallback(() => {
    clearTimer();
    setStatus('idle');
    setCountdown(null);
    firedRef.current = false;
    addLog('🛑 Scheduler disarmed.');
  }, [clearTimer, addLog]);

  // Countdown ticker
  useEffect(() => {
    if (status !== 'armed') {
      clearTimer();
      return;
    }

    const target = new Date(dropTime);

    const tick = async () => {
      const cd = getCountdown(target);
      setCountdown(cd);

      if (cd.total <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearTimer();
        setStatus('firing');
        addLog('🚀 DROP TIME REACHED — Firing mint transaction(s)...');

        try {
          await onExecuteMint({ slug, collectionSlug: slug, chainId, mode: 'single' });
          setStatus('done');
          addLog('✅ Mint successfully executed! Check Mint Status Feed for TX hashes.');
        } catch (err: any) {
          setStatus('failed');
          addLog(`❌ Mint failed: ${err.message}`);
        }
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => clearTimer();
  }, [status, dropTime, slug, chainId, clearTimer, addLog, onExecuteMint]);

  const statusConfig: Record<SchedulerStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    idle: {
      label: 'Idle — Not Armed',
      color: 'text-stone-500',
      bg: 'bg-stone-100',
      border: 'border-stone-200',
      icon: <Clock className="w-4 h-4" />
    },
    armed: {
      label: 'ARMED — Waiting for Drop',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      icon: <AlarmClock className="w-4 h-4 animate-pulse" />
    },
    firing: {
      label: 'FIRING — Minting in Progress...',
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      icon: <Zap className="w-4 h-4 animate-bounce" />
    },
    done: {
      label: 'DONE — Mint Executed!',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-300',
      icon: <CheckCircle2 className="w-4 h-4" />
    },
    failed: {
      label: 'FAILED — Mint Error',
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-300',
      icon: <XCircle className="w-4 h-4" />
    }
  };

  const cfg = statusConfig[status];

  return (
    <div className="glass-card rounded-2xl border border-amber-900/10 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/10 bg-gradient-to-r from-amber-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-[#C8922A]/30 flex items-center justify-center text-[#C8922A]">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-lg text-stone-900">Drop Timer & Auto-Mint</h2>
            <p className="text-stone-500 text-xs font-mono">Schedule mint to fire automatically at drop time</p>
          </div>
        </div>
        {/* Status Badge */}
        <span className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${cfg.bg} ${cfg.border} ${cfg.color}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div className="p-6 space-y-5">
        {/* Config Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Collection Slug */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Collection Slug</label>
            <input
              type="text"
              placeholder="e.g. pudgypenguins"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={status === 'armed' || status === 'firing'}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#C8922A] bg-white/70 font-mono placeholder:text-stone-400 disabled:opacity-50"
            />
          </div>

          {/* Drop DateTime */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Drop Date & Time</label>
            <input
              type="datetime-local"
              value={dropTime}
              onChange={(e) => setDropTime(e.target.value)}
              disabled={status === 'armed' || status === 'firing'}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#C8922A] bg-white/70 disabled:opacity-50"
            />
          </div>

          {/* Chain */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">Target Chain</label>
            <select
              value={chainId}
              onChange={(e) => setChainId(parseInt(e.target.value))}
              disabled={status === 'armed' || status === 'firing'}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#C8922A] bg-white/70 font-medium disabled:opacity-50"
            >
              <option value={84532}>Base Sepolia (Testnet)</option>
              <option value={4862}>Robinhood Chain ✨</option>
              <option value={8453}>Base Mainnet</option>
              <option value={1}>Ethereum Mainnet</option>
              <option value={42161}>Arbitrum One</option>
              <option value={137}>Polygon</option>
            </select>
          </div>
        </div>

        {/* Countdown Display */}
        {status === 'armed' && countdown && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-stone-50 to-amber-500/5 border border-[#C8922A]/30 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#C8922A] mb-3 text-center flex items-center justify-center gap-1.5">
              <AlarmClock className="w-3.5 h-3.5" /> Auto-Firing In...
            </p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: countdown.days, label: 'Days' },
                { value: countdown.hours, label: 'Hours' },
                { value: countdown.minutes, label: 'Mins' },
                { value: countdown.seconds, label: 'Secs' }
              ].map(({ value, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center bg-white/80 border border-[#C8922A]/20 rounded-2xl py-4 px-2 shadow-sm"
                >
                  <span className="font-mono font-extrabold text-4xl text-stone-900 leading-none tabular-nums">
                    {String(value).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Firing animation */}
        {status === 'firing' && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-5 flex items-center justify-center gap-3">
            <Zap className="w-6 h-6 text-blue-600 animate-bounce" />
            <span className="text-blue-700 font-bold text-sm animate-pulse">Minting in progress... Sending transaction(s) to chain!</span>
          </div>
        )}

        {/* Done */}
        {status === 'done' && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-emerald-700 font-semibold text-sm">Mint executed! Check the Mint Status Feed below for TX hashes.</span>
          </div>
        )}

        {/* Arm / Disarm Buttons */}
        <div className="flex items-center gap-3">
          {status === 'idle' || status === 'done' || status === 'failed' ? (
            <button
              onClick={handleArm}
              className="gold-gradient-btn px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md"
            >
              <Play className="w-4 h-4" /> Arm Scheduler
            </button>
          ) : status === 'armed' ? (
            <button
              onClick={handleDisarm}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white flex items-center gap-2 shadow-md hover:bg-red-600 transition-colors"
            >
              <Square className="w-4 h-4" /> Disarm
            </button>
          ) : null}

          {status === 'done' || status === 'failed' ? (
            <button
              onClick={() => { setStatus('idle'); setLog([]); }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-stone-300 text-stone-700 bg-white/70 hover:border-[#C8922A] transition-colors"
            >
              Reset
            </button>
          ) : null}

          <span className="text-xs text-stone-500 font-mono flex items-center gap-1">
            <ChevronRight className="w-3 h-3" /> {walletsCount} wallet(s) configured
          </span>
        </div>

        {/* Activity Log */}
        {log.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Scheduler Log</p>
            <div
              ref={logRef}
              className="bg-stone-900 rounded-xl p-4 space-y-1 max-h-40 overflow-y-auto font-mono"
            >
              {log.map((line, i) => (
                <p
                  key={i}
                  className={`text-xs leading-relaxed ${
                    line.includes('✅') ? 'text-emerald-400' :
                    line.includes('❌') ? 'text-red-400' :
                    line.includes('🚀') ? 'text-amber-300' :
                    line.includes('🎯') ? 'text-blue-300' :
                    'text-stone-400'
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
