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
    <div className="glass-card rounded-2xl p-6 space-y-6 shadow-sm relative overflow-hidden">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-[#C8922A]/20 flex items-center justify-center text-[#C8922A] shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-xl text-stone-900 flex items-center gap-2">
              Drop Configurator
            </h2>
            <p className="text-xs text-stone-500">Inspect OpenSea drop stage & trigger instant multi-wallet mint</p>
          </div>
        </div>
      </div>

      {/* Collection Search Form */}
      <form onSubmit={handleLookup} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Collection slug or URL (e.g. pudgypenguins)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl light-input text-sm text-stone-900 placeholder:text-stone-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="gold-gradient-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          {loading ? 'Resolving...' : 'Resolve'}
        </button>
      </form>

      {/* Collection Details Badge */}
      {collectionData && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-[#C8922A]/30 flex items-center justify-between">
          <div>
            <h4 className="font-heading font-bold text-amber-950 text-base">{collectionData.slug}</h4>
            <p className="text-xs font-mono text-amber-900/80 mt-0.5">{collectionData.address}</p>
          </div>
          <span className="px-3 py-1 bg-[#C8922A] text-white rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
            {collectionData.chainIdentifier || 'EVM'}
          </span>
        </div>
      )}

      {/* Execution Mode Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">Execution Mode</label>
        <div className="grid grid-cols-3 gap-2.5">
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
                  ? 'bg-amber-500/10 border-[#C8922A] text-stone-900 shadow-sm font-semibold'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">{m.label}</span>
                {mode === m.id && <Check className="w-3.5 h-3.5 text-[#C8922A]" />}
              </div>
              <p className="text-[10px] text-stone-500">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Target Chain & Quantity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">Target Network</label>
          <select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 rounded-xl light-input text-sm text-stone-900"
          >
            <option value={4663}>Robinhood Chain (Mainnet)</option>
            <option value={46630}>Robinhood Testnet</option>
            <option value={84532}>Base Sepolia (Testnet)</option>
            <option value={8453}>Base Mainnet</option>
            <option value={1}>Ethereum Mainnet</option>
            <option value={42161}>Arbitrum One</option>
            <option value={137}>Polygon</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">Mint Quantity</label>
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3.5 py-2.5 rounded-xl light-input text-sm text-stone-900"
          />
        </div>
      </div>

      {/* Sponsored Mode Executor Input */}
      {mode === 'sponsored' && (
        <div>
          <label className="block text-xs font-semibold text-[#C8922A] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> EIP-7702 Delegation Executor Address
          </label>
          <input
            type="text"
            value={executorAddress}
            onChange={(e) => setExecutorAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl light-input font-mono text-xs text-stone-900"
          />
        </div>
      )}

      {/* Trigger Mint Button */}
      <button
        type="button"
        onClick={handleStartMintClick}
        disabled={walletsCount === 0}
        className="w-full gold-gradient-btn py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-40"
      >
        <Sparkles className="w-4 h-4 fill-current" /> Execute Instant Mint Session ({walletsCount} Wallets)
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl space-y-4 border border-stone-200 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C8922A]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-stone-900">Confirm Mint Execution</h3>
                <p className="text-xs text-stone-500">Are you sure you want to broadcast transactions?</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs text-stone-700">
              <div className="flex justify-between"><span className="text-stone-500">Target Slug:</span><span className="font-mono text-[#C8922A] font-bold">{slug}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Execution Mode:</span><span className="capitalize font-semibold text-stone-900">{mode}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Target Chain:</span><span className="font-mono text-stone-800">{chainId}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Wallets Participating:</span><span className="font-semibold text-stone-900">{walletsCount}</span></div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50"
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
