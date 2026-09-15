import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Participant, WebSocketClientMessage, WebSocketServerMessage } from './types';
import { SkyWhaleBackground } from './components/SkyWhaleBackground';
import { StudentQuizView } from './components/StudentQuizView';
import { StudentWaitingView } from './components/StudentWaitingView';
import { AdminView } from './components/AdminView';
import { LobbyView } from './components/LobbyView';
import { RankingView } from './components/RankingView';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { Shield, User, Smartphone, Monitor } from 'lucide-react';

const LOCAL_STORAGE_KEY_PARTICIPANT = 'whale_quiz_participant_id';
const LOCAL_STORAGE_KEY_NAME = 'whale_quiz_student_name';
const LOCAL_STORAGE_KEY_AVATAR = 'whale_quiz_student_avatar';

export default function App() {
  // Mode: 'student' or 'admin'
  const [currentRole, setCurrentRole] = useState<'student' | 'admin'>('student');
  const [participantId, setParticipantId] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANT) : null;
  });

  const [gameState, setGameState] = useState<GameState>({
    status: 'lobby',
    currentQuestionIndex: 0,
    timeLimit: 20,
    timeRemaining: 20,
    participants: [],
    maxParticipants: 20,
    selectedQuestionSet: 'all',
    totalQuestions: 5,
    revealAnswers: false,
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Connect to WebSocket Server
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?role=${currentRole}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setJoinError(null);

      // Start keep-alive ping
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 15000);

      // If student was already joined previously, re-join with stored name
      const storedName = localStorage.getItem(LOCAL_STORAGE_KEY_NAME);
      const storedAvatar = localStorage.getItem(LOCAL_STORAGE_KEY_AVATAR) || '🐳';
      if (currentRole === 'student' && storedName) {
        ws.send(JSON.stringify({
          type: 'join',
          name: storedName,
          avatar: storedAvatar,
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketServerMessage = JSON.parse(event.data);

        if (data.type === 'state_update') {
          setGameState(data.state);
        } else if (data.type === 'join_success') {
          setParticipantId(data.participantId);
          setIsJoining(false);
          setJoinError(null);
          localStorage.setItem(LOCAL_STORAGE_KEY_PARTICIPANT, data.participantId);
        } else if (data.type === 'error') {
          setJoinError(data.message);
          setIsJoining(false);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect after 2 seconds
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket();
      }, 2000);
    };

    ws.onerror = () => {
      // ws.onclose will trigger reconnection
    };
  }, [currentRole]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Initial HTTP state fallback fetch
  useEffect(() => {
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        setGameState(prev => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  // Handlers for Student
  const handleJoinAsStudent = (name: string, avatar: string) => {
    setIsJoining(true);
    setJoinError(null);
    localStorage.setItem(LOCAL_STORAGE_KEY_NAME, name);
    localStorage.setItem(LOCAL_STORAGE_KEY_AVATAR, avatar);

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
          {/* Connection status dot */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/80 border border-slate-200 shadow-2xs"
            title={isConnected ? '서버 연결 정상' : '서버 재연결 중...'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-600 hidden xs:inline">
              {isConnected ? '온라인' : '재연결 중'}
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
