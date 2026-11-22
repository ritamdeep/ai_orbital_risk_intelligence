import React from 'react';
import { GlassCard } from '../common/GlassCard';

interface SatelliteHeroIllustrationProps {
  satelliteName: string;
}

export const SatelliteHeroIllustration: React.FC<SatelliteHeroIllustrationProps> = ({
  satelliteName,
}) => {
  return (
    <GlassCard className="relative w-full h-56 sm:h-64 overflow-hidden flex items-center justify-center select-none bg-gradient-to-b from-[#060c18]/80 via-[#091326]/75 to-[#0d1a33]/80">
      {/* Background Subtle Stars */}
      <div
        className="absolute inset-0 pointer-events-none opacity-45"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20px 30px, #ffffff, transparent),
            radial-gradient(1.5px 1.5px at 140px 70px, #38bdf8, transparent),
            radial-gradient(1px 1px at 260px 40px, #ffffff, transparent),
            radial-gradient(1.2px 1.2px at 380px 90px, #a5f3fc, transparent),
            radial-gradient(1px 1px at 520px 35px, #ffffff, transparent),
            radial-gradient(1.5px 1.5px at 640px 80px, #38bdf8, transparent)
          `,
          backgroundSize: '700px 150px',
        }}
      />

      {/* Earth Horizon Curvature & Atmosphere Glow at Bottom */}
      <div className="absolute -bottom-36 left-1/2 -translate-x-1/2 w-[140%] h-64 rounded-[100%] bg-gradient-to-t from-[#040814] via-[#081836] to-[#0f2b5c] pointer-events-none shadow-[0_-14px_50px_rgba(34,211,238,0.4)]">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-85 blur-[1px]" />
      </div>

      {/* Orbit Elliptical Arc */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <path
          d="M -50 180 Q 300 40 750 190"
          fill="none"
          stroke="rgba(56, 189, 248, 0.42)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <path
          d="M 50 190 Q 350 70 650 180"
          fill="none"
          stroke="rgba(34, 211, 238, 0.65)"
          strokeWidth="1"
        />
      </svg>

      {/* Central 3D Stylised Satellite Illustration */}
      <div className="relative z-10 w-80 sm:w-96 h-48 flex items-center justify-center filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.85)]">
        <svg viewBox="0 0 400 200" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="solarPanelGradLeft" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="25%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="solarPanelGradRight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="25%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="busBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="60%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>

            <linearGradient id="foilGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>
          </defs>

          {/* LEFT SOLAR ARRAY WING */}
          <g>
            <line x1="180" y1="95" x2="110" y2="75" stroke="#94a3b8" strokeWidth="3" />
            <polygon
              points="60,45 115,62 115,108 60,90"
              fill="url(#solarPanelGradLeft)"
              stroke="#60a5fa"
              strokeWidth="1.2"
            />
            <polygon
              points="118,63 172,80 172,126 118,109"
              fill="url(#solarPanelGradLeft)"
              stroke="#60a5fa"
              strokeWidth="1.2"
            />
            <line x1="60" y1="67" x2="115" y2="85" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
            <line x1="118" y1="86" x2="172" y2="103" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
            <line x1="88" y1="54" x2="88" y2="99" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
            <line x1="145" y1="72" x2="145" y2="118" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
          </g>

          {/* RIGHT SOLAR ARRAY WING */}
          <g>
            <line x1="220" y1="105" x2="290" y2="125" stroke="#94a3b8" strokeWidth="3" />
            <polygon
              points="228,88 282,105 282,151 228,134"
              fill="url(#solarPanelGradRight)"
              stroke="#60a5fa"
              strokeWidth="1.2"
            />
            <polygon
              points="285,106 340,123 340,169 285,152"
              fill="url(#solarPanelGradRight)"
              stroke="#60a5fa"
              strokeWidth="1.2"
            />
            <line x1="228" y1="111" x2="282" y2="128" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
            <line x1="285" y1="129" x2="340" y2="146" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
            <line x1="255" y1="96" x2="255" y2="142" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
            <line x1="312" y1="115" x2="312" y2="161" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
          </g>

          {/* SATELLITE MAIN BUS BODY */}
          <g id="satelliteBus">
            <polygon
              points="180,68 220,78 215,96 175,85"
              fill="url(#foilGrad)"
              stroke="#ca8a04"
              strokeWidth="1"
            />
            <polygon
              points="175,85 215,96 210,138 170,126"
              fill="url(#busBodyGrad)"
              stroke="#cbd5e1"
              strokeWidth="1.2"
            />
            <polygon
              points="215,96 230,86 225,126 210,138"
              fill="#475569"
              stroke="#334155"
              strokeWidth="1"
            />
            <ellipse cx="192" cy="108" rx="8" ry="12" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
            <circle cx="192" cy="108" r="4" fill="#0284c7" />
            <polygon points="186,132 196,135 194,146 188,144" fill="#64748b" stroke="#475569" />
            <line x1="202" y1="73" x2="206" y2="52" stroke="#e2e8f0" strokeWidth="1.8" />
            <circle cx="206" cy="52" r="2.5" fill="#38bdf8" />
          </g>
        </svg>
      </div>

      {/* Satellite Name Watermark Tag in Corner */}
      <div className="absolute top-3.5 right-4 pointer-events-none flex items-center space-x-1.5 font-sans text-[11px] font-medium text-cyan-200/90 bg-cyan-500/15 border border-cyan-400/30 px-3 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span>3D Telemetry Simulation: {satelliteName}</span>
      </div>
    </GlassCard>
  );
};
