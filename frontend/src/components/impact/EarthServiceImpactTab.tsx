import React from 'react';
import { EarthServiceImpact } from '../../types/intelligence';
import { formatEnum } from '../../utils/textFormatters';
import { AlertOctagon, MapPin } from 'lucide-react';

interface EarthServiceImpactTabProps {
  earthImpact: EarthServiceImpact;
}

export const EarthServiceImpactTab: React.FC<EarthServiceImpactTabProps> = ({ earthImpact }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h3 className="text-base font-bold text-white tracking-wide">
          Downstream Earth-Level Service Impact
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Identifies concrete disruption to ground services if this orbital asset degrades or becomes unavailable.
        </p>
      </div>

      {/* Top 3-Column Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Severity & Lead Time */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-lg space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
            Degradation Severity
          </div>
          <div className="text-2xl font-extrabold font-mono text-rose-400 tracking-tight">
            {formatEnum(earthImpact.service_degradation_severity)}
          </div>
          <p className="text-xs text-slate-300">
            Lead time to ground disruption:{' '}
            <span className="font-bold font-mono text-cyan-300">
              {earthImpact.lead_time_to_impact_hours} hours
            </span>
          </p>
        </div>

        {/* Vulnerable Sectors */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-lg md:col-span-2 space-y-2.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
            Vulnerable Sectors
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {earthImpact.disrupted_sectors.map((sec, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-200 text-xs font-medium shadow-sm"
              >
                {sec}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Direct Consequences */}
      <div className="border border-slate-800/80 rounded-2xl p-5 bg-slate-950/60 shadow-lg space-y-3">
        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
          Immediate Operational Disruption
        </h4>
        <div className="space-y-2.5">
          {earthImpact.immediate_consequences.map((conseq, idx) => (
            <div key={idx} className="flex items-start space-x-2.5 text-xs text-slate-300 leading-relaxed">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{conseq}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regional Geographic Exposure */}
      <div className="border border-slate-800/80 rounded-2xl p-5 bg-slate-950/60 shadow-lg space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Geographic Exposure Zones</span>
        </h4>
        <div className="flex flex-wrap gap-2 pt-1">
          {earthImpact.regional_exposure.map((reg, idx) => (
            <span
              key={idx}
              className="px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-300 text-xs font-mono"
            >
              {reg}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
