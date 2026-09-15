import React from 'react';
import { GameState, Participant } from '../types';
import { Users, LogOut, Sparkles } from 'lucide-react';

interface StudentWaitingViewProps {
  gameState: GameState;
  participant: Participant | undefined;
  onLeave: () => void;
}

export const StudentWaitingView: React.FC<StudentWaitingViewProps> = ({
  gameState,
  participant,
  onLeave,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center flex-1 px-4 py-8">
      {/* Student Badge Card */}
      <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-sky-200 text-center mb-6">
        <div className="relative inline-block mb-3">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-sky-100 border-3 border-sky-300 flex items-center justify-center text-6xl shadow-inner mx-auto animate-bounce">
            {participant?.avatar || '🐳'}
          </div>
          <span className="absolute -bottom-2 -right-2 text-2xl animate-pulse">✨</span>
        </div>

        <h2 className="font-jua text-3xl sm:text-4xl text-slate-800 mb-1">
          환영해요, {participant?.name || '학생'}!
        </h2>
        <p className="font-gaegu text-xl text-sky-700 font-bold mb-5">
          선생님이 퀴즈를 시작하면 곧바로 문제가 나타납니다!
        </p>

        {/* Waiting pulse card */}
        <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 flex items-center justify-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full bg-sky-500 animate-ping" />
          <span className="font-jua text-lg text-sky-800">
            선생님의 시작 신호를 기다리는 중...
          </span>
        </div>

        {/* Other Joined Classmates */}
        <div className="border-t border-slate-100 pt-4 text-left">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Users className="w-4 h-4 text-sky-600" />
              <span>함께 참여한 친구들:</span>
            </div>
            <span className="text-xs font-bold bg-sky-100 text-sky-700 px-2.5 py-0.5 rounded-full">
              {gameState.participants.length} / {gameState.maxParticipants}명
            </span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
            {gameState.participants.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                  p.id === participant?.id
                    ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <span>{p.avatar}</span>
                <span>{p.name}</span>
                {p.id === participant?.id && <span className="text-[10px] bg-white/30 px-1 rounded-sm">나</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Change Name / Exit Button */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>이름 변경하기 / 나가기</span>
          </button>
        </div>
      </div>

      {/* Rules summary banner */}
      <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-sky-200 text-xs text-slate-600 w-full text-center space-y-1">
        <p className="font-bold text-sky-800">💡 퀴즈 규칙 안내</p>
        <p>• 기본 문제는 10점이며, 정답이 2개인 문제는 20점입니다!</p>
        <p>• 제한 시간은 20초이며, 빨간색 게이지가 하얀색으로 변하기 전에 맞춰야 해요!</p>
        <p>• 정답을 맞히면 귀여운 고래와 함께 시원한 물이 차오릅니다 🐳</p>
      </div>
    </div>
  );
};
