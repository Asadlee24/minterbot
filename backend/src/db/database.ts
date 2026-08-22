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

// ─── Scheduler Types ──────────────────────────────────────────────────────────

export type SchedulerStatus = 'IDLE' | 'ARMED' | 'CHECKING' | 'FIRING' | 'DONE' | 'FAILED';

export interface SchedulerRecord {
  id: string;
  slug: string;
  expectedStartTime: string;      // ISO 8601 — user-supplied "latest" time
  chainId: number;
  quantity: number;
  mode: 'single' | 'self-funded' | 'sponsored';
  walletIds: string[];             // stored as JSON string in SQLite
  status: SchedulerStatus;
  monitoringActive: boolean;
  openSeaAvailable: boolean;
  lastCheckTimestamp?: string;
  nextCheckTimestamp?: string;
  firstAvailabilityTimestamp?: string;
  firingTimestamp?: string;
  completionTimestamp?: string;
  error?: string;
  updatedAt: string;
  createdAt: string;
}

export interface SchedulerLogRecord {
  id: string;
  schedulerId: string;
  message: string;
  timestamp: string;
}

// ─── JSON DB Schema ──────────────────────────────────────────────────────────

interface JsonDbSchema {
  wallets: WalletRecord[];
  dropConfigs: DropConfigRecord[];
  mintLogs: MintLogRecord[];
  scheduler: SchedulerRecord | null;
  schedulerLogs: SchedulerLogRecord[];
}

// ─── AppDatabase ──────────────────────────────────────────────────────────────

class AppDatabase {
  private dbPath: string;
  private memoryDb: JsonDbSchema;
  private betterSqlite: any = null;

