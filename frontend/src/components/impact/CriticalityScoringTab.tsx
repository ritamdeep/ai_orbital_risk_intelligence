import React, { useEffect, useState } from 'react';
import { CriticalityAssessment } from '../../types/intelligence';
import { CheckCircle2 } from 'lucide-react';

interface CriticalityScoringTabProps {
  criticality: CriticalityAssessment;
}

export const CriticalityScoringTab: React.FC<CriticalityScoringTabProps> = ({ criticality }) => {
  const [animated, setAnimated] = useState(false);

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
    <div className="space-y-6">
      <div>
        <h3 className="type-card-title text-white">Explainable Criticality Assessment</h3>
        <p className="text-sm text-[#b4c6dc] mt-1">
          Evaluated against human life safety, disaster response dependencies, and national infrastructure value.
        </p>
      </div>

      {/* 2x2 Factor Cards Grid — Single Cohesive Cyan-to-Teal Bar Color Family */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {factors.map((factor) => (
          <div
            key={factor.id}
            className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-cyan-400/30 transition-all duration-200 space-y-3"
          >
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-sm font-sans font-semibold text-slate-100">
                {factor.label}
              </span>
              <span className="font-data text-cyan-300 font-semibold text-base text-glow-cyan">
                {factor.value}%
              </span>
            </div>

            <div className="w-full bg-white/[0.08] h-2.5 rounded-full overflow-hidden">
              <div
                className="progress-glow-fill h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: animated ? `${factor.value}%` : '0%' }}
              />
            </div>

            <p className="text-xs text-[#b4c6dc] leading-relaxed">{factor.description}</p>
          </div>
        ))}
      </div>

      {/* Deterministic Decision Rationale Box */}
      <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/[0.08] space-y-3.5">
        <h4 className="type-label text-cyan-300">Deterministic Decision Rationale</h4>
        <p className="type-body text-slate-200">{criticality.rationale}</p>

        <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
          {criticality.scoring_factors.map((factor, idx) => (
            <div key={idx} className="flex items-start space-x-2.5 text-sm text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{factor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
