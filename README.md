# OSNM-Z | Multi-Wallet OpenSea Minting Engine (Web Platform)

A full-stack NFT minting bot platform with a modern Next.js 16 Web Dashboard, Node.js + Viem backend, real-time WebSocket status updates, 3D Three.js gold hero visualization, AES-256 encrypted wallet storage, and EIP-7702 sponsored mint execution.

---

## Features
- **3D Animated Hero:** Built with `@react-three/fiber` & `@react-three/drei` featuring a gold floating NFT crate with particle mesh and reduced-motion fallback.
- **Wallet Management:** Generate & import wallets stored with AES-256-GCM encryption. Real-time multi-chain native balance checking across Ethereum, Base, Arbitrum, Polygon, and Base Sepolia testnet.
- **Mint Execution Modes:**
  - **Single Wallet Mode:** Direct EIP-1559 transaction submission.
  - **Self-Funded Multi-Wallet Mode:** Concurrent execution for up to 10 manifest wallets.
  - **Sponsored EIP-7702 Mode:** EIP-7702 `SignedAuthorization` tuple & EIP-712 operation signing. Sponsor pays batch gas; wallets pay mint price.
- **Real-Time Monitoring:** Live Socket.io terminal streaming, progress bars, and direct Basescan transaction hash links.
- **Safety Doctor Check:** Pre-flight RPC liveness check, balance threshold verification, and `SponsoredMintExecutor` runtime bytecode hash matching (`0x81a8...3d60`).

---

## Tech Stack
- **Backend:** Node.js, Express, TypeScript, Viem, Socket.io, SQLite
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Three.js, `@react-three/fiber`, `@react-three/drei`
- **Design System:** Cream background (`#FAF8F5`), Gold accent (`#C8922A`), Playfair Display headings, DM Sans body font, glass cards

---

## Quick Start (Local Setup)

### 1. Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Backend runs on `http://localhost:4000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Dashboard opens at `http://localhost:3000`.

---

## Deployment Guide (Vercel + Backend Host)

1. **Frontend (Vercel):** Set root directory to `frontend/`. Add environment variable `NEXT_PUBLIC_BACKEND_URL` pointing to your deployed backend.
2. **Backend (Render / Railway / Fly.io):** Deploy `backend/` directory as a Node.js process. Configure `.env` variables (`ENCRYPTION_SECRET`, `RPC_*`).

---

## Credits & Branding
**Built by Asad Lee**
- Portfolio: [asad-lee-portfolio.vercel.app](https://asad-lee-portfolio.vercel.app)
- GitHub: [@Asadlee24](https://github.com/Asadlee24)
- X: [@asadleo416](https://x.com/asadleo416)
