import React from 'react';
import { 
  Orbit, 
  Search, 
  Bell, 
  Settings, 
  Database 
} from 'lucide-react';
import { USE_MOCK_DATA } from '../../services/apiClient';

export type NavPage = 'overview' | 'satellites' | 'risk' | 'impact' | 'alerts';

interface NavbarProps {
  currentPage: NavPage;
  onSelectPage: (page: NavPage) => void;
  activeAlertCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onSelectPage, activeAlertCount }) => {
  const navItems: { id: NavPage; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'satellites', label: 'Satellite Intelligence' },
    { id: 'risk', label: 'Risk Analysis' },
    { id: 'impact', label: 'Mission Impact' },
    { id: 'alerts', label: 'Alerts Centre', badge: activeAlertCount },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#030712]/70 backdrop-blur-xl border-b border-white/5 transition-all">
      {/* Top Simulated Data Pill in Top-Right Corner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2.5 pb-1 flex justify-end">
        {USE_MOCK_DATA && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-900/80 border border-slate-700/60 text-slate-300 shadow-sm">
            <Database className="w-3 h-3 text-cyan-400" />
            <span>SIMULATED DATA (MOCK)</span>
          </div>
        )}
      </div>

      {/* Main Navbar Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Brand & Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer shrink-0" 
            onClick={() => onSelectPage('overview')}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-aerospace-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Orbit className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-wider text-white font-mono">ASTRAVIGIL</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-cyan-500/40 text-cyan-400 bg-cyan-950/40 rounded">
                  AEROSPACE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden lg:block">
                Orbital Risk Intelligence & Satellite Continuity Platform
              </p>
            </div>
          </div>

          {/* Center: Rounded Pill Navigation Container */}
          <nav className="flex items-center bg-[#0c1322]/90 backdrop-blur-xl border border-slate-800/90 rounded-full p-1 shadow-2xl shrink-0">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectPage(item.id)}
                  className={`relative flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'border border-cyan-400/60 bg-cyan-950/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Circular Icon Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button 
              aria-label="Search"
              className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-700 transition-all"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button 
              aria-label="Notifications"
              className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-700 transition-all"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
            <button 
              aria-label="Settings"
              className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-700 transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
