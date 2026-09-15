import React from 'react';
import { Timer } from 'lucide-react';

interface TimerGaugeBarProps {
  timeRemaining: number;
  timeLimit: number;
  isActive: boolean;
}

export const TimerGaugeBar: React.FC<TimerGaugeBarProps> = ({
  timeRemaining,
  timeLimit,
  isActive,
}) => {
  const safeLimit = Math.max(timeLimit, 1);
  const remaining = Math.max(0, Math.min(timeRemaining, safeLimit));
  // percentage of time elapsed (0% when starting, 100% when 0s remains)
  const elapsedPercent = Math.min(100, Math.max(0, ((safeLimit - remaining) / safeLimit) * 100));
  // remaining percent (100% at start, 0% at end)
  const remainingPercent = 100 - elapsedPercent;

  return (
    <div className="w-full max-w-2xl mx-auto my-2 px-2">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 bg-white/80 backdrop-blur-xs px-3 py-1 rounded-full border border-sky-200 shadow-2xs">
          <Timer className="w-4 h-4 text-red-500 animate-spin" style={{ animationDuration: '3s' }} />
          <span>남은 시간</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-jua text-base sm:text-lg font-bold text-red-600 bg-white/90 px-3 py-0.5 rounded-full border border-red-200 shadow-2xs">
            {remaining.toFixed(1)}초
          </span>
          <span className="text-xs text-slate-500">/ {timeLimit}초</span>
        </div>
      </div>

      {/* 
        User Requirement: 
        "참고로 시간이 가는건 빨간색 게이지바가 점점 하얀색으로 변해"
        Red gauge bar gradually turning white as time elapses!
      */}
      <div className="relative h-6 sm:h-7 w-full rounded-full overflow-hidden p-0.5 bg-slate-200/80 border-2 border-red-300 shadow-inner">
        {/* Base Red Gauge Bar */}
        <div className="absolute inset-0.5 rounded-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500 overflow-hidden shadow-xs">
          {/* White Fill spreading from left to right as time passes, turning the red bar white */}
          <div
            className="absolute inset-y-0 left-0 bg-white/95 transition-[width] duration-100 ease-linear shadow-md"
            style={{ width: `${elapsedPercent}%` }}
          />

          {/* Shimmer / Bubble line effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
        </div>

        {/* Small center percentage indicator for accessibility */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className={`text-[11px] font-bold tracking-tight px-2 py-0.5 rounded-full ${
              elapsedPercent > 50 ? 'text-red-700' : 'text-white drop-shadow-xs'
            }`}
          >
            {remainingPercent > 0 ? `${Math.round(remainingPercent)}%` : '시간 종료!'}
          </span>
        </div>
      </div>
    </div>
  );
};
