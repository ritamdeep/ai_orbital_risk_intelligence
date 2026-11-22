import React, { useState, useRef, useEffect } from 'react';
import { Satellite, ChevronDown, Check } from 'lucide-react';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';

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

  const { satellites: contextSatellites } = useOrbitalIntelligence();

  const satellites: SatelliteOption[] =
    availableSatellites && availableSatellites.length > 0
      ? availableSatellites
      : contextSatellites.map((s) => ({
          noradId: s.noradId,
          name: s.name,
          category: s.categoryChipLabel || s.category,
        }));

  const currentSat = satellites.find((s) => s.noradId === currentNoradId) || satellites[0];

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (noradId: number) => {
    onSelectSatellite(noradId);
    setIsOpen(false);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('satellite', noradId.toString());
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div
      className="relative inline-block text-left"
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select satellite to assess mission impact"
        className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-white/[0.06] border border-white/15 hover:border-cyan-400/50 hover:shadow-glow-cyan text-xs sm:text-sm font-sans text-slate-100 hover:text-white transition-all duration-200"
      >
        <Satellite className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="font-display font-semibold text-white">
          {currentSat ? currentSat.name : 'Select Satellite'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#94adc9] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="glass-surface-chip absolute right-0 mt-2 w-64 bg-[#081022]/95 z-50 py-1.5"
        >
          <div className="px-3.5 py-2 type-label text-[10px] border-b border-white/10">
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
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/15 text-cyan-200 font-semibold'
                      : 'text-slate-200 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-display font-semibold text-slate-100">{sat.name}</span>
                    <span className="text-[11px] text-[#94adc9] font-sans">
                      <span className="font-data">#{sat.noradId}</span>{' '}
                      {sat.category ? `• ${sat.category}` : ''}
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
