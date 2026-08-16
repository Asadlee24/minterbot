'use client';

import React, { useState, useEffect } from 'react';
import WalletTable, { WalletItem } from '../components/WalletTable';
import DropConfigForm from '../components/DropConfigForm';
import MintStatusFeed, { ProgressData } from '../components/MintStatusFeed';
import DoctorCard from '../components/DoctorCard';
import GasTrackerBar from '../components/GasTrackerBar';
import { fetchWallets, generateWallets, importWallets, deleteWallet, fetchCollection, executeMint, getSocket } from '../lib/api';
import { Shield, Cpu } from 'lucide-react';

export default function DashboardPage() {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [mintProgress, setMintProgress] = useState<ProgressData | null>(null);

  const loadWalletsData = async (fast = false) => {
    setLoadingWallets(true);
    setWalletError(null);
    try {
      const res = await fetchWallets(fast);
      if (res?.wallets) {
        setWallets(res.wallets);
      }
    } catch (err: any) {
      console.error('Failed to load wallets:', err);
      setWalletError(err.message || 'Failed to load wallets');
    } finally {
      setLoadingWallets(false);
    }
  };

  useEffect(() => {
    // Load wallets fast (without balances) first for instant UI, then refresh with balances
    loadWalletsData(true).then(() => loadWalletsData(false));

    // Listen to real-time WebSocket events from backend (only if external backend is configured)
    const socket = getSocket();
    if (socket) {
      socket.on('mint_progress', (data: ProgressData) => {
        setMintProgress(data);
        if (data.status === 'COMPLETED') {
          loadWalletsData();
        }
      });
    }

    return () => {
      if (socket) socket.off('mint_progress');
    };
  }, []);

  const handleGenerateWallets = async (count: number) => {
    setLoadingWallets(true);
    setWalletError(null);
    try {
      const res = await generateWallets(count);
      if (res?.wallets) {
        // Optimistically add generated wallets immediately
        setWallets((prev) => [...prev, ...res.wallets].sort((a, b) => a.label.localeCompare(b.label)));
      }
      // Then refresh with balances in background
      loadWalletsData(false);
    } catch (err: any) {
      console.error(err);
      setWalletError(err.message || 'Failed to generate wallets');
    } finally {
      setLoadingWallets(false);
    }
  };

  const handleImportWallets = async (keys: string[]) => {
    setLoadingWallets(true);
    setWalletError(null);
    try {
      const res = await importWallets(keys);
      if (res?.wallets) {
        // Optimistically add imported wallets immediately
        setWallets((prev) => [...prev, ...res.wallets].sort((a, b) => a.label.localeCompare(b.label)));
      }
      // Then refresh with balances in background
      loadWalletsData(false);
    } catch (err: any) {
      console.error(err);
      setWalletError(err.message || 'Failed to import wallets');
    } finally {
      setLoadingWallets(false);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    try {
      await deleteWallet(id);
      await loadWalletsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteMint = async (payload: any) => {
    try {
      const walletIds = wallets.map((w) => w.id);
      if (walletIds.length === 0) {
        alert('Please generate or import at least 1 wallet first!');
        return;
      }
      const sponsorId = walletIds[0];
      const res = await executeMint({
        ...payload,
        collectionSlug: payload.slug || payload.collectionSlug,
        walletIds,
        sponsorWalletId: sponsorId
      });
      if (res?.success) {
        setMintProgress({
          taskId: res.sessionId || `session_${Date.now()}`,
          status: 'COMPLETED',
          completedCount: walletIds.length,
          totalCount: walletIds.length,
          txHashes: res.txHashes || [],
          logs: res.logs || [
            `[SESSION INITIATED] Target Collection: ${payload.slug || payload.collectionSlug || 'pudgypenguins'}`,
            `[STATUS] Mint session completed for ${walletIds.length} wallet(s)`
          ]
        });
      }
    } catch (err: any) {
      alert(`Mint trigger failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Wallet Error Banner */}
      {walletError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          <span className="flex-1">⚠️ {walletError}</span>
          <button onClick={() => setWalletError(null)} className="text-red-400 hover:text-red-700 ml-2 font-bold text-base leading-none">×</button>
        </div>
      )}

      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-900/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl gold-gradient-btn flex items-center justify-center font-serif font-bold text-xl shadow-md">
            Z
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight flex items-center gap-2">
              OSNM-Z Dashboard <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-[#C8922A] border border-[#C8922A]/30 font-sans font-semibold">v2.0 Pro</span>
            </h1>
            <p className="text-stone-500 text-xs font-mono">Multi-Wallet OpenSea & Robinhood Minting Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-stone-200 text-xs font-semibold text-stone-700 shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-[#C8922A]" />
            <span>Wallets: <strong>{wallets.length}</strong></span>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-[#C8922A]/30 text-[#C8922A] text-xs font-bold flex items-center gap-1.5 shadow-2xs">
            <Cpu className="w-3.5 h-3.5" /> Viem Engine Active
          </span>
        </div>
      </div>

      {/* Live Gas Tracker Bar */}
      <GasTrackerBar />

      {/* Main Control Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Drop Config & Live Feed */}
        <div className="lg:col-span-6 space-y-8">
          <DropConfigForm
            onExecuteMint={handleExecuteMint}
            onFetchCollection={fetchCollection}
            walletsCount={wallets.length}
          />
          <MintStatusFeed progress={mintProgress} />
        </div>

        {/* Right Column: Wallet Management & Doctor */}
        <div className="lg:col-span-6 space-y-8">
          <WalletTable
            wallets={wallets}
            loading={loadingWallets}
            onRefresh={loadWalletsData}
            onGenerate={handleGenerateWallets}
            onImport={handleImportWallets}
            onDelete={handleDeleteWallet}
          />
          <DoctorCard />
        </div>
      </div>
    </div>
  );
}
