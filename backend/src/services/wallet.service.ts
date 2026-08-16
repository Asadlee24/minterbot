import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Address, Hex } from 'viem';
import { db, WalletRecord } from '../db/database.js';
import { encryptPrivateKey, decryptPrivateKey } from '../crypto/encryption.js';
import { viemService } from './viem.service.js';

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export interface PublicWalletInfo {
  id: string;
  address: string;
  label: string;
  createdAt: string;
  balances?: Record<number, { chainName: string; symbol: string; balanceEth: string }>;
}

export class WalletService {
  /**
   * Generates N new EVM wallets, encrypts their keys, and stores them in DB.
   */
  public async generateWallets(count: number, labelPrefix: string = 'Manifest Wallet'): Promise<PublicWalletInfo[]> {
    const created: PublicWalletInfo[] = [];

    for (let i = 0; i < count; i++) {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const encryptedKey = encryptPrivateKey(privateKey, ENCRYPTION_SECRET);
      const id = `w_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const label = `${labelPrefix} #${i + 1}`;

      db.saveWallet(id, account.address, encryptedKey, label);
      created.push({
        id,
        address: account.address,
        label,
        createdAt: new Date().toISOString()
      });
    }

    return created;
  }

  /**
   * Imports a single or array of private keys.
   */
  public async importWallets(privateKeys: string[], labelPrefix: string = 'Imported Wallet'): Promise<PublicWalletInfo[]> {
    const imported: PublicWalletInfo[] = [];

    for (let i = 0; i < privateKeys.length; i++) {
      let keyHex = privateKeys[i].trim();
      if (!keyHex.startsWith('0x')) {
        keyHex = `0x${keyHex}`;
      }

      const account = privateKeyToAccount(keyHex as Hex);
      const encryptedKey = encryptPrivateKey(keyHex, ENCRYPTION_SECRET);
      const id = `w_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const label = `${labelPrefix} #${i + 1}`;

      db.saveWallet(id, account.address, encryptedKey, label);
      imported.push({
        id,
        address: account.address,
        label,
        createdAt: new Date().toISOString()
      });
    }

    return imported;
  }

  /**
   * Returns all wallet records with multi-chain balances (public info only).
   */
  public async listWalletsWithBalances(): Promise<PublicWalletInfo[]> {
    const records = db.getWallets();
    const result: PublicWalletInfo[] = [];

    await Promise.all(
      records.map(async (rec) => {
        const balances = await viemService.getBalancesAcrossChains(rec.address as Address);
        result.push({
          id: rec.id,
          address: rec.address,
          label: rec.label,
          createdAt: rec.createdAt,
          balances
        });
      })
    );

    return result.sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Internal method to decrypt private key for transaction signing.
   * NEVER expose this in public API routes!
   */
  public getDecryptedPrivateKey(walletId: string): string {
    const records = db.getWallets();
    const record = records.find((w) => w.id === walletId || w.address.toLowerCase() === walletId.toLowerCase());
    if (!record) {
      throw new Error(`Wallet not found for id/address ${walletId}`);
    }

    return decryptPrivateKey(record.encryptedKey, ENCRYPTION_SECRET);
  }

  public deleteWallet(id: string): boolean {
    return db.deleteWallet(id);
  }
}

export const walletService = new WalletService();
