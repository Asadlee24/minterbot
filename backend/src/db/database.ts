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

export type SchedulerStatus = 'IDLE' | 'ARMED' | 'CHECKING' | 'FIRING' | 'DONE' | 'FAILED';

export interface SchedulerRecord {
  id: string;
  slug: string;
  expectedStartTime: string;
  chainId: number;
  quantity: number;
  mode: 'single' | 'self-funded' | 'sponsored';
  walletIds: string[];
  sponsorWalletId?: string;
  executorAddress?: string;
  recipientAddress?: string;
  status: SchedulerStatus;
  monitoringState: 'IDLE' | 'MONITORING' | 'DETECTED' | 'FIRING' | 'COMPLETED' | 'FAILED';
  availabilityState: 'UNKNOWN' | 'UNAVAILABLE' | 'AVAILABLE' | 'ERROR';
  lastCheckAt?: string;
  nextCheckAt?: string;
  firstAvailabilityAt?: string;
  firingAt?: string;
  completionAt?: string;
  error?: string;
  executionTaskId?: string;
  executionStartedAt?: string;
  logs: string[];
  updatedAt: string;
}

export interface SchedulerLogRecord {
  id: string;
  schedulerId: string;
  message: string;
  timestamp: string;
}

interface JsonDbSchema {
  wallets: WalletRecord[];
  dropConfigs: DropConfigRecord[];
  mintLogs: MintLogRecord[];
  scheduler: SchedulerRecord | null;
  schedulerLogs: SchedulerLogRecord[];
}

const emptyJsonDb = (): JsonDbSchema => ({
  wallets: [],
  dropConfigs: [],
  mintLogs: [],
  scheduler: null,
  schedulerLogs: []
});

class AppDatabase {
  private dbPath: string;
  private memoryDb: JsonDbSchema;
  private betterSqlite: any = null;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    this.dbPath = path.join(dataDir, 'opensea_mint.json');
    this.memoryDb = emptyJsonDb();

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
      CREATE TABLE IF NOT EXISTS scheduler (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        expected_start_time TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        mode TEXT NOT NULL,
        wallet_ids TEXT NOT NULL,
        sponsor_wallet_id TEXT,
        executor_address TEXT,
        recipient_address TEXT,
        status TEXT NOT NULL,
        monitoring_state TEXT NOT NULL,
        availability_state TEXT NOT NULL,
        last_check_at TEXT,
        next_check_at TEXT,
        first_availability_at TEXT,
        firing_at TEXT,
        completion_at TEXT,
        error TEXT,
        execution_task_id TEXT,
        execution_started_at TEXT,
        logs TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scheduler_logs (
        id TEXT PRIMARY KEY,
        scheduler_id TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);
  }

  private loadJsonDb() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        this.memoryDb = {
          ...emptyJsonDb(),
          ...raw,
          wallets: Array.isArray(raw.wallets) ? raw.wallets : [],
          dropConfigs: Array.isArray(raw.dropConfigs) ? raw.dropConfigs : [],
          mintLogs: Array.isArray(raw.mintLogs) ? raw.mintLogs : [],
          schedulerLogs: Array.isArray(raw.schedulerLogs) ? raw.schedulerLogs : [],
          scheduler: raw.scheduler || null
        };
        this.saveJsonDb();
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
      if (existingIdx >= 0) this.memoryDb.wallets[existingIdx] = record;
      else this.memoryDb.wallets.push(record);
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

  // Persistent scheduler operations
  public getScheduler(): SchedulerRecord | null {
    if (this.betterSqlite) {
      const row = this.betterSqlite.prepare('SELECT * FROM scheduler ORDER BY updated_at DESC LIMIT 1').get();
      if (!row) return null;
      return this.fromSqlScheduler(row);
    }
    return this.memoryDb.scheduler ? { ...this.memoryDb.scheduler, walletIds: [...this.memoryDb.scheduler.walletIds], logs: [...this.memoryDb.scheduler.logs] } : null;
  }

