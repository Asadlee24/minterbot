import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

import { walletService } from './services/wallet.service.js';
import { openSeaService } from './services/opensea.service.js';
import { mintEngine } from './services/mint.engine.js';
import { fundingService } from './services/funding.service.js';
import { doctorService } from './services/doctor.service.js';
import { schedulerEngine } from './services/drop.watcher.js';
import { db } from './db/database.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 1. Wallets Management
app.get('/api/wallets', async (req, res) => {
  try {
    // Use ?fast=true to skip balance fetching for instant response
    const fast = req.query.fast === 'true';
    const wallets = await walletService.listWalletsWithBalances(!fast);
    res.json({ success: true, wallets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wallets/generate', async (req, res) => {
  try {
    const { count, labelPrefix } = req.body;
    if (count !== undefined && (isNaN(Number(count)) || Number(count) < 1)) {
      return res.status(400).json({ success: false, error: 'count must be a positive number' });
    }
    const created = await walletService.generateWallets(Number(count) || 1, labelPrefix);
    res.json({ success: true, wallets: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wallets/import', async (req, res) => {
  try {
    const { privateKeys, labelPrefix } = req.body;
    if (!Array.isArray(privateKeys) || privateKeys.length === 0) {
      return res.status(400).json({ success: false, error: 'privateKeys array is required and must not be empty' });
    }
    const imported = await walletService.importWallets(privateKeys, labelPrefix);
    res.json({ success: true, wallets: imported });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/wallets/:id', (req, res) => {
  try {
    const ok = walletService.deleteWallet(req.params.id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. OpenSea Metadata & Eligibility
app.get('/api/opensea/collection/:slug', async (req, res) => {
  try {
    const metadata = await openSeaService.getCollectionMetadata(req.params.slug);
    res.json({ success: true, metadata });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/opensea/eligibility/:slug/:address', async (req, res) => {
  try {
    const snapshot = await openSeaService.getDropEligibility(req.params.slug, req.params.address as any);
    res.json({ success: true, snapshot });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Mint Execution (Triggers WebSocket events)
app.post('/api/mint/execute', async (req, res) => {
  try {
    const reqBody = req.body;
    res.json({ success: true, message: 'Mint task initiated in background' });

    mintEngine.executeMintSession(reqBody, (progress) => {
      io.emit('mint_progress', progress);
    }).catch((err) => {
      io.emit('mint_progress', { taskId: 'error', status: 'FAILED', logs: [err.message] });
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Funding & Sweep
app.post('/api/funding/fund', async (req, res) => {
  try {
    const { sponsorWalletId, targetWalletIds, amountEth, chainId } = req.body;
    const txHashes = await fundingService.fundWallets(sponsorWalletId, targetWalletIds, amountEth, chainId || 84532);
    res.json({ success: true, txHashes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/funding/sweep', async (req, res) => {
  try {
    const { targetWalletIds, recipientAddress, chainId } = req.body;
    const txHashes = await fundingService.sweepWallets(targetWalletIds, recipientAddress, chainId || 84532);
    res.json({ success: true, txHashes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. System Doctor Safety Check
app.get('/api/doctor', async (req, res) => {
  try {
    const executor = req.query.executorAddress as string | undefined;
    const chainId = parseInt(req.query.chainId as string || '84532', 10);
    const report = await doctorService.runDoctorCheck(executor as any, chainId);
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Mint History Logs
app.get('/api/logs', (req, res) => {
  try {
    const logs = db.getMintLogs(100);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 7. Scheduler API ──────────────────────────────────────────────────────────
// Backend owns the scheduler lifecycle. Frontend only reads/controls via these endpoints.

/**
 * GET /api/scheduler
 * Returns the current persisted scheduler state (or null if none).
 * Frontend calls this on mount and after browser refresh to restore UI state.
 */
app.get('/api/scheduler', (req, res) => {
  try {
    const scheduler = db.getScheduler();
    res.json({ success: true, scheduler });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/scheduler/arm
 * Persists scheduler configuration to DB and starts the adaptive polling loop.
 *
 * Body: {
 *   slug: string,
 *   expectedStartTime: string (ISO 8601),
 *   chainId: number,
 *   quantity: number,
 *   mode: 'single' | 'self-funded' | 'sponsored',
 *   walletIds: string[]
 * }
 */
app.post('/api/scheduler/arm', async (req, res) => {
  try {
    const { slug, expectedStartTime, chainId, quantity, mode, walletIds } = req.body;

    // Validation
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ success: false, error: 'slug is required' });
    }
    if (!expectedStartTime || isNaN(Date.parse(expectedStartTime))) {
      return res.status(400).json({ success: false, error: 'expectedStartTime must be a valid ISO 8601 date string' });
    }
    if (new Date(expectedStartTime) <= new Date()) {
      return res.status(400).json({ success: false, error: 'expectedStartTime must be in the future' });
    }
    if (!chainId || isNaN(Number(chainId))) {
      return res.status(400).json({ success: false, error: 'chainId is required' });
    }
    if (!Array.isArray(walletIds) || walletIds.length === 0) {
      return res.status(400).json({ success: false, error: 'walletIds must be a non-empty array' });
    }
    const validModes = ['single', 'self-funded', 'sponsored'];
    if (!mode || !validModes.includes(mode)) {
      return res.status(400).json({ success: false, error: `mode must be one of: ${validModes.join(', ')}` });
    }

    const scheduler = await schedulerEngine.arm({
      slug: slug.trim().toLowerCase(),
      expectedStartTime,
      chainId: Number(chainId),
      quantity: Number(quantity) || 1,
      mode,
      walletIds
    }, io);

    res.json({ success: true, scheduler });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/scheduler/disarm
 * Cancels an ARMED or CHECKING scheduler and returns it to IDLE.
 * Has no effect on FIRING / DONE / FAILED schedulers.
 */
app.post('/api/scheduler/disarm', async (req, res) => {
  try {
    await schedulerEngine.disarm(io);
    const scheduler = db.getScheduler();
    res.json({ success: true, scheduler });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/scheduler/logs
 * Returns recent scheduler activity logs, including those from before a browser refresh.
 */
app.get('/api/scheduler/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const logs = db.getSchedulerLogs(Math.min(limit, 200));
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Server Startup ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 OpenSea Mint Backend Engine running on port ${PORT}`);
  console.log(`📡 WebSocket server listening for dashboard events`);
  console.log(`=================================================`);

  // Resume any persisted scheduler that was active before this startup
  schedulerEngine.recoverOnStartup(io).catch((err) => {
    console.error('⚠️  Scheduler recovery error:', err.message);
  });
});
