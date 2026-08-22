'use client';

import React, { useState, useEffect } from 'react';
import WalletTable, { WalletItem } from '../components/WalletTable';
import DropConfigForm from '../components/DropConfigForm';
import MintStatusFeed, { ProgressData } from '../components/MintStatusFeed';
import DoctorCard from '../components/DoctorCard';
import GasTrackerBar from '../components/GasTrackerBar';
import DropTimerScheduler from '../components/DropTimerScheduler';
import { fetchWallets, generateWallets, importWallets, deleteWallet, fetchCollection, executeMint, getSocket } from '../lib/api';
import { Shield, Cpu, Activity, Zap, CheckCircle2 } from 'lucide-react';

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

    // Listen to real-time WebSocket events from backend
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
        setWallets((prev) => [...prev, ...res.wallets].sort((a, b) => a.label.localeCompare(b.label)));
      }
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
        setWallets((prev) => [...prev, ...res.wallets].sort((a, b) => a.label.localeCompare(b.label)));
      }
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
          explorerUrl: res.explorer,
          chainId: payload.chainId,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Wallet Error Banner */}
      {walletError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium">
          <span className="flex-1">⚠️ {walletError}</span>
          <button onClick={() => setWalletError(null)} className="text-rose-400 hover:text-rose-200 ml-2 font-bold text-base leading-none">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-cyan-500 p-[2px] shadow-[0_0_24px_rgba(245,158,11,0.3)]">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-heading font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400">
              Z
            </div>
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-100 tracking-tight flex items-center gap-3">
              OSNM-Z Dashboard
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                v2.0 Web3
              </span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Multi-Wallet OpenSea Minting Engine — Base, Robinhood, Ethereum
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 shadow-md">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">{wallets.length} Active Wallet{wallets.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-md">
            <Cpu className="w-3.5 h-3.5 animate-pulse" /> Viem Engine Active
          </div>
        </div>
      </div>

      {/* Live Gas Tracker Bar */}
      <GasTrackerBar />

      {/* Drop Timer & Auto-Mint Scheduler */}
      <DropTimerScheduler
        wallets={wallets}
      />

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
