import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
  DatabaseReference,
  Unsubscribe,
} from 'firebase/database';
import { getFirebaseInstance, ensureAnonymousAuth } from './firebase';
import { ALL_QUESTIONS } from '../data/questions';
import { GameState, Participant, QuizQuestion } from '../types';

export const DEFAULT_ROOM_CODE = 'whale';

export interface RoomStateData {
  status: 'lobby' | 'countdown' | 'question' | 'feedback' | 'review' | 'ranking' | 'ended';
  currentQuestionIndex: number;
  timeLimit: number;
  timeRemaining: number;
  maxParticipants: number;
  selectedQuestionSet: string;
  totalQuestions: number;
  revealAnswers: boolean;
  questionStartedAt?: number;
}

export interface PlayerData {
  id: string;
  name: string;
  avatar: string;
  score: number;
  answeredCurrent: boolean;
  selectedAnswers: number[];
  isCorrect: boolean | null;
  pointsEarned: number;
  lastAnswerTime?: number;
  isOnline: boolean;
  joinedAt?: number | object;
}

export interface AnswerData {
  participantId: string;
  questionIndex: number;
  selectedAnswers: number[];
  isCorrect: boolean;
  pointsEarned: number;
  submittedAt: number;
}

/**
 * Initialize room in Firebase Realtime Database if it doesn't exist
 */
export async function initializeRoomIfNotExists(roomCode: string = DEFAULT_ROOM_CODE): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  const stateRef = ref(database, `rooms/${roomCode}/state`);
  const snapshot = await get(stateRef);

  if (!snapshot.exists()) {
    const initialState: RoomStateData = {
      status: 'lobby',
      currentQuestionIndex: 0,
      timeLimit: 20,
      timeRemaining: 20,
      maxParticipants: 20,
      selectedQuestionSet: 'all',
      totalQuestions: ALL_QUESTIONS.length,
      revealAnswers: false,
    };
    await set(stateRef, initialState);
  }
}

/**
 * Join room as a student with onDisconnect hook
 */
