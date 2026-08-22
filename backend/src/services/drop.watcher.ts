import axios from 'axios';
import { db, SchedulerRecord, SchedulerStatus } from '../db/database.js';
import { openSeaService } from './opensea.service.js';
import { mintEngine } from './mint.engine.js';
import type { MintTaskRequest } from './mint.engine.js';

// ─── Polling Interval Constants (ms) ─────────────────────────────────────────
// Centralized here for easy tuning without hunting down scattered timers.

const POLL_INTERVALS = {
  FAR:        30_000,  // > 5 minutes from expected time
  MEDIUM:     10_000,  // 2–5 minutes
  NEAR:        5_000,  // 1–2 minutes
  CLOSE:       2_000,  // 30s–1 minute
  IMMINENT:      500,  // < 30 seconds
  AGGRESSIVE:    500,  // Early availability suspected
} as const;

function calculatePollDelay(msUntilExpected: number): number {
  if (msUntilExpected > 5 * 60_000)  return POLL_INTERVALS.FAR;
  if (msUntilExpected > 2 * 60_000)  return POLL_INTERVALS.MEDIUM;
  if (msUntilExpected > 1 * 60_000)  return POLL_INTERVALS.NEAR;
  if (msUntilExpected > 30_000)       return POLL_INTERVALS.CLOSE;
  return POLL_INTERVALS.IMMINENT;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Arm Config ───────────────────────────────────────────────────────────────

export interface SchedulerArmConfig {
  slug: string;
  expectedStartTime: string;   // ISO 8601
  chainId: number;
  quantity: number;
  mode: 'single' | 'self-funded' | 'sponsored';
  walletIds: string[];
}

// ─── Scheduler Engine ─────────────────────────────────────────────────────────

export class SchedulerEngine {
  private running = false;
  private currentSchedulerId: string | null = null;
  private ioRef: any = null; // Socket.IO server ref, set on startup

  /**
   * Called once after server starts listening.
   * Loads persisted scheduler and resumes if ARMED or CHECKING.
   * Handles FIRING safely: marks FAILED to avoid blind duplicate mint.
   */
  public async recoverOnStartup(io: any): Promise<void> {
    this.ioRef = io;
    const scheduler = db.getScheduler();
    if (!scheduler) return;

    console.log(`🔄 Scheduler recovery: found scheduler ${scheduler.id} in status ${scheduler.status}`);

    switch (scheduler.status) {
      case 'ARMED':
      case 'CHECKING': {
        this.log(scheduler.id, `Backend restarted — resuming monitoring from ${scheduler.status}`);
        // Reset to ARMED so the polling loop can perform the ARMED→CHECKING transition cleanly
        db.patchScheduler(scheduler.id, {
          status: 'ARMED',
          monitoringActive: false,
          error: undefined
        });
        await this.startPollingLoop(scheduler.id, io);
        break;
      }
      case 'FIRING': {
        // We cannot know if the mint was actually submitted before the crash.
        // The safe behavior is to mark FAILED and let the user inspect logs/re-arm.
        const msg = 'Recovery: was FIRING at backend restart — could not confirm mint execution. Check transaction logs. Re-arm to retry.';
        db.patchScheduler(scheduler.id, {
          status: 'FAILED',
          monitoringActive: false,
          error: msg,
          completionTimestamp: new Date().toISOString()
        });
        db.resetFiringLock();
        this.log(scheduler.id, `⚠️ ${msg}`);
        this.emitUpdate(io, scheduler.id);
        break;
      }
      case 'DONE':
      case 'FAILED':
      case 'IDLE':
      default:
        // Nothing to resume
        break;
    }
  }

  /**
   * Arms the scheduler: persists config to DB and starts polling loop.
   */
  public async arm(config: SchedulerArmConfig, io: any): Promise<SchedulerRecord> {
    this.ioRef = io;

    // Disarm any previously active scheduler first
    await this.disarm(io, /* silent */ true);
    db.resetFiringLock();

    const id = `sched_${Date.now()}`;
    const now = new Date().toISOString();
    const record: SchedulerRecord = {
      id,
      slug: config.slug,
      expectedStartTime: config.expectedStartTime,
      chainId: config.chainId,
      quantity: config.quantity,
      mode: config.mode,
      walletIds: config.walletIds,
      status: 'ARMED',
      monitoringActive: false,
      openSeaAvailable: false,
      updatedAt: now,
      createdAt: now
    };

    db.clearScheduler();
    db.saveScheduler(record);

    this.log(id, `Scheduler armed`);
    this.log(id, `Collection: ${config.slug}   Chain: ${config.chainId}   Wallets: ${config.walletIds.length}   Mode: ${config.mode}   Qty: ${config.quantity}`);
    this.log(id, `Expected start time: ${new Date(config.expectedStartTime).toLocaleString()}`);

    this.emitUpdate(io, id);
    await this.startPollingLoop(id, io);

    return db.getScheduler()!;
  }

  /**
   * Disarms the scheduler, transitioning ARMED/CHECKING → IDLE.
   * Only cancels ARMED/CHECKING — FIRING/DONE/FAILED are left alone.
   */
  public async disarm(io: any, silent = false): Promise<void> {
    this.running = false;

    const scheduler = db.getScheduler();
    if (!scheduler) return;
    if (!['ARMED', 'CHECKING'].includes(scheduler.status)) return;

    db.patchScheduler(scheduler.id, {
      status: 'IDLE',
      monitoringActive: false,
      updatedAt: new Date().toISOString()
    });

    if (!silent) {
      this.log(scheduler.id, 'Scheduler disarmed by user request.');
      this.emitUpdate(io, scheduler.id);
    }
  }

  // ─── Private: Polling Loop ─────────────────────────────────────────────────

  private async startPollingLoop(schedulerId: string, io: any): Promise<void> {
    // Prevent duplicate loops
    if (this.running && this.currentSchedulerId === schedulerId) return;
    this.running = true;
    this.currentSchedulerId = schedulerId;

    // Transition ARMED → CHECKING atomically
    const claimed = db.updateSchedulerStatus(schedulerId, 'ARMED', 'CHECKING', {
      monitoringActive: true
    });
    if (!claimed) {
      // Another process already claimed it — exit
      console.warn(`[SchedulerEngine] Could not claim ARMED→CHECKING for ${schedulerId}; another worker may own it.`);
      return;
    }

    this.log(schedulerId, 'Monitoring started — polling OpenSea for public mint availability');
    this.emitUpdate(io, schedulerId);

    // Run polling loop asynchronously (does not block server startup)
    this.runPollingLoop(schedulerId, io).catch((err) => {
      console.error(`[SchedulerEngine] Polling loop crashed for ${schedulerId}:`, err.message);
      this.tryMarkFailed(schedulerId, `Polling loop error: ${err.message}`, io);
    });
  }

  private async runPollingLoop(schedulerId: string, io: any): Promise<void> {
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10;

    while (this.running) {
      // Re-read scheduler from DB each iteration (handles external disarm/reset)
      const scheduler = db.getScheduler();
      if (!scheduler || scheduler.id !== schedulerId) {
        console.log(`[SchedulerEngine] Scheduler ${schedulerId} no longer exists — stopping loop.`);
        this.running = false;
        break;
      }

      if (scheduler.status !== 'CHECKING') {
        // Externally disarmed, done, or failed
        console.log(`[SchedulerEngine] Scheduler ${schedulerId} status is ${scheduler.status} — stopping loop.`);
        this.running = false;
        break;
      }

      const now = Date.now();
      const expectedMs = new Date(scheduler.expectedStartTime).getTime();
      const msUntilExpected = expectedMs - now;

      // Update last check timestamp
      db.patchScheduler(schedulerId, {
        lastCheckTimestamp: new Date().toISOString()
      });

      // ── Check OpenSea availability ──────────────────────────────────────
      try {
        const result = await openSeaService.checkMintAvailability(scheduler.slug, scheduler.chainId);

        consecutiveErrors = 0; // Reset error counter on success

        const checkTimestamp = new Date().toISOString();
        db.patchScheduler(schedulerId, {
          lastCheckTimestamp: checkTimestamp,
          openSeaAvailable: result.available
        });

        this.log(schedulerId,
          result.available
            ? `✅ OpenSea public mint AVAILABLE — ${result.stageType || 'PUBLIC'} stage: ${result.reason}`
            : `⏳ OpenSea not yet available — ${result.reason}`
        );

        if (result.available) {
          // Record first availability timestamp if not already set
          const current = db.getScheduler();
          if (current && !current.firstAvailabilityTimestamp) {
            db.patchScheduler(schedulerId, {
              firstAvailabilityTimestamp: checkTimestamp
            });
          }

          // ── Atomic CHECKING → FIRING claim ──────────────────────────────
          const firingClaimed = db.updateSchedulerStatus(schedulerId, 'CHECKING', 'FIRING', {
            firingTimestamp: checkTimestamp,
            openSeaAvailable: true,
            firstAvailabilityTimestamp: checkTimestamp
          });

          if (!firingClaimed) {
            this.log(schedulerId, '⚠️ FIRING already claimed by another process — exiting loop.');
            this.running = false;
            break;
          }

          this.log(schedulerId, '🔥 Transitioning CHECKING → FIRING — invoking mint engine...');
          this.emitUpdate(io, schedulerId);

          await this.invokeMintEngine(scheduler, io);
          this.running = false;
          break;
        }

        // ── Not yet available: should we wait or check again at expected time? ──
        if (msUntilExpected <= 0) {
          // We've passed the expected time — keep polling aggressively for up to 5 minutes
          const overrunMs = now - expectedMs;
          if (overrunMs > 5 * 60_000) {
            this.log(schedulerId, '⏰ Expected time passed 5+ minutes ago and no mint detected — marking FAILED.');
            db.updateSchedulerStatus(schedulerId, 'CHECKING', 'FAILED', {
              error: 'Public mint not detected within 5 minutes after expected start time.',
              completionTimestamp: new Date().toISOString(),
              monitoringActive: false
            });
            this.emitUpdate(io, schedulerId);
            this.running = false;
            break;
          }
          // Still within 5-minute overrun window — aggressive polling
          const delay = POLL_INTERVALS.AGGRESSIVE;
          db.patchScheduler(schedulerId, { nextCheckTimestamp: new Date(Date.now() + delay).toISOString() });
          this.emitUpdate(io, schedulerId);
          await sleep(delay);
        } else {
          const delay = calculatePollDelay(msUntilExpected);
          db.patchScheduler(schedulerId, { nextCheckTimestamp: new Date(Date.now() + delay).toISOString() });
          this.emitUpdate(io, schedulerId);
          await sleep(delay);
        }

      } catch (outerErr: any) {
        consecutiveErrors++;
        this.log(schedulerId, `⚠️ Polling error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${outerErr.message}`);

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          this.log(schedulerId, '❌ Too many consecutive polling errors — marking FAILED.');
          db.updateSchedulerStatus(schedulerId, 'CHECKING', 'FAILED', {
            error: `Polling failed after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: ${outerErr.message}`,
            completionTimestamp: new Date().toISOString(),
            monitoringActive: false
          });
          this.emitUpdate(io, schedulerId);
          this.running = false;
          break;
        }

        // Backoff before retry
        const backoff = Math.min(consecutiveErrors * 5_000, 60_000);
        this.log(schedulerId, `Retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
      }
    }
  }

  // ─── Private: Mint Engine Invocation ──────────────────────────────────────

  private async invokeMintEngine(scheduler: SchedulerRecord, io: any): Promise<void> {
    try {
      const mintRequest: MintTaskRequest = {
        slug: scheduler.slug,
        walletIds: scheduler.walletIds,
        mode: scheduler.mode,
        chainId: scheduler.chainId,
        quantity: scheduler.quantity
      };

      this.log(scheduler.id, `Mint engine started — ${scheduler.walletIds.length} wallet(s) — mode: ${scheduler.mode} — collection: ${scheduler.slug}`);

      const result = await mintEngine.executeMintSession(mintRequest, (progress) => {
        // Re-emit mint progress over Socket.IO (same channel as manual mint)
        if (io) io.emit('mint_progress', progress);

        // Also append mint progress to scheduler logs
        const lastLog = progress.logs[progress.logs.length - 1];
        if (lastLog) this.log(scheduler.id, `[MintEngine] ${lastLog}`);
      });

      const txSummary = result.txHashes.length > 0
        ? `Tx: ${result.txHashes.join(', ')}`
        : 'No tx hashes returned';

      this.log(scheduler.id, `✅ Mint engine completed — ${result.completedCount}/${result.totalCount} wallets — ${txSummary}`);

      db.updateSchedulerStatus(scheduler.id, 'FIRING', 'DONE', {
        completionTimestamp: new Date().toISOString(),
        monitoringActive: false
      });
      db.resetFiringLock();

      this.log(scheduler.id, 'Scheduler DONE');
      this.emitUpdate(io, scheduler.id);

    } catch (err: any) {
      this.log(scheduler.id, `❌ Mint engine error: ${err.message}`);
      db.updateSchedulerStatus(scheduler.id, 'FIRING', 'FAILED', {
        error: err.message,
        completionTimestamp: new Date().toISOString(),
        monitoringActive: false
      });
      db.resetFiringLock();
      this.emitUpdate(io, scheduler.id);
    }
  }

  // ─── Private: Helpers ─────────────────────────────────────────────────────

  private log(schedulerId: string, message: string): void {
    console.log(`[Scheduler:${schedulerId}] ${message}`);
    try {
      db.addSchedulerLog(schedulerId, message);
    } catch (_) {
      // Never let logging crash the scheduler
    }
  }

  private emitUpdate(io: any, schedulerId: string): void {
    try {
      const scheduler = db.getScheduler();
      const logs = db.getSchedulerLogs(50);
      if (io) io.emit('scheduler_update', { scheduler, logs });
    } catch (_) {
      // Never let socket emission crash the scheduler
    }
  }

  private tryMarkFailed(schedulerId: string, reason: string, io: any): void {
    try {
      this.log(schedulerId, `❌ ${reason}`);
      const current = db.getScheduler();
      if (current && current.id === schedulerId && ['ARMED', 'CHECKING'].includes(current.status)) {
        db.patchScheduler(schedulerId, {
          status: 'FAILED',
          error: reason,
          monitoringActive: false,
          completionTimestamp: new Date().toISOString()
        });
        this.emitUpdate(io, schedulerId);
      }
    } catch (_) { /* silent */ }
  }

  // ─── Alert Notifications (preserved from original DropWatcher) ────────────

  /**
   * Dispatches alert notification via Telegram and/or Discord Webhook
   */
  public async sendAlert(title: string, message: string, collectionUrl?: string) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    // Telegram Alert
    if (telegramToken && telegramChatId) {
      try {
        const text = `🚨 *${title}*\n\n${message}${collectionUrl ? `\n\n[OpenSea Collection](${collectionUrl})` : ''}`;
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          chat_id: telegramChatId,
          text,
          parse_mode: 'Markdown'
        });
      } catch (err: any) {
        console.warn(`Telegram alert failed: ${err.message}`);
      }
    }

    // Discord Alert
    if (discordWebhookUrl) {
      try {
        await axios.post(discordWebhookUrl, {
          embeds: [
            {
              title,
              description: message,
              color: 0xc8922a, // Gold accent #C8922A
              url: collectionUrl,
              timestamp: new Date().toISOString()
            }
          ]
        });
      } catch (err: any) {
        console.warn(`Discord webhook alert failed: ${err.message}`);
      }
    }
  }
}

export const schedulerEngine = new SchedulerEngine();
