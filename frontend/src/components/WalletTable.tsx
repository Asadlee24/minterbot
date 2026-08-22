'use client';

import React, { useState } from 'react';
import { Wallet, Plus, Download, Trash2, CheckCircle, RefreshCw, Key, Copy, Check } from 'lucide-react';
import { exportWalletPrivateKey } from '../lib/api';

export interface WalletItem {
  id: string;
  address: string;
  label: string;
  encryptedKey?: string;
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
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address);
      } else {
        const input = document.createElement('input');
        input.value = address;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedAddressId(id);
      setTimeout(() => setCopiedAddressId(null), 2000);
    } catch (_) {}
  };

  const handleExportKey = async (wallet: WalletItem) => {
    setExportLoadingId(wallet.id);
    try {
      const key = await exportWalletPrivateKey(wallet.id, wallet.encryptedKey);
      setExportedKey({ label: wallet.label, address: wallet.address, key });
      setCopiedKey(false);
    } catch (err: any) {
      alert(`Export key failed: ${err.message}`);
    } finally {
      setExportLoadingId(null);
    }
  };

  const handleCopyKey = (key: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(key);
      } else {
        const input = document.createElement('input');
        input.value = key;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (_) {}
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
    <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-slate-900 flex items-center gap-2">
                Wallet Manifest
              </h2>
              <p className="text-xs text-slate-500">Encrypted AES-256 local storage — {wallets.length} active wallets</p>
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
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Key className="w-3.5 h-3.5 text-amber-600" /> Import
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh Balances"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Wallet List Table */}
      {wallets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3 bg-slate-50/50">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">No Wallets Configured</p>
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
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              Import Keys
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Base Sepolia</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wallets.map((w) => {
                  const baseBal = w.balances?.[84532]?.balanceEth || '0.0000';
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                        {w.label}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span>{w.address.slice(0, 6)}...{w.address.slice(-4)}</span>
                          <button
                            onClick={() => handleCopyAddress(w.id, w.address)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Copy Address"
                          >
                            {copiedAddressId === w.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {baseBal} ETH
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleExportKey(w)}
                            disabled={exportLoadingId === w.id}
                            className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors text-xs font-semibold flex items-center gap-1"
                            title="Export Private Key"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-600" /> Export Key
                          </button>
                          <button
                            onClick={() => onDelete(w.id)}
                            className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
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

          {/* Mobile Cards View (Extra Small Screens) */}
          <div className="block sm:hidden space-y-3">
            {wallets.map((w) => {
              const baseBal = w.balances?.[84532]?.balanceEth || '0.0000';
              return (
                <div key={w.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{w.label}</span>
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                      {baseBal} ETH
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span>{w.address.slice(0, 10)}...{w.address.slice(-6)}</span>
                    <button
                      onClick={() => handleCopyAddress(w.id, w.address)}
                      className="text-slate-500 hover:text-blue-600 p-1"
                    >
                      {copiedAddressId === w.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleExportKey(w)}
                      disabled={exportLoadingId === w.id}
                      className="flex-1 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-600" /> Export Key
                    </button>
                    <button
                      onClick={() => onDelete(w.id)}
                      className="p-2 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Generate Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl space-y-4 border border-slate-200 shadow-2xl">
            <h3 className="font-heading font-bold text-lg text-slate-900">Generate Wallets</h3>
            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Number of Wallets (1-20)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl light-input text-sm text-slate-900"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl space-y-4 border border-slate-200 shadow-2xl">
            <h3 className="font-heading font-bold text-lg text-slate-900">Import Private Keys</h3>
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Paste 64-hex Private Keys (one per line)
                </label>
                <textarea
                  rows={4}
                  value={importKeysText}
                  onChange={(e) => setImportKeysText(e.target.value)}
                  placeholder="0x..."
                  className="w-full p-3 rounded-xl light-input font-mono text-xs text-slate-900"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white max-w-md w-full p-5 sm:p-6 rounded-2xl space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C8922A] flex-shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-bold text-base text-slate-900 truncate">{exportedKey.label}</h3>
                <p className="text-xs font-mono text-slate-500 truncate">{exportedKey.address}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Decrypted Private Key
              </label>
              <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200 overflow-x-auto">
                <span className="font-mono text-xs text-amber-800 font-bold select-all break-all">{exportedKey.key}</span>
                <button
                  onClick={() => handleCopyKey(exportedKey.key)}
                  className="p-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 flex-shrink-0 font-semibold text-xs flex items-center gap-1"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setExportedKey(null)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
