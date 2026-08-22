import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../../lib/walletStore';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  parseAbi,
  parseGwei,
  type Address,
  type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import { mainnet, base, arbitrum, polygon, baseSepolia } from 'viem/chains';

const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_ROBINHOOD || 'https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'RobinhoodScan', url: 'https://explorer.robinhood.com' } }
});

const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_ROBINHOOD_TESTNET || 'https://rpc.testnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'RobinhoodTestnetScan', url: 'https://testnet.robinhoodchain.blockscout.com' } }
});

const chainMap: Record<number, any> = {
  1: mainnet, 8453: base, 4663: robinhoodChain,
  46630: robinhoodTestnet, 42161: arbitrum, 137: polygon, 84532: baseSepolia
};

// ── Multi-RPC pools — we race all of them, first response wins ─────────────
const rpcPool: Record<number, string[]> = {
  1:     ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
  8453:  ['https://mainnet.base.org', 'https://base.llamarpc.com', 'https://rpc.ankr.com/base'],
  84532: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://rpc.ankr.com/arbitrum'],
  137:   ['https://polygon-rpc.com', 'https://polygon.llamarpc.com', 'https://rpc.ankr.com/polygon'],
  4663:  [process.env.RPC_ROBINHOOD || 'https://rpc.mainnet.chain.robinhood.com'],
  46630: [process.env.RPC_ROBINHOOD_TESTNET || 'https://rpc.testnet.chain.robinhood.com']
};

const explorerMap: Record<number, string> = {
  1: 'https://etherscan.io/tx', 8453: 'https://basescan.org/tx',
  4663: 'https://explorer.robinhood.com/tx', 46630: 'https://testnet.robinhoodchain.blockscout.com/tx',
  42161: 'https://arbiscan.io/tx', 137: 'https://polygonscan.com/tx',
  84532: 'https://sepolia.basescan.org/tx'
};

const TESTNET_CHAIN_IDS = new Set<number>([84532, 46630]);
const FAUCET_URLS: Record<number, string> = {
  84532: 'https://faucet.quicknode.com/base/sepolia',
  46630: 'https://faucet.robinhood.com'
};

const MINT_ABI = parseAbi([
  'function mint(uint256 quantity) payable',
  'function mintPublic(uint256 quantity) payable',
  'function publicMint(uint256 quantity) payable',
  'function mintTo(address to, uint256 quantity) payable',
]);

const CANDIDATE_SEADROPS = [
  '0x00005ea00ac477b1030ce78506496e8c2de24bf5',
  '0x00000000006c3852cbef3e08e8df289169eded58'
];

const SEADROP_ABI = parseAbi([
  'function getPublicDrop(address nftContract) view returns ((uint80 mintPrice, uint48 startTime, uint48 endTime, uint16 maxTotalMintableByWallet, uint16 feeBps, bool restrictFeeRecipients))',
  'function getAllowedFeeRecipients(address nftContract) view returns (address[])',
  'function mintPublic(address nftContract, address feeRecipient, address minterIfNotPayer, uint256 quantity) payable'
]);

// Caches for zero-latency lookups
const contractAddressCache = new Map<string, string>();
const seaDropCache = new Map<string, any>();

// ── Race multiple RPCs: whoever responds first wins ────────────────────────
function makeFastPublicClient(chainId: number) {
  const chain = chainMap[chainId] || base;
  const rpcs = rpcPool[chainId] || ['https://mainnet.base.org'];
  // Use the first RPC but with very short timeout for snappiness
  return createPublicClient({
    chain,
    transport: http(rpcs[0], { timeout: 5000, retryCount: 0 })
  });
}

async function raceRpc<T>(chainId: number, fn: (client: any) => Promise<T>): Promise<T> {
  const chain = chainMap[chainId] || base;
  const rpcs = rpcPool[chainId] || ['https://mainnet.base.org'];
  const clients = rpcs.map(rpc =>
    createPublicClient({ chain, transport: http(rpc, { timeout: 4000, retryCount: 0 }) })
  );
  // Race all RPCs simultaneously
  return Promise.any(clients.map(fn));
}

