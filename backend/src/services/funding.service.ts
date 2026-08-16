import { Address, parseEther, formatEther } from 'viem';
import { walletService } from './wallet.service.js';
import { viemService } from './viem.service.js';

export class FundingService {
  /**
   * Funds all target wallets from sponsor key with native token amount
   */
  public async fundWallets(sponsorWalletId: string, targetWalletIds: string[], amountEth: string, chainId: number): Promise<string[]> {
    const sponsorKey = walletService.getDecryptedPrivateKey(sponsorWalletId);
    const { client: sponsorClient } = viemService.getWalletClient(sponsorKey, chainId);
    const txHashes: string[] = [];
    const amountWei = parseEther(amountEth);

    for (const wId of targetWalletIds) {
      const records = walletService.getDecryptedPrivateKey(wId);
      const { account: targetAccount } = viemService.getWalletClient(records, chainId);

      const hash = await (sponsorClient as any).sendTransaction({
        to: targetAccount.address,
        value: amountWei
      });
      txHashes.push(hash);
    }

    return txHashes;
  }

  /**
   * Sweeps remaining native balances from manifest wallets back to recipient address
   */
  public async sweepWallets(targetWalletIds: string[], recipientAddress: Address, chainId: number): Promise<string[]> {
    const txHashes: string[] = [];
    const publicClient = viemService.getPublicClient(chainId);

    for (const wId of targetWalletIds) {
      try {
        const pKey = walletService.getDecryptedPrivateKey(wId);
        const { account, client: walletClient } = viemService.getWalletClient(pKey, chainId);

        const balance = await publicClient.getBalance({ address: account.address });
        const gasLimit = 21000n;
        const gasPrice = await publicClient.getGasPrice();
        const gasCost = gasLimit * gasPrice;

        if (balance > gasCost) {
          const sweepAmount = balance - gasCost;
          const hash = await (walletClient as any).sendTransaction({
            to: recipientAddress,
            value: sweepAmount
          });
          txHashes.push(hash);
        }
      } catch (err: any) {
        console.warn(`Sweep failed for wallet ${wId}: ${err.message}`);
      }
    }

    return txHashes;
  }
}

export const fundingService = new FundingService();
