/**
 * Shared wallet store and crypto utilities for Next.js API routes.
 * Session-isolated so each user's browser session receives ONLY their own wallets.
 */

import crypto from 'crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export const ENCRYPTION_SECRET =
  process.env.ENCRYPTION_SECRET ||
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// ---------------------------------------------------------------------------
// AES-256-GCM encryption helpers
// ---------------------------------------------------------------------------

export function encryptKey(text: string, secret: string): string {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptKey(cipherText: string, secret: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted payload format');
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ---------------------------------------------------------------------------
// Session-Isolated In-memory Wallet Store
// ---------------------------------------------------------------------------

export interface WalletRecord {
  id: string;
  address: string;
  encryptedKey: string;
  label: string;
  createdAt: string;
}

const globalStore = global as unknown as {
  _walletsBySession: Record<string, WalletRecord[]>;
};

if (!globalStore._walletsBySession) globalStore._walletsBySession = {};

export const walletStore = {
  getWallets(sessionId = 'default_session'): WalletRecord[] {
    if (!globalStore._walletsBySession[sessionId]) {
      globalStore._walletsBySession[sessionId] = [];
    }
    return globalStore._walletsBySession[sessionId];
  },

  save(record: WalletRecord, sessionId = 'default_session'): void {
    const list = this.getWallets(sessionId);
    const existing = list.findIndex(
      (w) => w.id === record.id || w.address.toLowerCase() === record.address.toLowerCase()
    );
    if (existing >= 0) {
      list[existing] = record;
    } else {
      list.push(record);
    }
  },

  delete(id: string, sessionId = 'default_session'): boolean {
    const list = this.getWallets(sessionId);
    const idx = list.findIndex((w) => w.id === id);
    if (idx < 0) return false;
    list.splice(idx, 1);
    return true;
  },

  getDecryptedPrivateKey(id: string, fallbackEncryptedKey?: string, sessionId = 'default_session'): string {
    const list = this.getWallets(sessionId);
    const record = list.find((w) => w.id === id || w.address.toLowerCase() === id.toLowerCase());
    const encKey = record?.encryptedKey || fallbackEncryptedKey;
    if (!encKey) throw new Error(`Wallet not found for ID ${id}`);
    return decryptKey(encKey, ENCRYPTION_SECRET);
  },

  generate(count: number, labelPrefix = 'Manifest Wallet', sessionId = 'default_session') {
    const created: WalletRecord[] = [];
    const validCount = Math.min(Math.max(1, count || 1), 50);
    const existingCount = this.getWallets(sessionId).length;
    for (let i = 0; i < validCount; i++) {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const encryptedKey = encryptKey(privateKey, ENCRYPTION_SECRET);
      const id = `w_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const label = `${labelPrefix} #${existingCount + created.length + 1}`;
      const createdAt = new Date().toISOString();
      const record: WalletRecord = { id, address: account.address, encryptedKey, label, createdAt };
      this.save(record, sessionId);
      created.push(record);
    }
    return created;
  },

  import(privateKeys: string[], labelPrefix = 'Imported Wallet', sessionId = 'default_session') {
    const imported: WalletRecord[] = [];
    const existingCount = this.getWallets(sessionId).length;
    for (let i = 0; i < privateKeys.length; i++) {
      let raw = (privateKeys[i] || '').trim().replace(/^['"]|['"]$/g, '');
      if (!raw) continue;
      let keyHex = raw.startsWith('0x') ? raw : `0x${raw}`;
      if (!/^0x[0-9a-fA-F]{64}$/.test(keyHex)) {
        throw new Error(`Invalid private key at index ${i + 1}. Must be 64 hex chars (0x...).`);
      }
      const account = privateKeyToAccount(keyHex as Hex);
      const encryptedKey = encryptKey(keyHex, ENCRYPTION_SECRET);
      const id = `w_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const label = `${labelPrefix} #${existingCount + imported.length + 1}`;
      const createdAt = new Date().toISOString();
      const record: WalletRecord = { id, address: account.address, encryptedKey, label, createdAt };
      this.save(record, sessionId);
      imported.push(record);
    }
    if (imported.length === 0) throw new Error('No valid private keys provided.');
    return imported;
  }
};
