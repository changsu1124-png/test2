import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
  Database,
  Unsubscribe,
} from 'firebase/database';
import {
  getFirebaseDb,
  ensureAnonymousAuth,
  isFirebaseConfigured,
} from './firebase';
import { ALL_QUESTIONS } from '../data/questions';
import { GameState, Participant, QuizQuestion } from '../types';

export interface RoomMeta {
  hostUid: string;
  createdAt: number;
  maxParticipants: number;
  status: GameState['status'];
  title?: string;
}

export interface RoomState {
  currentQuestionIndex: number;
  status: GameState['status'];
  questionStartedAt: number;
  timeLimit: number;
  revealAnswers: boolean;
}

export interface PlayerData {
  uid: string;
  name: string;
  avatar: string;
  score: number;
  isOnline: boolean;
  lastActive: number;
  answeredCurrent: boolean;
  selectedAnswers: number[];
  isCorrect: boolean | null;
  pointsEarned: number;
}

export class FirebaseQuizService {
  private db: Database | null = null;
  private currentRoomCode: string | null = null;
  private currentUid: string | null = null;
  private unsubscribers: Unsubscribe[] = [];
  private serverTimeOffset = 0;
  private isConnectedToDb = false;

  private onStateChangeCallback?: (state: GameState) => void;
  private onConnectionChangeCallback?: (connected: boolean, detail: string) => void;
  private timerInterval: any = null;

  constructor() {
    this.db = getFirebaseDb();
    this.initServerInfo();
  }

  // Initialize Firebase server info: serverTimeOffset and connected status
  private initServerInfo() {
    if (!this.db) return;

    // Server time offset for synchronized countdown on all phones
    const offsetRef = ref(this.db, '.info/serverTimeOffset');
    const unsubOffset = onValue(offsetRef, (snap) => {
      this.serverTimeOffset = Number(snap.val() || 0);
    });
    this.unsubscribers.push(unsubOffset);

    // Connection state
    const connectedRef = ref(this.db, '.info/connected');
    const unsubConnected = onValue(connectedRef, (snap) => {
      this.isConnectedToDb = snap.val() === true;
      if (this.onConnectionChangeCallback) {
        this.onConnectionChangeCallback(
          this.isConnectedToDb,
          this.isConnectedToDb ? '실시간 데이터베이스 연결됨' : '연결 준비 중...'
        );
      }
    });
    this.unsubscribers.push(unsubConnected);
  }

  public getServerTime(): number {
    return Date.now() + this.serverTimeOffset;
  }

  public setCallbacks(
    onStateChange: (state: GameState) => void,
    onConnectionChange: (connected: boolean, detail: string) => void
  ) {
    this.onStateChangeCallback = onStateChange;
    this.onConnectionChangeCallback = onConnectionChange;
  }

  // Generate a 4-digit room code
  public static generateRoomCode(): string {
    const code = Math.floor(1000 + Math.random() * 9000);
    return code.toString();
  }

  // 3-hour cleanup: remove stale rooms
  public async cleanupOldRooms(): Promise<void> {
    if (!this.db) return;
    try {
      const roomsRef = ref(this.db, 'rooms');
      const snap = await get(roomsRef);
      if (!snap.exists()) return;

      const now = this.getServerTime();
      const threeHoursMs = 3 * 60 * 60 * 1000;
      const updates: Record<string, null> = {};

      snap.forEach((child) => {
        const meta = child.child('meta').val() as RoomMeta | null;
        if (meta && meta.createdAt && now - meta.createdAt > threeHoursMs) {
          updates[child.key!] = null;
        }
      });

      if (Object.keys(updates).length > 0) {
        await update(roomsRef, updates);
      }
    } catch {
      // Ignore cleanup error if permissions restrict reading all rooms
    }
  }

