'use client';

import React from 'react';
import { ExternalLink, Github, Twitter, Globe, Cpu } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 py-8 px-6 bg-white backdrop-blur-xl mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl gold-gradient-btn flex items-center justify-center font-heading font-extrabold text-white text-xs shadow-sm">
            M
          </div>
          <div>
            <span className="font-heading font-bold text-slate-900 text-base">Minter Engine</span>
            <span className="ml-2 text-xs text-slate-500 font-mono">v2.0 Full-Stack</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-600 font-medium">
          <span>
            Built by{' '}
            <a
              href="https://asad-lee-portfolio.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1 transition-colors"
            >
              Asad Lee <Globe className="w-3.5 h-3.5" />
            </a>
          </span>
          <a
            href="https://github.com/Asadlee24"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 transition-colors flex items-center gap-1 text-slate-700"
          >
            <Github className="w-4 h-4" /> @Asadlee24
          </a>
          <a
            href="https://x.com/asadleo416"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 transition-colors flex items-center gap-1 text-slate-700"
          >
            <Twitter className="w-4 h-4" /> @asadleo416
          </a>
        </div>
      </div>
    </footer>
  );
}
