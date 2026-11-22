import React from 'react';
import { EarthServiceImpact } from '../../types/intelligence';
import { formatEnum } from '../../utils/textFormatters';
import { AlertOctagon, MapPin } from 'lucide-react';

interface EarthServiceImpactTabProps {
  earthImpact: EarthServiceImpact;
}

export const EarthServiceImpactTab: React.FC<EarthServiceImpactTabProps> = ({ earthImpact }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="type-card-title text-white">Downstream Earth-Level Service Impact</h3>
        <p className="text-sm text-[#b4c6dc] mt-1">
          Identifies concrete disruption to ground services if this orbital asset degrades or becomes unavailable.
        </p>
      </div>

      {/* Top 3-Column Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Severity & Lead Time */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-rose-400/25 shadow-glow-red space-y-2">
          <div className="type-label">Degradation Severity</div>
          <div className="font-display text-2xl font-bold text-rose-300 text-glow-red tracking-[-0.02em]">
            {formatEnum(earthImpact.service_degradation_severity)}
          </div>
          <p className="text-sm text-[#b4c6dc]">
            Lead time to ground disruption:{' '}
            <span className="font-semibold font-data text-cyan-300">
              {earthImpact.lead_time_to_impact_hours} hours
            </span>
          </p>
        </div>

        {/* Vulnerable Sectors */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] md:col-span-2 space-y-3">
          <div className="type-label">Vulnerable Sectors</div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {earthImpact.disrupted_sectors.map((sec, idx) => (
              <span
                key={idx}
                className="px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/15 text-slate-100 text-xs sm:text-sm font-sans font-medium"
              >
                {sec}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Direct Consequences */}
      <div className="border border-white/[0.08] rounded-2xl p-5 bg-white/[0.03] space-y-3.5">
        <h4 className="type-label text-cyan-300">Immediate Operational Disruption</h4>
        <div className="space-y-2.5">
          {earthImpact.immediate_consequences.map((conseq, idx) => (
            <div
              key={idx}
              className="flex items-start space-x-2.5 text-sm text-slate-200 leading-relaxed"
            >
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-1" />
              <span>{conseq}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regional Geographic Exposure */}
      <div className="border border-white/[0.08] rounded-2xl p-5 bg-white/[0.03] space-y-3.5">
        <h4 className="type-label flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Geographic Exposure Zones</span>
        </h4>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {earthImpact.regional_exposure.map((reg, idx) => (
            <span
              key={idx}
              className="px-3.5 py-1.5 rounded-2xl bg-white/[0.05] border border-white/10 text-slate-100 text-xs sm:text-sm font-sans font-medium"
            >
              {reg}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
