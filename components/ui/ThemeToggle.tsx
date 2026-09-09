import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or before client hydration completes, render a stable neutral shell
  if (!mounted) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`} suppressHydrationWarning>
        <div className="relative inline-flex items-center p-1 rounded-full border border-slate-700/60 bg-slate-900/60 shadow-sm opacity-60">
          <div className="w-7 h-7 flex items-center justify-center">
            <Sun className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="w-7 h-7 flex items-center justify-center">
            <Moon className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>
        {showLabel && (
          <span className="text-xs font-semibold select-none text-slate-500">Theme</span>
        )}
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} suppressHydrationWarning>
      <div
        className={`relative inline-flex items-center p-1 rounded-full border transition-all duration-300 select-none shadow-sm ${isDark
          ? 'bg-slate-900/90 border-slate-700/80 text-slate-400'
          : 'bg-slate-100/90 border-slate-200/90 text-slate-600'
          }`}
      >
        {/* Light Option Button */}
        <button
          type="button"
          onClick={() => setTheme('light')}
          title="Switch to Light Mode"
          aria-label="Light Mode"
          className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${!isDark
            ? 'bg-white text-emerald-500 shadow-md shadow-emerald-500/10 scale-105'
            : 'text-slate-500 hover:text-slate-300 hover:scale-105'
            }`}
        >
          <Sun className="w-3.5 h-3.5" />
        </button>

        {/* Dark Option Button */}
        <button
          type="button"
          onClick={() => setTheme('dark')}
          title="Switch to Dark Mode"
          aria-label="Dark Mode"
          className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${isDark
            ? 'bg-emerald-600 text-white shadow-md shadow-blue-500/30 scale-105'
            : 'text-slate-400 hover:text-slate-600 hover:scale-105'
            }`}
        >
          <Moon className="w-3.5 h-3.5" />
        </button>
      </div>

      {showLabel && (
        <span className="text-xs font-semibold select-none text-slate-400">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </div>
  );
}
