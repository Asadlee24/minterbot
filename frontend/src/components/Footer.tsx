'use client';

import React from 'react';
import { ExternalLink, Github, Twitter, Globe, Cpu } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-white/10 py-8 px-6 bg-slate-950/60 backdrop-blur-xl mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-cyan-500 p-[1px] shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center font-heading font-extrabold text-amber-400 text-xs">
              Z
            </div>
          </div>
          <div>
            <span className="font-heading font-bold text-slate-100 text-base">OSNM-Z Engine</span>
            <span className="ml-2 text-xs text-slate-500 font-mono">v2.0 Full-Stack</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
          <span>
            Built by{' '}
            <a
              href="https://asad-lee-portfolio.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              Asad Lee <Globe className="w-3.5 h-3.5" />
            </a>
          </span>
          <a
            href="https://github.com/Asadlee24"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <Github className="w-4 h-4" /> @Asadlee24
          </a>
          <a
            href="https://x.com/asadleo416"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <Twitter className="w-4 h-4" /> @asadleo416
          </a>
        </div>
      </div>
    </footer>
  );
}
