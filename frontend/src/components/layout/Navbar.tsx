import React from 'react';
import {
  Orbit,
  Search,
  Bell,
  Settings,
  Database,
  Radio,
  Layers,
} from 'lucide-react';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { GlassCard } from '../common/GlassCard';

export type NavPage = 'overview' | 'satellites' | 'risk' | 'impact' | 'alerts';

interface NavbarProps {
  currentPage: NavPage;
  onSelectPage: (page: NavPage) => void;
  activeAlertCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onSelectPage, activeAlertCount }) => {
  const { overallFidelity } = useOrbitalIntelligence();

  const navItems: { id: NavPage; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'satellites', label: 'Satellite Intelligence' },
    { id: 'risk', label: 'Risk Analysis' },
    { id: 'impact', label: 'Mission Impact' },
    { id: 'alerts', label: 'Alerts Centre', badge: activeAlertCount },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#030712]/65 backdrop-blur-xl border-b border-white/[0.08] transition-all">
      {/* Top Status / Telemetry Fidelity Pill in Top-Right Corner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-1 flex justify-end">
        {overallFidelity === 'Live' && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-[11px] font-sans font-semibold tracking-[0.06em] uppercase bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 shadow-glow-green">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>LIVE TELEMETRY (REAL)</span>
          </div>
        )}

        {overallFidelity === 'Partial' && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-[11px] font-sans font-semibold tracking-[0.06em] uppercase bg-amber-500/15 border border-amber-400/40 text-amber-200 shadow-glow-amber">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <Layers className="w-3 h-3 text-amber-400" />
            <span>PARTIAL TELEMETRY (HYBRID)</span>
          </div>
        )}

        {overallFidelity === 'Mock' && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-[11px] font-sans font-semibold tracking-[0.06em] uppercase bg-white/[0.06] border border-white/15 text-[#b4c6dc]">
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
            className="flex items-center space-x-3 cursor-pointer shrink-0 group"
            onClick={() => onSelectPage('overview')}
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-glow-cyan group-hover:shadow-glow-cyan-strong transition-shadow">
              <Orbit className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-display text-lg font-bold tracking-[-0.02em] text-white">
                  ASTRAVIGIL
                </span>
                <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.08em] px-2 py-0.5 border border-cyan-400/35 text-cyan-300 bg-cyan-500/15 rounded-full">
                  AEROSPACE
                </span>
              </div>
              <p className="text-xs text-[#94adc9] hidden lg:block font-sans">
                Orbital Risk Intelligence & Satellite Continuity Platform
              </p>
            </div>
          </div>

          {/* Center: Rounded Glass Pill Navigation Container */}
          <GlassCard
            as="nav"
            variant="pill"
            aria-label="Primary navigation"
            className="flex items-center p-1.5 shrink-0 overflow-x-auto max-w-full"
          >
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectPage(item.id)}
                  className={`relative flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-sans font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'glass-selected bg-cyan-500/20 text-cyan-200 font-semibold'
                      : 'text-[#b4c6dc] hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-data font-semibold flex items-center justify-center shrink-0 shadow-glow-red">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </GlassCard>

          {/* Right: Circular Icon Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              aria-label="Search"
              className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#b4c6dc] hover:text-white hover:border-cyan-400/40 hover:shadow-glow-cyan transition-all duration-200"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              aria-label="Notifications"
              className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#b4c6dc] hover:text-white hover:border-cyan-400/40 hover:shadow-glow-cyan transition-all duration-200"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              aria-label="Settings"
              className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#b4c6dc] hover:text-white hover:border-cyan-400/40 hover:shadow-glow-cyan transition-all duration-200"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
