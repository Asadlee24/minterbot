import type { Metadata } from 'next';
import '../styles/globals.css';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'OSNM-Z | Multi-Wallet OpenSea Minting Terminal',
  description: 'Full-stack multi-wallet OpenSea NFT minting platform with persistent backend scheduler, EIP-7702 sponsored mode, and real-time monitoring.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#080A10] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
