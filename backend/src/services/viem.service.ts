import { createPublicClient, createWalletClient, http, formatEther, parseEther, Address, Hex, Chain, Account, defineChain } from 'viem';
import { mainnet, base, arbitrum, polygon, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

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

export interface ChainInfo {
  id: number;
  name: string;
  nativeSymbol: string;
  chain: Chain;
  defaultRpc: string;
}

export const SUPPORTED_CHAINS: Record<number, ChainInfo> = {
  1: { id: 1, name: 'Ethereum Mainnet', nativeSymbol: 'ETH', chain: mainnet, defaultRpc: process.env.RPC_ETH || 'https://ethereum-rpc.publicnode.com' },
  8453: { id: 8453, name: 'Base', nativeSymbol: 'ETH', chain: base, defaultRpc: process.env.RPC_BASE || 'https://mainnet.base.org' },
  4663: { id: 4663, name: 'Robinhood Chain', nativeSymbol: 'ETH', chain: robinhoodChain, defaultRpc: process.env.RPC_ROBINHOOD || 'https://rpc.mainnet.chain.robinhood.com' },
  46630: { id: 46630, name: 'Robinhood Testnet', nativeSymbol: 'ETH', chain: robinhoodTestnetChain, defaultRpc: process.env.RPC_ROBINHOOD_TESTNET || 'https://rpc.testnet.chain.robinhood.com' },
  42161: { id: 42161, name: 'Arbitrum One', nativeSymbol: 'ETH', chain: arbitrum, defaultRpc: process.env.RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc' },
  137: { id: 137, name: 'Polygon', nativeSymbol: 'POL', chain: polygon, defaultRpc: process.env.RPC_POLYGON || 'https://polygon-rpc.com' },
  84532: { id: 84532, name: 'Base Sepolia (Testnet)', nativeSymbol: 'ETH', chain: baseSepolia, defaultRpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org' }
};

export class ViemService {
  private publicClients: Map<number, any> = new Map();

  constructor() {
    for (const [chainId, chainInfo] of Object.entries(SUPPORTED_CHAINS)) {
      const numId = Number(chainId);
      this.publicClients.set(
        numId,
        createPublicClient({
          chain: chainInfo.chain,
          transport: http(chainInfo.defaultRpc, { timeout: 15000 })
        })
      );
    }
  }

  public getPublicClient(chainId: number) {
    const client = this.publicClients.get(chainId);
    if (!client) {
      throw new Error(`Unsupported or unconfigured chainId ${chainId}`);
    }
    return client;
  }

  /**
   * Fetches native balance across all configured chains for a target address
   */
  public async getBalancesAcrossChains(address: Address): Promise<Record<number, { chainName: string; symbol: string; balanceWei: bigint; balanceEth: string }>> {
    const results: Record<number, any> = {};

    await Promise.all(
      Object.entries(SUPPORTED_CHAINS).map(async ([chainIdStr, info]) => {
        const chainId = Number(chainIdStr);
        try {
          const client = this.getPublicClient(chainId);
          const balancePromise = client.getBalance({ address });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('RPC Timeout')), 2500)
          );
          const balance = (await Promise.race([balancePromise, timeoutPromise])) as bigint;
          results[chainId] = {
            chainName: info.name,
            symbol: info.nativeSymbol,
            balanceWei: balance,
            balanceEth: formatEther(balance)
          };
        } catch (err) {
          results[chainId] = {
            chainName: info.name,
            symbol: info.nativeSymbol,
            balanceWei: 0n,
            balanceEth: '0.00'
          };
        }
      })
    );

    return results;
  }

  /**
   * Creates a Viem WalletClient given a raw private key hex string
   */
  public getWalletClient(privateKeyHex: string, chainId: number) {
    const chainInfo = SUPPORTED_CHAINS[chainId];
    if (!chainInfo) {
      throw new Error(`Unsupported chainId ${chainId}`);
    }

    const formattedKey = (privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`) as Hex;
    const account = privateKeyToAccount(formattedKey);

    return {
      account,
      client: createWalletClient({
        account,
        chain: chainInfo.chain,
        transport: http(chainInfo.defaultRpc)
      })
    };
  }

  /**
   * Probes for EIP-7702 delegation support / runtime codehash
   */
  public async checkAccountCode(address: Address, chainId: number): Promise<{ hasCode: boolean; codeHex: Hex }> {
    const client = this.getPublicClient(chainId);
    const code = await client.getBytecode({ address });
    const codeHex = code || '0x';
    return {
      hasCode: codeHex !== '0x',
      codeHex
    };
  }
}

export const viemService = new ViemService();
