import { io, Socket } from 'socket.io-client';

// External backend (optional). If not set, wallet ops use Next.js API routes (/api/...).
const EXTERNAL_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || '';

// Base for wallet API calls — relative if no external backend (works on Vercel)
const WALLET_API = EXTERNAL_BACKEND || '';

let socket: Socket | null = null;

export function getClientSessionId(): string {
  if (typeof window === 'undefined') return 'default_session';
  let sid = localStorage.getItem('minter_session_id');
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('minter_session_id', sid);
  }
  return sid;
}

function getAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-client-session-id': getClientSessionId()
  };
}

export function getSocket(): Socket | null {
  if (!EXTERNAL_BACKEND) return null;
  if (!socket) {
    socket = io(EXTERNAL_BACKEND);
  }
  return socket;
}

export async function fetchWallets(fast = false) {
  const res = await fetch(`${WALLET_API}/api/wallets${fast ? '?fast=true' : ''}`, {
    headers: { 'x-client-session-id': getClientSessionId() }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch wallets');
  }
  return data;
}

export async function generateWallets(count: number, labelPrefix?: string) {
  const res = await fetch(`${WALLET_API}/api/wallets/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
    body: JSON.stringify({ privateKeys, labelPrefix })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to import wallets');
  }
  return data;
}

export async function deleteWallet(id: string) {
  const res = await fetch(`${WALLET_API}/api/wallets/${id}`, {
    method: 'DELETE',
    headers: { 'x-client-session-id': getClientSessionId() }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete wallet');
  }
  return data;
}

export async function exportWalletPrivateKey(id: string, encryptedKey?: string) {
  const query = encryptedKey ? `?encryptedKey=${encodeURIComponent(encryptedKey)}` : '';
  const res = await fetch(`${WALLET_API}/api/wallets/export/${id}${query}`, {
    headers: { 'x-client-session-id': getClientSessionId() }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to export private key');
  }
  return data.privateKey as string;
}

async function safeJsonFetch(url: string, options?: RequestInit) {
  const headers = {
    ...options?.headers,
    'x-client-session-id': getClientSessionId()
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText})`);
  }
  if (!res.ok || (data && data.success === false)) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function fetchCollection(slug: string) {
  return safeJsonFetch(`${WALLET_API}/api/opensea/collection/${slug}`);
}

export async function executeMint(payload: any) {
  return safeJsonFetch(`${WALLET_API}/api/mint/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fundWallets(payload: any) {
  return safeJsonFetch(`${WALLET_API}/api/funding/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function sweepWallets(payload: any) {
  return safeJsonFetch(`${WALLET_API}/api/funding/sweep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function runDoctorCheck(executorAddress?: string, chainId = 84532) {
  const query = new URLSearchParams({ chainId: chainId.toString() });
  if (executorAddress) query.append('executorAddress', executorAddress);
  return safeJsonFetch(`${WALLET_API}/api/doctor?${query.toString()}`);
}

// ─── Scheduler API ──────────────────────────────────────────────────────────

export async function fetchScheduler() {
  return safeJsonFetch(`${WALLET_API}/api/scheduler`);
}

export async function armScheduler(payload: {
  slug: string;
  expectedStartTime: string;
  chainId: number;
  quantity: number;
  mode: 'single' | 'self-funded' | 'sponsored';
  walletIds: string[];
}) {
  return safeJsonFetch(`${WALLET_API}/api/scheduler/arm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function disarmScheduler() {
  return safeJsonFetch(`${WALLET_API}/api/scheduler/disarm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
}

export async function fetchSchedulerLogs(limit = 100) {
  return safeJsonFetch(`${WALLET_API}/api/scheduler/logs?limit=${limit}`);
}
