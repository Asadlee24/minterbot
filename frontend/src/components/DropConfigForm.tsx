'use client';

import React, { useState } from 'react';
import { Search, Zap, Shield, Layers, Play, AlertTriangle, Sparkles, Check } from 'lucide-react';

interface DropConfigFormProps {
  onExecuteMint: (payload: any) => void;
  onFetchCollection: (slug: string, chainId: number) => Promise<any>;
  walletsCount: number;
}

export default function DropConfigForm({ onExecuteMint, onFetchCollection, walletsCount }: DropConfigFormProps) {
  const [slug, setSlug] = useState('pudgypenguins');
  const [loading, setLoading] = useState(false);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [mode, setMode] = useState<'single' | 'self-funded' | 'sponsored'>('single');
  const [chainId, setChainId] = useState(84532); // Default Base Sepolia
  const [quantity, setQuantity] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [executorAddress, setExecutorAddress] = useState('0x4e59b44847b379578588920cA78FbF26c0B4956C');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;
    setLoading(true);
    try {
      const data = await onFetchCollection(slug.trim(), chainId);
      const metadata = data?.metadata || null;
      setCollectionData(metadata);
      if (metadata?.networkId) {
        setChainId(metadata.networkId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartMintClick = () => {
    setShowConfirm(true);
  };

  const confirmAndExecute = () => {
    setShowConfirm(false);
    onExecuteMint({
      slug,
      mode,
      chainId,
      quantity,
      executorAddress: mode === 'sponsored' ? executorAddress : undefined
    });
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-xl text-slate-100 flex items-center gap-2">
              Drop Configurator
            </h2>
            <p className="text-xs text-slate-400">Inspect OpenSea drop stage & trigger instant multi-wallet mint</p>
          </div>
        </div>
      </div>

      {/* Collection Search Form */}
      <form onSubmit={handleLookup} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Collection slug or URL (e.g. pudgypenguins)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl dark-input text-sm text-slate-100 placeholder:text-slate-600"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="cyan-gradient-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          {loading ? 'Resolving...' : 'Resolve'}
        </button>
      </form>

      {/* Collection Details Badge */}
      {collectionData && (
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between">
          <div>
            <h4 className="font-heading font-bold text-cyan-300 text-base">{collectionData.slug}</h4>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{collectionData.address}</p>
          </div>
          <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-full text-xs font-bold uppercase tracking-wider">
            {collectionData.chainIdentifier || 'EVM'}
          </span>
        </div>
      )}

      {/* Execution Mode Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Execution Mode</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'single', label: 'Single Wallet', desc: 'Direct Mint' },
            { id: 'self-funded', label: 'Self-Funded', desc: 'Multi-Wallet' },
            { id: 'sponsored', label: 'Sponsored', desc: 'EIP-7702' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id as any)}
              className={`p-3 rounded-xl border text-left transition-all ${
                mode === m.id
                  ? 'bg-amber-500/10 border-amber-500/40 text-slate-100 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  : 'bg-slate-900/40 border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">{m.label}</span>
                {mode === m.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <p className="text-[10px] text-slate-500">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Target Chain & Quantity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Network</label>
          <select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 rounded-xl dark-input text-sm text-slate-100"
          >
            <option value={4663} className="bg-slate-900 text-slate-200">Robinhood Chain (Mainnet)</option>
            <option value={46630} className="bg-slate-900 text-slate-200">Robinhood Testnet</option>
            <option value={84532} className="bg-slate-900 text-slate-200">Base Sepolia (Testnet)</option>
            <option value={8453} className="bg-slate-900 text-slate-200">Base Mainnet</option>
            <option value={1} className="bg-slate-900 text-slate-200">Ethereum Mainnet</option>
            <option value={42161} className="bg-slate-900 text-slate-200">Arbitrum One</option>
            <option value={137} className="bg-slate-900 text-slate-200">Polygon</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mint Quantity</label>
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3.5 py-2.5 rounded-xl dark-input text-sm text-slate-100"
          />
        </div>
      </div>

      {/* Sponsored Mode Executor Input */}
      {mode === 'sponsored' && (
        <div>
          <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> EIP-7702 Delegation Executor Address
          </label>
          <input
            type="text"
            value={executorAddress}
            onChange={(e) => setExecutorAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl dark-input font-mono text-xs text-slate-100"
          />
        </div>
      )}

      {/* Trigger Mint Button */}
      <button
        type="button"
        onClick={handleStartMintClick}
        disabled={walletsCount === 0}
        className="w-full gold-gradient-btn py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-40"
      >
        <Sparkles className="w-4 h-4 fill-current" /> Execute Instant Mint Session ({walletsCount} Wallets)
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl space-y-4 border border-amber-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-slate-100">Confirm Mint Execution</h3>
                <p className="text-xs text-slate-400">Are you sure you want to broadcast transactions?</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Target Slug:</span><span className="font-mono text-amber-400 font-bold">{slug}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Execution Mode:</span><span className="capitalize font-semibold text-slate-200">{mode}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Target Chain:</span><span className="font-mono text-cyan-400">{chainId}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Wallets Participating:</span><span className="font-semibold text-slate-200">{walletsCount}</span></div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndExecute}
                className="flex-1 gold-gradient-btn py-2.5 rounded-xl text-xs font-bold"
              >
                Confirm & Mint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