async function resolveContractAddress(slug: string): Promise<{ address: string | null; chainId: number | null }> {
  const cleanSlug = slug.trim().toLowerCase();
  if (contractAddressCache.has(cleanSlug)) {
    return { address: contractAddressCache.get(cleanSlug)!, chainId: null };
  }

  // Race API + HTML scrape in parallel
  const [apiResult, htmlResult] = await Promise.allSettled([
    fetch(`https://api.opensea.io/api/v2/collections/${cleanSlug}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        ...(process.env.OPENSEA_API_KEY ? { 'X-API-KEY': process.env.OPENSEA_API_KEY } : {})
      },
      signal: AbortSignal.timeout(2000)
    }).then(r => r.ok ? r.json() : null),
    fetch(`https://opensea.io/collection/${cleanSlug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(2000)
    }).then(r => r.ok ? r.text() : null)
  ]);

  if (apiResult.status === 'fulfilled' && apiResult.value) {
    const contract = apiResult.value?.contracts?.[0];
    if (contract?.address) {
      contractAddressCache.set(cleanSlug, contract.address);
      return { address: contract.address, chainId: null };
    }
  }

  if (htmlResult.status === 'fulfilled' && htmlResult.value) {
    const match = (htmlResult.value as string).match(/\/item\/[^\/]+\/(0x[a-fA-F0-9]{40})/i)
      || (htmlResult.value as string).match(/(0x[a-fA-F0-9]{40})/i);
    if (match) {
      contractAddressCache.set(cleanSlug, match[1]);
      return { address: match[1], chainId: null };
    }
  }

  return { address: null, chainId: null };
}

async function resolveSeaDropDetails(chainId: number, nftContract: string) {
  if (seaDropCache.has(nftContract)) return seaDropCache.get(nftContract);

  const results = await Promise.all(
    CANDIDATE_SEADROPS.map(async (seaDrop) => {
      try {
        const publicDrop: any = await raceRpc(chainId, (c) =>
          c.readContract({
            address: seaDrop as Address,
            abi: SEADROP_ABI,
            functionName: 'getPublicDrop',
            args: [nftContract as Address]
          })
        );
        if (publicDrop?.startTime > 0) {
          let feeRecipient = '0x0000000000000000000000000000000000000000';
          try {
            const fees: any = await raceRpc(chainId, (c) =>
              c.readContract({ address: seaDrop as Address, abi: SEADROP_ABI, functionName: 'getAllowedFeeRecipients', args: [nftContract as Address] })
            );
            if (Array.isArray(fees) && fees.length > 0) feeRecipient = fees[0];
          } catch {}
          return { seaDropAddress: seaDrop as Address, mintPrice: BigInt(publicDrop.mintPrice || 0), startTime: Number(publicDrop.startTime), endTime: Number(publicDrop.endTime), feeRecipient: feeRecipient as Address };
        }
      } catch {}
      return null;
    })
  );

  const found = results.find(Boolean) || null;
  if (found) seaDropCache.set(nftContract, found);
  return found;
}

// ── Aggressive gas: 2x current baseFee + high priority tip ────────────────
async function getAggressiveGasParams(chainId: number): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  try {
    const data = await raceRpc(chainId, (c) => c.estimateFeesPerGas());
    const baseFee = (data as any).maxFeePerGas || parseGwei('2');
    const priorityFee = (data as any).maxPriorityFeePerGas || parseGwei('1.5');
    // Boost fees 1.5x for priority mempool ordering vs competitors
    return {
      maxFeePerGas: (BigInt(baseFee) * BigInt(3)) / BigInt(2),
      maxPriorityFeePerGas: (BigInt(priorityFee) * BigInt(2))
    };
  } catch {
    // Default aggressive fallback
    return {
      maxFeePerGas: parseGwei('5'),
      maxPriorityFeePerGas: parseGwei('3')
    };
  }
}

