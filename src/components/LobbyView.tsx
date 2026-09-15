import React, { useState, useEffect } from 'react';
import { GameState } from '../types';
import { Shield, User, ArrowRight, RefreshCw, AlertCircle, Info, KeyRound } from 'lucide-react';

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
  roomCode = '',
  onRoomCodeChange,
  onClearError,
}) => {
  const [studentName, setStudentName] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('whale_quiz_name') || '' : '';
  });
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('whale_quiz_avatar') || AVATARS[0] : AVATARS[0];
  });
  
  // If URL has ?room=, use it; otherwise start empty
  const hasUrlRoomCode = Boolean(roomCode && roomCode.trim());
  const [inputRoomCode, setInputRoomCode] = useState(roomCode || '');
  const [showRoomCodeInput, setShowRoomCodeInput] = useState(!hasUrlRoomCode);

  useEffect(() => {
    if (roomCode) {
      setInputRoomCode(roomCode);
      setShowRoomCodeInput(false);
    } else {
      setShowRoomCodeInput(true);
    }
  }, [roomCode]);

  const isFull = gameState.participants.length >= (gameState.maxParticipants || 30);
  const activeRoom = (hasUrlRoomCode && !showRoomCodeInput) ? roomCode.trim() : inputRoomCode.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRoom = activeRoom;
    if (!targetRoom) {
      return;
    }
    if (!studentName.trim() || isJoining || isFull) return;
    if (onRoomCodeChange && targetRoom !== roomCode) {
      onRoomCodeChange(targetRoom);
    }
    onJoinAsStudent(studentName.trim(), selectedAvatar, targetRoom);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center flex-1 px-4 py-4 sm:py-6">
      {/* Title Header */}
      <div className="text-center mb-4">
        <div className="relative inline-block">
          <span className="text-7xl sm:text-8xl filter drop-shadow-xl inline-block select-none transform hover:scale-105 transition-transform">
            🐳
          </span>
          <span className="absolute -top-1 -right-2 text-3xl animate-bounce">✨</span>
        </div>
        <h1 className="font-jua text-4xl sm:text-5xl text-sky-800 tracking-wide mt-1">
          하늘고래 퀴즈
        </h1>
        <p className="font-gaegu text-xl sm:text-2xl text-emerald-700 font-bold mt-0.5">
          실시간 초등 퀴즈 대결!
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-7 shadow-xl border-2 border-sky-200">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-sky-600" />
            <h2 className="font-jua text-2xl sm:text-3xl text-slate-800">학생 / 학부모 참여</h2>
          </div>
          {activeRoom && (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                isFull
                  ? 'bg-rose-100 text-rose-700 border-rose-300'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}
            >
              {gameState.participants.length} / {gameState.maxParticipants || 30}명
            </span>
          )}
        </div>

        {/* Room Code Section */}
        {hasUrlRoomCode && !showRoomCodeInput ? (
          /* When joined via QR or ?room= URL */
          <div className="mb-3 bg-sky-50/90 border border-sky-200 rounded-2xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-sky-500 text-white font-bold px-2.5 py-1 rounded-lg text-xs">
                참여 방 코드
              </span>
              <span className="font-bold text-sky-900 font-mono text-xl tracking-wider">
                {roomCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowRoomCodeInput(true)}
              className="text-xs text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer p-1"
            >
              방 번호 변경
            </button>
          </div>
        ) : (
          /* When opened without ?room= URL -> Prominently ask for the 4-digit code first */
          <div className="mb-4 p-3.5 bg-amber-50/90 border-2 border-amber-300 rounded-2xl space-y-2">
            <label htmlFor="input-room-code" className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-900">
              <KeyRound className="w-4 h-4 text-amber-700" />
              <span>선생님 화면의 방 코드 4자리를 입력해 주세요:</span>
            </label>
            <div className="flex gap-2">
              <input
                id="input-room-code"
                type="text"
                maxLength={6}
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value.trim())}
                placeholder="예: 6114"
                className="w-full min-h-[48px] px-4 py-2 rounded-xl border-2 border-amber-400 font-mono font-black text-2xl text-center tracking-widest uppercase focus:outline-none focus:border-amber-600 bg-white shadow-inner"
              />
            </div>
            <p className="text-[11px] text-amber-800">
              * 선생님 칠판이나 TV 화면 상단에 표시된 4자리 방 번호를 입력해 주세요.
            </p>
          </div>
        )}

        {/* Expandable Room Code Input when user clicks '방 번호 변경' */}
        {hasUrlRoomCode && showRoomCodeInput && (
          <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 animate-in fade-in">
            <label className="block text-xs font-bold text-slate-600">
              선생님 화면의 방 코드 4자리를 입력해 주세요:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value.trim())}
                placeholder="예: 6114"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono text-lg uppercase focus:outline-none focus:border-sky-500 bg-white"
              />
              <button
                type="button"
                onClick={() => {
                  if (onRoomCodeChange && inputRoomCode.trim()) {
                    onRoomCodeChange(inputRoomCode.trim());
                  }
                  setShowRoomCodeInput(false);
                }}
                className="min-h-[48px] px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold cursor-pointer"
              >
                적용
              </button>
            </div>
          </div>
        )}

        {/* Privacy Notice Required by User */}
        <div className="mb-3 p-2.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-2 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="leading-snug">
            <strong>개인정보 보호 안내:</strong> 실명(본명) 대신 재미있는 <strong>별명이나 아이 별명</strong>을 입력해 주세요!
          </span>
        </div>

        {/* Error Notification Banner */}
        {joinError && (
          <div className="mb-3.5 p-3.5 bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-2xl space-y-2 animate-bounce">
            <div className="flex items-start gap-2 font-bold text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <span>접속 오류</span>
            </div>
            <p className="text-xs sm:text-sm text-rose-700 leading-relaxed font-semibold">
              {joinError}
            </p>
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onClearError) onClearError();
                  if (studentName.trim() && activeRoom) {
                    onJoinAsStudent(studentName.trim(), selectedAvatar, activeRoom);
                  }
                }}
                className="min-h-[48px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>접속 다시 시도</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRoomCodeInput(true);
                  if (onClearError) onClearError();
                }}
                className="min-h-[48px] px-3 text-xs text-slate-600 hover:text-slate-900 underline font-semibold cursor-pointer"
              >
                방 코드 변경
              </button>
            </div>
          </div>
        )}

        {isFull ? (
          <div className="text-center py-6">
            <p className="font-jua text-2xl text-rose-600 mb-1">
              인원이 가득 찼습니다!
            </p>
            <p className="text-sm text-slate-600">
              최대 인원({gameState.maxParticipants || 30}명)이 모두 참여했습니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Avatar Selector - Large Touch Targets (min 48px) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                나만의 고래 캐릭터 고르기:
              </label>
              <div className="grid grid-cols-5 gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`min-h-[48px] h-12 rounded-2xl flex items-center justify-center text-2xl transition-all cursor-pointer ${
                      selectedAvatar === avatar
                        ? 'bg-sky-500 text-white scale-105 shadow-md ring-2 ring-sky-400'
                        : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            {/* Nickname Input - Large Height & Font */}
            <div>
              <label htmlFor="student-name-input" className="block text-xs font-bold text-slate-600 mb-1">
                별명 (닉네임):
              </label>
              <input
                id="student-name-input"
                type="text"
                required
                maxLength={10}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="예: 푸른고래, 씩씩이, 별이"
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-sky-50/70 border-2 border-sky-200 focus:border-sky-500 focus:bg-white focus:outline-none font-jua text-xl text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:text-sm"
              />
            </div>

            {/* Join Submit Button - Min 48px height, >= 18px font */}
            <button
              id="join-quiz-btn"
              type="submit"
              disabled={!studentName.trim() || !activeRoom || isJoining}
              className={`w-full min-h-[52px] py-3.5 px-6 rounded-2xl font-jua text-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
                !studentName.trim() || !activeRoom || isJoining
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-300/50 hover:shadow-xl'
              }`}
            >
              {isJoining ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>방 접속 확인 중...</span>
                </>
              ) : (
                <>
                  <span>{activeRoom ? `퀴즈 방(${activeRoom}) 참여하기` : '방 코드를 입력해 주세요'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Link to Teacher Mode */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-center">
          <button
            type="button"
            onClick={onEnterAsAdmin}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-700 transition-colors p-2 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>선생님이신가요? 선생님 모드로 전환 (PIN 필요)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