  public saveScheduler(record: SchedulerRecord): SchedulerRecord {
    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare(`
        INSERT OR REPLACE INTO scheduler (
          id, slug, expected_start_time, chain_id, quantity, mode, wallet_ids,
          sponsor_wallet_id, executor_address, recipient_address, status,
          monitoring_state, availability_state, last_check_at, next_check_at,
          first_availability_at, firing_at, completion_at, error,
          execution_task_id, execution_started_at, logs, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.id, record.slug, record.expectedStartTime, record.chainId, record.quantity, record.mode,
        JSON.stringify(record.walletIds), record.sponsorWalletId || null, record.executorAddress || null,
        record.recipientAddress || null, record.status, record.monitoringState, record.availabilityState,
        record.lastCheckAt || null, record.nextCheckAt || null, record.firstAvailabilityAt || null,
        record.firingAt || null, record.completionAt || null, record.error || null,
        record.executionTaskId || null, record.executionStartedAt || null, JSON.stringify(record.logs), record.updatedAt
      );
    } else {
      this.memoryDb.scheduler = { ...record, walletIds: [...record.walletIds], logs: [...record.logs] };
      this.saveJsonDb();
    }
    return record;
  }

  public updateScheduler(patch: Partial<SchedulerRecord>): SchedulerRecord | null {
    const current = this.getScheduler();
    if (!current) return null;
    const next: SchedulerRecord = { ...current, ...patch, updatedAt: new Date().toISOString() };
    return this.saveScheduler(next);
  }

  /** Atomically changes status. Returns the updated scheduler only for the winner. */
  public claimSchedulerStatus(id: string, from: SchedulerStatus, to: SchedulerStatus): SchedulerRecord | null {
    const updatedAt = new Date().toISOString();
    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare(`UPDATE scheduler SET status = ?, updated_at = ? WHERE id = ? AND status = ?`);
      const result = stmt.run(to, updatedAt, id, from);
      if (result.changes !== 1) return null;
      return this.getScheduler();
    }

    // JSON fallback is synchronous and therefore serialized by the single Node process.
    const current = this.memoryDb.scheduler;
    if (!current || current.id !== id || current.status !== from) return null;
    this.memoryDb.scheduler = { ...current, status: to, updatedAt };
    this.saveJsonDb();
    return { ...this.memoryDb.scheduler, walletIds: [...this.memoryDb.scheduler.walletIds], logs: [...this.memoryDb.scheduler.logs] };
  }

  public addSchedulerLog(schedulerId: string, message: string): SchedulerLogRecord {
    const record: SchedulerLogRecord = {
      id: `scheduler_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      schedulerId,
      message,
      timestamp: new Date().toISOString()
    };

    if (this.betterSqlite) {
      this.betterSqlite.prepare('INSERT INTO scheduler_logs (id, scheduler_id, message, timestamp) VALUES (?, ?, ?, ?)').run(record.id, schedulerId, message, record.timestamp);
      const scheduler = this.getScheduler();
      if (scheduler) this.updateScheduler({ logs: [message, ...scheduler.logs].slice(0, 100) });
    } else {
      this.memoryDb.schedulerLogs.unshift(record);
      if (this.memoryDb.scheduler?.id === schedulerId) {
        this.memoryDb.scheduler.logs = [message, ...this.memoryDb.scheduler.logs].slice(0, 100);
        this.memoryDb.scheduler.updatedAt = new Date().toISOString();
      }
      this.saveJsonDb();
    }
    return record;
  }

  public getSchedulerLogs(schedulerId?: string, limit = 100): SchedulerLogRecord[] {
    if (this.betterSqlite) {
      if (schedulerId) {
        return this.betterSqlite.prepare('SELECT id, scheduler_id as schedulerId, message, timestamp FROM scheduler_logs WHERE scheduler_id = ? ORDER BY timestamp DESC LIMIT ?').all(schedulerId, limit) as SchedulerLogRecord[];
      }
      return this.betterSqlite.prepare('SELECT id, scheduler_id as schedulerId, message, timestamp FROM scheduler_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as SchedulerLogRecord[];
    }
    const logs = schedulerId ? this.memoryDb.schedulerLogs.filter((l) => l.schedulerId === schedulerId) : this.memoryDb.schedulerLogs;
    return logs.slice(0, limit);
  }

  private fromSqlScheduler(row: any): SchedulerRecord {
    return {
      id: row.id,
      slug: row.slug,
      expectedStartTime: row.expected_start_time,
      chainId: Number(row.chain_id),
      quantity: Number(row.quantity),
      mode: row.mode,
      walletIds: JSON.parse(row.wallet_ids || '[]'),
      sponsorWalletId: row.sponsor_wallet_id || undefined,
      executorAddress: row.executor_address || undefined,
      recipientAddress: row.recipient_address || undefined,
      status: row.status,
      monitoringState: row.monitoring_state,
      availabilityState: row.availability_state,
      lastCheckAt: row.last_check_at || undefined,
      nextCheckAt: row.next_check_at || undefined,
      firstAvailabilityAt: row.first_availability_at || undefined,
      firingAt: row.firing_at || undefined,
      completionAt: row.completion_at || undefined,
      error: row.error || undefined,
      executionTaskId: row.execution_task_id || undefined,
      executionStartedAt: row.execution_started_at || undefined,
      logs: JSON.parse(row.logs || '[]'),
      updatedAt: row.updated_at
    };
  }
}

export const db = new AppDatabase();
