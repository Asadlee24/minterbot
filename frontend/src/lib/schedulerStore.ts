export type SchedulerStatus = 'IDLE' | 'ARMED' | 'CHECKING' | 'FIRING' | 'DONE' | 'FAILED';

export interface SchedulerRecord {
  id: string;
  slug: string;
  expectedStartTime: string;
  chainId: number;
  quantity: number;
  mode: 'single' | 'self-funded' | 'sponsored';
  walletIds: string[];
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

const globalStore = global as unknown as {
  _scheduler: SchedulerRecord | null;
  _schedulerLogs: SchedulerLogRecord[];
};

if (!globalStore._scheduler) globalStore._scheduler = null;
if (!globalStore._schedulerLogs) globalStore._schedulerLogs = [];

export const schedulerStore = {
  get(): SchedulerRecord | null {
    return globalStore._scheduler;
  },

  arm(payload: {
    slug: string;
    expectedStartTime: string;
    chainId: number;
    quantity: number;
    mode: 'single' | 'self-funded' | 'sponsored';
    walletIds: string[];
  }): SchedulerRecord {
    const now = new Date().toISOString();
    const record: SchedulerRecord = {
      id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      slug: payload.slug,
      expectedStartTime: payload.expectedStartTime,
      chainId: payload.chainId,
      quantity: payload.quantity || 1,
      mode: payload.mode,
      walletIds: payload.walletIds,
      status: 'ARMED',
      monitoringActive: true,
      openSeaAvailable: false,
      createdAt: now,
      updatedAt: now
    };
    globalStore._scheduler = record;
    this.addLog(record.id, `Scheduler ARMED for ${payload.slug} (Target: ${payload.expectedStartTime})`);
    return record;
  },

  disarm(): SchedulerRecord | null {
    if (!globalStore._scheduler) return null;
    const now = new Date().toISOString();
    globalStore._scheduler.status = 'IDLE';
    globalStore._scheduler.monitoringActive = false;
    globalStore._scheduler.updatedAt = now;
    this.addLog(globalStore._scheduler.id, 'Scheduler DISARMED by user.');
    return globalStore._scheduler;
  },

  addLog(schedulerId: string, message: string): SchedulerLogRecord {
    const log: SchedulerLogRecord = {
      id: `slog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      schedulerId,
      message,
      timestamp: new Date().toISOString()
    };
    globalStore._schedulerLogs.unshift(log);
    if (globalStore._schedulerLogs.length > 200) {
      globalStore._schedulerLogs = globalStore._schedulerLogs.slice(0, 200);
    }
    return log;
  },

  getLogs(limit = 100): SchedulerLogRecord[] {
    return globalStore._schedulerLogs.slice(0, limit);
  }
};
