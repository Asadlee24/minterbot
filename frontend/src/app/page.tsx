'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import WalletTable, { WalletItem } from '../components/WalletTable';
import DropConfigForm from '../components/DropConfigForm';
import MintStatusFeed, { ProgressData } from '../components/MintStatusFeed';
import DoctorCard from '../components/DoctorCard';
import { fetchWallets, generateWallets, importWallets, deleteWallet, fetchCollection, executeMint, getSocket } from '../lib/api';
import { Sparkles, Shield, Cpu, ExternalLink } from 'lucide-react';

// Dynamic import for 3D Hero component to avoid SSR hydration issues
const NftCrateHero = dynamic(() => import('../components/3d/NftCrateHero'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center">
      <div className="w-32 h-32 rounded-3xl bg-amber-500/20 animate-pulse border border-[#C8922A]/30" />
    </div>
  )
});

export default function DashboardPage() {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [mintProgress, setMintProgress] = useState<ProgressData | null>(null);

  const loadWalletsData = async () => {
    setLoadingWallets(true);
    try {
      const res = await fetchWallets();
      if (res?.wallets) {
        setWallets(res.wallets);
      }
    } catch (err) {
      console.error('Failed to load wallets:', err);
    } finally {
      setLoadingWallets(false);
    }
  };

  useEffect(() => {
    loadWalletsData();

    // Listen to real-time WebSocket events from backend
    const socket = getSocket();
    socket.on('mint_progress', (data: ProgressData) => {
      setMintProgress(data);
      if (data.status === 'COMPLETED') {
        loadWalletsData();
      }
    });

    return () => {
      socket.off('mint_progress');
    };
  }, []);

  const handleGenerateWallets = async (count: number) => {
    setLoadingWallets(true);
    try {
      await generateWallets(count);
      await loadWalletsData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWallets(false);
    }
  };

  const handleImportWallets = async (keys: string[]) => {
    setLoadingWallets(true);
    try {
      await importWallets(keys);
      await loadWalletsData();
    } catch (err) {
      console.error(err);
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
      await executeMint({
        ...payload,
        walletIds,
        sponsorWalletId: sponsorId
      });
    } catch (err: any) {
      alert(`Mint trigger failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between border-b border-amber-900/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl gold-gradient-btn flex items-center justify-center font-serif font-bold text-xl">
            Z
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight">OSNM-Z Dashboard</h1>
            <p className="text-stone-500 text-xs font-mono">Multi-Wallet OpenSea Minting Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-[#C8922A]/30 text-[#C8922A] text-xs font-bold flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> Viem Engine Active
          </span>
        </div>
      </div>

      {/* Hero Section with 3D Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center glass-card rounded-3xl p-8 border border-amber-900/10 relative overflow-hidden">
        <div className="lg:col-span-7 space-y-4 z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-[#C8922A]/20 text-[#C8922A] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen NFT Automation
          </div>
          <h2 className="font-serif font-extrabold text-4xl sm:text-5xl text-stone-900 leading-tight">
            Multi-Wallet OpenSea <span className="gold-text-gradient">Minting Engine</span>
          </h2>
          <p className="text-stone-600 text-base leading-relaxed">
            Execute single, self-funded, and EIP-7702 sponsored mints seamlessly. Multi-chain RPC support, SIWE authentication, aliased GraphQL calldata fetching, and live WebSocket monitoring.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-700 bg-white/70 px-3.5 py-2 rounded-xl border border-stone-200">
              <Shield className="w-4 h-4 text-[#C8922A]" /> AES-256 Key Encryption
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-700 bg-white/70 px-3.5 py-2 rounded-xl border border-stone-200">
              <Cpu className="w-4 h-4 text-[#C8922A]" /> EIP-7702 Sponsored Gas
            </div>
          </div>
        </div>

        {/* 3D Gold Crate Canvas */}
        <div className="lg:col-span-5 relative">
          <NftCrateHero />
        </div>
      </div>

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