  // Create room (Teacher / Host)
  public async createRoom(
    roomCode: string,
    maxParticipants: number = 30
  ): Promise<{ success: boolean; roomCode: string; error?: string }> {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        roomCode,
        error: 'Firebase 설정이 필요합니다. Vercel 또는 .env에 VITE_FIREBASE_* 키를 등록해 주세요.',
      };
    }

    const user = await ensureAnonymousAuth();
    if (!user) {
      return { success: false, roomCode, error: 'Firebase 익명 인증에 실패했습니다.' };
    }

    this.currentUid = user.uid;
    this.currentRoomCode = roomCode;
    const db = getFirebaseDb();
    if (!db) return { success: false, roomCode, error: '데이터베이스 연결 실패' };

    try {
      const roomRef = ref(db, `rooms/${roomCode}`);
      const metaSnap = await get(ref(db, `rooms/${roomCode}/meta`));

      const now = this.getServerTime();

      // If room already exists with a different host and is active
      if (metaSnap.exists()) {
        const existingMeta = metaSnap.val() as RoomMeta;
        if (existingMeta.hostUid !== user.uid && now - existingMeta.createdAt < 2 * 60 * 60 * 1000) {
          // Room code in use, pick a new 4 digit code
          const newCode = FirebaseQuizService.generateRoomCode();
          return this.createRoom(newCode, maxParticipants);
        }
      }

      const initialMeta: RoomMeta = {
        hostUid: user.uid,
        createdAt: now,
        maxParticipants,
        status: 'lobby',
        title: '하늘고래 퀴즈',
      };

      const initialState: RoomState = {
        currentQuestionIndex: 0,
        status: 'lobby',
        questionStartedAt: now,
        timeLimit: 20,
        revealAnswers: false,
      };

      await set(ref(db, `rooms/${roomCode}/meta`), initialMeta);
      await set(ref(db, `rooms/${roomCode}/state`), initialState);

      // Start listening
      this.subscribeToRoom(roomCode, 'admin');

      // Periodically trigger cleanup of old rooms
      this.cleanupOldRooms().catch(() => {});

      return { success: true, roomCode };
    } catch (err: any) {
      console.error('Error creating room:', err);
      return { success: false, roomCode, error: err.message || '방 생성 중 오류가 발생했습니다.' };
    }
  }

  // Join Room (Student / Parent) with 10-second timeout guarantee
  public async joinRoom(
    roomCode: string,
    name: string,
    avatar: string
  ): Promise<{ success: boolean; participantId?: string; error?: string }> {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        error: 'Firebase 설정이 준비되지 않았습니다. Vercel 환경변수를 확인해 주세요.',
      };
    }

    const joinPromise = async (): Promise<{ success: boolean; participantId?: string; error?: string }> => {
      const user = await ensureAnonymousAuth();
      if (!user) {
        return { success: false, error: '익명 접속 인증에 실패했습니다.' };
      }

      this.currentUid = user.uid;
      this.currentRoomCode = roomCode;
      const db = getFirebaseDb();
      if (!db) return { success: false, error: '데이터베이스 연결 실패' };

      const metaRef = ref(db, `rooms/${roomCode}/meta`);
      const metaSnap = await get(metaRef);

      if (!metaSnap.exists()) {
        return {
          success: false,
          error: '방 코드를 다시 확인해 주세요. (존재하지 않거나 이미 종료된 방입니다)',
        };
      }

      const meta = metaSnap.val() as RoomMeta;
      if (meta.status === 'ended') {
        return {
          success: false,
          error: '이미 종료된 퀴즈 방입니다. 선생님께 새 방 코드를 문의해 주세요.',
        };
      }

      // Check current participant count
      const playersRef = ref(db, `rooms/${roomCode}/players`);
      const playersSnap = await get(playersRef);
      const playersObj = playersSnap.val() || {};
      const existingPlayer = playersObj[user.uid];

      if (!existingPlayer && Object.keys(playersObj).length >= (meta.maxParticipants || 30)) {
        return {
          success: false,
          error: `인원이 가득 찼습니다! (최대 ${meta.maxParticipants || 30}명)`,
        };
      }

      const now = this.getServerTime();
      const playerData: PlayerData = {
        uid: user.uid,
        name: name.trim(),
        avatar: avatar || '🐳',
        score: existingPlayer?.score || 0,
        isOnline: true,
        lastActive: now,
        answeredCurrent: existingPlayer?.answeredCurrent || false,
        selectedAnswers: existingPlayer?.selectedAnswers || [],
        isCorrect: existingPlayer?.isCorrect ?? null,
        pointsEarned: existingPlayer?.pointsEarned || 0,
      };

      // Set user player data
      const myPlayerRef = ref(db, `rooms/${roomCode}/players/${user.uid}`);
      await set(myPlayerRef, playerData);

      // On disconnect, mark offline
      const onlineStatusRef = ref(db, `rooms/${roomCode}/players/${user.uid}/isOnline`);
      onDisconnect(onlineStatusRef).set(false);

      // Save to localStorage for auto reconnection
      try {
        localStorage.setItem('whale_quiz_room_code', roomCode);
        localStorage.setItem('whale_quiz_uid', user.uid);
        localStorage.setItem('whale_quiz_name', name);
        localStorage.setItem('whale_quiz_avatar', avatar);
      } catch {
        // LocalStorage fallback
      }

      // Subscribe to updates
      this.subscribeToRoom(roomCode, 'student');

      return { success: true, participantId: user.uid };
    };

    // Wrap with 10-second timeout
    const timeoutPromise = new Promise<{ success: boolean; error: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: '접속 실패 – 10초 내에 연결되지 않았습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.',
        });
      }, 10000);
    });

    return Promise.race([joinPromise(), timeoutPromise]);
  }

  // Subscribe to room updates (meta, state, players)
  public subscribeToRoom(roomCode: string, role: 'student' | 'admin') {
    this.clearSubscriptions();
    this.currentRoomCode = roomCode;

    const db = getFirebaseDb();
    if (!db) return;

    let currentMeta: RoomMeta | null = null;
    let currentState: RoomState | null = null;
    let currentPlayers: Record<string, PlayerData> = {};

    const syncState = () => {
      if (!this.onStateChangeCallback || !currentState) return;

      const qIndex = currentState.currentQuestionIndex ?? 0;
      const currentQ = ALL_QUESTIONS[qIndex];

      // Sanitized public question: hide correctAnswers during answering phase!
      const shouldReveal = currentState.revealAnswers || currentState.status === 'review' || currentState.status === 'ranking' || currentState.status === 'ended';
      const sanitizedQuestion: QuizQuestion | undefined = currentQ ? {
        ...currentQ,
        correctAnswers: shouldReveal ? currentQ.correctAnswers : [],
        explanation: shouldReveal ? currentQ.explanation : undefined,
      } : undefined;

      // Calculate synchronized remaining time
      const now = this.getServerTime();
      const elapsed = Math.max(0, Math.floor((now - (currentState.questionStartedAt || now)) / 1000));
      const remaining = Math.max(0, (currentState.timeLimit || 20) - elapsed);

      const participantsList: Participant[] = Object.values(currentPlayers).map((p) => ({
        id: p.uid,
        name: p.name,
        avatar: p.avatar,
        score: p.score || 0,
        answeredCurrent: p.answeredCurrent || false,
        selectedAnswers: p.selectedAnswers || [],
        isCorrect: p.isCorrect ?? null,
        pointsEarned: p.pointsEarned || 0,
        isOnline: p.isOnline !== false,
      }));

      const fullState: GameState = {
        status: currentState.status,
        currentQuestionIndex: qIndex,
        timeLimit: currentState.timeLimit || 20,
        timeRemaining: remaining,
        participants: participantsList,
        maxParticipants: currentMeta?.maxParticipants || 30,
        selectedQuestionSet: 'all',
        totalQuestions: ALL_QUESTIONS.length,
        currentQuestion: sanitizedQuestion,
        revealAnswers: currentState.revealAnswers,
      };

      this.onStateChangeCallback(fullState);
    };

    // Meta listener
    const metaRef = ref(db, `rooms/${roomCode}/meta`);
    const unsubMeta = onValue(metaRef, (snap) => {
      currentMeta = snap.val() as RoomMeta | null;
      syncState();
    });
    this.unsubscribers.push(unsubMeta);

    // State listener
    const stateRef = ref(db, `rooms/${roomCode}/state`);
    const unsubState = onValue(stateRef, (snap) => {
      currentState = snap.val() as RoomState | null;
      syncState();
    });
    this.unsubscribers.push(unsubState);

    // Players listener
    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const unsubPlayers = onValue(playersRef, (snap) => {
      currentPlayers = snap.val() || {};
      syncState();
    });
    this.unsubscribers.push(unsubPlayers);

    // Setup local tick for ticking down remaining seconds smoothly
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (currentState && currentState.status === 'question') {
        syncState();
      }
    }, 1000);
  }

  // Submit Answer
  public async submitAnswer(
    roomCode: string,
    questionIndex: number,
    selectedAnswers: number[]
  ): Promise<void> {
    const user = await ensureAnonymousAuth();
    if (!user) return;

    const db = getFirebaseDb();
    if (!db) return;

    const currentQ = ALL_QUESTIONS[questionIndex];
    if (!currentQ) return;

    // Check correctness
    const sortedSelected = [...selectedAnswers].sort().join(',');
    const sortedCorrect = [...currentQ.correctAnswers].sort().join(',');
    const isCorrect = sortedSelected === sortedCorrect;
    const points = isCorrect ? (currentQ.points || 10) : 0;

    const now = this.getServerTime();

    // 1. Record answer under `rooms/{roomCode}/answers/{questionIndex}/{uid}`
    const answerRef = ref(db, `rooms/${roomCode}/answers/${questionIndex}/${user.uid}`);
    await set(answerRef, {
      selectedAnswers,
      submittedAt: now,
      isCorrect,
      points,
    });

    // 2. Fetch current player to increment score
    const playerRef = ref(db, `rooms/${roomCode}/players/${user.uid}`);
    const snap = await get(playerRef);
    const prevData = snap.val() as PlayerData | null;
    const prevScore = prevData?.score || 0;

    await update(playerRef, {
      answeredCurrent: true,
      selectedAnswers,
      isCorrect,
      pointsEarned: points,
      score: prevScore + points,
      lastActive: now,
    });
  }

  // Teacher Controls
  public async startQuiz(roomCode: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;

    const now = this.getServerTime();

    // Reset players' answer states and scores
    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const snap = await get(playersRef);
    if (snap.exists()) {
      const updates: Record<string, any> = {};
      snap.forEach((child) => {
        updates[`${child.key}/score`] = 0;
        updates[`${child.key}/answeredCurrent`] = false;
        updates[`${child.key}/selectedAnswers`] = [];
        updates[`${child.key}/isCorrect`] = null;
        updates[`${child.key}/pointsEarned`] = 0;
      });
      await update(playersRef, updates);
    }

    const stateUpdate: Partial<RoomState> = {
      currentQuestionIndex: 0,
      status: 'question',
      questionStartedAt: now,
      revealAnswers: false,
    };

    await update(ref(db, `rooms/${roomCode}/state`), stateUpdate);
    await update(ref(db, `rooms/${roomCode}/meta`), { status: 'question' });
  }

  public async nextQuestion(roomCode: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;

    const stateSnap = await get(ref(db, `rooms/${roomCode}/state`));
    const currentState = stateSnap.val() as RoomState;
    const nextIndex = (currentState?.currentQuestionIndex || 0) + 1;

    // Check if finished
    if (nextIndex >= ALL_QUESTIONS.length) {
      await this.showRanking(roomCode);
      return;
    }

    const now = this.getServerTime();

    // Reset player answer status for new question
    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const snap = await get(playersRef);
    if (snap.exists()) {
      const updates: Record<string, any> = {};
      snap.forEach((child) => {
        updates[`${child.key}/answeredCurrent`] = false;
        updates[`${child.key}/selectedAnswers`] = [];
        updates[`${child.key}/isCorrect`] = null;
        updates[`${child.key}/pointsEarned`] = 0;
      });
      await update(playersRef, updates);
    }

    await update(ref(db, `rooms/${roomCode}/state`), {
      currentQuestionIndex: nextIndex,
      status: 'question',
      questionStartedAt: now,
      revealAnswers: false,
    });
    await update(ref(db, `rooms/${roomCode}/meta`), { status: 'question' });
  }

  public async showReview(roomCode: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;

    await update(ref(db, `rooms/${roomCode}/state`), {
      revealAnswers: true,
      status: 'review',
    });
    await update(ref(db, `rooms/${roomCode}/meta`), { status: 'review' });
  }

  public async showRanking(roomCode: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;

    await update(ref(db, `rooms/${roomCode}/state`), {
      status: 'ranking',
      revealAnswers: true,
    });
    await update(ref(db, `rooms/${roomCode}/meta`), { status: 'ranking' });
  }

  public async resetQuiz(roomCode: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;

    // Reset players
    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const snap = await get(playersRef);
    if (snap.exists()) {
      const updates: Record<string, any> = {};
      snap.forEach((child) => {
        updates[`${child.key}/score`] = 0;
        updates[`${child.key}/answeredCurrent`] = false;
        updates[`${child.key}/selectedAnswers`] = [];
        updates[`${child.key}/isCorrect`] = null;
        updates[`${child.key}/pointsEarned`] = 0;
      });
      await update(playersRef, updates);
    }

    await update(ref(db, `rooms/${roomCode}/state`), {
      currentQuestionIndex: 0,
      status: 'lobby',
      revealAnswers: false,
    });
    await update(ref(db, `rooms/${roomCode}/meta`), { status: 'lobby' });
  }

  public async setTimeLimit(roomCode: string, seconds: number): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;
    await update(ref(db, `rooms/${roomCode}/state`), { timeLimit: seconds });
  }

  public async setMaxParticipants(roomCode: string, max: number): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;
    await update(ref(db, `rooms/${roomCode}/meta`), { maxParticipants: max });
  }

  public async kickParticipant(roomCode: string, uid: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;
    await remove(ref(db, `rooms/${roomCode}/players/${uid}`));
  }

  public async deleteRoom(roomCode: string): Promise<void> {
    const db = getFirebaseDb();
    if (!db) return;
    await remove(ref(db, `rooms/${roomCode}`));
  }

  // Handle phone sleep / lock / visibility change
  public handleVisibilityChange(isVisible: boolean) {
    if (!isVisible || !this.currentRoomCode || !this.currentUid) return;

    const db = getFirebaseDb();
    if (!db) return;

    const now = this.getServerTime();
    const onlineRef = ref(db, `rooms/${this.currentRoomCode}/players/${this.currentUid}/isOnline`);
    set(onlineRef, true).catch(() => {});

    const lastActiveRef = ref(db, `rooms/${this.currentRoomCode}/players/${this.currentUid}/lastActive`);
    set(lastActiveRef, now).catch(() => {});
  }

  public clearSubscriptions() {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public destroy() {
    this.clearSubscriptions();
    if (this.currentRoomCode && this.currentUid && this.db) {
      const onlineRef = ref(this.db, `rooms/${this.currentRoomCode}/players/${this.currentUid}/isOnline`);
      set(onlineRef, false).catch(() => {});
    }
  }
}
