import { io, Socket } from 'socket.io-client';

// External backend (optional). If not set, wallet ops use Next.js API routes (/api/...).
const EXTERNAL_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || '';

// Base for wallet API calls — relative if no external backend (works on Vercel)
const WALLET_API = EXTERNAL_BACKEND || '';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (!EXTERNAL_BACKEND) return null; // no socket without external backend
  if (!socket) {
    socket = io(EXTERNAL_BACKEND);
  }
  return socket;
}

export async function fetchWallets(fast = false) {
  const res = await fetch(`${WALLET_API}/api/wallets${fast ? '?fast=true' : ''}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch wallets');
  }
  return data;
}

export async function generateWallets(count: number, labelPrefix?: string) {
  const res = await fetch(`${WALLET_API}/api/wallets/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, labelPrefix })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to generate wallets');
  }
  return data;
}

export async function importWallets(privateKeys: string[], labelPrefix?: string) {
  const res = await fetch(`${WALLET_API}/api/wallets/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privateKeys, labelPrefix })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to import wallets');
  }
  return data;
}

export async function deleteWallet(id: string) {
  const res = await fetch(`${WALLET_API}/api/wallets/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete wallet');
  }
  return data;
}

export async function fetchCollection(slug: string) {
  const res = await fetch(`${EXTERNAL_BACKEND}/api/opensea/collection/${slug}`);
  return res.json();
}

export async function executeMint(payload: any) {
  const res = await fetch(`${EXTERNAL_BACKEND}/api/mint/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fundWallets(payload: any) {
  const res = await fetch(`${EXTERNAL_BACKEND}/api/funding/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function sweepWallets(payload: any) {
  const res = await fetch(`${EXTERNAL_BACKEND}/api/funding/sweep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function runDoctorCheck(executorAddress?: string, chainId = 84532) {
  const query = new URLSearchParams({ chainId: chainId.toString() });
  if (executorAddress) query.append('executorAddress', executorAddress);
  const res = await fetch(`${EXTERNAL_BACKEND}/api/doctor?${query.toString()}`);
  return res.json();
}
