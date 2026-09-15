import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Participant } from './types';
import { SkyWhaleBackground } from './components/SkyWhaleBackground';
import { StudentQuizView } from './components/StudentQuizView';
import { StudentWaitingView } from './components/StudentWaitingView';
import { AdminView } from './components/AdminView';
import { LobbyView } from './components/LobbyView';
import { RankingView } from './components/RankingView';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { FirebaseQuizService } from './lib/firebaseQuizService';
import { isFirebaseConfigured } from './lib/firebase';
import { requestScreenWakeLock, releaseScreenWakeLock } from './lib/wakeLock';
import { Smartphone, Monitor, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

const LOCAL_STORAGE_KEY_ROOM = 'whale_quiz_room_code';
const LOCAL_STORAGE_KEY_TEACHER_ROOM = 'whale_quiz_teacher_room_code';
const LOCAL_STORAGE_KEY_UID = 'whale_quiz_uid';
const LOCAL_STORAGE_KEY_NAME = 'whale_quiz_name';
const LOCAL_STORAGE_KEY_AVATAR = 'whale_quiz_avatar';

export default function App() {
  const [currentRole, setCurrentRole] = useState<'student' | 'admin'>('student');
  const [participantId, setParticipantId] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY_UID) : null;
  });

  // Room Code: read from URL `?room=...` or leave empty (no default 1004)
  const [roomCode, setRoomCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryRoom = params.get('room');
      if (queryRoom) return queryRoom.trim();
    }
    return '';
  });

  const [gameState, setGameState] = useState<GameState>({
    status: 'lobby',
    currentQuestionIndex: 0,
    timeLimit: 20,
    timeRemaining: 20,
    participants: [],
    maxParticipants: 30,
    selectedQuestionSet: 'all',
    totalQuestions: 15,
    revealAnswers: false,
  });

  const [isConnected, setIsConnected] = useState(false);
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const firebaseServiceRef = useRef<FirebaseQuizService | null>(null);

  // Handle Room Code Change & URL synchronization
  const handleRoomCodeChange = useCallback((newCode: string) => {
    const sanitized = newCode.trim();
    setRoomCode(sanitized);

    // Update URL parameter without full reload
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (sanitized) {
        url.searchParams.set('room', sanitized);
        localStorage.setItem(LOCAL_STORAGE_KEY_ROOM, sanitized);
      } else {
        url.searchParams.delete('room');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Ensure Teacher Room Code is restored from localStorage or generated
  useEffect(() => {
    if (currentRole === 'admin') {
      if (!roomCode) {
        const savedTeacherRoom = localStorage.getItem(LOCAL_STORAGE_KEY_TEACHER_ROOM);
        if (savedTeacherRoom) {
          handleRoomCodeChange(savedTeacherRoom);
        } else {
          const newCode = FirebaseQuizService.generateRoomCode();
          localStorage.setItem(LOCAL_STORAGE_KEY_TEACHER_ROOM, newCode);
          handleRoomCodeChange(newCode);
        }
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY_TEACHER_ROOM, roomCode);
      }
    }
  }, [currentRole, roomCode, handleRoomCodeChange]);

  // Initialize Firebase Realtime Database Service
  useEffect(() => {
    if (!roomCode) return; // Do not connect without a designated roomCode

    const service = new FirebaseQuizService();
    firebaseServiceRef.current = service;

    service.setCallbacks(
      (updatedState) => {
        setGameState(updatedState);
      },
      (connected, detail) => {
        setIsConnected(connected);
        setStatusDetail(detail);
      },
      (errorMessage) => {
        setSyncErrorMessage(errorMessage);
      }
    );

    if (currentRole === 'admin') {
      // 선생님 화면은 새로고침해도 새 방을 만들지 않고 기존 방 코드를 그대로 다시 불러옴
      service.createRoom(roomCode, gameState.maxParticipants || 30);
    } else {
      // Student subscribes to the room
      service.subscribeToRoom(roomCode, 'student');
    }

    return () => {
      service.destroy();
      firebaseServiceRef.current = null;
    };
  }, [currentRole, roomCode]);

  // Screen Wake Lock & Visibility change management
  useEffect(() => {
    if (gameState.status === 'question') {
      requestScreenWakeLock();
    } else if (gameState.status === 'ended' || gameState.status === 'ranking') {
      releaseScreenWakeLock();
    }

    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      if (isVisible) {
        if (gameState.status === 'question') {
          requestScreenWakeLock();
        }
        if (firebaseServiceRef.current) {
          firebaseServiceRef.current.handleVisibilityChange(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseScreenWakeLock();
    };
  }, [gameState.status]);

  // Admin Access PIN check
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

    const savedTeacherRoom = localStorage.getItem(LOCAL_STORAGE_KEY_TEACHER_ROOM);
    if (savedTeacherRoom) {
      handleRoomCodeChange(savedTeacherRoom);
    } else if (!roomCode) {
      const newCode = FirebaseQuizService.generateRoomCode();
      localStorage.setItem(LOCAL_STORAGE_KEY_TEACHER_ROOM, newCode);
      handleRoomCodeChange(newCode);
    }
  };

  // Student Join Handler (10-second timeout guaranteed & room existence verification)
  const handleJoinAsStudent = async (name: string, avatar: string, customRoomCode?: string) => {
    const targetRoom = (customRoomCode || roomCode).trim();
    if (!targetRoom) {
      setJoinError('선생님 화면의 방 코드 4자리를 입력해 주세요.');
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    if (customRoomCode && customRoomCode !== roomCode) {
      handleRoomCodeChange(customRoomCode);
    }

    if (!firebaseServiceRef.current) {
      firebaseServiceRef.current = new FirebaseQuizService();
    }

    // 방 존재 여부 사전 검증 (없는 방으로 입장하여 빈 데이터가 생기지 않도록 방지)
    const exists = await firebaseServiceRef.current.checkRoomExists(targetRoom);
    if (!exists) {
      setIsJoining(false);
      setJoinError('존재하지 않는 방입니다. 방 코드를 확인해 주세요.');
      return;
    }

    const result = await firebaseServiceRef.current.joinRoom(targetRoom, name, avatar);

    setIsJoining(false);
    if (result.success && result.participantId) {
      setParticipantId(result.participantId);
      setJoinError(null);
    } else {
      setJoinError(result.error || '참여에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  // Student Submit Answer
  const handleSubmitAnswer = (selectedAnswers: number[]) => {
    if (!firebaseServiceRef.current) return;
    firebaseServiceRef.current.submitAnswer(roomCode, gameState.currentQuestionIndex, selectedAnswers);
  };

  // Student Leave - 나가기 클릭 시 players/{uid} 삭제 및 onDisconnect 해제
  const handleStudentLeave = async () => {
    if (firebaseServiceRef.current && participantId) {
      await firebaseServiceRef.current.leaveRoom(roomCode, participantId);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY_UID);
    localStorage.removeItem(LOCAL_STORAGE_KEY_NAME);
    localStorage.removeItem(LOCAL_STORAGE_KEY_AVATAR);
    setParticipantId(null);
    setIsJoining(false);
    setJoinError(null);
  };

  // Admin Controls
  const handleStartQuiz = () => firebaseServiceRef.current?.startQuiz(roomCode);
  const handleNextQuestion = () => firebaseServiceRef.current?.nextQuestion(roomCode);
  const handleShowReview = () => firebaseServiceRef.current?.showReview(roomCode);
  const handleShowRanking = () => firebaseServiceRef.current?.showRanking(roomCode);
  const handleResetQuiz = () => firebaseServiceRef.current?.resetQuiz(roomCode);
  const handleSetTimeLimit = (seconds: number) => firebaseServiceRef.current?.setTimeLimit(roomCode, seconds);
  const handleSetMaxParticipants = (max: number) => firebaseServiceRef.current?.setMaxParticipants(roomCode, max);
  const handleKickParticipant = (id: string) => firebaseServiceRef.current?.kickParticipant(roomCode, id);
  const handleDeleteRoom = () => {
    if (window.confirm('현재 방의 모든 참가자 및 진행 기록을 삭제하시겠습니까?')) {
      firebaseServiceRef.current?.deleteRoom(roomCode);
    }
  };

  // Generate New 4-digit Room Code (이전 방 삭제 후 새 방 생성)
  const handleGenerateNewRoom = async () => {
    const prevRoomCode = roomCode;
    const newCode = FirebaseQuizService.generateRoomCode();

    // 1. 이전 방 데이터 Firebase에서 삭제
    if (firebaseServiceRef.current && prevRoomCode) {
      await firebaseServiceRef.current.deleteRoom(prevRoomCode);
    }

    // 2. 새 방 코드 저장 및 설정
    localStorage.setItem(LOCAL_STORAGE_KEY_TEACHER_ROOM, newCode);
    handleRoomCodeChange(newCode);

    // 3. 새 방 생성
    if (firebaseServiceRef.current) {
      await firebaseServiceRef.current.createRoom(newCode, gameState.maxParticipants || 30);
    }
  };

  // 방 코드 변경 (기존 방 불러오기)
  const handleChangeRoomCode = async (targetCode: string) => {
    const sanitized = targetCode.trim();
    if (!sanitized) return;

    localStorage.setItem(LOCAL_STORAGE_KEY_TEACHER_ROOM, sanitized);
    handleRoomCodeChange(sanitized);

    if (firebaseServiceRef.current) {
      await firebaseServiceRef.current.createRoom(sanitized, gameState.maxParticipants || 30);
    }
  };

  // Simulate Student for Demo & Testing
  const handleSimulateStudent = async () => {
    const names = ['김민우', '이지은', '강서준', '송하율', '최도윤', '윤서아', '임지호', '장예원'];
    const avatars = ['🐬', '🐋', '🦭', '🐧', '🐢', '🐙', '🐠', '🦀'];
    const count = gameState.participants.length;
    const chosenName = names[count % names.length] + (count >= names.length ? `_${count + 1}` : '');
    const chosenAvatar = avatars[count % avatars.length];

    if (!firebaseServiceRef.current) return;
    const simService = new FirebaseQuizService();
    await simService.joinRoom(roomCode, chosenName, chosenAvatar);
  };

  // Current Participant
  const currentParticipant = gameState.participants.find((p) => p.id === participantId);

  return (
    <SkyWhaleBackground>
      {/* Top Header & Role Switcher */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-sky-200 px-4 py-2 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <span className="text-2xl select-none">🐳</span>
          <span className="font-jua text-xl text-sky-900 font-bold">하늘고래 퀴즈</span>
          <span className="hidden sm:inline-block text-xs font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
            실시간 RTDB
          </span>
        </div>

        {/* Status Pill & Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Dot */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/90 border border-slate-200 shadow-2xs"
            title={statusDetail || (isConnected ? '정상 연결됨' : '연결 준비 중...')}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-700 font-bold hidden xs:inline">
              {isConnected ? `온라인 (방: ${roomCode})` : '연결 준비 중'}
            </span>
          </div>

          {/* Role Switcher */}
          <div className="bg-slate-200/80 p-0.5 rounded-xl flex items-center shadow-inner">
            <button
              id="role-student-btn"
              type="button"
              onClick={() => setCurrentRole('student')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentRole === 'student'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>학생 화면</span>
            </button>
            <button
              id="role-admin-btn"
              type="button"
              onClick={requestAdminAccess}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentRole === 'admin'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>선생님 화면</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notice if Firebase env keys are not yet configured */}
      {!isFirebaseConfigured() && (
        <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-xs sm:text-sm text-amber-900 flex items-center justify-center gap-2 text-center">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Firebase 설정 안내:</strong> Vercel 환경 변수에 <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_DATABASE_URL</code> 등을 등록하면 모든 실시간 동기화가 활성화됩니다.
          </span>
        </div>
      )}

      {/* Database Sync Error Banner */}
      {syncErrorMessage && (
        <div className="w-full bg-rose-100 border-b-2 border-rose-300 px-4 py-2.5 text-xs sm:text-sm text-rose-900 flex items-center justify-center gap-2 text-center animate-pulse">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{syncErrorMessage}</span>
        </div>
      )}

      {/* Main Screen Views */}
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        {currentRole === 'admin' ? (
          // TEACHER / ADMIN VIEW
          gameState.status === 'ranking' ? (
            <RankingView
              gameState={gameState}
              isAdmin={true}
              onBackToGame={() => handleShowReview()}
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
              onSetMaxParticipants={handleSetMaxParticipants}
              onKickParticipant={handleKickParticipant}
              onSimulateStudent={handleSimulateStudent}
              onGenerateNewRoom={handleGenerateNewRoom}
              onChangeRoomCode={handleChangeRoomCode}
              onDeleteRoom={handleDeleteRoom}
              roomCode={roomCode}
              isConnectedToDb={isConnected}
              connectionDetail={statusDetail}
            />
          )
        ) : (
          // STUDENT VIEW
          !currentParticipant ? (
            // Not joined yet -> Lobby
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
            // Joined and waiting for quiz to start
            <StudentWaitingView
              gameState={gameState}
              participant={currentParticipant}
              onLeave={handleStudentLeave}
            />
          ) : gameState.status === 'ranking' || gameState.status === 'ended' ? (
            // Final or intermediate ranking
            <RankingView
              gameState={gameState}
              isAdmin={false}
            />
          ) : (
            // Active quiz question
            <StudentQuizView
              gameState={gameState}
              participant={currentParticipant}
              onSubmitAnswer={handleSubmitAnswer}
              onExit={handleStudentLeave}
            />
          )
        )}
      </main>

      {/* Admin Password Modal (PIN) */}
      <AdminPasswordModal
        isOpen={isAdminPasswordModalOpen}
        onClose={() => setIsAdminPasswordModalOpen(false)}
        onSuccess={handleAdminPasswordSuccess}
      />
    </SkyWhaleBackground>
  );
}
