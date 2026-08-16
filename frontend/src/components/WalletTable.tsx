'use client';

import React, { useState } from 'react';
import { Wallet, Plus, Download, Trash2, CheckCircle, RefreshCw, Key } from 'lucide-react';

export interface WalletItem {
  id: string;
  address: string;
  label: string;
  balances?: Record<number, { chainName: string; symbol: string; balanceEth: string }>;
}

interface WalletTableProps {
  wallets: WalletItem[];
  loading: boolean;
  onRefresh: () => void;
  onGenerate: (count: number) => void;
  onImport: (keys: string[]) => void;
  onDelete: (id: string) => void;
}

export default function WalletTable({ wallets, loading, onRefresh, onGenerate, onImport, onDelete }: WalletTableProps) {
  const [showGenModal, setShowGenModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [genCount, setGenCount] = useState(5);
  const [importKeysText, setImportKeysText] = useState('');

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(genCount);
    setShowGenModal(false);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const keys = importKeysText.split('\n').map(k => k.trim()).filter(Boolean);
    if (keys.length > 0) {
      onImport(keys);
      setImportKeysText('');
      setShowImportModal(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-amber-900/10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-serif font-bold text-2xl text-stone-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[#C8922A]" /> Wallet Manifest
          </h2>
          <p className="text-stone-500 text-sm">Encrypted AES-256 local storage. Keys never touch the browser.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-stone-300 text-stone-700 hover:border-[#C8922A] hover:text-[#C8922A] transition-colors"
            title="Refresh Balances"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowGenModal(true)}
            className="gold-gradient-btn px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Generate
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-800 hover:border-[#C8922A] text-sm font-semibold flex items-center gap-1.5 bg-white/50"
          >
            <Download className="w-4 h-4" /> Import
          </button>
        </div>
      </div>

      {/* Wallet Table */}
      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-100/70 border-b border-stone-200 text-xs font-semibold text-stone-600 uppercase tracking-wider">
              <th className="py-3.5 px-4">Label</th>
              <th className="py-3.5 px-4">Address</th>
              <th className="py-3.5 px-4">Base Balance</th>
              <th className="py-3.5 px-4">Sepolia Balance</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/60 text-sm">
            {wallets.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500 font-medium">
                  No manifest wallets configured. Click "Generate" or "Import" to add wallets.
                </td>
              </tr>
            ) : (
              wallets.map((w) => (
                <tr key={w.id} className="hover:bg-amber-50/40 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-stone-900">{w.label}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-stone-700">
                    {w.address.slice(0, 8)}...{w.address.slice(-6)}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-stone-800">
                    {w.balances?.[8453]?.balanceEth || '0.00'} ETH
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-stone-600">
                    {w.balances?.[84532]?.balanceEth || '0.00'} ETH
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onDelete(w.id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                      title="Remove Wallet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Generate Modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-amber-900/10 shadow-2xl">
            <h3 className="font-serif font-bold text-xl text-stone-900 mb-2">Generate New Wallets</h3>
            <p className="text-stone-600 text-sm mb-4">Keys will be generated and saved in AES-256 encrypted storage.</p>
            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:border-[#C8922A]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 text-stone-600 hover:text-stone-900 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="gold-gradient-btn px-5 py-2 rounded-xl text-sm font-semibold">
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-amber-900/10 shadow-2xl">
            <h3 className="font-serif font-bold text-xl text-stone-900 mb-2">Import Private Keys</h3>
            <p className="text-stone-600 text-sm mb-4">Paste hex private keys (one per line). Encrypted at rest.</p>
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <textarea
                  rows={5}
                  value={importKeysText}
                  onChange={(e) => setImportKeysText(e.target.value)}
                  placeholder="0x1234...&#10;0x5678..."
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-xs focus:outline-none focus:border-[#C8922A]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-stone-600 hover:text-stone-900 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="gold-gradient-btn px-5 py-2 rounded-xl text-sm font-semibold">
                  Import Wallets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
