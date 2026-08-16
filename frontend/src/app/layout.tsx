import type { Metadata } from 'next';
import '../styles/globals.css';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'OSNM-Z | Multi-Wallet OpenSea Minting Engine',
  description: 'Full-stack multi-wallet OpenSea NFT minting platform with EIP-7702 sponsored mode, real-time WebSocket monitoring, and 3D visual engine.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
