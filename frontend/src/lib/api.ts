import { io, Socket } from 'socket.io-client';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE);
  }
  return socket;
}

export async function fetchWallets() {
  const res = await fetch(`${API_BASE}/api/wallets`);
  return res.json();
}

export async function generateWallets(count: number, labelPrefix?: string) {
  const res = await fetch(`${API_BASE}/api/wallets/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, labelPrefix })
  });
  return res.json();
}

export async function importWallets(privateKeys: string[], labelPrefix?: string) {
  const res = await fetch(`${API_BASE}/api/wallets/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privateKeys, labelPrefix })
  });
  return res.json();
}

export async function deleteWallet(id: string) {
  const res = await fetch(`${API_BASE}/api/wallets/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchCollection(slug: string) {
  const res = await fetch(`${API_BASE}/api/opensea/collection/${slug}`);
  return res.json();
}

export async function executeMint(payload: any) {
  const res = await fetch(`${API_BASE}/api/mint/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fundWallets(payload: any) {
  const res = await fetch(`${API_BASE}/api/funding/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function sweepWallets(payload: any) {
  const res = await fetch(`${API_BASE}/api/funding/sweep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function runDoctorCheck(executorAddress?: string, chainId = 84532) {
  const query = new URLSearchParams({ chainId: chainId.toString() });
  if (executorAddress) query.append('executorAddress', executorAddress);
  const res = await fetch(`${API_BASE}/api/doctor?${query.toString()}`);
  return res.json();
}
