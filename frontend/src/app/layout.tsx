import type { Metadata } from 'next';
import '../styles/globals.css';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'Minter | Multi-Wallet OpenSea Minting Terminal',
  description: 'Full-stack multi-wallet OpenSea NFT minting platform with persistent backend scheduler, EIP-7702 sponsored mode, and real-time monitoring.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-blue-500/20 selection:text-blue-900">
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
