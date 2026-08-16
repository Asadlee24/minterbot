import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../lib/walletStore';
import { createPublicClient, http, formatEther, type Address } from 'viem';
import { defineChain } from 'viem';
import { mainnet, base, arbitrum, polygon, baseSepolia } from 'viem/chains';

const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_ROBINHOOD || 'https://rpc.mainnet.chain.robinhood.com'] }
  },
  blockExplorers: {
    default: { name: 'RobinhoodScan', url: 'https://explorer.robinhood.com' }
  }
});

const robinhoodTestnetChain = defineChain({
  id: 46630,
  name: 'Robinhood Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_ROBINHOOD_TESTNET || 'https://rpc.testnet.chain.robinhood.com'] }
  },
  blockExplorers: {
    default: { name: 'RobinhoodTestnetScan', url: 'https://testnet.robinhoodchain.blockscout.com' }
  }
});

const publicClients: Record<number, any> = {
  4663: createPublicClient({ chain: robinhoodChain, transport: http(process.env.RPC_ROBINHOOD || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 3000 }) }),
  46630: createPublicClient({ chain: robinhoodTestnetChain, transport: http(process.env.RPC_ROBINHOOD_TESTNET || 'https://rpc.testnet.chain.robinhood.com', { timeout: 3000 }) }),
  1: createPublicClient({ chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com', { timeout: 3000 }) }),
  8453: createPublicClient({ chain: base, transport: http('https://mainnet.base.org', { timeout: 3000 }) }),
  42161: createPublicClient({ chain: arbitrum, transport: http('https://arb1.arbitrum.io/rpc', { timeout: 3000 }) }),
  137: createPublicClient({ chain: polygon, transport: http('https://polygon-rpc.com', { timeout: 3000 }) }),
  84532: createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org', { timeout: 3000 }) })
};

async function getWalletBalances(address: Address) {
  const balances: Record<number, { chainName: string; symbol: string; balanceEth: string }> = {};

  await Promise.all(
    Object.entries(publicClients).map(async ([chainIdStr, client]) => {
      const chainId = Number(chainIdStr);
      try {
        const balancePromise = client.getBalance({ address });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 2500)
        );
        const balance = (await Promise.race([balancePromise, timeoutPromise])) as bigint;
        balances[chainId] = {
          chainName: chainId === 4663 ? 'Robinhood' : chainId === 46630 ? 'Robinhood Testnet' : chainId === 8453 ? 'Base' : chainId === 1 ? 'Ethereum' : chainId === 84532 ? 'Base Sepolia' : 'Chain ' + chainId,
          symbol: chainId === 137 ? 'POL' : 'ETH',
          balanceEth: parseFloat(formatEther(balance)).toFixed(4)
        };
      } catch {
        balances[chainId] = {
          chainName: chainId === 4663 ? 'Robinhood' : chainId === 46630 ? 'Robinhood Testnet' : chainId === 8453 ? 'Base' : chainId === 1 ? 'Ethereum' : chainId === 84532 ? 'Base Sepolia' : 'Chain ' + chainId,
          symbol: chainId === 137 ? 'POL' : 'ETH',
          balanceEth: '0.00'
        };
      }
    })
  );

  return balances;
}

// GET /api/wallets — list all wallets
export async function GET(req: NextRequest) {
  try {
    const fast = req.nextUrl.searchParams.get('fast') === 'true';
    const records = walletStore.getAll();

    const wallets = await Promise.all(
      records.map(async (rec) => {
        const balances = fast ? {} : await getWalletBalances(rec.address as Address);
        return {
          id: rec.id,
          address: rec.address,
          label: rec.label,
          createdAt: rec.createdAt,
          balances
        };
      })
    );

    wallets.sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ success: true, wallets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
