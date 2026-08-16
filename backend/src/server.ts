import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { walletService } from './services/wallet.service.js';
import { openSeaService } from './services/opensea.service.js';
import { mintEngine } from './services/mint.engine.js';
import { fundingService } from './services/funding.service.js';
import { doctorService } from './services/doctor.service.js';
import { db } from './db/database.js';
import { dropWatcher } from './services/drop.watcher.js';

dotenv.config();

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

// Socket.io connection logger
io.on('connection', (socket) => {
  console.log(`Web Dashboard connected: ${socket.id}`);
  socket.emit('connected', { status: 'OK', timestamp: new Date().toISOString() });
});

// REST API Endpoints

// 1. Wallets Management
app.get('/api/wallets', async (req, res) => {
  try {
    const wallets = await walletService.listWalletsWithBalances();
    res.json({ success: true, wallets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wallets/generate', async (req, res) => {
  try {
    const { count, labelPrefix } = req.body;
    const created = await walletService.generateWallets(count || 1, labelPrefix);
    res.json({ success: true, wallets: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wallets/import', async (req, res) => {
  try {
    const { privateKeys, labelPrefix } = req.body;
    if (!Array.isArray(privateKeys) || privateKeys.length === 0) {
      return res.status(400).json({ success: false, error: 'privateKeys array required' });
    }
    const imported = await walletService.importWallets(privateKeys, labelPrefix);
    res.json({ success: true, wallets: imported });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 OpenSea Mint Backend Engine running on port ${PORT}`);
  console.log(`📡 WebSocket server listening for dashboard events`);
  console.log(`=================================================`);
});
