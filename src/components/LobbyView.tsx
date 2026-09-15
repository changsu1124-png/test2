import React, { useState } from 'react';
import { GameState } from '../types';
import { Shield, User, ArrowRight, RefreshCw, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

interface LobbyViewProps {
  gameState: GameState;
  onJoinAsStudent: (name: string, avatar: string, customRoomCode?: string) => void;
  onEnterAsAdmin: () => void;
  isJoining?: boolean;
  joinError?: string | null;
  roomCode?: string;
  onRoomCodeChange?: (code: string) => void;
  onClearError?: () => void;
}

const AVATARS = ['🐳', '🐬', '🐋', '🦭', '🐧', '🐢', '🐙', '🐠', '🦀', '⭐'];

export const LobbyView: React.FC<LobbyViewProps> = ({
  gameState,
  onJoinAsStudent,
  onEnterAsAdmin,
  isJoining = false,
  joinError = null,
  roomCode = '1004',
  onRoomCodeChange,
  onClearError,
}) => {
  const [studentName, setStudentName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [inputRoomCode, setInputRoomCode] = useState(roomCode);
  const [showRoomCodeInput, setShowRoomCodeInput] = useState(false);

  const isFull = gameState.participants.length >= gameState.maxParticipants;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || isJoining || isFull) return;
    if (onRoomCodeChange && inputRoomCode.trim()) {
      onRoomCodeChange(inputRoomCode.trim());
    }
    onJoinAsStudent(studentName.trim(), selectedAvatar, inputRoomCode.trim() || roomCode);
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center flex-1 px-4 py-6 sm:py-8">
      {/* Cute Whale Title Header */}
      <div className="text-center mb-5">
        <div className="relative inline-block">
          <span className="text-7xl sm:text-8xl filter drop-shadow-xl animate-whale-float inline-block select-none">
            🐳
          </span>
          <span className="absolute -top-1 -right-2 text-3xl animate-pulse">✨</span>
        </div>
        <h1 className="font-jua text-4xl sm:text-5xl text-sky-800 tracking-wide mt-2">
          하늘고래 퀴즈
        </h1>
        <p className="font-gaegu text-xl sm:text-2xl text-emerald-700 font-bold mt-1">
          친구들과 함께 푸는 실시간 초등 퀴즈 대결!
        </p>
      </div>

      {/* Main Join Card */}
      <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-sky-200">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-sky-600" />
            <h2 className="font-jua text-2xl text-slate-800">학생 참여하기</h2>
          </div>
          {/* User Requirement: "최대 20명이 참여할 수 있을것" */}
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              isFull
                ? 'bg-rose-100 text-rose-700 border-rose-300'
                : 'bg-emerald-50 text-emerald-700 border-emerald-300'
            }`}
          >
            현재 {gameState.participants.length} / {gameState.maxParticipants}명
          </span>
        </div>

        {/* Room Code Badge / Customizer */}
        <div className="mb-4 bg-sky-50/80 border border-sky-200 rounded-2xl p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-sky-500 text-white font-bold px-2 py-0.5 rounded-md text-[11px]">
              참여 방
            </span>
            <span className="font-bold text-sky-900 font-mono text-sm tracking-wider">
              {inputRoomCode || roomCode}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowRoomCodeInput(!showRoomCodeInput)}
            className="text-[11px] text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer"
          >
            {showRoomCodeInput ? '닫기' : '방 코드 변경'}
          </button>
        </div>

        {/* Expandable Room Code Input */}
        {showRoomCodeInput && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">
              선생님 화면의 방 코드 입력:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputRoomCode}
                onChange={(e) => {
                  setInputRoomCode(e.target.value);
                  if (onRoomCodeChange) onRoomCodeChange(e.target.value);
                }}
                placeholder="예: 1004"
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:outline-none focus:border-sky-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowRoomCodeInput(false)}
                className="px-3 py-1.5 bg-sky-600 text-white rounded-xl text-xs font-bold"
              >
                확인
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              * QR코드로 접속한 경우 방 코드가 자동으로 설정되어 있습니다.
            </p>
          </div>
        )}

        {/* Error notification banner with solution */}
        {joinError && (
          <div className="mb-4 p-4 bg-rose-50 border-2 border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl space-y-2">
            <div className="flex items-start gap-2 font-bold text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <span>접속 안내</span>
            </div>
            <p className="leading-relaxed pl-7 text-xs text-rose-700">
              {joinError}
            </p>
            <div className="pl-7 pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onClearError) onClearError();
                  if (studentName.trim()) {
                    onJoinAsStudent(studentName.trim(), selectedAvatar, inputRoomCode || roomCode);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>다시 시도하기</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRoomCodeInput(true)}
                className="text-xs text-slate-600 hover:text-slate-800 underline font-semibold"
              >
                방 코드 확인
              </button>
            </div>
          </div>
        )}

        {isFull ? (
          <div className="text-center py-6">
            <p className="font-jua text-xl text-rose-600 mb-2">
              참여 인원이 마감되었습니다! (최대 20명)
            </p>
            <p className="text-xs text-slate-500">
              다음 퀴즈나 선생님의 초대를 기다려주세요.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                나만의 고래 캐릭터 고르기:
              </label>
              <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-xl transition-all cursor-pointer ${
                      selectedAvatar === avatar
                        ? 'bg-sky-500 text-white scale-110 shadow-md ring-2 ring-sky-300'
                        : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            {/* Nickname Input */}
            <div>
              <label htmlFor="student-name-input" className="block text-xs font-bold text-slate-600 mb-1.5">
                이름 또는 닉네임:
              </label>
              <input
                id="student-name-input"
                type="text"
                required
                maxLength={10}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="예: 박한결, 안유빈, 김민우"
                className="w-full px-4 py-3.5 rounded-2xl bg-sky-50/70 border-2 border-sky-200 focus:border-sky-500 focus:bg-white focus:outline-none font-jua text-xl text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:text-sm"
              />
            </div>

            {/* Join Submit Button with non-blocking loader */}
            <button
              id="join-quiz-btn"
              type="submit"
              disabled={!studentName.trim() || isJoining}
              className={`w-full py-4 rounded-2xl font-jua text-2xl tracking-wide text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                studentName.trim() && !isJoining
                  ? 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 active:scale-98 ring-2 ring-sky-300'
                  : isJoining
                  ? 'bg-sky-400 text-white cursor-wait animate-pulse'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isJoining ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>연결 확인 중... (잠시만 기다려주세요)</span>
                </>
              ) : (
                <>
                  <span>퀴즈 참가하기! 🚀</span>
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Admin Switcher */}
        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <button
            id="switch-admin-mode-btn"
            type="button"
            onClick={onEnterAsAdmin}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-700 px-3 py-1.5 rounded-full hover:bg-sky-50 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>선생님 / 퀴즈 관리자 화면으로 전환하기</span>
          </button>
        </div>
      </div>

      {/* Cute Info Badges */}
      <div className="mt-4 flex flex-wrap justify-center items-center gap-2 text-xs font-semibold text-slate-600">
        <span className="bg-emerald-50 text-emerald-800 backdrop-blur-xs px-3 py-1 rounded-full border border-emerald-300 shadow-2xs font-bold">
          🔓 로그인 필요 없음 (닉네임만 입력!)
        </span>
        <span className="bg-white/80 backdrop-blur-xs px-3 py-1 rounded-full border border-sky-200 shadow-2xs">
          🌐 Vercel/태블릿 완벽 호환
        </span>
        <span className="bg-white/80 backdrop-blur-xs px-3 py-1 rounded-full border border-sky-200 shadow-2xs">
          ⏱️ 기본 20초 제한
        </span>
        <span className="bg-white/80 backdrop-blur-xs px-3 py-1 rounded-full border border-sky-200 shadow-2xs">
          🐳 맞히면 고래와 물놀이!
        </span>
      </div>
    </div>
  );
};
