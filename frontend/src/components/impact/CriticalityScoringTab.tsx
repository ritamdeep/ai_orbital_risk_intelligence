import React, { useEffect, useState } from 'react';
import { CriticalityAssessment } from '../../types/intelligence';
import { CheckCircle2 } from 'lucide-react';

interface CriticalityScoringTabProps {
  criticality: CriticalityAssessment;
}

export const CriticalityScoringTab: React.FC<CriticalityScoringTabProps> = ({ criticality }) => {
  const [animated, setAnimated] = useState(false);

  // Trigger smooth progress bar animation on mount or satellite change
  useEffect(() => {
    setAnimated(false);
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [criticality]);

  const factors = [
    {
      id: 'life_safety',
      label: 'Human Life & Safety Support',
      value: criticality.breakdown.life_safety_support,
      description: 'Early disaster warning, cyclone path evacuations, distress relay.',
    },
    {
      id: 'disaster_management',
      label: 'Disaster Management Operations',
      value: criticality.breakdown.disaster_management,
      description: 'Monsoon flood mapping, post-event structural damage assessment.',
    },
    {
      id: 'national_infrastructure',
      label: 'National Infrastructure & Defense',
      value: criticality.breakdown.national_infrastructure,
      description: 'Cadastral cartography, coastal surveillance, power/grid telecommunications.',
    },
    {
      id: 'commercial_scientific',
      label: 'Commercial & Scientific Research',
      value: criticality.breakdown.commercial_scientific,
      description: 'Agricultural yield forecasts, ocean chlorophyll, academic data sets.',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h3 className="text-base font-bold text-white tracking-wide">
          Explainable Criticality Assessment
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Evaluated against human life safety, disaster response dependencies, and national infrastructure value.
        </p>
      </div>

      {/* 2x2 Factor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {factors.map((factor) => (
          <div
            key={factor.id}
            className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-lg space-y-2.5"
          >
            <div className="flex justify-between items-baseline text-xs font-semibold">
              <span className="text-slate-200">{factor.label}</span>
              <span className="font-mono text-cyan-300 font-bold text-sm tabular-nums">
                {factor.value}%
              </span>
            </div>

            {/* Consistent Cyan-to-Teal Progress Bar for all 4 factors */}
            <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full shadow-[0_0_10px_rgba(6,182,212,0.4)] transition-all duration-700 ease-out"
                style={{
                  width: animated ? `${factor.value}%` : '0%',
                }}
              />
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {factor.description}
            </p>
          </div>
        ))}
      </div>

      {/* Deterministic Decision Rationale Box */}
      <div className="bg-slate-950/60 rounded-2xl p-5 border border-slate-800/80 shadow-lg space-y-3.5">
        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
          Deterministic Decision Rationale
        </h4>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {criticality.rationale}
        </p>

        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          {criticality.scoring_factors.map((factor, idx) => (
            <div key={idx} className="flex items-start space-x-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{factor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
