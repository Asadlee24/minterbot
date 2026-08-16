import { Address, keccak256 } from 'viem';
import { viemService, SUPPORTED_CHAINS } from './viem.service.js';
import { walletService } from './wallet.service.js';
import { AUDITED_EXECUTOR_RUNTIME_HASH } from './sponsored.service.js';

export interface DoctorReport {
  timestamp: string;
  rpcChecks: { chainId: number; chainName: string; ok: boolean; blockNumber?: number; error?: string }[];
  walletChecks: { totalWallets: number; totalEth: string; underfundedCount: number };
  sponsoredChecks: { executorAddress?: Address; verified: boolean; runtimeHashMatch?: boolean; details?: string };
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export class DoctorService {
  public async runDoctorCheck(executorAddress?: Address, targetChainId: number = 84532): Promise<DoctorReport> {
    const rpcChecks: DoctorReport['rpcChecks'] = [];

    // 1. Check all RPCs
    for (const [chainIdStr, info] of Object.entries(SUPPORTED_CHAINS)) {
      const chainId = Number(chainIdStr);
      try {
        const client = viemService.getPublicClient(chainId);
        const blockNumber = await client.getBlockNumber();
        rpcChecks.push({
          chainId,
          chainName: info.name,
          ok: true,
          blockNumber: Number(blockNumber)
        });
      } catch (err: any) {
        rpcChecks.push({
          chainId,
          chainName: info.name,
          ok: false,
          error: err.message
        });
      }
    }

    // 2. Check Wallets & Balances
    const wallets = await walletService.listWalletsWithBalances();
    let totalEth = 0;
    let underfundedCount = 0;

    for (const w of wallets) {
      const bal = w.balances?.[targetChainId];
      if (bal) {
        const numEth = parseFloat(bal.balanceEth);
        totalEth += numEth;
        if (numEth < 0.001) underfundedCount++;
      }
    }

    // 3. Sponsored Executor Check
    let sponsoredChecks: DoctorReport['sponsoredChecks'] = { verified: false };
    if (executorAddress) {
      try {
        const { hasCode, codeHex } = await viemService.checkAccountCode(executorAddress, targetChainId);
        if (hasCode) {
          const runtimeHash = keccak256(codeHex);
          const hashMatch = runtimeHash.toLowerCase() === AUDITED_EXECUTOR_RUNTIME_HASH.toLowerCase();
          sponsoredChecks = {
            executorAddress,
            verified: true,
            runtimeHashMatch: hashMatch,
            details: hashMatch ? 'Executor bytecode matches audited runtime hash' : `Runtime hash mismatch: ${runtimeHash}`
          };
        } else {
          sponsoredChecks = { executorAddress, verified: false, details: 'Contract not deployed at given address' };
        }
      } catch (err: any) {
        sponsoredChecks = { executorAddress, verified: false, details: err.message };
      }
    }

    const rpcFailed = rpcChecks.some((c) => !c.ok);
    const status: DoctorReport['overallStatus'] = rpcFailed ? 'CRITICAL' : underfundedCount > 0 ? 'WARNING' : 'HEALTHY';

    return {
      timestamp: new Date().toISOString(),
      rpcChecks,
      walletChecks: {
        totalWallets: wallets.length,
        totalEth: totalEth.toFixed(4),
        underfundedCount
      },
      sponsoredChecks,
      overallStatus: status
    };
  }
}

export const doctorService = new DoctorService();
