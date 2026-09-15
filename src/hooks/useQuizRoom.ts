import { useState, useEffect, useRef } from 'react';
import { ref, onValue, Unsubscribe } from 'firebase/database';
import { getFirebaseInstance, isFirebaseConfigured, ensureAnonymousAuth } from '../lib/firebase';
import {
  DEFAULT_ROOM_CODE,
  initializeRoomIfNotExists,
  joinRoomAsStudent,
  leaveRoom,
  submitStudentAnswer,
  adminStartQuiz,
  adminNextQuestion,
  adminShowReview,
  adminShowRanking,
  adminResetQuiz,
  adminSetTimeLimit,
  adminKickParticipant,
  adminUpdateTimeRemaining,
} from '../lib/quizDatabase';
import { GameState, Participant, QuizQuestion } from '../types';
import { ALL_QUESTIONS } from '../data/questions';

const LOCAL_STORAGE_KEY_PARTICIPANT = 'whale_quiz_participant_id';
const LOCAL_STORAGE_KEY_NAME = 'whale_quiz_student_name';
const LOCAL_STORAGE_KEY_AVATAR = 'whale_quiz_student_avatar';

export function useQuizRoom(roomCode: string = DEFAULT_ROOM_CODE, role: 'student' | 'admin' = 'student') {
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connectionTimeout, setConnectionTimeout] = useState(false);

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
    totalQuestions: ALL_QUESTIONS.length,
    revealAnswers: false,
    currentQuestion: undefined,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor .info/connected from Firebase Realtime Database
  useEffect(() => {
    const { database } = getFirebaseInstance();
    if (!database) {
      setIsConnected(false);
      return;
    }

    const connectedRef = ref(database, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      const online = snap.val() === true;
      setIsConnected(online);
      if (online) {
        setConnectionTimeout(false);
        if (connectionTimerRef.current) {
          clearTimeout(connectionTimerRef.current);
          connectionTimerRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 10-second timeout detection for initial connection/join
  const startConnectionTimeoutCheck = () => {
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    setConnectionTimeout(false);
    connectionTimerRef.current = setTimeout(() => {
      setConnectionTimeout(true);
    }, 10000);
  };

  // Subscribe to room state & players
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    startConnectionTimeoutCheck();

    // Ensure anonymous auth and room exists
    ensureAnonymousAuth()
      .then(() => initializeRoomIfNotExists(roomCode))
      .catch((err) => {
        console.error('Firebase setup error:', err);
      });

    const { database } = getFirebaseInstance();
    if (!database) return;

    const stateRef = ref(database, `rooms/${roomCode}/state`);
    const playersRef = ref(database, `rooms/${roomCode}/players`);

    let currentParticipants: Participant[] = [];
    let currentRawState: any = null;

    const updateCombinedState = () => {
      if (!currentRawState) return;

      const qIndex = currentRawState.currentQuestionIndex || 0;
      const rawQuestion = ALL_QUESTIONS[qIndex];
      const shouldReveal = currentRawState.revealAnswers || currentRawState.status === 'review' || currentRawState.status === 'ranking' || currentRawState.status === 'ended';

      const publicQuestion: QuizQuestion | undefined = rawQuestion
        ? {
            ...rawQuestion,
            correctAnswers: shouldReveal ? rawQuestion.correctAnswers : [],
            explanation: shouldReveal ? rawQuestion.explanation : undefined,
          }
        : undefined;

      setGameState({
        status: currentRawState.status || 'lobby',
        currentQuestionIndex: qIndex,
        timeLimit: currentRawState.timeLimit || 20,
        timeRemaining: currentRawState.timeRemaining ?? 20,
        participants: currentParticipants,
        maxParticipants: currentRawState.maxParticipants || 20,
        selectedQuestionSet: currentRawState.selectedQuestionSet || 'all',
        totalQuestions: ALL_QUESTIONS.length,
        currentQuestion: publicQuestion,
        revealAnswers: shouldReveal,
      });
    };

    const unsubState: Unsubscribe = onValue(stateRef, (snapshot) => {
      if (snapshot.exists()) {
        currentRawState = snapshot.val();
        updateCombinedState();
      }
    });

    const unsubPlayers: Unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        currentParticipants = [];
      } else {
        currentParticipants = Object.values(data).map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          score: p.score || 0,
          answeredCurrent: Boolean(p.answeredCurrent),
          selectedAnswers: p.selectedAnswers || [],
          isCorrect: p.isCorrect ?? null,
          pointsEarned: p.pointsEarned || 0,
          lastAnswerTime: p.lastAnswerTime,
          isOnline: p.isOnline !== false,
        }));
      }
      updateCombinedState();
    });

    return () => {
      unsubState();
      unsubPlayers();
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    };
  }, [roomCode]);

  // Admin-driven countdown timer when question is active
  useEffect(() => {
    if (role !== 'admin') return;

    if (gameState.status === 'question') {
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setGameState((prev) => {
          if (prev.status !== 'question') return prev;
          const nextTime = Math.max(0, prev.timeRemaining - 1);

          // Update Firebase state occasionally or on timeout
          adminUpdateTimeRemaining(roomCode, nextTime).catch(() => {});

          if (nextTime === 0) {
            // Auto-advance to review on timeout
            adminShowReview(roomCode).catch(() => {});
          }

          return { ...prev, timeRemaining: nextTime };
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [role, gameState.status, roomCode]);

  // Student join action
  const handleJoinAsStudent = async (name: string, avatar: string) => {
    setIsJoining(true);
    setJoinError(null);
    setConnectionTimeout(false);
    startConnectionTimeoutCheck();

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_NAME, name);
      localStorage.setItem(LOCAL_STORAGE_KEY_AVATAR, avatar);

      const id = await joinRoomAsStudent(roomCode, name, avatar, participantId || undefined);
      setParticipantId(id);
      localStorage.setItem(LOCAL_STORAGE_KEY_PARTICIPANT, id);
      setIsJoining(false);
      setJoinError(null);
      if (connectionTimerRef.current) {
        clearTimeout(connectionTimerRef.current);
        connectionTimerRef.current = null;
      }
    } catch (err: any) {
      console.error('Join error:', err);
      setIsJoining(false);
      setJoinError(err?.message || '접속 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // Student answer submit
  const handleSubmitAnswer = async (selectedAnswers: number[]) => {
    if (!participantId) return;
    try {
      await submitStudentAnswer(roomCode, participantId, gameState.currentQuestionIndex, selectedAnswers);
    } catch (err) {
      console.error('Submit answer error:', err);
    }
  };

  // Student exit
  const handleStudentLeave = async () => {
    if (participantId) {
      await leaveRoom(roomCode, participantId).catch(() => {});
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY_PARTICIPANT);
    localStorage.removeItem(LOCAL_STORAGE_KEY_NAME);
    setParticipantId(null);
  };

  // Admin action handlers
  const handleStartQuiz = () => adminStartQuiz(roomCode);
  const handleNextQuestion = () => adminNextQuestion(roomCode, gameState.currentQuestionIndex + 1);
  const handleShowReview = () => adminShowReview(roomCode);
  const handleShowRanking = () => adminShowRanking(roomCode);
  const handleResetQuiz = () => adminResetQuiz(roomCode);
  const handleSetTimeLimit = (seconds: number) => adminSetTimeLimit(roomCode, seconds);
  const handleKickParticipant = (id: string) => adminKickParticipant(roomCode, id);

  const handleSimulateStudent = async () => {
    const names = ['김민우', '이지은', '강서준', '송하율', '최도윤', '윤서아', '임지호', '장예원'];
    const avatars = ['🐬', '🐋', '🦭', '🐧', '🐢', '🐙', '🐠', '🦀'];
    const availableNames = names.filter((n) => !gameState.participants.some((p) => p.name.includes(n)));
    const chosenName = availableNames[0] || `테스트_${gameState.participants.length + 1}`;
    const chosenAvatar = avatars[gameState.participants.length % avatars.length];

    try {
      await joinRoomAsStudent(roomCode, chosenName, chosenAvatar);
    } catch (err) {
      console.error('Simulate student error:', err);
    }
  };

  return {
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
    retryConnection: () => {
      setConnectionTimeout(false);
      setJoinError(null);
      const storedName = localStorage.getItem(LOCAL_STORAGE_KEY_NAME);
      const storedAvatar = localStorage.getItem(LOCAL_STORAGE_KEY_AVATAR) || '🐳';
      if (storedName) {
        handleJoinAsStudent(storedName, storedAvatar);
      }
    },
  };
}
