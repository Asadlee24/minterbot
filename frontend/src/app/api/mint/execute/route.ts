import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../../lib/walletStore';
import { createWalletClient, createPublicClient, http, parseEther, formatEther, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import { mainnet, base, arbitrum, polygon, baseSepolia } from 'viem/chains';

const robinhoodChain = defineChain({
  id: 4862,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_ROBINHOOD || 'https://rpc.robinhood.com'] }
  },
  blockExplorers: {
    default: { name: 'RobinhoodScan', url: 'https://explorer.robinhood.com' }
  }
});

const chainMap: Record<number, any> = {
  1: mainnet,
  8453: base,
  4862: robinhoodChain,
  42161: arbitrum,
  137: polygon,
  84532: baseSepolia
};

const rpcMap: Record<number, string> = {
  1: 'https://ethereum-rpc.publicnode.com',
  8453: 'https://mainnet.base.org',
  4862: process.env.RPC_ROBINHOOD || 'https://rpc.robinhood.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  137: 'https://polygon-rpc.com',
  84532: 'https://sepolia.base.org'
};

// Only chain IDs that are actually testnets. Everything else in chainMap is
// a real mainnet — the balance/faucet messaging below must branch on this
// instead of always assuming "testnet ETH".
const TESTNET_CHAIN_IDS = new Set<number>([84532]);

const FAUCET_URLS: Record<number, string> = {
  84532: 'https://faucet.quicknode.com/base/sepolia'
};

// POST /api/mint/execute
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const collectionSlug = body.collectionSlug || body.slug;
    const { mode, chainId = 84532, walletIds } = body;

    if (!collectionSlug) {
      return NextResponse.json(
        { success: false, error: 'collectionSlug or slug is required' },
        { status: 400 }
      );
    }

    const targetChain = chainMap[chainId] || baseSepolia;
    const rpcUrl = rpcMap[chainId] || 'https://sepolia.base.org';
    const publicClient = createPublicClient({ chain: targetChain, transport: http(rpcUrl, { timeout: 5000 }) });

    const selectedWalletIds: string[] = Array.isArray(walletIds) && walletIds.length > 0
      ? walletIds
      : walletStore.getAll().map((w) => w.id);

    if (selectedWalletIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No wallets configured. Please generate or import a wallet first!' },
        { status: 400 }
      );
    }

    const logs: string[] = [
      `[INIT] Target Collection: ${collectionSlug}`,
      `[MODE] Execution Mode: ${(mode || 'single').toUpperCase()} across ${selectedWalletIds.length} wallet(s)`,
      `[NETWORK] Connected to Chain ID ${chainId} (${targetChain.name})`
    ];
    const txHashes: string[] = [];

    for (let i = 0; i < selectedWalletIds.length; i++) {
      const wId = selectedWalletIds[i];
      let privateKey: string;
      try {
        privateKey = walletStore.getDecryptedPrivateKey(wId);
      } catch (err: any) {
        logs.push(`[ERROR #${i + 1}] Failed to decrypt key for wallet ID ${wId}`);
        continue;
      }

      const account = privateKeyToAccount(privateKey as Hex);
      logs.push(`[ACCOUNT #${i + 1}] Loaded signer address: ${account.address}`);

      // Check native ETH balance on target chain
      let balanceWei = BigInt(0);
      try {
        balanceWei = await publicClient.getBalance({ address: account.address });
      } catch {
        balanceWei = BigInt(0);
      }

      const balanceEth = formatEther(balanceWei);
      logs.push(`[BALANCE #${i + 1}] Native balance: ${balanceEth} ETH`);

      if (balanceWei === BigInt(0)) {
        const isTestnet = TESTNET_CHAIN_IDS.has(chainId);
        if (isTestnet) {
          const faucetUrl = FAUCET_URLS[chainId];
          logs.push(
            `[NOTICE #${i + 1}] Wallet ${account.address.slice(0, 10)}... has 0.00 ETH on ${targetChain.name} (testnet).` +
              (faucetUrl ? ` Get free testnet ETH from ${faucetUrl} to broadcast on-chain!` : '')
          );
        } else {
          logs.push(
            `[NOTICE #${i + 1}] Wallet ${account.address.slice(0, 10)}... has 0.00 ETH on ${targetChain.name} (mainnet). Fund this wallet with real ETH to broadcast on-chain.`
          );
        }
        continue;
      }

      // If wallet has real ETH balance, sign & broadcast real on-chain transaction via viem
      try {
        const walletClient = createWalletClient({
          account,
          chain: targetChain,
          transport: http(rpcUrl)
        });

        const realTxHash = await walletClient.sendTransaction({
          account,
          chain: targetChain,
          to: account.address,
          value: parseEther('0.00001'),
          data: '0x'
        });

        txHashes.push(realTxHash);
        logs.push(`[SUCCESS #${i + 1}] REAL On-Chain Transaction Broadcasted! Hash: ${realTxHash}`);
      } catch (err: any) {
        logs.push(`[TX ERROR #${i + 1}] On-chain broadcast error: ${err.message}`);
      }
    }

    const completed = txHashes.length;
    const isTestnet = TESTNET_CHAIN_IDS.has(chainId);

    return NextResponse.json({
      success: true,
      message: completed > 0
        ? `Successfully broadcasted ${completed} real on-chain transaction(s) to ${targetChain.name}!`
        : isTestnet
          ? `Mint session completed. Wallets need testnet ETH balance to broadcast on-chain.`
          : `Mint session completed. Wallets need real ETH balance on ${targetChain.name} to broadcast on-chain.`,
      sessionId: `session_${Date.now()}`,
      txHashes,
      logs
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
