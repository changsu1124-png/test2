import React, { useState, useEffect } from 'react';
import { SkyWhaleBackground } from './components/SkyWhaleBackground';
import { StudentQuizView } from './components/StudentQuizView';
import { StudentWaitingView } from './components/StudentWaitingView';
import { AdminView } from './components/AdminView';
import { LobbyView } from './components/LobbyView';
import { RankingView } from './components/RankingView';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { useQuizRoom } from './hooks/useQuizRoom';
import { DEFAULT_ROOM_CODE } from './lib/quizDatabase';
import { Smartphone, Monitor } from 'lucide-react';

export default function App() {
  const [currentRole, setCurrentRole] = useState<'student' | 'admin'>('student');
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [roomCode, setRoomCode] = useState<string>(DEFAULT_ROOM_CODE);

  // Check URL query parameters: ?room=code, ?role=admin, ?admin=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom && urlRoom.trim()) {
        setRoomCode(urlRoom.trim());
      }
      if (params.get('role') === 'admin' || params.get('admin') === 'true') {
        setCurrentRole('admin');
        setIsAdminAuthenticated(true);
      }
    }
  }, []);

  // Use Firebase Realtime Database room hook
  const {
    isConnected,
    isJoining,
    joinError,
    connectionTimeout,
    participantId,
    gameState,
    handleJoinAsStudent,
    handleSubmitAnswer,
    handleStudentLeave,
    handleStartQuiz,
    handleNextQuestion,
    handleShowReview,
    handleShowRanking,
    handleResetQuiz,
    handleSetTimeLimit,
    handleKickParticipant,
    handleSimulateStudent,
    retryConnection,
  } = useQuizRoom(roomCode, currentRole);

  // Helper to request entering admin mode with password protection
  const requestAdminAccess = () => {
    if (isAdminAuthenticated) {
      setCurrentRole('admin');
    } else {
      setIsAdminPasswordModalOpen(true);
    }
  };

  const handleAdminPasswordSuccess = () => {
    setIsAdminAuthenticated(true);
    setIsAdminPasswordModalOpen(false);
    setCurrentRole('admin');
  };

  // Current participant object
  const currentParticipant = gameState.participants.find((p) => p.id === participantId);

  return (
    <SkyWhaleBackground>
      {/* Top Universal Role Switcher & Status Bar */}
      <header className="w-full bg-white/70 backdrop-blur-md border-b border-sky-200 px-4 py-2 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <span className="text-xl select-none">🐳</span>
          <span className="font-jua text-lg text-sky-900 font-bold">하늘고래 퀴즈</span>
          <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">
            (실시간 다인 참여)
          </span>
        </div>

        {/* Device & Role Toggle Pill */}
        <div className="flex items-center gap-2">
          {/* Connection status dot powered by .info/connected */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/80 border border-slate-200 shadow-2xs"
            title={
              isConnected
                ? 'Firebase 실시간 데이터베이스 연결 정상'
                : '실시간 데이터베이스 연결 확인 중...'
            }
          >
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                isConnected ? 'bg-emerald-500 shadow-xs animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-600 hidden xs:inline">
              {isConnected ? '온라인' : '연결 중'}
            </span>
          </div>

          {/* Role Switcher Button */}
          <div className="bg-slate-200/80 p-0.5 rounded-xl flex items-center shadow-inner">
            <button
              id="role-student-btn"
              type="button"
              onClick={() => setCurrentRole('student')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentRole === 'student'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>학생 모드</span>
            </button>
            <button
              id="role-admin-btn"
              type="button"
              onClick={requestAdminAccess}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentRole === 'admin'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>선생님 모드</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        {currentRole === 'admin' ? (
          // ADMIN VIEW
          gameState.status === 'ranking' ? (
            <RankingView
              gameState={gameState}
              isAdmin={true}
              onBackToGame={handleShowReview}
              onResetQuiz={handleResetQuiz}
            />
          ) : (
            <AdminView
              gameState={gameState}
              onStartQuiz={handleStartQuiz}
              onNextQuestion={handleNextQuestion}
              onShowReview={handleShowReview}
              onShowRanking={handleShowRanking}
              onResetQuiz={handleResetQuiz}
              onSetTimeLimit={handleSetTimeLimit}
              onKickParticipant={handleKickParticipant}
              onSimulateStudent={handleSimulateStudent}
              roomCode={roomCode}
            />
          )
        ) : (
          // STUDENT VIEW
          !currentParticipant ? (
            // Student hasn't joined yet
            <LobbyView
              gameState={gameState}
              onJoinAsStudent={handleJoinAsStudent}
              onEnterAsAdmin={requestAdminAccess}
              isJoining={isJoining}
              joinError={joinError}
              connectionTimeout={connectionTimeout}
              onRetry={retryConnection}
              roomCode={roomCode}
            />
          ) : gameState.status === 'lobby' ? (
            // Joined student waiting for quiz to start
            <StudentWaitingView
              gameState={gameState}
              participant={currentParticipant}
              onLeave={handleStudentLeave}
            />
          ) : gameState.status === 'ranking' || gameState.status === 'ended' ? (
            // Ranking view
            <RankingView
              gameState={gameState}
              isAdmin={false}
            />
          ) : (
            // Student solving question
            <StudentQuizView
              gameState={gameState}
              participant={currentParticipant}
              onSubmitAnswer={handleSubmitAnswer}
              onExit={handleStudentLeave}
            />
          )
        )}
      </main>

      {/* Admin Password Modal */}
      <AdminPasswordModal
        isOpen={isAdminPasswordModalOpen}
        onClose={() => setIsAdminPasswordModalOpen(false)}
        onSuccess={handleAdminPasswordSuccess}
      />
    </SkyWhaleBackground>
  );
}
