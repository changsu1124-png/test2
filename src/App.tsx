import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Participant, WebSocketClientMessage } from './types';
import { SkyWhaleBackground } from './components/SkyWhaleBackground';
import { StudentQuizView } from './components/StudentQuizView';
import { StudentWaitingView } from './components/StudentWaitingView';
import { AdminView } from './components/AdminView';
import { LobbyView } from './components/LobbyView';
import { RankingView } from './components/RankingView';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { NetworkService, TransportMode } from './lib/networkService';
import { Shield, User, Smartphone, Monitor, Radio } from 'lucide-react';

const LOCAL_STORAGE_KEY_PARTICIPANT = 'whale_quiz_participant_id';
const LOCAL_STORAGE_KEY_NAME = 'whale_quiz_student_name';
const LOCAL_STORAGE_KEY_AVATAR = 'whale_quiz_student_avatar';

export default function App() {
  // Mode: 'student' or 'admin'
  const [currentRole, setCurrentRole] = useState<'student' | 'admin'>('student');
  const [participantId, setParticipantId] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANT) : null;
  });

  // Room Code: read from URL param `?room=...` or default to '1004'
  const [roomCode, setRoomCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryRoom = params.get('room');
      if (queryRoom) return queryRoom.trim().toLowerCase();
    }
    return '1004';
  });

  const [gameState, setGameState] = useState<GameState>({
    status: 'lobby',
    currentQuestionIndex: 0,
    timeLimit: 20,
    timeRemaining: 20,
    participants: [],
    maxParticipants: 20,
    selectedQuestionSet: 'all',
    totalQuestions: 15,
    revealAnswers: false,
  });

  const [isConnected, setIsConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('p2p');
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const networkRef = useRef<NetworkService | null>(null);

  // Initialize NetworkService
  useEffect(() => {
    const network = new NetworkService({
      onStateUpdate: (state) => {
        setGameState(state);
      },
      onJoinSuccess: (newParticipantId) => {
        setParticipantId(newParticipantId);
        setIsJoining(false);
        setJoinError(null);
        localStorage.setItem(LOCAL_STORAGE_KEY_PARTICIPANT, newParticipantId);
      },
      onError: (errorMessage) => {
        setJoinError(errorMessage);
        setIsJoining(false);
      },
      onConnectionStatusChange: (connected, mode, detail) => {
        setIsConnected(connected);
        setTransportMode(mode);
        if (detail) setStatusDetail(detail);
      },
    });

    networkRef.current = network;
    network.connect(currentRole, roomCode);

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [currentRole, roomCode]);

  // Re-connect when role or room code changes
  const handleRoomCodeChange = useCallback((newCode: string) => {
    const sanitized = newCode.trim().toLowerCase();
    setRoomCode(sanitized);
    if (networkRef.current) {
      networkRef.current.connect(currentRole, sanitized);
    }
  }, [currentRole]);

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

  // Send message helper
  const sendMessage = useCallback((msg: WebSocketClientMessage) => {
    if (networkRef.current) {
      networkRef.current.sendMessage(msg);
    }
  }, []);

  // Handlers for Student
  const handleJoinAsStudent = (name: string, avatar: string, customRoomCode?: string) => {
    setIsJoining(true);
    setJoinError(null);
    localStorage.setItem(LOCAL_STORAGE_KEY_NAME, name);
    localStorage.setItem(LOCAL_STORAGE_KEY_AVATAR, avatar);

    if (customRoomCode && customRoomCode !== roomCode) {
      handleRoomCodeChange(customRoomCode);
    }

    sendMessage({
      type: 'join',
      name,
      avatar,
    });
  };

  const handleSubmitAnswer = (selectedAnswers: number[]) => {
    sendMessage({
      type: 'submit_answer',
      questionIndex: gameState.currentQuestionIndex,
      selectedAnswers,
    });
  };

  const handleStudentLeave = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY_PARTICIPANT);
    localStorage.removeItem(LOCAL_STORAGE_KEY_NAME);
    setParticipantId(null);
    setIsJoining(false);
    setJoinError(null);
  };

  // Handlers for Admin
  const handleStartQuiz = () => sendMessage({ type: 'admin:start_quiz' });
  const handleNextQuestion = () => sendMessage({ type: 'admin:next_question' });
  const handleShowReview = () => sendMessage({ type: 'admin:show_review' });
  const handleShowRanking = () => sendMessage({ type: 'admin:show_ranking' });
  const handleResetQuiz = () => sendMessage({ type: 'admin:reset_quiz' });
  const handleSetTimeLimit = (seconds: number) => sendMessage({ type: 'admin:set_time_limit', seconds });
  const handleKickParticipant = (id: string) => sendMessage({ type: 'admin:kick_participant', participantId: id });

  // Simulation test helper: adds simulated student for easy local/preview testing
  const handleSimulateStudent = () => {
    const names = ['김민우', '이지은', '강서준', '송하율', '최도윤', '윤서아', '임지호', '장예원'];
    const avatars = ['🐬', '🐋', '🦭', '🐧', '🐢', '🐙', '🐠', '🦀'];
    const availableNames = names.filter(
      n => !gameState.participants.some(p => p.name.includes(n))
    );
    const chosenName = availableNames[0] || `테스트_${gameState.participants.length + 1}`;
    const chosenAvatar = avatars[gameState.participants.length % avatars.length];

    sendMessage({
      type: 'join',
      name: chosenName,
      avatar: chosenAvatar,
    });
  };

  // Current participant object
  const currentParticipant = gameState.participants.find(p => p.id === participantId);

  return (
    <SkyWhaleBackground>
      {/* Top Universal Role Switcher & Status Bar */}
      <header className="w-full bg-white/75 backdrop-blur-md border-b border-sky-200 px-4 py-2 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <span className="text-xl select-none">🐳</span>
          <span className="font-jua text-lg text-sky-900 font-bold">하늘고래 퀴즈</span>
          <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">
            (실시간 다인 참여)
          </span>
        </div>

        {/* Device & Role Toggle Pill */}
        <div className="flex items-center gap-2">
          {/* Connection status dot & transport pill */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 border border-slate-200 shadow-2xs"
            title={statusDetail || (isConnected ? '정상 연결됨' : '연결 준비 중...')}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-slate-700 font-bold hidden xs:inline">
              {transportMode === 'websocket' ? '웹소켓' : `P2P (방: ${roomCode})`}
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
              onBackToGame={() => sendMessage({ type: 'admin:show_review' })}
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
              onRoomCodeChange={handleRoomCodeChange}
              transportMode={transportMode}
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
              roomCode={roomCode}
              onRoomCodeChange={handleRoomCodeChange}
              onClearError={() => setJoinError(null)}
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
