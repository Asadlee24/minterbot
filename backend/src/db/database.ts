import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface WalletRecord {
  id: string;
  address: string;
  encryptedKey: string;
  label: string;
  createdAt: string;
}

export interface DropConfigRecord {
  id: string;
  slug: string;
  contractAddress: string;
  chainId: number;
  stageType: string;
  quantity: number;
  mode: 'single' | 'self-funded' | 'sponsored';
  createdAt: string;
}

export interface MintLogRecord {
  id: string;
  walletAddress: string;
  collectionSlug: string;
  mode: string;
  status: 'PENDING' | 'SUBMITTED' | 'SUCCESS' | 'FAILED';
  txHash?: string;
  error?: string;
  timestamp: string;
}

class AppDatabase {
  private db: Database.Database;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'opensea_mint.db');
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        address TEXT UNIQUE NOT NULL,
        encrypted_key TEXT NOT NULL,
        label TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS drop_configs (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        stage_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mint_logs (
        id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        collection_slug TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        error TEXT,
        timestamp TEXT NOT NULL
      );
    `);
  }

  // Wallet operations
  public saveWallet(id: string, address: string, encryptedKey: string, label: string = ''): WalletRecord {
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wallets (id, address, encrypted_key, label, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, address.toLowerCase(), encryptedKey, label, createdAt);
    return { id, address: address.toLowerCase(), encryptedKey, label, createdAt };
  }

  public getWallets(): WalletRecord[] {
    const stmt = this.db.prepare('SELECT id, address, encrypted_key as encryptedKey, label, created_at as createdAt FROM wallets');
    return stmt.all() as WalletRecord[];
  }

  public deleteWallet(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM wallets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Mint logs
  public addMintLog(log: Omit<MintLogRecord, 'id' | 'timestamp'>): MintLogRecord {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO mint_logs (id, wallet_address, collection_slug, mode, status, tx_hash, error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, log.walletAddress, log.collectionSlug, log.mode, log.status, log.txHash || null, log.error || null, timestamp);
    return { id, ...log, timestamp };
  }

  public getMintLogs(limit = 100): MintLogRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, wallet_address as walletAddress, collection_slug as collectionSlug, mode, status, tx_hash as txHash, error, timestamp
      FROM mint_logs ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(limit) as MintLogRecord[];
  }
}

export const db = new AppDatabase();
