import React from 'react';

interface SkyWhaleBackgroundProps {
  children?: React.ReactNode;
}

export const SkyWhaleBackground: React.FC<SkyWhaleBackgroundProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-50 text-slate-800">
      {/* Sky & Clouds decorative layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Soft Sun/Sky Glow */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-sky-200/50 blur-3xl pointer-events-none" />

        {/* Fluffy Floating Clouds */}
        <div className="absolute top-8 left-12 opacity-80 animate-float" style={{ animationDuration: '7s' }}>
          <svg width="120" height="50" viewBox="0 0 120 50" fill="white" className="drop-shadow-sm">
            <path d="M20,40 Q10,40 10,30 Q10,18 25,18 Q30,8 45,10 Q58,2 75,8 Q90,5 95,20 Q110,22 108,35 Q105,40 95,40 Z" />
          </svg>
        </div>

        <div className="absolute top-24 right-16 opacity-70 animate-float" style={{ animationDuration: '9s', animationDelay: '1s' }}>
          <svg width="140" height="60" viewBox="0 0 140 60" fill="white" className="drop-shadow-sm">
            <path d="M25,50 Q12,50 12,38 Q12,22 30,22 Q38,10 55,12 Q70,4 90,10 Q108,6 115,25 Q130,28 128,45 Q125,50 115,50 Z" />
          </svg>
        </div>

        {/* Cute Flying Whales in the Sky */}
        <div className="absolute top-16 left-1/4 opacity-85 animate-whale-float">
          <svg width="90" height="60" viewBox="0 0 100 65" fill="none" className="drop-shadow-md">
            {/* Whale body */}
            <path
              d="M15,40 C15,20 35,10 65,15 C85,18 95,30 92,42 C90,48 80,50 60,50 C35,50 15,50 15,40 Z"
              fill="#38BDF8"
            />
            {/* Belly */}
            <path
              d="M30,42 C45,45 65,46 78,44 C72,50 55,51 35,50 C28,48 24,45 30,42 Z"
              fill="#E0F2FE"
            />
            {/* Tail */}
            <path
              d="M15,40 C10,35 2,28 3,22 C4,32 10,38 15,40 Z"
              fill="#0284C7"
            />
            <path
              d="M15,40 C8,45 2,52 4,58 C6,48 11,43 15,40 Z"
              fill="#0284C7"
            />
            {/* Fin */}
            <path
              d="M48,42 C52,48 58,52 64,48 C60,44 54,40 48,42 Z"
              fill="#0284C7"
            />
            {/* Eye */}
            <circle cx="75" cy="30" r="3" fill="#0F172A" />
            <circle cx="76" cy="29" r="1" fill="#FFFFFF" />
            {/* Blush */}
            <ellipse cx="78" cy="36" rx="4" ry="2" fill="#F472B6" opacity="0.6" />
            {/* Water Spout & Hearts */}
            <path d="M60,15 Q60,5 65,2 Q68,6 63,14 Z" fill="#7DD3FC" />
            <circle cx="68" cy="1" r="2" fill="#BAE6FD" />
            <circle cx="72" cy="4" r="1.5" fill="#BAE6FD" />
          </svg>
        </div>

        {/* Second smaller baby whale */}
        <div className="absolute top-44 right-28 opacity-75 animate-whale-float" style={{ animationDelay: '2s' }}>
          <svg width="60" height="40" viewBox="0 0 100 65" fill="none" className="drop-shadow-sm">
            <path
              d="M15,40 C15,20 35,10 65,15 C85,18 95,30 92,42 C90,48 80,50 60,50 C35,50 15,50 15,40 Z"
              fill="#60A5FA"
            />
            <path
              d="M30,42 C45,45 65,46 78,44 C72,50 55,51 35,50 C28,48 24,45 30,42 Z"
              fill="#EFF6FF"
            />
            <circle cx="75" cy="30" r="2.5" fill="#0F172A" />
            <ellipse cx="77" cy="35" rx="3" ry="1.5" fill="#F472B6" opacity="0.5" />
          </svg>
        </div>

        {/* Requested Feature: "소다가 담긴 컵도 배경에 넣어줘" (Cup filled with Soda with bubbles) */}
        <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-12 z-0 opacity-85 hover:opacity-100 transition-opacity">
          <div className="relative group cursor-pointer" title="시원하고 달콤한 청포도 소다 🥤">
            {/* Soda Cup SVG Graphic */}
            <svg width="110" height="150" viewBox="0 0 120 160" fill="none" className="drop-shadow-lg">
              {/* Cup Shadow */}
              <ellipse cx="60" cy="155" rx="40" ry="5" fill="#000000" opacity="0.1" />

              {/* Striped Straw */}
              <path
                d="M68,10 L78,65"
                stroke="#F43F5E"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M68,10 L78,65"
                stroke="#FFFFFF"
                strokeWidth="7"
                strokeDasharray="8 8"
                strokeLinecap="round"
              />

              {/* Glass Cup Body */}
              <path
                d="M25,35 L35,145 C36,150 45,152 60,152 C75,152 84,150 85,145 L95,35 Z"
                fill="url(#glassGradient)"
                stroke="#93C5FD"
                strokeWidth="2.5"
              />

              {/* Soda Liquid (Fizzy Blue Lagoon Soda) */}
              <path
                d="M28,55 Q60,50 92,55 L84,142 C83,148 75,150 60,150 C45,150 37,148 36,142 Z"
                fill="url(#sodaGradient)"
                opacity="0.85"
              />

              {/* Lemon Slice */}
              <circle cx="34" cy="48" r="14" fill="#FDE047" stroke="#EAB308" strokeWidth="2" />
              <circle cx="34" cy="48" r="10" fill="#FEF08A" />
              <path d="M34,38 L34,58 M24,48 L44,48 M27,41 L41,55 M27,55 L41,41" stroke="#F59E0B" strokeWidth="1" />

              {/* Ice cubes inside cup */}
              <rect x="42" y="65" width="16" height="16" rx="3" fill="#FFFFFF" opacity="0.45" />
              <rect x="58" y="85" width="15" height="15" rx="3" fill="#FFFFFF" opacity="0.4" />
              <rect x="40" y="105" width="17" height="15" rx="3" fill="#FFFFFF" opacity="0.35" />

              {/* Soda Bubbles */}
              <circle cx="50" cy="75" r="3" fill="#FFFFFF" opacity="0.8" className="animate-bubble-rise" />
              <circle cx="65" cy="110" r="2.5" fill="#FFFFFF" opacity="0.7" className="animate-bubble-rise" style={{ animationDelay: '1s' }} />
              <circle cx="45" cy="130" r="3.5" fill="#FFFFFF" opacity="0.6" className="animate-bubble-rise" style={{ animationDelay: '2s' }} />
              <circle cx="72" cy="70" r="2" fill="#FFFFFF" opacity="0.75" className="animate-bubble-rise" style={{ animationDelay: '0.5s' }} />
              <circle cx="56" cy="125" r="4" fill="#FFFFFF" opacity="0.5" className="animate-bubble-rise" style={{ animationDelay: '1.5s' }} />

              {/* Glass Highlight Shine */}
              <path
                d="M32,45 L39,140"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.6"
              />

              {/* Cute cup face */}
              <circle cx="53" cy="98" r="2" fill="#0369A1" />
              <circle cx="67" cy="98" r="2" fill="#0369A1" />
              <path d="M57,103 Q60,107 63,103" stroke="#0369A1" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <circle cx="49" cy="101" r="2" fill="#F43F5E" opacity="0.4" />
              <circle cx="71" cy="101" r="2" fill="#F43F5E" opacity="0.4" />

              <defs>
                <linearGradient id="glassGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="sodaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="50%" stopColor="#0EA5E9" />
                  <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
              </defs>
            </svg>

            {/* Little text badge below cup */}
            <div className="text-center mt-1">
              <span className="text-[11px] font-bold text-sky-700 bg-white/70 backdrop-blur-xs px-2 py-0.5 rounded-full border border-sky-200 shadow-2xs">
                시원한 소다 🥤
              </span>
            </div>
          </div>
        </div>

        {/* Requested Feature: "푸릇푸릇이랑" - Lush green leaves, plants, clovers */}
        <div className="absolute bottom-0 left-0 z-0 pointer-events-none">
          <svg width="240" height="120" viewBox="0 0 240 120" fill="none">
            {/* Green Hills */}
            <path d="M-20,120 Q50,70 140,110 Q200,100 260,120 Z" fill="#86EFAC" opacity="0.6" />
            <path d="M-10,120 Q60,85 180,120 Z" fill="#4ADE80" opacity="0.5" />

            {/* Clover & Leaves */}
            {/* Leaf 1 */}
            <path d="M30,95 C20,75 40,60 55,75 C70,90 40,115 30,95 Z" fill="#22C55E" />
            <path d="M32,95 L48,78" stroke="#16A34A" strokeWidth="1.5" />
            {/* Leaf 2 */}
            <path d="M55,90 C65,70 85,75 80,95 C75,115 50,110 55,90 Z" fill="#15803D" opacity="0.8" />
            {/* Cute Four-leaf clover */}
            <g transform="translate(100, 85) scale(0.7)">
              <circle cx="-6" cy="-6" r="8" fill="#16A34A" />
              <circle cx="6" cy="-6" r="8" fill="#16A34A" />
              <circle cx="-6" cy="6" r="8" fill="#16A34A" />
              <circle cx="6" cy="6" r="8" fill="#16A34A" />
              <path d="M0,0 Q5,20 2,28" stroke="#15803D" strokeWidth="2.5" fill="none" />
            </g>
            {/* Sprout */}
            <g transform="translate(150, 95) scale(0.8)">
              <path d="M0,20 Q0,0 -8,-5 Q-2,-12 0,0 Q2,-12 8,-5 Q0,0 0,20" fill="#4ADE80" />
            </g>
          </svg>
        </div>

        {/* Right side greenery */}
        <div className="absolute bottom-0 right-32 z-0 pointer-events-none hidden sm:block">
          <svg width="180" height="90" viewBox="0 0 180 90" fill="none">
            <path d="M30,90 C40,65 65,70 60,90 Z" fill="#86EFAC" />
            <path d="M70,90 C85,55 110,65 100,90 Z" fill="#22C55E" opacity="0.8" />
            <path d="M120,90 C130,70 150,75 145,90 Z" fill="#16A34A" opacity="0.7" />
          </svg>
        </div>
      </div>

      {/* Main App Content Container */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
};