export async function joinRoomAsStudent(
  roomCode: string,
  name: string,
  avatar: string,
  providedId?: string
): Promise<string> {
  const { database } = getFirebaseInstance();
  if (!database) {
    throw new Error('Firebase Database가 설정되지 않았습니다.');
  }

  // 1. Ensure anonymous auth
  const user = await ensureAnonymousAuth();
  const participantId = providedId || user?.uid || `student_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // 2. Check room capacity
  const playersRef = ref(database, `rooms/${roomCode}/players`);
  const snapshot = await get(playersRef);
  const currentPlayers = snapshot.val() || {};
  const currentCount = Object.keys(currentPlayers).filter((k) => currentPlayers[k]?.isOnline !== false).length;

  if (currentCount >= 20 && !currentPlayers[participantId]) {
    throw new Error('참여 인원이 마감되었습니다! (최대 20명)');
  }

  // 3. Register player
  const playerRef = ref(database, `rooms/${roomCode}/players/${participantId}`);
  const initialPlayer: PlayerData = {
    id: participantId,
    name,
    avatar,
    score: currentPlayers[participantId]?.score || 0,
    answeredCurrent: false,
    selectedAnswers: [],
    isCorrect: null,
    pointsEarned: 0,
    isOnline: true,
    joinedAt: serverTimestamp(),
  };

  await set(playerRef, initialPlayer);

  // 4. Set onDisconnect to remove or mark offline
  const playerDisconnect = onDisconnect(playerRef);
  await playerDisconnect.remove();

  return participantId;
}

/**
 * Remove participant from room
 */
export async function leaveRoom(roomCode: string, participantId: string): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database || !participantId) return;

  const playerRef = ref(database, `rooms/${roomCode}/players/${participantId}`);
  await remove(playerRef);
}

/**
 * Submit student's answer
 */
export async function submitStudentAnswer(
  roomCode: string,
  participantId: string,
  questionIndex: number,
  selectedAnswers: number[]
): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database || !participantId) return;

  const question = ALL_QUESTIONS[questionIndex];
  if (!question) return;

  // Evaluate correctness
  const isCorrect =
    question.correctAnswers.length === selectedAnswers.length &&
    question.correctAnswers.every((ans) => selectedAnswers.includes(ans));

  const pointsEarned = isCorrect ? question.points : 0;

  // Save answer to rooms/{roomCode}/answers/{questionIndex}/{participantId}
  const answerRef = ref(database, `rooms/${roomCode}/answers/${questionIndex}/${participantId}`);
  const answerRecord: AnswerData = {
    participantId,
    questionIndex,
    selectedAnswers,
    isCorrect,
    pointsEarned,
    submittedAt: Date.now(),
  };
  await set(answerRef, answerRecord);

  // Update player record
  const playerRef = ref(database, `rooms/${roomCode}/players/${participantId}`);
  const playerSnap = await get(playerRef);
  const currentScore = playerSnap.val()?.score || 0;

  await update(playerRef, {
    answeredCurrent: true,
    selectedAnswers,
    isCorrect,
    pointsEarned,
    score: currentScore + pointsEarned,
    lastAnswerTime: Date.now(),
  });
}

/**
 * Admin actions
 */
export async function adminStartQuiz(roomCode: string): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  // Reset players answers & scores
  const playersRef = ref(database, `rooms/${roomCode}/players`);
  const playersSnap = await get(playersRef);
  if (playersSnap.exists()) {
    const players = playersSnap.val();
    const updates: Record<string, unknown> = {};
    Object.keys(players).forEach((pId) => {
      updates[`${pId}/score`] = 0;
      updates[`${pId}/answeredCurrent`] = false;
      updates[`${pId}/selectedAnswers`] = [];
      updates[`${pId}/isCorrect`] = null;
      updates[`${pId}/pointsEarned`] = 0;
    });
    await update(playersRef, updates);
  }

  // Clear answers
  await remove(ref(database, `rooms/${roomCode}/answers`));

  const stateRef = ref(database, `rooms/${roomCode}/state`);
  await update(stateRef, {
    status: 'question',
    currentQuestionIndex: 0,
    timeRemaining: 20,
    revealAnswers: false,
    questionStartedAt: Date.now(),
  });
}

export async function adminNextQuestion(roomCode: string, nextIndex: number): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  if (nextIndex >= ALL_QUESTIONS.length) {
    await update(ref(database, `rooms/${roomCode}/state`), {
      status: 'ended',
      revealAnswers: true,
    });
    return;
  }

  // Reset participants' answeredCurrent for new question
  const playersRef = ref(database, `rooms/${roomCode}/players`);
  const playersSnap = await get(playersRef);
  if (playersSnap.exists()) {
    const players = playersSnap.val();
    const updates: Record<string, unknown> = {};
    Object.keys(players).forEach((pId) => {
      updates[`${pId}/answeredCurrent`] = false;
      updates[`${pId}/selectedAnswers`] = [];
      updates[`${pId}/isCorrect`] = null;
      updates[`${pId}/pointsEarned`] = 0;
    });
    await update(playersRef, updates);
  }

  await update(ref(database, `rooms/${roomCode}/state`), {
    status: 'question',
    currentQuestionIndex: nextIndex,
    timeRemaining: 20,
    revealAnswers: false,
    questionStartedAt: Date.now(),
  });
}

export async function adminShowReview(roomCode: string): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  await update(ref(database, `rooms/${roomCode}/state`), {
    status: 'review',
    revealAnswers: true,
  });
}

export async function adminShowRanking(roomCode: string): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  await update(ref(database, `rooms/${roomCode}/state`), {
    status: 'ranking',
    revealAnswers: true,
  });
}

export async function adminResetQuiz(roomCode: string): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  // Reset players answers & scores
  const playersRef = ref(database, `rooms/${roomCode}/players`);
  const playersSnap = await get(playersRef);
  if (playersSnap.exists()) {
    const players = playersSnap.val();
    const updates: Record<string, unknown> = {};
    Object.keys(players).forEach((pId) => {
      updates[`${pId}/score`] = 0;
      updates[`${pId}/answeredCurrent`] = false;
      updates[`${pId}/selectedAnswers`] = [];
      updates[`${pId}/isCorrect`] = null;
      updates[`${pId}/pointsEarned`] = 0;
    });
    await update(playersRef, updates);
  }

  await remove(ref(database, `rooms/${roomCode}/answers`));

  await update(ref(database, `rooms/${roomCode}/state`), {
    status: 'lobby',
    currentQuestionIndex: 0,
    timeRemaining: 20,
    revealAnswers: false,
  });
}

export async function adminSetTimeLimit(roomCode: string, seconds: number): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  await update(ref(database, `rooms/${roomCode}/state`), {
    timeLimit: seconds,
    timeRemaining: seconds,
  });
}

export async function adminKickParticipant(roomCode: string, participantId: string): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  await remove(ref(database, `rooms/${roomCode}/players/${participantId}`));
}

export async function adminUpdateTimeRemaining(roomCode: string, seconds: number): Promise<void> {
  const { database } = getFirebaseInstance();
  if (!database) return;

  await update(ref(database, `rooms/${roomCode}/state`), {
    timeRemaining: seconds,
  });
}
