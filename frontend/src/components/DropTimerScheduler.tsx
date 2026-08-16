'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Zap, AlarmClock, CheckCircle2, XCircle, Play, Square, Clock } from 'lucide-react';

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
  const diff = Math.max(0, targetDate.getTime() - now);
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    total: diff
  };
}

const statusConfig = {
  idle:   { label: 'Not scheduled',          bg: 'bg-stone-100',   border: 'border-stone-200',   text: 'text-stone-500',  dot: 'bg-stone-400' },
  armed:  { label: 'Scheduled — armed',       bg: 'bg-amber-50',    border: 'border-amber-300',   text: 'text-amber-700',  dot: 'bg-amber-500' },
  firing: { label: 'Firing — minting now',    bg: 'bg-blue-50',     border: 'border-blue-300',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  done:   { label: 'Done — mint executed',    bg: 'bg-emerald-50',  border: 'border-emerald-300', text: 'text-emerald-700',dot: 'bg-emerald-500' },
  failed: { label: 'Failed — see log',        bg: 'bg-red-50',      border: 'border-red-300',     text: 'text-red-700',    dot: 'bg-red-500' },
};

export default function DropTimerScheduler({ onExecuteMint, walletsCount }: DropTimerProps) {
  const [dropTime, setDropTime] = useState('');
  const [slug, setSlug] = useState('');
  const [chainId, setChainId] = useState(84532);
  const [status, setStatus] = useState<SchedulerStatus>('idle');
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const firedRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLog((prev) => [`${ts}  ${msg}`, ...prev].slice(0, 30));
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const handleArm = () => {
    if (!dropTime)      return alert('Set a drop date and time first.');
    if (!slug.trim())   return alert('Enter a collection slug.');
    if (walletsCount === 0) return alert('Generate or import at least one wallet first.');
    if (new Date(dropTime) <= new Date()) return alert('Drop time must be in the future.');
    firedRef.current = false;
    setStatus('armed');
    addLog(`Scheduler armed — target: ${new Date(dropTime).toLocaleString()}`);
    addLog(`Collection: ${slug}   Chain: ${chainId}   Wallets: ${walletsCount}`);
  };

  const handleDisarm = useCallback(() => {
    clearTimer();
    setStatus('idle');
    setCountdown(null);
    firedRef.current = false;
    addLog('Scheduler disarmed.');
  }, [clearTimer, addLog]);

  useEffect(() => {
    if (status !== 'armed') { clearTimer(); return; }
    const target = new Date(dropTime);

    const tick = async () => {
      const cd = getCountdown(target);
      setCountdown(cd);
      if (cd.total <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearTimer();
        setStatus('firing');
        addLog('Drop time reached — sending transaction...');
        try {
          await onExecuteMint({ slug, collectionSlug: slug, chainId, mode: 'single' });
          setStatus('done');
          addLog('Mint executed — check the Status Feed for transaction hashes.');
        } catch (err: any) {
          setStatus('failed');
          addLog(`Error: ${err.message}`);
        }
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearTimer();
  }, [status, dropTime, slug, chainId, clearTimer, addLog, onExecuteMint]);

  const cfg = statusConfig[status];

  return (
    <div className="glass-card rounded-2xl border border-amber-900/10 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-[#C8922A]/20 flex items-center justify-center text-[#C8922A]">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-stone-900 text-sm">Auto-Mint Scheduler</h2>
            <p className="text-stone-400 text-xs">Schedule a mint to fire automatically at drop time</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'armed' ? 'animate-pulse' : ''}`} />
          {cfg.label}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Config */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Collection Slug</label>
            <input
              type="text"
              placeholder="pudgypenguins"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={status === 'armed' || status === 'firing'}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] placeholder:text-stone-300 disabled:opacity-50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Drop Date & Time</label>
            <input
              type="datetime-local"
              value={dropTime}
              onChange={(e) => setDropTime(e.target.value)}
              disabled={status === 'armed' || status === 'firing'}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 bg-white/70 focus:outline-none focus:border-[#C8922A] disabled:opacity-50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Target Chain</label>
            <select
              value={chainId}
              onChange={(e) => setChainId(parseInt(e.target.value))}
              disabled={status === 'armed' || status === 'firing'}
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

        {/* Countdown */}
        {status === 'armed' && countdown && (
          <div className="rounded-2xl border border-[#C8922A]/20 bg-gradient-to-b from-amber-500/5 to-transparent p-5">
            <p className="text-center text-xs font-medium text-stone-400 mb-4">Minting in</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { v: countdown.days,    l: 'Days' },
                { v: countdown.hours,   l: 'Hours' },
                { v: countdown.minutes, l: 'Min' },
                { v: countdown.seconds, l: 'Sec' },
              ].map(({ v, l }) => (
                <div key={l} className="flex flex-col items-center bg-white rounded-2xl py-4 border border-stone-100 shadow-sm">
                  <span className="font-mono font-bold text-4xl text-stone-900 tabular-nums leading-none">
                    {String(v).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mt-2">{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Firing */}
        {status === 'firing' && (
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center gap-3">
            <Zap className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-blue-700 font-medium">Sending transaction to chain...</span>
          </div>
        )}

        {/* Done */}
        {status === 'done' && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span className="text-sm text-emerald-700 font-medium">Mint executed. Check the Status Feed for transaction details.</span>
          </div>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-3">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 font-medium">Mint failed. See log below for details.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {(status === 'idle' || status === 'done' || status === 'failed') && (
            <button
              onClick={handleArm}
              className="gold-gradient-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Arm Scheduler
            </button>
          )}
          {status === 'armed' && (
            <button
              onClick={handleDisarm}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-stone-900 text-white flex items-center gap-2 hover:bg-stone-800 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Disarm
            </button>
          )}
          {(status === 'done' || status === 'failed') && (
            <button
              onClick={() => { setStatus('idle'); setLog([]); }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-600 hover:border-stone-300 bg-white/70 transition-colors"
            >
              Reset
            </button>
          )}
          <span className="ml-auto text-xs text-stone-400">
            {walletsCount} wallet{walletsCount !== 1 ? 's' : ''} ready
          </span>
        </div>

        {/* Activity Log */}
        {log.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 mb-2">Activity log</p>
            <div className="bg-stone-950 rounded-xl px-4 py-3 space-y-1 max-h-36 overflow-y-auto">
              {log.map((line, i) => (
                <p key={i} className={`text-[11px] font-mono leading-relaxed ${
                  line.includes('Error') || line.includes('failed')
                    ? 'text-red-400'
                    : line.includes('executed') || line.includes('Done')
                    ? 'text-emerald-400'
                    : line.includes('Firing') || line.includes('Sending')
                    ? 'text-blue-300'
                    : 'text-stone-400'
                }`}>
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
