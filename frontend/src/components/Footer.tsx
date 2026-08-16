'use client';

import React from 'react';
import { ExternalLink, Github, Twitter, Globe } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-amber-900/10 py-8 px-6 bg-stone-50/50 backdrop-blur-md mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-500 flex items-center justify-center text-white font-bold text-xs">
            Z
          </div>
          <span className="font-serif font-bold text-stone-900 text-lg">OSNM-Z Engine</span>
          <span className="text-xs text-stone-500 font-mono">v2.0 Full-Stack Edition</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-stone-700 font-medium">
          <span>
            Built by{' '}
            <a
              href="https://asad-lee-portfolio.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#C8922A] hover:underline font-semibold inline-flex items-center gap-1"
            >
              Asad Lee <Globe className="w-3.5 h-3.5" />
            </a>
          </span>
          <a
            href="https://github.com/Asadlee24"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#C8922A] transition-colors flex items-center gap-1 text-stone-600"
          >
            <Github className="w-4 h-4" /> @Asadlee24
          </a>
          <a
            href="https://x.com/asadleo416"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#C8922A] transition-colors flex items-center gap-1 text-stone-600"
          >
            <Twitter className="w-4 h-4" /> @asadleo416
          </a>
        </div>
      </div>
    </footer>
  );
}
