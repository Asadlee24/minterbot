import axios from 'axios';
import { db, SchedulerRecord } from '../db/database.js';
import { openSeaService } from './opensea.service.js';
import { mintEngine } from './mint.engine.js';
import type { MintTaskRequest, MintTaskProgress } from './mint.engine.js';

export interface DropFilter {
  minSupply?: number;
  maxMintPriceEth?: number;
  chainIds?: number[];
}

export interface SchedulerArmRequest {
  slug: string;
  expectedStartTime: string;
  chainId: number;
  quantity: number;
  mode: MintTaskRequest['mode'];
  walletIds: string[];
  sponsorWalletId?: string;
  executorAddress?: string;
  recipientAddress?: string;
}

export type SchedulerEventEmitter = (event: string, payload: any) => void;

const POLL_FAR_MS = 30_000;
const POLL_MID_MS = 10_000;
const POLL_APPROACHING_MS = 3_000;
const POLL_CLOSE_MS = 750;
const FAR_THRESHOLD_MS = 10 * 60_000;
const MID_THRESHOLD_MS = 2 * 60_000;
const CLOSE_THRESHOLD_MS = 30_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class DropWatcher {
  private schedulerLoopIds = new Set<string>();
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private emitEvent: SchedulerEventEmitter = () => undefined;

  public setEventEmitter(emitter: SchedulerEventEmitter) {
    this.emitEvent = emitter;
  }

  /** Legacy generic watcher retained for compatibility; scheduler uses runSchedulerLoop instead. */
  public startWatching(intervalSeconds = 30, filter: DropFilter = {}) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(async () => {
      try {
        await this.pollDrops(filter);
      } catch (err: any) {
        console.error(`Drop watcher poll error: ${err.message}`);
      }
    }, intervalSeconds * 1000);
  }

  public stopWatching() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  private async pollDrops(_filter: DropFilter) {
    // Existing generic drop-alert hook intentionally left untouched.
  }

  public getScheduler(): SchedulerRecord | null {
    return db.getScheduler();
  }

  public async armScheduler(request: SchedulerArmRequest): Promise<SchedulerRecord> {
    const expected = new Date(request.expectedStartTime);
    if (!request.slug?.trim()) throw new Error('Collection slug is required');
    if (!Number.isFinite(expected.getTime())) throw new Error('expectedStartTime must be a valid ISO date');
    if (expected.getTime() <= Date.now()) throw new Error('Expected start time must be in the future');
    if (!Number.isInteger(request.chainId)) throw new Error('chainId must be an integer');
    if (!Number.isInteger(request.quantity) || request.quantity < 1) throw new Error('quantity must be at least 1');
    if (!Array.isArray(request.walletIds) || request.walletIds.length === 0) throw new Error('At least one wallet is required');
    if (request.mode === 'sponsored' && (!request.sponsorWalletId || !request.executorAddress)) {
      throw new Error('Sponsored scheduler mode requires sponsorWalletId and executorAddress');
    }

    const existing = db.getScheduler();
    if (existing && ['ARMED', 'CHECKING', 'FIRING'].includes(existing.status)) {
      throw new Error(`Scheduler ${existing.id} is already ${existing.status}`);
    }

    const scheduler: SchedulerRecord = {
      id: `scheduler_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      slug: request.slug.trim(),
      expectedStartTime: expected.toISOString(),
      chainId: request.chainId,
      quantity: request.quantity,
      mode: request.mode,
      walletIds: [...request.walletIds],
      sponsorWalletId: request.sponsorWalletId,
      executorAddress: request.executorAddress,
      recipientAddress: request.recipientAddress,
      status: 'ARMED',
      monitoringState: 'MONITORING',
      availabilityState: 'UNKNOWN',
      logs: [],
      updatedAt: new Date().toISOString()
    };

    db.saveScheduler(scheduler);
    this.log(scheduler.id, `Scheduler armed — expected/latest public mint start: ${scheduler.expectedStartTime}`);
    this.log(scheduler.id, `Collection: ${scheduler.slug} | Chain: ${scheduler.chainId} | Quantity: ${scheduler.quantity} | Mode: ${scheduler.mode} | Wallets: ${scheduler.walletIds.length}`);
    this.log(scheduler.id, 'Monitoring started. Expected time is only a reference; OpenSea availability can fire earlier.');
    this.emitSchedulerUpdate();
    void this.runSchedulerLoop(scheduler.id);
    return db.getScheduler() as SchedulerRecord;
  }

  public async disarmScheduler(): Promise<SchedulerRecord | null> {
    const current = db.getScheduler();
    if (!current) return null;
    if (current.status === 'FIRING') throw new Error('Scheduler is already firing and cannot be disarmed safely');
    if (current.status === 'DONE' || current.status === 'FAILED' || current.status === 'IDLE') return current;

    const from = current.status === 'ARMED' ? 'ARMED' : 'CHECKING';
    const claimed = db.claimSchedulerStatus(current.id, from, 'IDLE');
    if (!claimed) throw new Error('Scheduler changed state before it could be disarmed');
    db.updateScheduler({ monitoringState: 'IDLE', nextCheckAt: undefined });
    this.log(current.id, 'Scheduler disarmed.');
    this.emitSchedulerUpdate();
    return db.getScheduler();
  }

  public recoverScheduler() {
    const scheduler = db.getScheduler();
    if (!scheduler) return;

    if (scheduler.status === 'ARMED' || scheduler.status === 'CHECKING') {
      this.log(scheduler.id, `Backend startup recovery: resuming ${scheduler.status} scheduler monitoring.`);
      this.emitSchedulerUpdate();
      void this.runSchedulerLoop(scheduler.id);
      return;
    }

    if (scheduler.status === 'FIRING') {
      db.updateScheduler({
        status: 'FAILED',
        monitoringState: 'FAILED',
        error: 'Backend restarted while scheduler was FIRING; mint was not replayed to prevent duplicate execution.',
        completionAt: new Date().toISOString()
      });
      this.log(scheduler.id, 'Startup recovery found FIRING state. Marked FAILED without replaying mint engine.');
      this.emitSchedulerUpdate();
    }
  }

  private async runSchedulerLoop(schedulerId: string) {
    if (this.schedulerLoopIds.has(schedulerId)) return;
    this.schedulerLoopIds.add(schedulerId);

    try {
      const current = db.getScheduler();
      if (!current || current.id !== schedulerId) return;

      if (current.status === 'ARMED') {
        const claimed = db.claimSchedulerStatus(schedulerId, 'ARMED', 'CHECKING');
        if (!claimed) return;
        db.updateScheduler({ monitoringState: 'MONITORING' });
        this.log(schedulerId, 'Transitioned ARMED → CHECKING.');
        this.emitSchedulerUpdate();
      } else if (current.status !== 'CHECKING') {
        return;
      }

      while (true) {
        const scheduler = db.getScheduler();
        if (!scheduler || scheduler.id !== schedulerId || scheduler.status !== 'CHECKING') return;

        const now = Date.now();
        const expected = Date.parse(scheduler.expectedStartTime);
        const delay = this.calculatePollDelay(expected - now);
        const checkStartedAt = new Date().toISOString();
        let result;

        try {
          result = await openSeaService.checkMintAvailability(scheduler.slug, scheduler.chainId);
          db.updateScheduler({
            lastCheckAt: checkStartedAt,
            nextCheckAt: new Date(Date.now() + delay).toISOString(),
            availabilityState: result.available ? 'AVAILABLE' : 'UNAVAILABLE',
            monitoringState: result.available ? 'DETECTED' : 'MONITORING',
            firstAvailabilityAt: result.available && !scheduler.firstAvailabilityAt ? new Date().toISOString() : scheduler.firstAvailabilityAt,
            error: undefined
          });
          this.log(schedulerId, result.available
            ? `OpenSea public mint detected: ${result.stageType || 'PUBLIC'} stage ${result.stageIndex ?? 0}${result.startTime ? ` (start ${result.startTime})` : ''}.`
            : `OpenSea check: public mint unavailable${result.startTime ? `; reported start ${result.startTime}` : ''}.`);
          this.emitSchedulerUpdate();
        } catch (err: any) {
          const retryDelay = Math.min(Math.max(delay, 1000) * 2, 30_000);
          db.updateScheduler({
            lastCheckAt: checkStartedAt,
            nextCheckAt: new Date(Date.now() + retryDelay).toISOString(),
            availabilityState: 'ERROR',
            monitoringState: 'MONITORING',
            error: err.message
          });
          this.log(schedulerId, `OpenSea request failed; retrying after backoff: ${err.message}`);
          this.emitSchedulerUpdate();
          await sleep(retryDelay);
          continue;
        }

        if (result.available) {
          const firingClaim = db.claimSchedulerStatus(schedulerId, 'CHECKING', 'FIRING');
          if (!firingClaim) return;

          db.updateScheduler({
            firingAt: new Date().toISOString(),
            executionStartedAt: new Date().toISOString(),
            monitoringState: 'FIRING',
            nextCheckAt: undefined,
            error: undefined
          });
          this.log(schedulerId, 'Atomic CHECKING → FIRING claim succeeded. Starting existing mint.engine.ts exactly once.');
          this.emitSchedulerUpdate();

          await this.executeMint(schedulerId, firingClaim);
          return;
        }

        await sleep(delay);
      }
    } finally {
      this.schedulerLoopIds.delete(schedulerId);
    }
  }

  private async executeMint(schedulerId: string, scheduler: SchedulerRecord) {
    const request: MintTaskRequest = {
      slug: scheduler.slug,
      walletIds: scheduler.walletIds,
      mode: scheduler.mode,
      chainId: scheduler.chainId,
      quantity: scheduler.quantity,
      sponsorWalletId: scheduler.sponsorWalletId,
      executorAddress: scheduler.executorAddress as any,
      recipientAddress: scheduler.recipientAddress as any
    };

    this.log(schedulerId, 'Mint engine started. Existing OpenSea authentication, calldata, wallet execution, sponsorship and gas handling are preserved.');

    try {
      const result = await mintEngine.executeMintSession(request, (progress: MintTaskProgress) => {
        if (progress.taskId) db.updateScheduler({ executionTaskId: progress.taskId });
        const last = progress.logs?.[progress.logs.length - 1];
        if (last) this.log(schedulerId, last);
        this.emitEvent('mint_progress', progress);
        this.emitSchedulerUpdate();
      });

      if (!result.txHashes.length && scheduler.walletIds.length > 0) {
        throw new Error('Mint engine completed without any submitted transaction hashes');
      }

      db.updateScheduler({ status: 'DONE', monitoringState: 'COMPLETED', completionAt: new Date().toISOString(), error: undefined, nextCheckAt: undefined });
      this.log(schedulerId, `Mint execution completed. ${result.txHashes.length} transaction(s) submitted.`);
      this.emitSchedulerUpdate();
    } catch (err: any) {
      db.updateScheduler({ status: 'FAILED', monitoringState: 'FAILED', completionAt: new Date().toISOString(), error: err.message, nextCheckAt: undefined });
      this.log(schedulerId, `Mint execution failed: ${err.message}`);
      this.emitEvent('mint_progress', {
        taskId: db.getScheduler()?.executionTaskId || `scheduler_${schedulerId}`,
        status: 'FAILED', completedCount: 0, totalCount: scheduler.walletIds.length,
        logs: [err.message], txHashes: []
      });
      this.emitSchedulerUpdate();
    }
  }

  private calculatePollDelay(msUntilExpected: number) {
    if (msUntilExpected > FAR_THRESHOLD_MS) return POLL_FAR_MS;
    if (msUntilExpected > MID_THRESHOLD_MS) return POLL_MID_MS;
    if (msUntilExpected > CLOSE_THRESHOLD_MS) return POLL_APPROACHING_MS;
    return POLL_CLOSE_MS;
  }

  private log(schedulerId: string, message: string) {
    db.addSchedulerLog(schedulerId, message);
    this.emitSchedulerUpdate();
  }

  private emitSchedulerUpdate() {
    const scheduler = db.getScheduler();
    if (scheduler) this.emitEvent('scheduler_update', scheduler);
  }

  public async sendAlert(title: string, message: string, collectionUrl?: string) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (telegramToken && telegramChatId) {
      try {
        const text = `🚨 *${title}*\n\n${message}${collectionUrl ? `\n\n[OpenSea Collection](${collectionUrl})` : ''}`;
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { chat_id: telegramChatId, text, parse_mode: 'Markdown' });
      } catch (err: any) {
        console.warn(`Telegram alert failed: ${err.message}`);
      }
    }

    if (discordWebhookUrl) {
      try {
        await axios.post(discordWebhookUrl, { embeds: [{ title, description: message, color: 0xc8922a, url: collectionUrl, timestamp: new Date().toISOString() }] });
      } catch (err: any) {
        console.warn(`Discord webhook alert failed: ${err.message}`);
      }
    }
  }
}

export const dropWatcher = new DropWatcher();
