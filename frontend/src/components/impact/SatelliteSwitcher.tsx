import React, { useState, useRef, useEffect } from 'react';
import { Satellite, ChevronDown, Check } from 'lucide-react';
import { MOCK_SATELLITE_CATALOGUE } from '../../services/mock/mockSatelliteIntelligence';

interface SatelliteOption {
  noradId: number;
  name: string;
  category?: string;
}

interface SatelliteSwitcherProps {
  currentNoradId: number;
  onSelectSatellite: (noradId: number) => void;
  availableSatellites?: SatelliteOption[];
}

export const SatelliteSwitcher: React.FC<SatelliteSwitcherProps> = ({
  currentNoradId,
  onSelectSatellite,
  availableSatellites,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fallback to catalogue if availableSatellites is not passed
  const satellites: SatelliteOption[] = (availableSatellites && availableSatellites.length > 0)
    ? availableSatellites
    : MOCK_SATELLITE_CATALOGUE.map(s => ({
        noradId: s.noradId,
        name: s.name,
        category: s.categoryChipLabel || s.category,
      }));

  const currentSat = satellites.find(s => s.noradId === currentNoradId) || satellites[0];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (noradId: number) => {
    onSelectSatellite(noradId);
    setIsOpen(false);

    // Sync query parameter ?satellite={noradId} without page reload
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('satellite', noradId.toString());
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select satellite to assess mission impact"
        className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/80 hover:border-cyan-400/60 text-xs font-mono text-slate-200 hover:text-white shadow-lg transition-all focus:outline-none focus:ring-1 focus:ring-cyan-400"
      >
        <Satellite className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="font-semibold text-white">{currentSat ? currentSat.name : 'Select Satellite'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.8)] z-50 py-1.5 focus:outline-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
            Switch Target Satellite
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {satellites.map((sat) => {
              const isSelected = sat.noradId === currentNoradId;
              return (
                <button
                  key={sat.noradId}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(sat.noradId)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono transition-colors ${
                    isSelected
                      ? 'bg-cyan-950/50 text-cyan-300 font-bold'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-sans font-semibold text-slate-100">{sat.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      #{sat.noradId} {sat.category ? `• ${sat.category}` : ''}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