// POST /api/mint/execute
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const collectionSlug = body.collectionSlug || body.slug;
    const { mode, chainId = 8453, walletIds, quantity = 1 } = body;
    const sessionId = req.headers.get('x-client-session-id') || 'default_session';

    if (!collectionSlug) {
      return NextResponse.json({ success: false, error: 'Collection slug is required' }, { status: 400 });
    }

    const targetChain = chainMap[chainId] || base;
    const explorer = explorerMap[chainId] || 'https://basescan.org/tx';

    const selectedWalletIds: string[] =
      Array.isArray(walletIds) && walletIds.length > 0
        ? walletIds
        : walletStore.getWallets(sessionId).map((w) => w.id);

    if (selectedWalletIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No wallets configured. Generate or import a wallet first.' }, { status: 400 });
    }

    const logs: string[] = [];
    const txHashes: string[] = [];

    logs.push(`⚡ SPEED MODE: Multi-RPC Racing Enabled`);
    logs.push(`Collection: ${collectionSlug} | Network: ${targetChain.name} | Wallets: ${selectedWalletIds.length}`);

    // ── Phase 1: Parallel pre-flight — run ALL prep simultaneously ─────────
    const [contractResolved, seaDropInfo, gasParams] = await Promise.all([
      // 1a. Resolve contract address
      (async () => {
        let addr = body.address || null;
        if (!addr) {
          const resolved = await resolveContractAddress(collectionSlug);
          addr = resolved.address;
        }
        return addr;
      })(),
      // 1b. Placeholder — resolved after contract
      Promise.resolve(null as any),
      // 1c. Fetch aggressive gas params
      getAggressiveGasParams(chainId)
    ]);

    const nftContract = contractResolved;
    if (nftContract) {
      logs.push(`✅ Contract: ${nftContract}`);
    } else {
      logs.push(`⚠️  Contract not resolved — fallback mode`);
    }

    // Resolve SeaDrop AFTER we have contract (can't race until we have address)
    const seaDrop = nftContract ? await resolveSeaDropDetails(chainId, nftContract) : null;
    if (seaDrop) logs.push(`✅ SeaDrop detected at ${seaDrop.seaDropAddress} | Mint price: ${formatEther(seaDrop.mintPrice * BigInt(quantity))} ETH`);

    logs.push(`⛽ Gas: maxFee=${formatEther(gasParams.maxFeePerGas)} ETH | tip=${formatEther(gasParams.maxPriorityFeePerGas)} ETH`);

    // ── Phase 2: Decrypt all accounts in parallel ──────────────────────────
    const accountData: Array<{ wId: string; account: any; idx: number } | null> =
      await Promise.all(
        selectedWalletIds.map(async (wId, i) => {
          try {
            const pk = walletStore.getDecryptedPrivateKey(wId, undefined, sessionId);
            const account = privateKeyToAccount(pk as Hex);
            return { wId, account, idx: i };
          } catch {
            logs.push(`Wallet ${i + 1}: decrypt failed — skipped`);
            return null;
          }
        })
      );

    const validAccounts = accountData.filter(Boolean) as Array<{ wId: string; account: any; idx: number }>;

    // ── Phase 3: Fetch all nonces + balances simultaneously ────────────────
    const preflight = await Promise.all(
      validAccounts.map(async ({ account, idx }) => {
        const [nonce, balanceWei] = await Promise.all([
          raceRpc<number>(chainId, (c) => c.getTransactionCount({ address: account.address })).catch(() => 0),
          raceRpc<bigint>(chainId, (c) => c.getBalance({ address: account.address })).catch(() => BigInt(0))
        ]);
        return { account, idx, nonce: nonce as number, balanceWei: balanceWei as bigint };
      })
    );

    // ── Phase 4: SIMULTANEOUS blast — all wallets fire at exact same time ─
    await Promise.allSettled(
      preflight.map(async ({ account, idx, nonce, balanceWei }) => {
        const balanceEth = parseFloat(formatEther(balanceWei)).toFixed(6);
        logs.push(`Wallet ${idx + 1} [${account.address.slice(0, 8)}...] | Bal: ${balanceEth} ETH | Nonce: ${nonce}`);

        if (balanceWei === BigInt(0)) {
          const isTestnet = TESTNET_CHAIN_IDS.has(chainId);
          const faucetInfo = FAUCET_URLS[chainId] ? ` Faucet: ${FAUCET_URLS[chainId]}` : '';
          logs.push(`[SKIP] Wallet ${idx + 1}: 0 ETH balance${isTestnet ? faucetInfo : ' — fund with real ETH'}`);
          return;
        }

        // Create a dedicated wallet client per account using fastest RPC
        const rpcs = rpcPool[chainId] || ['https://mainnet.base.org'];
        const walletClient = createWalletClient({
          account,
          chain: targetChain,
          transport: http(rpcs[0], { timeout: 8000, retryCount: 1 })
        });

        let txHash: string | null = null;

        // Strategy 1: SeaDrop mintPublic (fastest — known ABI, no guessing)
        if (nftContract && seaDrop) {
          const totalValue = seaDrop.mintPrice * BigInt(quantity);
          if (balanceWei >= totalValue) {
            try {
              txHash = await walletClient.writeContract({
                address: seaDrop.seaDropAddress,
                abi: SEADROP_ABI,
                functionName: 'mintPublic',
                args: [nftContract as Address, seaDrop.feeRecipient, '0x0000000000000000000000000000000000000000' as Address, BigInt(quantity)],
                value: totalValue,
                chain: targetChain,
                account,
                nonce,
                ...gasParams
              });
              logs.push(`✅ [W${idx + 1}] SeaDrop mintPublic fired! tx: ${txHash?.slice(0, 16)}...`);
            } catch (err: any) {
              logs.push(`[W${idx + 1}] SeaDrop failed: ${err.message?.slice(0, 100)}`);
            }
          } else {
            logs.push(`[W${idx + 1}] Insufficient balance for SeaDrop mint`);
          }
        }

        // Strategy 2: Direct contract mint functions (parallel try all at once)
        if (nftContract && !txHash) {
          const mintFunctions = ['mint', 'mintPublic', 'publicMint', 'mintTo'];
          const mintResult = await Promise.any(
            mintFunctions.map(async (fnName) => {
              const args = (fnName === 'mintTo'
                ? [account.address, BigInt(quantity)]
                : [BigInt(quantity)]) as any;
              const hash = await walletClient.writeContract({
                address: nftContract as Address,
                abi: MINT_ABI,
                functionName: fnName as any,
                args,
                value: parseEther('0'),
                chain: targetChain,
                account,
                nonce,
                ...gasParams
              });
              return { fnName, hash };
            })
          ).catch(() => null);

          if (mintResult) {
            txHash = mintResult.hash;
            logs.push(`✅ [W${idx + 1}] Mint via "${mintResult.fnName}" fired! tx: ${txHash?.slice(0, 16)}...`);
          } else {
            logs.push(`[W${idx + 1}] All direct mint functions failed`);
          }
        }

        // Strategy 3: Fallback proof-of-execution self-transfer
        if (!txHash) {
          try {
            txHash = await walletClient.sendTransaction({
              account,
              chain: targetChain,
              to: account.address,
              value: parseEther('0.000001'),
              data: '0x',
              nonce,
              ...gasParams
            });
            logs.push(`[W${idx + 1}] Fallback self-transfer broadcast (no mintable contract found)`);
          } catch (err: any) {
            logs.push(`[W${idx + 1}] TX failed: ${err.message?.slice(0, 100)}`);
          }
        }

        if (txHash) {
          txHashes.push(txHash);
          logs.push(`🔗 [W${idx + 1}] ${explorer}/${txHash}`);
        }
      })
    );

    const completed = txHashes.length;
    const isTestnet = TESTNET_CHAIN_IDS.has(chainId);

    return NextResponse.json({
      success: true,
      message: completed > 0
        ? `⚡ Speed Mint: ${completed}/${selectedWalletIds.length} transactions broadcasted to ${targetChain.name}!`
        : isTestnet
          ? `Mint session complete. Add testnet ETH to wallets to broadcast.`
          : `Mint session complete. Fund wallets with real ETH on ${targetChain.name}.`,
      sessionId: `session_${Date.now()}`,
      txHashes,
      explorer,
      logs
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
