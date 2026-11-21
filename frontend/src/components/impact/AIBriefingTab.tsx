import React from 'react';
import { OperatorAIBriefing } from '../../types/intelligence';
import { Sparkles, Info, ShieldCheck } from 'lucide-react';

interface AIBriefingTabProps {
  aiBriefing: OperatorAIBriefing | null;
  loading?: boolean;
}

export const AIBriefingTab: React.FC<AIBriefingTabProps> = ({ aiBriefing, loading }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header and Mandatory Fixed Caption */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <h3 className="text-base font-bold text-white tracking-wide">
              AI Decision-Support Executive Briefing
            </h3>
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 font-mono shadow-sm">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>AI-generated explanation</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">
            Natural language synthesis of orbital encounter mechanics + mission criticality.
          </p>
        </div>

        {aiBriefing && (
          <span className="text-[11px] text-slate-400 font-mono shrink-0">
            Synthesized at {aiBriefing.generated_at.replace('T', ' ').substring(0, 19)} UTC
          </span>
        )}
      </div>

      {/* Mandatory Fixed Caption Banner */}
      <div className="bg-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 flex items-start space-x-3 text-xs text-slate-300 shadow-lg">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-cyan-300">Decision-Support Guideline:</strong> Explanations support decision-making. They do not predict collisions.
        </p>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="h-4 bg-slate-800 rounded w-1/4" />
            <div className="h-3 bg-slate-800/80 rounded w-full" />
            <div className="h-3 bg-slate-800/80 rounded w-5/6" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800/80" />
            <div className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800/80" />
          </div>
        </div>
      ) : aiBriefing ? (
        <div className="space-y-5">
          {/* Executive Summary (Readable sans-serif) */}
          <div className="bg-slate-950/70 text-slate-200 p-5 rounded-2xl border border-slate-800/80 shadow-lg space-y-2">
            <div className="text-xs uppercase tracking-wider text-cyan-400 font-bold font-mono">
              Incident Executive Summary
            </div>
            <p className="font-sans text-sm sm:text-base leading-relaxed text-slate-200">
              {aiBriefing.executive_summary}
            </p>
          </div>

          {/* Two-Column Deep Dive */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-lg space-y-2">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                Physical Proximity & Kinetic Analysis
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                {aiBriefing.physical_encounter_analysis}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-lg space-y-2">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                Mission Vulnerability Analysis
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                {aiBriefing.mission_vulnerability_analysis}
              </p>
            </div>
          </div>

          {/* Recommended Actionable Procedures */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-lg space-y-3">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
              Recommended Actionable Procedures
            </h4>
            <div className="space-y-2.5">
              {aiBriefing.actionable_recommendations.map((rec, rIdx) => (
                <div
                  key={rIdx}
                  className="flex items-start space-x-3 text-xs sm:text-sm text-slate-200 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800"
                >
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {rIdx + 1}
                  </span>
                  <span className="leading-relaxed font-sans">{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scientific Notice */}
          <div className="text-xs text-slate-400 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 italic font-sans leading-relaxed">
            <strong className="text-slate-300 font-semibold font-mono not-italic">Scientific Notice:</strong>{' '}
            {aiBriefing.scientific_disclaimer}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800/80 shadow-lg text-xs space-y-2">
          <ShieldCheck className="w-8 h-8 text-cyan-400/60 mx-auto" />
          <p className="font-semibold text-slate-300">No active conjunction briefing loaded.</p>
          <p className="text-slate-500 max-w-md mx-auto">
            Briefings are automatically synthesized for screened close-approach events involving high-criticality assets.
          </p>
        </div>
      )}
    </div>
  );
};
