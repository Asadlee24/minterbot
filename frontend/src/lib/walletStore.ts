/**
 * Shared in-memory wallet store and crypto utilities for Next.js API routes.
 * This runs server-side on Vercel and is the single source of truth.
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
// In-memory wallet store (persists for the lifetime of the server process).
// On Vercel serverless each cold start begins empty — that's fine for demo.
// For persistence set WALLET_DATA env var or use a real DB (Upstash/Neon).
// ---------------------------------------------------------------------------

export interface WalletRecord {
  id: string;
  address: string;
  encryptedKey: string;
  label: string;
  createdAt: string;
}

// Global store — survives warm lambda invocations
const globalStore = global as unknown as { _wallets: WalletRecord[] };
if (!globalStore._wallets) globalStore._wallets = [];
const wallets = globalStore._wallets;

export const walletStore = {
  getAll(): WalletRecord[] {
    return wallets;
  },

  save(record: WalletRecord): void {
    const existing = wallets.findIndex(
      (w) => w.id === record.id || w.address === record.address
    );
    if (existing >= 0) {
      wallets[existing] = record;
    } else {
      wallets.push(record);
    }
  },

  delete(id: string): boolean {
    const idx = wallets.findIndex((w) => w.id === id);
    if (idx < 0) return false;
    wallets.splice(idx, 1);
    return true;
  },

  generate(count: number, labelPrefix = 'Manifest Wallet') {
    const created: Omit<WalletRecord, 'encryptedKey'>[] = [];
    const validCount = Math.min(Math.max(1, count || 1), 50);
    for (let i = 0; i < validCount; i++) {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const encryptedKey = encryptKey(privateKey, ENCRYPTION_SECRET);
      const id = `w_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const label = `${labelPrefix} #${wallets.length + created.length + 1}`;
      const createdAt = new Date().toISOString();
      const record: WalletRecord = { id, address: account.address, encryptedKey, label, createdAt };
      walletStore.save(record);
      created.push({ id, address: account.address, label, createdAt });
    }
    return created;
  },

  import(privateKeys: string[], labelPrefix = 'Imported Wallet') {
    const imported: Omit<WalletRecord, 'encryptedKey'>[] = [];
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
      const label = `${labelPrefix} #${wallets.length + imported.length + 1}`;
      const createdAt = new Date().toISOString();
      const record: WalletRecord = { id, address: account.address, encryptedKey, label, createdAt };
      walletStore.save(record);
      imported.push({ id, address: account.address, label, createdAt });
    }
    if (imported.length === 0) throw new Error('No valid private keys provided.');
    return imported;
  }
};
