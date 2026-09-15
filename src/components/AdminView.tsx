import React, { useState } from 'react';
import { GameState, QuizQuestion } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Play,
  RotateCcw,
  SkipForward,
  Trophy,
  Users,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Eye,
  Sliders,
  Sparkles,
  QrCode,
  PlusCircle,
  Trash2,
  Wifi,
  WifiOff,
  FolderOpen,
} from 'lucide-react';

interface AdminViewProps {
  gameState: GameState;
  onStartQuiz: () => void;
  onNextQuestion: () => void;
  onShowReview: () => void;
  onShowRanking: () => void;
  onResetQuiz: () => void;
  onSetTimeLimit: (seconds: number) => void;
  onSetMaxParticipants: (max: number) => void;
  onKickParticipant: (id: string) => void;
  onSimulateStudent?: () => void;
  onGenerateNewRoom: () => void;
  onChangeRoomCode?: (code: string) => void;
  onDeleteRoom: () => void;
  roomCode: string;
  isConnectedToDb: boolean;
  connectionDetail?: string;
}

export const AdminView: React.FC<AdminViewProps> = ({
  gameState,
  onStartQuiz,
  onNextQuestion,
  onShowReview,
  onShowRanking,
  onResetQuiz,
  onSetTimeLimit,
  onSetMaxParticipants,
  onKickParticipant,
  onSimulateStudent,
  onGenerateNewRoom,
  onChangeRoomCode,
  onDeleteRoom,
  roomCode,
  isConnectedToDb,
  connectionDetail,
}) => {
  const [copied, setCopied] = useState(false);
  const [showLargeQrModal, setShowLargeQrModal] = useState(false);
  const [isChangeRoomModalOpen, setIsChangeRoomModalOpen] = useState(false);
  const [changeRoomInput, setChangeRoomInput] = useState('');

  const currentQ: QuizQuestion | undefined = gameState.currentQuestion;

  // QR join URL is strictly pinned to production domain as requested
  const joinUrl = `https://test2-tawny-nu.vercel.app/?room=${roomCode}`;

  const shortUrlDisplay = `test2-tawny-nu.vercel.app/?room=${roomCode}`;

  // Sort participants by score descending
  const sortedParticipants = [...gameState.participants].sort((a, b) => b.score - a.score);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalStudents = gameState.participants.length;
  const answeredStudents = gameState.participants.filter((p) => p.answeredCurrent).length;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col flex-1 px-4 py-3 sm:py-5">
      {/* Top Header Card */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-sky-200 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md text-3xl">
              🐳
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-jua text-2xl sm:text-3xl text-slate-900">선생님 / 퀴즈 제어실</h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {gameState.status === 'lobby' && '대기실 준비 중'}
                  {gameState.status === 'question' && `문제 진행 중 (${gameState.currentQuestionIndex + 1}/${gameState.totalQuestions})`}
                  {gameState.status === 'review' && '정답 및 해설 공개 중'}
                  {gameState.status === 'ranking' && '실시간 순위표 발표'}
                  {gameState.status === 'ended' && '퀴즈 종료'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isConnectedToDb
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300'
                  }`}
                  title={connectionDetail}
                >
                  {isConnectedToDb ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Firebase 실시간 연결됨</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                      <span>연결 확인 중...</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <div className="flex items-center gap-2.5 bg-gradient-to-r from-sky-600 via-sky-700 to-blue-800 text-white px-5 py-2.5 rounded-2xl shadow-lg border-2 border-sky-300">
                  <span className="text-xs sm:text-sm font-bold text-sky-200 uppercase tracking-wide">
                    현재 방 코드:
                  </span>
                  <span className="font-mono font-black text-3xl sm:text-4xl text-amber-300 tracking-widest drop-shadow-sm">
                    {roomCode}
                  </span>
                </div>
                {onChangeRoomCode && (
                  <button
                    type="button"
                    onClick={() => {
                      setChangeRoomInput('');
                      setIsChangeRoomModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-white hover:bg-sky-50 text-sky-800 px-4 py-2.5 rounded-2xl border-2 border-sky-300 transition-colors shadow-xs cursor-pointer min-h-[44px]"
                    title="기존에 사용하던 방 코드를 직접 입력하여 불러옵니다"
                  >
                    <FolderOpen className="w-4 h-4 text-sky-600" />
                    <span>방 코드 변경 (기존 방 불러오기)</span>
                  </button>
                )}
                <div className="flex items-center gap-2 bg-sky-50 text-sky-900 px-4 py-2 rounded-2xl border border-sky-200 shadow-2xs">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span className="text-xs sm:text-sm font-semibold">
                    참여 학생 현황: <strong className="text-base text-sky-800 font-extrabold">{totalStudents}</strong> / {gameState.maxParticipants || 30}명
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 px-3.5 py-2.5 rounded-xl border border-sky-200 transition-colors cursor-pointer shadow-xs min-h-[44px]"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '링크 복사됨!' : '참여 주소 복사'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLargeQrModal(true)}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md min-h-[44px]"
            >
              <QrCode className="w-4 h-4" />
              <span>교실용 대형 QR 열기 (300px+)</span>
            </button>

            <button
              type="button"
              onClick={onGenerateNewRoom}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl border border-slate-300 transition-colors cursor-pointer min-h-[44px]"
              title="새로운 4자리 방 코드로 방을 다시 생성합니다 (이전 방 삭제)"
            >
              <PlusCircle className="w-4 h-4 text-slate-600" />
              <span>새 방 만들기</span>
            </button>

            {onSimulateStudent && (
              <button
                type="button"
                onClick={onSimulateStudent}
                disabled={gameState.participants.length >= (gameState.maxParticipants || 30)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 min-h-[44px]"
                title="시연을 위해 가상 학생 1명을 참여시킵니다"
              >
                <Sparkles className="w-4 h-4" />
                <span>+ 테스트 참가자</span>
              </button>
            )}
          </div>
        </div>

        {/* Big Classroom QR Display in Lobby Mode */}
        {gameState.status === 'lobby' && (
          <div className="mt-5 p-5 sm:p-6 bg-gradient-to-br from-sky-50 via-white to-blue-50/50 rounded-3xl border-2 border-sky-300 shadow-sm flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="bg-white p-5 rounded-3xl border-3 border-sky-400 shadow-lg shrink-0 flex flex-col items-center">
              <QRCodeSVG
                value={joinUrl}
                size={300}
                level="H"
                includeMargin={true}
                className="rounded-xl"
              />
              <div className="mt-3 text-center">
                <div className="text-xs font-bold text-slate-500">참여 방 코드</div>
                <div className="font-mono font-black text-4xl text-sky-800 tracking-widest">
                  {roomCode}
                </div>
              </div>
              <p className="font-jua text-sm text-sky-800 text-center mt-1">
                📸 기본 카메라 앱으로 비추면 즉시 참여!
              </p>
            </div>

            <div className="flex-1 max-w-lg space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm font-bold">
                <span>🔓 로그인 없이 닉네임만 적으면 즉시 참여</span>
              </div>

              <div>
                <h3 className="font-jua text-3xl sm:text-4xl text-slate-900 leading-tight">
                  휴대폰 카메라로 QR을 스캔하세요!
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  아이폰, 갤럭시, 카카오톡 카메라 등 어떤 기종이든 별도 앱 설치나 로그인 없이 바로 퀴즈에 참여합니다.
                </p>
              </div>

              {/* Huge Room Code & Direct URL for manual input */}
              <div className="p-4 bg-white rounded-2xl border-2 border-sky-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">카메라가 안 될 때 직접 입력:</span>
                  <span className="text-xs text-sky-700 font-bold">주소창에 입력</span>
                </div>
                <div className="font-mono text-sm sm:text-base font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl truncate">
                  {shortUrlDisplay}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-700">4자리 방 번호:</span>
                  <span className="font-mono text-4xl font-extrabold text-sky-600 tracking-wider">
                    {roomCode}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Setting Controls: Time Limit & Max Participants */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
          {/* Time Limit Setting */}
          <div className="flex items-center gap-2 flex-wrap">
            <Sliders className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-slate-700">
              문제 제한 시간 (현재: {gameState.timeLimit}초):
            </span>
            <div className="flex items-center gap-1.5">
              {[10, 15, 20, 30].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onSetTimeLimit(sec)}
                  className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                    gameState.timeLimit === sec
                      ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sec}초 {sec === 20 && '(기본)'}
                </button>
              ))}
            </div>
          </div>

          {/* Max Participants Setting */}
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-700">
              최대 인원 (현재: {gameState.maxParticipants || 30}명):
            </span>
            <div className="flex items-center gap-1.5">
              {[20, 30, 40, 50].map((max) => (
                <button
                  key={max}
                  type="button"
                  onClick={() => onSetMaxParticipants(max)}
                  className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                    (gameState.maxParticipants || 30) === max
                      ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {max}명 {max === 30 && '(기본)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Control Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {gameState.status === 'lobby' ? (
          <button
            id="admin-start-btn"
            type="button"
            onClick={onStartQuiz}
            className="col-span-2 sm:col-span-2 py-4 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-jua text-2xl rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 min-h-[56px]"
          >
            <Play className="w-6 h-6 fill-white" />
            <span>퀴즈 시작하기 🚀</span>
          </button>
        ) : (
          <button
            id="admin-next-btn"
            type="button"
            onClick={onNextQuestion}
            disabled={gameState.status === 'ended'}
            className="col-span-2 sm:col-span-1 py-4 px-3 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-jua text-xl rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 min-h-[56px]"
          >
            <SkipForward className="w-6 h-6" />
            <span>다음 문제 ➡️</span>
          </button>
        )}

        <button
          id="admin-review-btn"
          type="button"
          onClick={onShowReview}
          disabled={gameState.status === 'lobby'}
          className="py-4 px-3 bg-amber-500 hover:bg-amber-600 text-white font-jua text-xl rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 min-h-[56px]"
        >
          <Eye className="w-6 h-6" />
          <span>정답/해설 공개</span>
        </button>

        <button
          id="admin-ranking-btn"
          type="button"
          onClick={onShowRanking}
          className="py-4 px-3 bg-purple-500 hover:bg-purple-600 text-white font-jua text-xl rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[56px]"
        >
          <Trophy className="w-6 h-6" />
          <span>순위표 보기 🏆</span>
        </button>

        <button
          id="admin-reset-btn"
          type="button"
          onClick={onResetQuiz}
          className="py-4 px-3 bg-rose-500 hover:bg-rose-600 text-white font-jua text-xl rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[56px]"
        >
          <RotateCcw className="w-6 h-6" />
          <span>대기실로 복귀 🔄</span>
        </button>
      </div>

      {/* Center Question Display */}
      {currentQ && gameState.status !== 'lobby' && (
        <div className="bg-white/95 rounded-3xl p-6 shadow-md border-2 border-sky-100 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                {currentQ.category}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                문제 {gameState.currentQuestionIndex + 1} / {gameState.totalQuestions}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                제출 현황: {answeredStudents} / {totalStudents}명
              </span>
              {gameState.status === 'question' && (
                <span className="text-sm font-bold text-rose-600 bg-rose-50 px-3.5 py-1 rounded-full animate-pulse border border-rose-200">
                  남은 시간: {Math.max(0, Math.ceil(gameState.timeRemaining))}초
                </span>
              )}
            </div>
          </div>

          <h3 className="font-jua text-2xl sm:text-3xl text-slate-900 mb-4">
            {currentQ.question}
          </h3>

          {/* 4 Choices Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {currentQ.options.map((option, idx) => {
              const shouldShowCorrect = gameState.status === 'review' || gameState.revealAnswers;
              const isCorrect = shouldShowCorrect && currentQ.correctAnswers.includes(idx);
              const voteCount = gameState.participants.filter((p) =>
                p.selectedAnswers.includes(idx)
              ).length;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
                    isCorrect
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                        isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-base sm:text-lg">{option}</span>
                    {isCorrect && (
                      <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        정답 (◯)
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-bold bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
                    {voteCount}명 선택
                  </span>
                </div>
              );
            })}
          </div>

          {/* Explanation if review */}
          {gameState.status === 'review' && currentQ.explanation && (
            <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl text-sm text-sky-900 leading-relaxed font-sans">
              <span className="font-bold text-sky-700 mr-1">💡 정답 해설:</span>
              {currentQ.explanation}
            </div>
          )}
        </div>
      )}

      {/* Bottom Section: Live Ranking & Participant List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Leaderboard Column */}
        <div className="lg:col-span-2 bg-white/95 rounded-3xl p-5 sm:p-6 shadow-md border-2 border-sky-100 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="font-jua text-xl text-slate-800">
                실시간 순위표 (Leaderboard)
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              문제 풀이 후 자동 집계됩니다
            </span>
          </div>

          {/* Top 3 Podium */}
          {sortedParticipants.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 text-center">
              {/* 2nd Place */}
              {sortedParticipants[1] ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-end">
                  <span className="text-3xl mb-1">{sortedParticipants[1].avatar}</span>
                  <div className="text-xs font-bold text-slate-700 truncate w-full">
                    {sortedParticipants[1].name}
                  </div>
                  <div className="font-jua text-lg text-slate-600 mt-0.5">
                    {sortedParticipants[1].score}점
                  </div>
                  <div className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold mt-1">
                    🥈 2등
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-2xl p-3 flex items-center justify-center text-xs text-slate-400">
                  2등 대기 중
                </div>
              )}

              {/* 1st Place */}
              {sortedParticipants[0] ? (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 flex flex-col items-center justify-end shadow-sm -translate-y-1">
                  <div className="text-amber-500 text-lg">👑</div>
                  <span className="text-4xl mb-1">{sortedParticipants[0].avatar}</span>
                  <div className="text-sm font-bold text-slate-800 truncate w-full">
                    {sortedParticipants[0].name}
                  </div>
                  <div className="font-jua text-xl text-amber-600 mt-0.5">
                    {sortedParticipants[0].score}점
                  </div>
                  <div className="text-xs bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-full font-bold mt-1 shadow-2xs">
                    🥇 1등
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-2xl p-3 flex items-center justify-center text-xs text-slate-400">
                  1등 대기 중
                </div>
              )}

              {/* 3rd Place */}
              {sortedParticipants[2] ? (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 flex flex-col items-center justify-end">
                  <span className="text-3xl mb-1">{sortedParticipants[2].avatar}</span>
                  <div className="text-xs font-bold text-slate-700 truncate w-full">
                    {sortedParticipants[2].name}
                  </div>
                  <div className="font-jua text-lg text-orange-700 mt-0.5">
                    {sortedParticipants[2].score}점
                  </div>
                  <div className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-bold mt-1">
                    🥉 3등
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-2xl p-3 flex items-center justify-center text-xs text-slate-400">
                  3등 대기 중
                </div>
              )}
            </div>
          )}

          {/* Full Participant Ranking List */}
          <div className="overflow-y-auto max-h-72 divide-y divide-slate-100">
            {sortedParticipants.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                아직 참여한 학생이 없습니다. 참여 링크나 QR 코드를 공유해주세요!
              </div>
            ) : (
              sortedParticipants.map((p, idx) => {
                const isConnected = p.isOnline;
                return (
                  <div
                    key={p.id}
                    className={`py-2.5 flex items-center justify-between px-2 rounded-xl transition-colors ${
                      isConnected ? 'hover:bg-slate-50' : 'bg-slate-100/80 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 text-center font-bold text-sm ${
                          idx === 0
                            ? 'text-amber-500'
                            : idx === 1
                            ? 'text-slate-500'
                            : idx === 2
                            ? 'text-orange-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className={`text-xl ${!isConnected ? 'grayscale opacity-60' : ''}`}>
                        {p.avatar}
                      </span>
                      <div>
                        <div className="font-bold text-sm flex items-center gap-1.5">
                          <span className={isConnected ? 'text-slate-800' : 'text-slate-500'}>
                            {p.name}
                          </span>
                          {!isConnected && (
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">
                              접속 끊김
                            </span>
                          )}
                        </div>
                      {gameState.status !== 'lobby' && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          {p.answeredCurrent ? (
                            p.isCorrect ? (
                              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> 정답 (+{p.pointsEarned}점)
                              </span>
                            ) : (
                              <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                <XCircle className="w-3 h-3" /> 오답
                              </span>
                            )
                          ) : (
                            <span className="text-amber-600">고민 중...</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-jua text-xl text-sky-600 font-bold">
                      {p.score}점
                    </span>
                    <button
                      type="button"
                      onClick={() => onKickParticipant(p.id)}
                      className="text-xs text-slate-400 hover:text-rose-600 p-1 rounded-sm cursor-pointer"
                      title="참가자 내보내기"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Participant Roster & Room Control */}
        <div className="bg-white/95 rounded-3xl p-5 sm:p-6 shadow-md border-2 border-sky-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600" />
                <h3 className="font-jua text-xl text-slate-800">
                  참여 학생 현황
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                {gameState.participants.length} / {gameState.maxParticipants || 30}명
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              각자의 스마트폰으로 로그인 없이 참가한 학생들의 실시간 접속 상태입니다.
            </p>

            <div className="overflow-y-auto max-h-60 space-y-2 pr-1">
              {gameState.participants.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  참여 대기 중인 학생이 없습니다.
                </div>
              ) : (
                gameState.participants.map((p) => {
                  const isConnected = p.isOnline;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                        isConnected
                          ? 'bg-sky-50/80 border-sky-100 text-slate-800'
                          : 'bg-slate-100/90 border-slate-200 text-slate-400 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xl ${!isConnected ? 'grayscale opacity-60' : ''}`}>
                          {p.avatar}
                        </span>
                        <span className={`text-xs font-bold ${isConnected ? 'text-slate-800' : 'text-slate-500'}`}>
                          {p.name}
                        </span>
                        {!isConnected && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">
                            접속 끊김
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isConnected ? 'text-sky-700' : 'text-slate-400'}`}>
                          {p.score}점
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                          title={isConnected ? '온라인 (접속 중)' : '접속 끊김 (오프라인)'}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onDeleteRoom}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>현재 방 데이터 즉시 삭제 (초기화)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Big QR Modal */}
      {showLargeQrModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center border-4 border-sky-400 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-jua text-2xl text-slate-900">
                📸 스마트폰 카메라로 QR 스캔
              </h3>
              <button
                type="button"
                onClick={() => setShowLargeQrModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-sky-50 p-4 rounded-3xl border-2 border-sky-200 inline-block">
              <QRCodeSVG
                value={joinUrl}
                size={340}
                level="H"
                includeMargin={true}
                className="rounded-xl shadow-md"
              />
              <div className="mt-3 text-center">
                <div className="text-xs font-bold text-slate-500">참여 방 코드</div>
                <div className="font-mono font-black text-5xl text-sky-800 tracking-widest">
                  {roomCode}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl truncate">
                {shortUrlDisplay}
              </p>
              <p className="text-xs text-slate-500">
                구글 로그인 없이 휴대폰 기본 카메라 앱으로 QR을 비추면 바로 참가합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowLargeQrModal(false)}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-jua text-xl rounded-2xl cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Modal for Changing/Loading Room Code */}
      {isChangeRoomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border-2 border-sky-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-sky-600" />
                <h3 className="font-jua text-xl text-slate-800">
                  기존 방 코드 불러오기
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsChangeRoomModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600">
              이전에 생성한 퀴즈 방 코드(예: 1004)를 입력하면 해당 방으로 즉시 전환하여 학부모/학생들과 동기화합니다.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                불러올 방 코드 (4자리):
              </label>
              <input
                type="text"
                maxLength={6}
                value={changeRoomInput}
                onChange={(e) => setChangeRoomInput(e.target.value.trim())}
                placeholder="예: 1004"
                className="w-full min-h-[48px] px-4 py-2 rounded-xl border-2 border-sky-300 font-mono font-black text-2xl text-center tracking-widest uppercase focus:outline-none focus:border-sky-500 bg-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsChangeRoomModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm cursor-pointer hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!changeRoomInput.trim()}
                onClick={() => {
                  if (onChangeRoomCode && changeRoomInput.trim()) {
                    onChangeRoomCode(changeRoomInput.trim());
                  }
                  setIsChangeRoomModalOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm cursor-pointer disabled:opacity-50"
              >
                방 불러오기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
