'use client';

import React, { useState } from 'react';
import { Search, Zap, Shield, Layers, Play, AlertTriangle } from 'lucide-react';

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
      setCollectionData(data?.metadata || null);
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
    <div className="glass-card rounded-2xl p-6 border border-amber-900/10 space-y-6">
      <div>
        <h2 className="font-serif font-bold text-2xl text-stone-900 flex items-center gap-2">
          <Layers className="w-6 h-6 text-[#C8922A]" /> Drop Configurator
        </h2>
        <p className="text-stone-500 text-sm">Paste OpenSea collection slug to inspect drop stages & execute mint.</p>
      </div>

      {/* Collection Search Form */}
      <form onSubmit={handleLookup} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Collection slug or URL (e.g. pudgypenguins)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#C8922A] bg-white/70"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="gold-gradient-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          {loading ? 'Fetching...' : 'Resolve'}
        </button>
      </form>

      {/* Collection Details Badge */}
      {collectionData && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-[#C8922A]/20 flex items-center justify-between">
          <div>
            <h4 className="font-serif font-bold text-stone-900 text-lg">{collectionData.slug}</h4>
            <p className="text-xs font-mono text-stone-600">{collectionData.address}</p>
          </div>
          <span className="px-3 py-1 bg-amber-600 text-white rounded-full text-xs font-bold uppercase">
            {collectionData.chainIdentifier || 'EVM'}
          </span>
        </div>
      )}

      {/* Mode Selector */}
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-2">Execution Mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`p-4 rounded-xl border text-left transition-all ${
              mode === 'single'
                ? 'border-[#C8922A] bg-amber-500/10 shadow-sm'
                : 'border-stone-200 bg-white/40 hover:border-stone-300'
            }`}
          >
            <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5 mb-1">
              <Zap className="w-4 h-4 text-[#C8922A]" /> Single Wallet
            </div>
            <p className="text-xs text-stone-500">1 wallet signs & pays own gas/mint price.</p>
          </button>

          <button
            type="button"
            onClick={() => setMode('self-funded')}
            className={`p-4 rounded-xl border text-left transition-all ${
              mode === 'self-funded'
                ? 'border-[#C8922A] bg-amber-500/10 shadow-sm'
                : 'border-stone-200 bg-white/40 hover:border-stone-300'
            }`}
          >
            <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5 mb-1">
              <Layers className="w-4 h-4 text-[#C8922A]" /> Self-Funded Multi
            </div>
            <p className="text-xs text-stone-500">Max 10 wallets concurrent execution.</p>
          </button>

          <button
            type="button"
            onClick={() => setMode('sponsored')}
            className={`p-4 rounded-xl border text-left transition-all ${
              mode === 'sponsored'
                ? 'border-[#C8922A] bg-amber-500/10 shadow-sm'
                : 'border-stone-200 bg-white/40 hover:border-stone-300'
            }`}
          >
            <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5 mb-1">
              <Shield className="w-4 h-4 text-[#C8922A]" /> Sponsored EIP-7702
            </div>
            <p className="text-xs text-stone-500">Max 25 wallets. Sponsor pays batch gas.</p>
          </button>
        </div>
      </div>

      {/* Target Chain & Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Target Chain</label>
          <select
            value={chainId}
            onChange={(e) => setChainId(parseInt(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#C8922A] bg-white/70 font-medium"
          >
            <option value={84532}>Base Sepolia (Testnet - Recommended)</option>
            <option value={4862}>Robinhood Chain</option>
            <option value={8453}>Base Mainnet</option>
            <option value={1}>Ethereum Mainnet</option>
            <option value={42161}>Arbitrum One</option>
            <option value={137}>Polygon</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Quantity per Wallet</label>
          <input
            type="number"
            min={1}
            max={5}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#C8922A] bg-white/70"
          />
        </div>
      </div>

      {/* Execution Trigger Button */}
      <button
        onClick={handleStartMintClick}
        className="w-full gold-gradient-btn py-3.5 rounded-xl text-base font-bold flex items-center justify-center gap-2 shadow-lg"
      >
        <Play className="w-5 h-5 fill-current" /> Execute {mode.toUpperCase()} Mint Session
      </button>

      {/* Confirmation Modal Safeguard */}
      {showConfirm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-amber-900/10 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <h3 className="font-serif font-bold text-xl text-stone-900">Confirm Mint Transaction</h3>
            </div>
            <p className="text-stone-600 text-sm">
              You are about to initiate a live <strong className="text-stone-900 uppercase">{mode}</strong> mint session for{' '}
              <strong className="text-stone-900">{slug}</strong> on Chain ID <strong>{chainId}</strong> across{' '}
              <strong>{walletsCount}</strong> wallet(s).
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-stone-600 hover:text-stone-900 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndExecute}
                className="gold-gradient-btn px-6 py-2.5 rounded-xl text-sm font-bold"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
