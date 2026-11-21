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
  { label: string; dotColor: string; textColor: string }
> = {
  UNREVIEWED: {
    label: 'Unreviewed',
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-300',
  },
  UNDER_EVALUATION: {
    label: 'Under Evaluation',
    dotColor: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]',
    textColor: 'text-cyan-300',
  },
  MONITORING: {
    label: 'Monitoring',
    dotColor: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.7)]',
    textColor: 'text-blue-300',
  },
  DISMISSED: {
    label: 'Dismissed',
    dotColor: 'bg-slate-600',
    textColor: 'text-slate-500',
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

  // Click outside listener
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
    <div className="relative inline-block text-left" ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current status: ${current.label}. Click to change status.`}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/80 hover:border-cyan-500/60 focus:border-cyan-400 text-xs font-mono transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
      >
        <span className={`w-2 h-2 rounded-full ${current.dotColor} shrink-0`} />
        <span className={`font-medium ${current.textColor}`}>{current.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-48 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 shadow-[0_12px_36px_rgba(0,0,0,0.8)] z-50 py-1 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
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
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono transition-colors ${
                  isSelected
                    ? 'bg-cyan-950/60 text-cyan-300 font-bold'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
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
