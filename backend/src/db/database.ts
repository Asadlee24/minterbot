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

interface JsonDbSchema {
  wallets: WalletRecord[];
  dropConfigs: DropConfigRecord[];
  mintLogs: MintLogRecord[];
}

class AppDatabase {
  private dbPath: string;
  private memoryDb: JsonDbSchema;
  private betterSqlite: any = null;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'opensea_mint.json');
    this.memoryDb = { wallets: [], dropConfigs: [], mintLogs: [] };

    // Try loading better-sqlite3 dynamically if available
    try {
      const Database = require('better-sqlite3');
      const sqlitePath = path.join(dataDir, 'opensea_mint.db');
      this.betterSqlite = new Database(sqlitePath);
      this.initSqliteTables();
    } catch (err) {
      console.log('ℹ️ Using zero-dependency JSON file database at data/opensea_mint.json');
      this.loadJsonDb();
    }
  }

  private initSqliteTables() {
    if (!this.betterSqlite) return;
    this.betterSqlite.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        address TEXT UNIQUE NOT NULL,
        encrypted_key TEXT NOT NULL,
        label TEXT,
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

  private loadJsonDb() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        this.memoryDb = JSON.parse(raw);
      } catch (err) {
        this.saveJsonDb();
      }
    } else {
      this.saveJsonDb();
    }
  }

  private saveJsonDb() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.memoryDb, null, 2), 'utf8');
  }

  // Wallet operations
  public saveWallet(id: string, address: string, encryptedKey: string, label: string = ''): WalletRecord {
    const createdAt = new Date().toISOString();
    const record: WalletRecord = { id, address: address.toLowerCase(), encryptedKey, label, createdAt };

    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare(`
        INSERT OR REPLACE INTO wallets (id, address, encrypted_key, label, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(id, address.toLowerCase(), encryptedKey, label, createdAt);
    } else {
      const existingIdx = this.memoryDb.wallets.findIndex((w) => w.id === id || w.address === address.toLowerCase());
      if (existingIdx >= 0) {
        this.memoryDb.wallets[existingIdx] = record;
      } else {
        this.memoryDb.wallets.push(record);
      }
      this.saveJsonDb();
    }

    return record;
  }

  public getWallets(): WalletRecord[] {
    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare('SELECT id, address, encrypted_key as encryptedKey, label, created_at as createdAt FROM wallets');
      return stmt.all() as WalletRecord[];
    }
    return this.memoryDb.wallets;
  }

  public deleteWallet(id: string): boolean {
    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare('DELETE FROM wallets WHERE id = ?');
      return stmt.run(id).changes > 0;
    }
    const initialLen = this.memoryDb.wallets.length;
    this.memoryDb.wallets = this.memoryDb.wallets.filter((w) => w.id !== id);
    this.saveJsonDb();
    return this.memoryDb.wallets.length < initialLen;
  }

  // Mint logs
  public addMintLog(log: Omit<MintLogRecord, 'id' | 'timestamp'>): MintLogRecord {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = new Date().toISOString();
    const record: MintLogRecord = { id, ...log, timestamp };

    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare(`
        INSERT INTO mint_logs (id, wallet_address, collection_slug, mode, status, tx_hash, error, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, log.walletAddress, log.collectionSlug, log.mode, log.status, log.txHash || null, log.error || null, timestamp);
    } else {
      this.memoryDb.mintLogs.unshift(record);
      this.saveJsonDb();
    }

    return record;
  }

  public getMintLogs(limit = 100): MintLogRecord[] {
    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare(`
        SELECT id, wallet_address as walletAddress, collection_slug as collectionSlug, mode, status, tx_hash as txHash, error, timestamp
        FROM mint_logs ORDER BY timestamp DESC LIMIT ?
      `);
      return stmt.all(limit) as MintLogRecord[];
    }
    return this.memoryDb.mintLogs.slice(0, limit);
  }
}

export const db = new AppDatabase();
