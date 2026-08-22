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
  _schedulersBySession: Record<string, SchedulerRecord | null>;
  _schedulerLogsBySession: Record<string, SchedulerLogRecord[]>;
};

if (!globalStore._schedulersBySession) globalStore._schedulersBySession = {};
if (!globalStore._schedulerLogsBySession) globalStore._schedulerLogsBySession = {};

export const schedulerStore = {
  get(sessionId = 'default_session'): SchedulerRecord | null {
    return globalStore._schedulersBySession[sessionId] || null;
  },

  arm(payload: {
    slug: string;
    expectedStartTime: string;
    chainId: number;
    quantity: number;
    mode: 'single' | 'self-funded' | 'sponsored';
    walletIds: string[];
  }, sessionId = 'default_session'): SchedulerRecord {
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
    globalStore._schedulersBySession[sessionId] = record;
    this.addLog(record.id, `Scheduler ARMED for ${payload.slug} (Target: ${payload.expectedStartTime})`, sessionId);
    return record;
  },

  disarm(sessionId = 'default_session'): SchedulerRecord | null {
    const active = this.get(sessionId);
    if (!active) return null;
    const now = new Date().toISOString();
    active.status = 'IDLE';
    active.monitoringActive = false;
    active.updatedAt = now;
    this.addLog(active.id, 'Scheduler DISARMED by user.', sessionId);
    return active;
  },

  addLog(schedulerId: string, message: string, sessionId = 'default_session'): SchedulerLogRecord {
    if (!globalStore._schedulerLogsBySession[sessionId]) {
      globalStore._schedulerLogsBySession[sessionId] = [];
    }
    const logs = globalStore._schedulerLogsBySession[sessionId];
    const log: SchedulerLogRecord = {
      id: `slog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      schedulerId,
      message,
      timestamp: new Date().toISOString()
    };
    logs.unshift(log);
    if (logs.length > 200) {
      globalStore._schedulerLogsBySession[sessionId] = logs.slice(0, 200);
    }
    return log;
  },

  getLogs(limit = 100, sessionId = 'default_session'): SchedulerLogRecord[] {
    const logs = globalStore._schedulerLogsBySession[sessionId] || [];
    return logs.slice(0, limit);
  }
};
