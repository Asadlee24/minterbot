import { Address, Hex, parseEther, formatEther } from 'viem';
import { walletService } from './wallet.service.js';
import { openSeaService, CollectionMetadata } from './opensea.service.js';
import { viemService } from './viem.service.js';
import { sponsoredService } from './sponsored.service.js';
import { db } from '../db/database.js';
import pLimit from 'p-limit';

export interface MintTaskRequest {
  slug: string;
  walletIds: string[];
  mode: 'single' | 'self-funded' | 'sponsored';
  chainId: number;
  recipientAddress?: Address;
  sponsorWalletId?: string;
  executorAddress?: Address;
  quantity?: number;
}

export interface MintTaskProgress {
  taskId: string;
  status: 'STARTING' | 'AUTH' | 'FETCHING_CALLDATA' | 'SUBMITTING' | 'COMPLETED' | 'FAILED';
  completedCount: number;
  totalCount: number;
  logs: string[];
  txHashes: string[];
}

export type StatusCallback = (progress: MintTaskProgress) => void;

export class MintEngine {
  /**
   * Executes mint session according to selected mode
   */
  public async executeMintSession(req: MintTaskRequest, onProgress?: StatusCallback): Promise<MintTaskProgress> {
    const taskId = `mint_${Date.now()}`;
    const logs: string[] = [];
    const txHashes: string[] = [];

    const updateStatus = (status: MintTaskProgress['status'], completed = 0, total = req.walletIds.length, msg?: string) => {
      if (msg) logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      const payload: MintTaskProgress = {
        taskId,
        status,
        completedCount: completed,
        totalCount: total,
        logs: [...logs],
        txHashes: [...txHashes]
      };
      if (onProgress) onProgress(payload);
    };

    updateStatus('STARTING', 0, req.walletIds.length, `Initializing ${req.mode} mint session for collection: ${req.slug}`);

    try {
      // 1. Fetch collection metadata
      updateStatus('STARTING', 0, req.walletIds.length, 'Fetching collection metadata from OpenSea...');
      const metadata = await openSeaService.getCollectionMetadata(req.slug);
      updateStatus('STARTING', 0, req.walletIds.length, `Collection resolved: ${metadata.slug} (${metadata.address}) on chain ${metadata.networkId}`);

      // 2. Select execution path
      if (req.mode === 'single') {
        return await this.executeSingleWallet(req, metadata, taskId, logs, txHashes, updateStatus);
      } else if (req.mode === 'self-funded') {
        return await this.executeSelfFundedMultiWallet(req, metadata, taskId, logs, txHashes, updateStatus);
      } else {
        return await this.executeSponsoredEip7702(req, metadata, taskId, logs, txHashes, updateStatus);
      }
    } catch (err: any) {
      updateStatus('FAILED', 0, req.walletIds.length, `Mint session error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Single wallet mode execution
   */
  private async executeSingleWallet(
    req: MintTaskRequest,
    collection: CollectionMetadata,
    taskId: string,
    logs: string[],
    txHashes: string[],
    updateStatus: any
  ): Promise<MintTaskProgress> {
    const walletId = req.walletIds[0];
    const privateKey = walletService.getDecryptedPrivateKey(walletId);
    const { account, client: walletClient } = viemService.getWalletClient(privateKey, req.chainId);

    updateStatus('AUTH', 0, 1, `Authenticating wallet ${account.address} with OpenSea SIWE...`);
    await openSeaService.authenticateWallet(privateKey, req.chainId, req.slug);

    updateStatus('FETCHING_CALLDATA', 0, 1, 'Fetching mint transaction calldata...');
    const action = await openSeaService.getMintAction(collection, account.address, '0', req.quantity || 1);

    updateStatus('SUBMITTING', 0, 1, `Submitting EIP-1559 transaction to target ${action.target}...`);
    const txHash = await walletClient.sendTransaction({
      to: action.target,
      data: action.calldata,
      value: action.value
    });

    txHashes.push(txHash);
    db.addMintLog({
      walletAddress: account.address,
      collectionSlug: req.slug,
      mode: 'single',
      status: 'SUCCESS',
      txHash
    });

    updateStatus('COMPLETED', 1, 1, `Successfully submitted mint transaction: ${txHash}`);
    return {
      taskId,
      status: 'COMPLETED',
      completedCount: 1,
      totalCount: 1,
      logs,
      txHashes
    };
  }

  /**
   * Self-funded multi-wallet execution (max 10 wallets concurrent)
   */
  private async executeSelfFundedMultiWallet(
    req: MintTaskRequest,
    collection: CollectionMetadata,
    taskId: string,
    logs: string[],
    txHashes: string[],
    updateStatus: any
  ): Promise<MintTaskProgress> {
    const walletIds = req.walletIds.slice(0, 10);
    updateStatus('STARTING', 0, walletIds.length, `Preparing self-funded multi-wallet execution for ${walletIds.length} wallets`);

    const limit = pLimit(5); // Concurrency cap of 5 parallel requests
    let completed = 0;

    await Promise.all(
      walletIds.map((wId) =>
        limit(async () => {
          try {
            const privateKey = walletService.getDecryptedPrivateKey(wId);
            const { account, client: walletClient } = viemService.getWalletClient(privateKey, req.chainId);

            await openSeaService.authenticateWallet(privateKey, req.chainId, req.slug);
            const action = await openSeaService.getMintAction(collection, account.address, '0', req.quantity || 1);

            const hash = await walletClient.sendTransaction({
              to: action.target,
              data: action.calldata,
              value: action.value
            });

            txHashes.push(hash);
            completed++;
            db.addMintLog({
              walletAddress: account.address,
              collectionSlug: req.slug,
              mode: 'self-funded',
              status: 'SUCCESS',
              txHash: hash
            });
            updateStatus('SUBMITTING', completed, walletIds.length, `Wallet ${account.address} minted! Tx: ${hash}`);
          } catch (err: any) {
            completed++;
            updateStatus('SUBMITTING', completed, walletIds.length, `Wallet mint failed: ${err.message}`);
          }
        })
      )
    );

    updateStatus('COMPLETED', walletIds.length, walletIds.length, 'All self-funded multi-wallet mint tasks completed.');
    return { taskId, status: 'COMPLETED', completedCount: completed, totalCount: walletIds.length, logs, txHashes };
  }

  /**
   * Sponsored EIP-7702 multi-wallet execution (max 25 wallets)
   */
  private async executeSponsoredEip7702(
    req: MintTaskRequest,
    collection: CollectionMetadata,
    taskId: string,
    logs: string[],
    txHashes: string[],
    updateStatus: any
  ): Promise<MintTaskProgress> {
    if (!req.sponsorWalletId || !req.executorAddress) {
      throw new Error('Sponsored mode requires sponsorWalletId and executorAddress');
    }

    const walletIds = req.walletIds.slice(0, 25);
    const sponsorKey = walletService.getDecryptedPrivateKey(req.sponsorWalletId);
    const { account: sponsorAccount, client: sponsorWalletClient } = viemService.getWalletClient(sponsorKey, req.chainId);

    updateStatus('STARTING', 0, walletIds.length, `Preparing EIP-7702 sponsored batch for ${walletIds.length} wallets via sponsor ${sponsorAccount.address}`);

    const signedOps: any[] = [];
    const batchId = `0x${Date.now().toString(16).padStart(64, '0')}` as Hex;
    let index = 0;

    for (const wId of walletIds) {
      const pKey = walletService.getDecryptedPrivateKey(wId);
      const { account: walletAcc } = viemService.getWalletClient(pKey, req.chainId);

      await openSeaService.authenticateWallet(pKey, req.chainId, req.slug);
      const action = await openSeaService.getMintAction(collection, walletAcc.address, '0', req.quantity || 1);

      const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min deadline
      const recipient = req.recipientAddress || sponsorAccount.address;

      const signedOp = await sponsoredService.signOperation(
        pKey,
        sponsorAccount.address,
        batchId,
        index,
        req.executorAddress,
        {
          wallet: walletAcc.address,
          mintTarget: action.target,
          nftContract: collection.address,
          recipient,
          mintValue: action.value,
          expectedUnits: BigInt(req.quantity || 1),
          mintGasLimit: 300000n,
          walletGasLimit: 550000n,
          deadline,
          mintCalldata: action.calldata
        },
        req.chainId
      );

      signedOps.push({
        wallet: signedOp.wallet,
        mintTarget: signedOp.mintTarget,
        nftContract: signedOp.nftContract,
        recipient: signedOp.recipient,
        mintValue: signedOp.mintValue,
        expectedUnits: signedOp.expectedUnits,
        mintGasLimit: signedOp.mintGasLimit,
        walletGasLimit: signedOp.walletGasLimit,
        deadline: signedOp.deadline,
        mintCalldata: signedOp.mintCalldata,
        signatureR: signedOp.signatureR,
        signatureYParityAndS: signedOp.signatureYParityAndS
      });

      index++;
      updateStatus('FETCHING_CALLDATA', index, walletIds.length, `Prepared EIP-712 mint op for wallet ${walletAcc.address}`);
    }

    updateStatus('SUBMITTING', walletIds.length, walletIds.length, `Sponsor submitting executeBatch transaction to executor ${req.executorAddress}...`);

    // ABI for SponsoredMintExecutor.executeBatch
    const abi = [
      {
        name: 'executeBatch',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'batchId', type: 'bytes32' },
          {
            name: 'operations',
            type: 'tuple[]',
            components: [
              { name: 'wallet', type: 'address' },
              { name: 'mintTarget', type: 'address' },
              { name: 'nftContract', type: 'address' },
              { name: 'recipient', type: 'address' },
              { name: 'mintValue', type: 'uint256' },
              { name: 'expectedUnits', type: 'uint256' },
              { name: 'mintGasLimit', type: 'uint64' },
              { name: 'walletGasLimit', type: 'uint64' },
              { name: 'deadline', type: 'uint48' },
              { name: 'mintCalldata', type: 'bytes' },
              { name: 'signatureR', type: 'bytes32' },
              { name: 'signatureYParityAndS', type: 'bytes32' }
            ]
          }
        ],
        outputs: []
      }
    ] as const;

    const txHash = await sponsorWalletClient.writeContract({
      address: req.executorAddress,
      abi,
      functionName: 'executeBatch',
      args: [batchId, signedOps]
    });

    txHashes.push(txHash);
    updateStatus('COMPLETED', walletIds.length, walletIds.length, `EIP-7702 Sponsored batch executed! Tx: ${txHash}`);

    return { taskId, status: 'COMPLETED', completedCount: walletIds.length, totalCount: walletIds.length, logs, txHashes };
  }
}

export const mintEngine = new MintEngine();
