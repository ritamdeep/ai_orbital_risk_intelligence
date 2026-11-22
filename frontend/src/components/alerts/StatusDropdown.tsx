import React, { useState, useRef, useEffect } from 'react';
import { InvestigationStatus } from '../../types/common';
import { ChevronDown, Check } from 'lucide-react';

interface StatusDropdownProps {
  status: InvestigationStatus;
  onChange: (newStatus: InvestigationStatus) => void;
  disabled?: boolean;
}

const STATUS_CONFIG: Record<
  InvestigationStatus,
  { label: string; dotColor: string; textColor: string; pillGlow: string }
> = {
  UNREVIEWED: {
    label: 'Unreviewed',
    dotColor: 'bg-slate-300',
    textColor: 'text-slate-200',
    pillGlow: 'border-white/15 hover:border-cyan-400/40',
  },
  UNDER_EVALUATION: {
    label: 'Under Evaluation',
    dotColor: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    textColor: 'text-amber-200',
    pillGlow: 'border-amber-400/40 bg-amber-500/10 shadow-glow-amber',
  },
  MONITORING: {
    label: 'Monitoring',
    dotColor: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
    textColor: 'text-cyan-200',
    pillGlow: 'border-cyan-400/40 bg-cyan-500/10 shadow-glow-cyan',
  },
  DISMISSED: {
    label: 'Dismissed',
    dotColor: 'bg-slate-500',
    textColor: 'text-[#94adc9]',
    pillGlow: 'border-white/10',
  },
};

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  status,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = STATUS_CONFIG[status] || STATUS_CONFIG.UNREVIEWED;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const statuses: InvestigationStatus[] = [
    'UNREVIEWED',
    'UNDER_EVALUATION',
    'MONITORING',
    'DISMISSED',
  ];

  return (
    <div
      className="relative inline-block text-left"
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current status: ${current.label}. Click to change status.`}
        className={`flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-white/[0.05] border text-xs font-sans font-medium transition-all duration-200 ${current.pillGlow}`}
      >
        <span className={`w-2 h-2 rounded-full ${current.dotColor} shrink-0`} />
        <span className={current.textColor}>{current.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#94adc9] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="glass-surface-chip absolute right-0 mt-2 w-48 z-50 py-1.5 bg-[#081022]/95"
        >
          {statuses.map((s) => {
            const item = STATUS_CONFIG[s];
            const isSelected = s === status;
            return (
              <button
                key={s}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(s);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-sans transition-colors ${
                  isSelected
                    ? 'bg-cyan-500/15 text-cyan-200 font-semibold'
                    : 'text-slate-200 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${item.dotColor} shrink-0`} />
                  <span className={item.textColor}>{item.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
