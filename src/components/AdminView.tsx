import React, { useState } from 'react';
import { GameState, QuizQuestion } from '../types';
import {
  Play,
  RotateCcw,
  SkipForward,
  Trophy,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Award,
  ChevronRight,
  Eye,
  Sliders,
  Sparkles,
  QrCode,
} from 'lucide-react';

interface AdminViewProps {
  gameState: GameState;
  onStartQuiz: () => void;
  onNextQuestion: () => void;
  onShowReview: () => void;
  onShowRanking: () => void;
  onResetQuiz: () => void;
  onSetTimeLimit: (seconds: number) => void;
  onKickParticipant: (id: string) => void;
  onSimulateStudent?: () => void;
  roomCode?: string;
  onRoomCodeChange?: (code: string) => void;
  transportMode?: string;
}

export const AdminView: React.FC<AdminViewProps> = ({
  gameState,
  onStartQuiz,
  onNextQuestion,
  onShowReview,
  onShowRanking,
  onResetQuiz,
  onSetTimeLimit,
  onKickParticipant,
  onSimulateStudent,
  roomCode = '1004',
  onRoomCodeChange,
  transportMode = 'p2p',
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [tempRoomCode, setTempRoomCode] = useState(roomCode);

  const currentQ: QuizQuestion | undefined = gameState.currentQuestion;
  
  // Create student join URL with room code embedded
  const currentUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    : '';

  // Sort participants by score descending
  const sortedParticipants = [...gameState.participants].sort((a, b) => b.score - a.score);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Calculate statistics for current question
  const totalStudents = gameState.participants.length;
  const answeredStudents = gameState.participants.filter(p => p.answeredCurrent).length;
  const correctStudents = gameState.participants.filter(p => p.isCorrect === true).length;
  const incorrectStudents = gameState.participants.filter(p => p.isCorrect === false).length;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col flex-1 px-4 py-4 sm:py-6">
      {/* Admin Top Banner */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-lg border-2 border-sky-200 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md text-2xl">
              🐳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-jua text-2xl text-slate-900">선생님 / 관리자 제어실</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {gameState.status === 'lobby' && '대기실 준비 중'}
                  {gameState.status === 'question' && `문제 진행 중 (${gameState.currentQuestionIndex + 1}/${gameState.totalQuestions})`}
                  {gameState.status === 'review' && '오답/해설 확인 중'}
                  {gameState.status === 'ranking' && '실시간 순위표 공개'}
                  {gameState.status === 'ended' && '퀴즈 종료'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                  방 코드: <strong className="font-mono text-sm">{roomCode}</strong>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  {transportMode === 'websocket' ? '⚡ 전용 웹소켓 서버' : '🌐 P2P 실시간 (Vercel 호환)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                학생들은 문제를 풀기만 하고, 선생님이 퀴즈 시작·문제 넘김·순위표를 제어합니다.
              </p>
            </div>
          </div>

          {/* Quick Actions & URL Sharing */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              id="copy-join-link-btn"
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 px-3 py-2 rounded-xl border border-sky-200 transition-colors cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '링크 복사됨!' : '참여 링크 복사'}</span>
            </button>

            <button
              id="toggle-qr-btn"
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="flex items-center gap-1 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl border border-slate-300 transition-colors cursor-pointer shadow-2xs"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-600" />
              <span>QR코드</span>
            </button>

            {onSimulateStudent && (
              <button
                id="simulate-student-btn"
                type="button"
                onClick={onSimulateStudent}
                disabled={gameState.participants.length >= gameState.maxParticipants}
                className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                title="시연 및 테스트를 위해 가상의 학생 1명을 참여시킵니다"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ 테스트 학생 추가</span>
              </button>
            )}
          </div>
        </div>

        {/* QR Code Popup / Collapsible Box */}
        {showQr && (
          <div className="mt-4 p-5 bg-gradient-to-br from-sky-50 to-indigo-50/50 rounded-2xl border-2 border-sky-200 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left animate-in fade-in">
            <div className="bg-white p-3.5 rounded-2xl border-2 border-sky-200 shadow-md shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}`}
                alt="학생 접속용 QR 코드"
                className="w-36 h-36 sm:w-40 sm:h-40"
                referrerPolicy="no-referrer"
              />
              <p className="text-[11px] font-bold text-sky-700 text-center mt-1.5">카메라로 스캔</p>
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold mb-2">
                <span>🔓 구글 로그인 없이 즉시 참가 가능</span>
              </div>
              <h4 className="font-jua text-xl text-slate-800 mb-1">
                태블릿 / 스마트폰 카메라로 QR을 스캔하세요!
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                학생들은 <strong>구글 계정이나 별도 로그인 없이</strong> 카메라로 QR을 비추면 바로 웹페이지가 열려 닉네임만 입력하고 참여할 수 있습니다.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs font-mono bg-white px-3 py-2 rounded-xl border border-slate-200 select-all text-slate-700 truncate shadow-2xs">
                  {currentUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                >
                  {copied ? '복사됨!' : '주소 복사'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Time Limit Setting:
            User Requirement: "문제를 풀 수 있는 시간은 제한적이되 조정할 수 있을 것" */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-600" />
            <span className="text-xs sm:text-sm font-bold text-slate-700">
              문제 제한 시간 설정 (현재: {gameState.timeLimit}초):
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[5, 10, 15, 20, 30].map(sec => (
              <button
                key={sec}
                id={`time-limit-btn-${sec}`}
                type="button"
                onClick={() => onSetTimeLimit(sec)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
      </div>

      {/* Main Control Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {gameState.status === 'lobby' ? (
          <button
            id="admin-start-btn"
            type="button"
            onClick={onStartQuiz}
            className="col-span-2 sm:col-span-2 py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-jua text-xl rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>퀴즈 시작하기 🚀</span>
          </button>
        ) : (
          <button
            id="admin-next-btn"
            type="button"
            onClick={onNextQuestion}
            disabled={gameState.status === 'ended'}
            className="col-span-2 sm:col-span-1 py-3.5 px-3 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-jua text-lg rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
          >
            <SkipForward className="w-5 h-5" />
            <span>다음 문제 ➡️</span>
          </button>
        )}

        <button
          id="admin-review-btn"
          type="button"
          onClick={onShowReview}
          disabled={gameState.status === 'lobby'}
          className="py-3.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-jua text-lg rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
        >
          <Eye className="w-5 h-5" />
          <span>정답/해설 공개</span>
        </button>

        <button
          id="admin-ranking-btn"
          type="button"
          onClick={onShowRanking}
          className="py-3.5 px-3 bg-purple-500 hover:bg-purple-600 text-white font-jua text-lg rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Trophy className="w-5 h-5" />
          <span>순위표 보기 🏆</span>
        </button>

        <button
          id="admin-reset-btn"
          type="button"
          onClick={onResetQuiz}
          className="py-3.5 px-3 bg-rose-500 hover:bg-rose-600 text-white font-jua text-lg rounded-2xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <RotateCcw className="w-5 h-5" />
          <span>퀴즈 초기화 🔄</span>
        </button>
      </div>

      {/* Center Display: Question & Live Response Progress */}
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

            {/* Answer Rate Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                제출 현황: {answeredStudents} / {totalStudents}명
              </span>
              {gameState.status === 'question' && (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full animate-pulse border border-rose-200">
                  남은 시간: {gameState.timeRemaining.toFixed(1)}초
                </span>
              )}
            </div>
          </div>

          <h3 className="font-jua text-xl sm:text-2xl text-slate-900 mb-4">
            {currentQ.question}
          </h3>

          {/* 4 Choices Admin Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {currentQ.options.map((option, idx) => {
              const shouldShowCorrect = (gameState.status === 'review' || gameState.revealAnswers);
              const isCorrect = shouldShowCorrect && currentQ.correctAnswers.includes(idx);
              const voteCount = gameState.participants.filter(p =>
                p.selectedAnswers.includes(idx)
              ).length;

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border-2 flex items-center justify-between ${
                    isCorrect
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm sm:text-base">{option}</span>
                    {isCorrect && (
                      <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">
                        정답 (◯)
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-bold bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                    {voteCount}명 선택
                  </span>
                </div>
              );
            })}
          </div>

          {/* Explanation if review */}
          {gameState.status === 'review' && currentQ.explanation && (
            <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-2xl text-sm text-sky-900 leading-relaxed font-sans">
              <span className="font-bold text-sky-700 mr-1">💡 정답 해설:</span>
              {currentQ.explanation}
            </div>
          )}
        </div>
      )}

      {/* Bottom Section: Live Ranking / Leaderboard & Participant Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Leaderboard Column (2 cols on large) */}
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

          {/* Top 3 Podium (if >= 3 participants) */}
          {sortedParticipants.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 text-center">
              {/* 2nd Place */}
              {sortedParticipants[1] ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-end">
                  <span className="text-2xl mb-1">{sortedParticipants[1].avatar}</span>
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
                  <span className="text-3xl mb-1">{sortedParticipants[0].avatar}</span>
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
                  <span className="text-2xl mb-1">{sortedParticipants[2].avatar}</span>
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
              sortedParticipants.map((p, idx) => (
                <div
                  key={p.id}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 text-center font-bold text-sm ${
                        idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-500' : idx === 2 ? 'text-orange-600' : 'text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xl">{p.avatar}</span>
                    <div>
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {!p.isOnline && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-sm">오프라인</span>
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
                    <span className="font-jua text-lg text-sky-600 font-bold">
                      {p.score}점
                    </span>
                    <button
                      type="button"
                      onClick={() => onKickParticipant(p.id)}
                      className="text-xs text-slate-400 hover:text-rose-600 p-1 rounded-sm cursor-pointer"
                      title="학생 내보내기"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Participant Roster & Status Column */}
        <div className="bg-white/95 rounded-3xl p-5 sm:p-6 shadow-md border-2 border-sky-100 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              <h3 className="font-jua text-xl text-slate-800">
                참여 학생 목록
              </h3>
            </div>
            {/* User Requirement: "최대 20명이 참여할 수 있을것" */}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
              {gameState.participants.length} / {gameState.maxParticipants}명
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            최대 20명의 학생이 각자의 태블릿이나 스마트폰으로 동시 접속할 수 있습니다.
          </p>

          <div className="flex-1 overflow-y-auto max-h-72 space-y-2 pr-1">
            {gameState.participants.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                참여 대기 중인 학생이 없습니다.
              </div>
            ) : (
              gameState.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50/70 border border-sky-100"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.avatar}</span>
                    <span className="text-xs font-bold text-slate-800">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-sky-700">{p.score}점</span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        p.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      title={p.isOnline ? '온라인' : '오프라인'}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