  // In-memory atomic lock for JSON fallback mode (single-process safety)
  private firingLock = false;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'opensea_mint.json');
    this.memoryDb = { wallets: [], dropConfigs: [], mintLogs: [], scheduler: null, schedulerLogs: [] };

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
      CREATE TABLE IF NOT EXISTS scheduler (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        expected_start_time TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        mode TEXT NOT NULL DEFAULT 'single',
        wallet_ids TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'IDLE',
        monitoring_active INTEGER NOT NULL DEFAULT 0,
        opensea_available INTEGER NOT NULL DEFAULT 0,
        last_check_timestamp TEXT,
        next_check_timestamp TEXT,
        first_availability_timestamp TEXT,
        firing_timestamp TEXT,
        completion_timestamp TEXT,
        error TEXT,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL
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
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        // Backward-compatible: pre-fill missing scheduler keys
        this.memoryDb = {
          wallets: parsed.wallets || [],
          dropConfigs: parsed.dropConfigs || [],
          mintLogs: parsed.mintLogs || [],
          scheduler: parsed.scheduler || null,
          schedulerLogs: parsed.schedulerLogs || []
        };
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

  // ─── Wallet Operations ────────────────────────────────────────────────────

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

  // ─── Mint Logs ────────────────────────────────────────────────────────────

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

  // ─── Scheduler Operations ─────────────────────────────────────────────────

  public getScheduler(): SchedulerRecord | null {
    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare(`
        SELECT
          id, slug, expected_start_time as expectedStartTime, chain_id as chainId,
          quantity, mode, wallet_ids as walletIds, status,
          monitoring_active as monitoringActive, opensea_available as openSeaAvailable,
          last_check_timestamp as lastCheckTimestamp, next_check_timestamp as nextCheckTimestamp,
          first_availability_timestamp as firstAvailabilityTimestamp,
          firing_timestamp as firingTimestamp, completion_timestamp as completionTimestamp,
          error, updated_at as updatedAt, created_at as createdAt
        FROM scheduler LIMIT 1
      `);
      const row = stmt.get() as any;
      if (!row) return null;
      return {
        ...row,
        walletIds: JSON.parse(row.walletIds || '[]'),
        monitoringActive: Boolean(row.monitoringActive),
        openSeaAvailable: Boolean(row.openSeaAvailable)
      };
    }
    return this.memoryDb.scheduler;
  }

  public saveScheduler(record: SchedulerRecord): void {
    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare(`
        INSERT OR REPLACE INTO scheduler (
          id, slug, expected_start_time, chain_id, quantity, mode, wallet_ids,
          status, monitoring_active, opensea_available,
          last_check_timestamp, next_check_timestamp, first_availability_timestamp,
          firing_timestamp, completion_timestamp, error, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.id, record.slug, record.expectedStartTime, record.chainId,
        record.quantity, record.mode, JSON.stringify(record.walletIds),
        record.status, record.monitoringActive ? 1 : 0, record.openSeaAvailable ? 1 : 0,
        record.lastCheckTimestamp || null, record.nextCheckTimestamp || null,
        record.firstAvailabilityTimestamp || null, record.firingTimestamp || null,
        record.completionTimestamp || null, record.error || null,
        record.updatedAt, record.createdAt
      );
    } else {
      this.memoryDb.scheduler = record;
      this.saveJsonDb();
    }
  }

  /**
   * Patch specific fields on the scheduler record.
   * Does NOT use atomic locking — use updateSchedulerStatus for state transitions.
   */
  public patchScheduler(id: string, fields: Partial<SchedulerRecord>): void {
    const now = new Date().toISOString();
    if (this.betterSqlite) {
      const setClauses: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (fields.status !== undefined)                    { setClauses.push('status = ?');                          values.push(fields.status); }
      if (fields.monitoringActive !== undefined)          { setClauses.push('monitoring_active = ?');               values.push(fields.monitoringActive ? 1 : 0); }
      if (fields.openSeaAvailable !== undefined)          { setClauses.push('opensea_available = ?');               values.push(fields.openSeaAvailable ? 1 : 0); }
      if (fields.lastCheckTimestamp !== undefined)        { setClauses.push('last_check_timestamp = ?');            values.push(fields.lastCheckTimestamp); }
      if (fields.nextCheckTimestamp !== undefined)        { setClauses.push('next_check_timestamp = ?');            values.push(fields.nextCheckTimestamp); }
      if (fields.firstAvailabilityTimestamp !== undefined){ setClauses.push('first_availability_timestamp = ?');    values.push(fields.firstAvailabilityTimestamp); }
      if (fields.firingTimestamp !== undefined)           { setClauses.push('firing_timestamp = ?');                values.push(fields.firingTimestamp); }
      if (fields.completionTimestamp !== undefined)       { setClauses.push('completion_timestamp = ?');            values.push(fields.completionTimestamp); }
      if (fields.error !== undefined)                     { setClauses.push('error = ?');                           values.push(fields.error); }

      values.push(id);
      this.betterSqlite.prepare(`UPDATE scheduler SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    } else {
      if (this.memoryDb.scheduler && this.memoryDb.scheduler.id === id) {
        Object.assign(this.memoryDb.scheduler, fields, { updatedAt: now });
        this.saveJsonDb();
      }
    }
  }

  /**
   * Atomic state transition: only succeeds if current status matches expectedCurrentStatus.
   * Returns true if this caller successfully performed the transition.
   *
   * SQLite: uses changes count (1 = success, 0 = another worker already transitioned).
   * JSON fallback: uses synchronous in-memory flag (safe for single-process Node.js).
   */
  public updateSchedulerStatus(
    id: string,
    expectedCurrentStatus: SchedulerStatus,
    newStatus: SchedulerStatus,
    extraFields: Partial<SchedulerRecord> = {}
  ): boolean {
    const now = new Date().toISOString();

    if (this.betterSqlite) {
      const setClauses = ['status = ?', 'updated_at = ?'];
      const values: any[] = [newStatus, now];

      if (extraFields.monitoringActive !== undefined)           { setClauses.push('monitoring_active = ?');               values.push(extraFields.monitoringActive ? 1 : 0); }
      if (extraFields.openSeaAvailable !== undefined)           { setClauses.push('opensea_available = ?');               values.push(extraFields.openSeaAvailable ? 1 : 0); }
      if (extraFields.firstAvailabilityTimestamp !== undefined) { setClauses.push('first_availability_timestamp = ?');    values.push(extraFields.firstAvailabilityTimestamp); }
      if (extraFields.firingTimestamp !== undefined)            { setClauses.push('firing_timestamp = ?');                values.push(extraFields.firingTimestamp); }
      if (extraFields.completionTimestamp !== undefined)        { setClauses.push('completion_timestamp = ?');            values.push(extraFields.completionTimestamp); }
      if (extraFields.error !== undefined)                      { setClauses.push('error = ?');                           values.push(extraFields.error); }

      values.push(id, expectedCurrentStatus);
      const stmt = this.betterSqlite.prepare(
        `UPDATE scheduler SET ${setClauses.join(', ')} WHERE id = ? AND status = ?`
      );
      const result = stmt.run(...values);
      return result.changes === 1;
    } else {
      // JSON fallback: synchronous check-and-set (single process, safe)
      // Special case: CHECKING → FIRING uses the firingLock flag
      if (expectedCurrentStatus === 'CHECKING' && newStatus === 'FIRING') {
        if (this.firingLock) return false; // another async call already claimed it
        this.firingLock = true;
      }
      if (this.memoryDb.scheduler && this.memoryDb.scheduler.id === id && this.memoryDb.scheduler.status === expectedCurrentStatus) {
        Object.assign(this.memoryDb.scheduler, { status: newStatus, updatedAt: now, ...extraFields });
        this.saveJsonDb();
        return true;
      }
      return false;
    }
  }

  public clearScheduler(): void {
    if (this.betterSqlite) {
      this.betterSqlite.prepare('DELETE FROM scheduler').run();
      this.betterSqlite.prepare('DELETE FROM scheduler_logs').run();
    } else {
      this.memoryDb.scheduler = null;
      this.memoryDb.schedulerLogs = [];
      this.firingLock = false;
      this.saveJsonDb();
    }
  }

  /**
   * Reset the firing lock (call after DONE/FAILED to allow re-arm)
   */
  public resetFiringLock(): void {
    this.firingLock = false;
  }

  // ─── Scheduler Logs ───────────────────────────────────────────────────────

  public addSchedulerLog(schedulerId: string, message: string): SchedulerLogRecord {
    const id = `slog_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = new Date().toISOString();
    const record: SchedulerLogRecord = { id, schedulerId, message, timestamp };

    if (this.betterSqlite) {
      this.betterSqlite.prepare(`
        INSERT INTO scheduler_logs (id, scheduler_id, message, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(id, schedulerId, message, timestamp);
    } else {
      this.memoryDb.schedulerLogs.unshift(record);
      // Keep last 200 log entries in JSON mode
      if (this.memoryDb.schedulerLogs.length > 200) {
        this.memoryDb.schedulerLogs = this.memoryDb.schedulerLogs.slice(0, 200);
      }
      this.saveJsonDb();
    }

    return record;
  }

  public getSchedulerLogs(limit = 100): SchedulerLogRecord[] {
    if (this.betterSqlite) {
      const stmt = this.betterSqlite.prepare(`
        SELECT id, scheduler_id as schedulerId, message, timestamp
        FROM scheduler_logs ORDER BY timestamp DESC LIMIT ?
      `);
      return stmt.all(limit) as SchedulerLogRecord[];
    }
    return this.memoryDb.schedulerLogs.slice(0, limit);
  }
}

export const db = new AppDatabase();
