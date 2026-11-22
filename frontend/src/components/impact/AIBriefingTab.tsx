import React from 'react';
import { OperatorAIBriefing } from '../../types/intelligence';
import { Sparkles, Info, ShieldCheck, RefreshCw } from 'lucide-react';

interface AIBriefingTabProps {
  aiBriefing: OperatorAIBriefing | null;
  loading?: boolean;
  onRetry?: () => void;
}

export const AIBriefingTab: React.FC<AIBriefingTabProps> = ({ aiBriefing, loading, onRetry }) => {
  return (
    <div className="space-y-6">
      {/* Header and Mandatory Fixed Caption */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="type-card-title text-white">AI Decision-Support Executive Briefing</h3>
            <span className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-violet-500/15 text-violet-200 border border-violet-400/45 shadow-glow-violet">
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              <span>
                {aiBriefing?.generatedBy === 'llm'
                  ? 'LLM Neural Briefing'
                  : 'Rule-Based Synthesis'}
              </span>
            </span>
            {aiBriefing?.dataSource === 'mock' && (
              <span className="text-xs text-[#94adc9] font-sans italic">
                Mock data. Illustrative values.
              </span>
            )}
          </div>
          <p className="text-sm text-[#b4c6dc] mt-1 font-sans">
            Natural language synthesis of orbital encounter mechanics + mission criticality.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {aiBriefing && (
            <span className="text-xs text-[#94adc9] font-sans">
              Synthesized at{' '}
              <span className="font-data text-slate-200">
                {aiBriefing.generated_at.replace('T', ' ').substring(0, 19)} UTC
              </span>
            </span>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl text-xs font-sans font-medium bg-white/[0.06] border border-white/15 hover:border-violet-400/50 hover:shadow-glow-violet text-slate-100 hover:text-white transition-all disabled:opacity-50"
              title="Re-synthesize briefing"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-300' : ''}`}
              />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Fixed Caption Banner */}
      <div className="bg-violet-500/[0.08] border border-violet-400/30 rounded-2xl p-4 flex items-start space-x-3 text-sm text-slate-200">
        <Info className="w-4 h-4 text-violet-300 shrink-0 mt-1" />
        <p className="leading-relaxed">
          <strong className="text-violet-200 font-semibold">Decision-Support Guideline:</strong> Explanations support decision-making. They do not predict collisions.
        </p>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
            <div className="h-4 bg-white/10 rounded w-1/4" />
            <div className="h-3 bg-white/[0.07] rounded w-full" />
            <div className="h-3 bg-white/[0.07] rounded w-5/6" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-28 rounded-2xl bg-white/[0.03] border border-white/[0.08]" />
            <div className="h-28 rounded-2xl bg-white/[0.03] border border-white/[0.08]" />
          </div>
        </div>
      ) : aiBriefing ? (
        <div className="space-y-5">
          {/* Executive Summary */}
          <div className="bg-white/[0.035] text-slate-100 p-5 rounded-2xl border border-white/10 space-y-2">
            <div className="type-label text-violet-300">Incident Executive Summary</div>
            <p className="type-body text-slate-100">{aiBriefing.executive_summary}</p>
          </div>

          {/* Two-Column Deep Dive */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="type-label text-cyan-300">
                Physical Proximity & Kinetic Analysis
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                {aiBriefing.physical_encounter_analysis}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="type-label text-violet-300">Mission Vulnerability Analysis</div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                {aiBriefing.mission_vulnerability_analysis}
              </p>
            </div>
          </div>

          {/* Service Impact & Continuity Plan */}
          {aiBriefing.service_continuity_plan && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="type-label text-cyan-300">
                Service Continuity & Redundancy Strategy
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                {aiBriefing.service_continuity_plan}
              </p>
            </div>
          )}

          {/* Recommended Actionable Procedures */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
            <h4 className="type-label text-cyan-300">Recommended Actionable Procedures</h4>
            <div className="space-y-2.5">
              {aiBriefing.actionable_recommendations.map((rec, rIdx) => (
                <div
                  key={rIdx}
                  className="flex items-start space-x-3 text-sm text-slate-100 bg-white/[0.035] p-3.5 rounded-2xl border border-white/[0.08]"
                >
                  <span className="w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-400/45 text-cyan-200 font-data font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-glow-cyan">
                    {rIdx + 1}
                  </span>
                  <span className="leading-relaxed font-sans">{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scientific Notice */}
          <div className="text-xs sm:text-sm text-[#b4c6dc] bg-white/[0.025] p-4 rounded-2xl border border-white/[0.08] italic font-sans leading-relaxed">
            <strong className="text-slate-100 font-semibold not-italic">Scientific Notice:</strong>{' '}
            {aiBriefing.scientific_disclaimer}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-[#b4c6dc] bg-white/[0.03] rounded-2xl border border-white/[0.08] text-sm space-y-2.5">
          <ShieldCheck className="w-8 h-8 text-violet-300/80 mx-auto" />
          <p className="font-semibold text-slate-100">No active conjunction briefing loaded.</p>
          <p className="text-[#94adc9] max-w-md mx-auto">
            Briefings are automatically synthesized for screened close-approach events involving high-criticality assets.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn-primary-glow mt-3 px-5 py-2 rounded-2xl text-sm"
            >
              Generate Briefing
            </button>
          )}
        </div>
      )}
    </div>
  );
};
