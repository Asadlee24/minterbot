'use client';

import React, { useState } from 'react';
import { Wallet, Plus, Download, Trash2, CheckCircle, RefreshCw, Key, Copy, Check } from 'lucide-react';
import { exportWalletPrivateKey } from '../lib/api';

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
  
  // Export Key State
  const [exportedKey, setExportedKey] = useState<{ label: string; address: string; key: string } | null>(null);
  const [exportLoadingId, setExportLoadingId] = useState<string | null>(null);
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

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

  const handleCopyAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddressId(id);
    setTimeout(() => setCopiedAddressId(null), 2000);
  };

  const handleExportKey = async (wallet: WalletItem) => {
    setExportLoadingId(wallet.id);
    try {
      const key = await exportWalletPrivateKey(wallet.id);
      setExportedKey({ label: wallet.label, address: wallet.address, key });
      setCopiedKey(false);
    } catch (err: any) {
      alert(`Export key failed: ${err.message}`);
    } finally {
      setExportLoadingId(null);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleExportCSV = () => {
    if (wallets.length === 0) {
      alert('No wallets to export!');
      return;
    }
    const headers = 'ID,Label,Address\n';
    const rows = wallets.map((w) => `"${w.id}","${w.label}","${w.address}"`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallets_manifest_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-slate-100 flex items-center gap-2">
                Wallet Manifest
              </h2>
              <p className="text-xs text-slate-400">Encrypted AES-256 local storage — {wallets.length} active wallets</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowGenModal(true)}
            className="emerald-gradient-btn px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Generate
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-white/10 text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" /> Import
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="Refresh Balances"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Wallet List Table */}
      {wallets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-300">No Wallets Configured</p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Generate or import wallets to start executing multi-wallet mint sessions.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setShowGenModal(true)}
              className="emerald-gradient-btn px-4 py-2 rounded-xl text-xs font-semibold"
            >
              Generate Wallets
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-white/10 text-slate-200 hover:bg-slate-800"
            >
              Import Keys
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Base Sepolia</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-900/40">
              {wallets.map((w) => {
                const baseBal = w.balances?.[84532]?.balanceEth || '0.0000';
                return (
                  <tr key={w.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-200 whitespace-nowrap">
                      {w.label}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span>{w.address.slice(0, 6)}...{w.address.slice(-4)}</span>
                        <button
                          onClick={() => handleCopyAddress(w.id, w.address)}
                          className="text-slate-500 hover:text-cyan-400 transition-colors"
                          title="Copy Address"
                        >
                          {copiedAddressId === w.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-300">
                      {baseBal} ETH
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleExportKey(w)}
                          disabled={exportLoadingId === w.id}
                          className="p-1.5 rounded-lg border border-white/10 text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="Export Private Key"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(w.id)}
                          className="p-1.5 rounded-lg border border-white/10 text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Wallet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card max-w-sm w-full p-6 rounded-2xl space-y-4 border border-emerald-500/30">
            <h3 className="font-heading font-bold text-lg text-slate-100">Generate Wallets</h3>
            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Number of Wallets (1-20)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl dark-input text-sm text-slate-100"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 emerald-gradient-btn py-2.5 rounded-xl text-xs font-bold"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl space-y-4 border border-amber-500/30">
            <h3 className="font-heading font-bold text-lg text-slate-100">Import Private Keys</h3>
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Paste 64-hex Private Keys (one per line)
                </label>
                <textarea
                  rows={4}
                  value={importKeysText}
                  onChange={(e) => setImportKeysText(e.target.value)}
                  placeholder="0x..."
                  className="w-full p-3 rounded-xl dark-input font-mono text-xs text-slate-100"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 gold-gradient-btn py-2.5 rounded-xl text-xs font-bold"
                >
                  Import Keys
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Key Modal */}
      {exportedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl space-y-4 border border-amber-500/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-slate-100">{exportedKey.label}</h3>
                <p className="text-xs font-mono text-slate-400">{exportedKey.address}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Decrypted Private Key
              </label>
              <div className="flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-lg border border-white/10">
                <span className="font-mono text-xs text-amber-300 select-all truncate">{exportedKey.key}</span>
                <button
                  onClick={() => handleCopyKey(exportedKey.key)}
                  className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 flex-shrink-0"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setExportedKey(null)}
              className="w-full py-2.5 rounded-xl border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/5"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
