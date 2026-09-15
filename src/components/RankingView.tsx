import React from 'react';
import { GameState, Participant } from '../types';
import { Trophy, Award, RotateCcw, ArrowLeft, Star } from 'lucide-react';

interface RankingViewProps {
  gameState: GameState;
  onBackToGame?: () => void;
  onResetQuiz?: () => void;
  isAdmin?: boolean;
}

export const RankingView: React.FC<RankingViewProps> = ({
  gameState,
  onBackToGame,
  onResetQuiz,
  isAdmin = false,
}) => {
  const sorted = [...gameState.participants].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col flex-1 px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-400 text-white shadow-lg text-3xl mb-2">
          🏆
        </div>
        <h1 className="font-jua text-4xl sm:text-5xl text-slate-900 tracking-wide">
          {gameState.status === 'ended' ? '최종 퀴즈 순위표' : '실시간 퀴즈 순위표'}
        </h1>
        <p className="font-gaegu text-xl sm:text-2xl text-emerald-700 font-bold mt-1">
          {gameState.status === 'ended'
            ? '모든 문제를 마쳤습니다! 멋지게 참여한 학생 모두 축하합니다 🐳'
            : `현재 문제 ${gameState.currentQuestionIndex + 1} 진행 후 중간 순위입니다.`}
        </p>
      </div>

      {/* Top 3 Podium */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          {/* 2nd Place */}
          <div className="flex flex-col items-center justify-end">
            {sorted[1] ? (
              <div className="w-full bg-white/95 rounded-3xl p-4 border-2 border-slate-300 shadow-md text-center flex flex-col items-center">
                <span className="text-3xl mb-1">{sorted[1].avatar}</span>
                <span className="font-bold text-sm text-slate-800 truncate w-full">
                  {sorted[1].name}
                </span>
                <span className="font-jua text-xl text-slate-700 mt-0.5">
                  {sorted[1].score}점
                </span>
                <span className="mt-2 bg-slate-200 text-slate-700 px-3 py-0.5 rounded-full text-xs font-bold shadow-2xs">
                  🥈 2위
                </span>
              </div>
            ) : null}
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center justify-end -translate-y-2">
            {sorted[0] ? (
              <div className="w-full bg-gradient-to-b from-amber-50 to-white rounded-3xl p-5 border-3 border-amber-400 shadow-xl text-center flex flex-col items-center">
                <div className="text-2xl mb-1 animate-bounce">👑</div>
                <span className="text-4xl mb-1">{sorted[0].avatar}</span>
                <span className="font-bold text-base text-slate-900 truncate w-full">
                  {sorted[0].name}
                </span>
                <span className="font-jua text-2xl text-amber-600 mt-0.5">
                  {sorted[0].score}점
                </span>
                <span className="mt-2 bg-amber-400 text-slate-950 px-3.5 py-1 rounded-full text-xs font-bold shadow-xs">
                  🥇 1위 우승!
                </span>
              </div>
            ) : null}
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center justify-end">
            {sorted[2] ? (
              <div className="w-full bg-white/95 rounded-3xl p-4 border-2 border-orange-200 shadow-md text-center flex flex-col items-center">
                <span className="text-3xl mb-1">{sorted[2].avatar}</span>
                <span className="font-bold text-sm text-slate-800 truncate w-full">
                  {sorted[2].name}
                </span>
                <span className="font-jua text-xl text-orange-700 mt-0.5">
                  {sorted[2].score}점
                </span>
                <span className="mt-2 bg-orange-200 text-orange-800 px-3 py-0.5 rounded-full text-xs font-bold shadow-2xs">
                  🥉 3위
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Full Leaderboard List */}
      <div className="bg-white/95 rounded-3xl p-5 sm:p-7 shadow-lg border-2 border-sky-100 flex-1 overflow-hidden flex flex-col mb-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <span className="text-xs font-bold text-slate-500">순위 및 학생명</span>
          <span className="text-xs font-bold text-slate-500">누적 점수</span>
        </div>

        <div className="overflow-y-auto max-h-80 divide-y divide-slate-100 pr-1">
          {sorted.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              참여한 학생이 없습니다.
            </div>
          ) : (
            sorted.map((p, idx) => (
              <div
                key={p.id}
                className="py-3 flex items-center justify-between hover:bg-sky-50/50 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 text-center font-bold text-sm ${
                      idx === 0
                        ? 'text-amber-500 font-extrabold text-base'
                        : idx === 1
                        ? 'text-slate-500 font-bold'
                        : idx === 2
                        ? 'text-orange-600 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-2xl">{p.avatar}</span>
                  <div>
                    <span className="font-bold text-slate-800 text-base">{p.name}</span>
                    {p.isCorrect && (
                      <span className="ml-2 text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                        +{p.pointsEarned}점
                      </span>
                    )}
                  </div>
                </div>

                <div className="font-jua text-xl text-sky-600 font-bold">
                  {p.score}점
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onBackToGame && (
          <button
            type="button"
            onClick={onBackToGame}
            className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-jua text-lg shadow-md cursor-pointer transition-all active:scale-98"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>문제로 돌아가기</span>
          </button>
        )}

        {isAdmin && onResetQuiz && (
          <button
            type="button"
            onClick={onResetQuiz}
            className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-jua text-lg shadow-md cursor-pointer transition-all active:scale-98"
          >
            <RotateCcw className="w-5 h-5" />
            <span>퀴즈 다시 시작하기 (초기화)</span>
          </button>
        )}
      </div>
    </div>
  );
};
