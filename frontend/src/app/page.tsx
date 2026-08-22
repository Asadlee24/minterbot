'use client';

import React, { useState, useEffect } from 'react';
import WalletTable, { WalletItem } from '../components/WalletTable';
import DropConfigForm from '../components/DropConfigForm';
import MintStatusFeed, { ProgressData } from '../components/MintStatusFeed';
import DoctorCard from '../components/DoctorCard';
import GasTrackerBar from '../components/GasTrackerBar';
import DropTimerScheduler from '../components/DropTimerScheduler';
import { fetchWallets, generateWallets, importWallets, deleteWallet, fetchCollection, executeMint, getSocket } from '../lib/api';
import { requestNotificationPermission, getNotificationPermission, sendDesktopNotification } from '../lib/notifications';
import { Shield, Cpu, Bell, BellRing, CheckCircle2 } from 'lucide-react';

export default function DashboardPage() {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [mintProgress, setMintProgress] = useState<ProgressData | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  const updateWalletsWithCache = (newWallets: WalletItem[]) => {
    setWallets(newWallets);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('minter_wallets_cache', JSON.stringify(newWallets));
      }
    } catch (_) {}
  };

  const loadWalletsData = async (fast = false) => {
    setLoadingWallets(true);
    setWalletError(null);
    try {
      const res = await fetchWallets(fast);
      if (res?.wallets && res.wallets.length > 0) {
        updateWalletsWithCache(res.wallets);
      } else if (typeof window !== 'undefined') {
        const cachedStr = localStorage.getItem('minter_wallets_cache');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Array.isArray(cached) && cached.length > 0) {
            setWallets(cached);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load wallets:', err);
      if (typeof window !== 'undefined') {
        const cachedStr = localStorage.getItem('minter_wallets_cache');
        if (cachedStr) {
          try {
            const cached = JSON.parse(cachedStr);
            if (Array.isArray(cached) && cached.length > 0) {
              setWallets(cached);
            }
          } catch (_) {}
        }
      }
      setWalletError(err.message || 'Failed to load wallets');
    } finally {
      setLoadingWallets(false);
    }
  };

  useEffect(() => {
    loadWalletsData(true).then(() => loadWalletsData(false));
    setNotifPermission(getNotificationPermission());

    const socket = getSocket();
    if (socket) {
      socket.on('mint_progress', (data: ProgressData) => {
        setMintProgress(data);
        if (data.status === 'COMPLETED') {
          loadWalletsData();
          sendDesktopNotification(
            '🎉 Mint Session Completed!',
            `Successfully processed mint session across ${data.totalCount} wallet(s).`
          );
        } else if (data.status === 'FAILED') {
          sendDesktopNotification(
            '⚠️ Mint Session Failed',
            `Mint task encountered an error. Check status logs for details.`
          );
        }
      });
    }

    return () => {
      if (socket) socket.off('mint_progress');
    };
  }, []);

  const handleToggleNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    if (granted) {
      sendDesktopNotification('🔔 Desktop Alerts Enabled', 'You will receive real-time pop-up alerts when mints execute!');
    }
  };

  const handleGenerateWallets = async (count: number) => {
    setLoadingWallets(true);
    setWalletError(null);
    try {
      const res = await generateWallets(count);
      if (res?.wallets) {
        setWallets((prev) => {
          const updated = [...prev, ...res.wallets].sort((a, b) => a.label.localeCompare(b.label));
          updateWalletsWithCache(updated);
          return updated;
        });
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
        setWallets((prev) => {
          const updated = [...prev, ...res.wallets].sort((a, b) => a.label.localeCompare(b.label));
          updateWalletsWithCache(updated);
          return updated;
        });
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
      setWallets((prev) => {
        const updated = prev.filter((w) => w.id !== id);
        updateWalletsWithCache(updated);
        return updated;
      });
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
        const completedData: ProgressData = {
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
        };
        setMintProgress(completedData);
        sendDesktopNotification(
          '🎉 Mint Session Executed!',
          `Mint completed for collection ${payload.slug || payload.collectionSlug || 'pudgypenguins'}!`
        );
      }
    } catch (err: any) {
      alert(`Mint trigger failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Wallet Error Banner */}
      {walletError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
          <span className="flex-1">⚠️ {walletError}</span>
          <button onClick={() => setWalletError(null)} className="text-rose-400 hover:text-rose-700 ml-2 font-bold text-base leading-none">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-[#C8922A]/15 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gold-gradient-btn flex items-center justify-center font-heading font-black text-2xl text-white shadow-md">
            M
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-stone-900 tracking-tight flex items-center gap-3">
              Minter Dashboard
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 border border-[#C8922A]/30 text-[#C8922A]">
                v2.0 Gold Edition
              </span>
            </h1>
            <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
              Multi-Wallet OpenSea Minting Engine — Base, Robinhood, Ethereum
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Notification Permission Toggle */}
          <button
            onClick={handleToggleNotifications}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              notifPermission === 'granted'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border border-[#C8922A]/30 text-[#C8922A] hover:bg-amber-100'
            }`}
            title="Toggle Desktop Push Notifications"
          >
            {notifPermission === 'granted' ? (
              <>
                <BellRing className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Desktop Alerts On
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5 text-[#C8922A]" /> Enable Desktop Alerts
              </>
            )}
          </button>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#C8922A]/20 text-xs text-stone-700 font-medium shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#C8922A]" />
            <span className="font-bold">{wallets.length} Active Wallet{wallets.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-[#C8922A]/30 text-[#C8922A] text-xs font-bold shadow-sm">
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
