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
  OnDisconnect,
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
  uid?: string;
  name?: string;
  nickname?: string;
  avatar?: string;
  score?: number;
  connected?: boolean;
  isOnline?: boolean;
  lastSeen?: number | object;
  lastActive?: number | object;
  answeredCurrent?: boolean;
  selectedAnswers?: number[];
  isCorrect?: boolean | null;
  pointsEarned?: number;
}

export class FirebaseQuizService {
  private db: Database | null = null;
  private currentRoomCode: string | null = null;
  private currentRole: 'student' | 'admin' = 'student';
  private currentUid: string | null = null;
  private unsubscribers: Unsubscribe[] = [];
  private serverTimeOffset = 0;
  private isConnectedToDb = false;

  private onStateChangeCallback?: (state: GameState) => void;
  private onConnectionChangeCallback?: (connected: boolean, detail: string) => void;
  private onErrorCallback?: (errorMessage: string | null) => void;
  private timerInterval: any = null;
  private retryTimer: any = null;
  private activeOnDisconnect: OnDisconnect | null = null;

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
    onConnectionChange: (connected: boolean, detail: string) => void,
    onError?: (errorMessage: string | null) => void
  ) {
    this.onStateChangeCallback = onStateChange;
    this.onConnectionChangeCallback = onConnectionChange;
    this.onErrorCallback = onError;
  }

  // Generate a 4-digit room code
  public static generateRoomCode(): string {
    const code = Math.floor(1000 + Math.random() * 9000);
    return code.toString();
  }

  // Schedule auto-retry subscription after 3 seconds
  private scheduleRetrySubscription(roomCode: string, role: 'student' | 'admin') {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.retryTimer = setTimeout(() => {
      console.log(`[Firebase] 3초 후 방 구독 자동 재시도: ${roomCode} (${role})`);
      this.subscribeToRoom(roomCode, role);
    }, 3000);
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

    // Step 2: signInAnonymously 완료 및 onAuthStateChanged로 user 확인 후에만 진행
    const user = await ensureAnonymousAuth();
    if (!user) {
      return { success: false, roomCode, error: 'Firebase 익명 인증에 실패했습니다.' };
    }

    this.currentUid = user.uid;
    this.currentRoomCode = roomCode;
    this.currentRole = 'admin';

    const db = getFirebaseDb();
    if (!db) return { success: false, roomCode, error: '데이터베이스 연결 실패' };

    try {
      const metaSnap = await get(ref(db, `rooms/${roomCode}/meta`));
      const now = this.getServerTime();

      if (!metaSnap.exists()) {
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
      } else {
        // Room already exists; ensure hostUid is set and room stays on this code
        await update(ref(db, `rooms/${roomCode}/meta`), {
          hostUid: user.uid,
          maxParticipants,
        });
      }

      // Start listening to the exact same rooms/{roomCode}/players
      await this.subscribeToRoom(roomCode, 'admin');

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
      // Step 2: signInAnonymously 완료 및 onAuthStateChanged로 user 확인
      const user = await ensureAnonymousAuth();
      if (!user) {
        return { success: false, error: '익명 접속 인증에 실패했습니다.' };
      }

      this.currentUid = user.uid;
      this.currentRoomCode = roomCode;
      this.currentRole = 'student';

      const db = getFirebaseDb();
      if (!db) return { success: false, error: '데이터베이스 연결 실패' };

      const metaRef = ref(db, `rooms/${roomCode}/meta`);
      const metaSnap = await get(metaRef);

      // Auto-create meta if missing so students can connect smoothly
      if (!metaSnap.exists()) {
        const now = this.getServerTime();
        await set(metaRef, {
          hostUid: 'host',
          createdAt: now,
          maxParticipants: 30,
          status: 'lobby',
          title: '하늘고래 퀴즈',
        });
        await set(ref(db, `rooms/${roomCode}/state`), {
          currentQuestionIndex: 0,
          status: 'lobby',
          questionStartedAt: now,
          timeLimit: 20,
          revealAnswers: false,
        });
      } else {
        const meta = metaSnap.val() as RoomMeta;
        if (meta.status === 'ended') {
          return {
            success: false,
            error: '이미 종료된 퀴즈 방입니다. 선생님께 새 방 코드를 문의해 주세요.',
          };
        }
      }

      // Check current participant count
      const playersRef = ref(db, `rooms/${roomCode}/players`);
      const playersSnap = await get(playersRef);
      const playersObj = (playersSnap.val() || {}) as Record<string, PlayerData>;
      const existingPlayer = playersObj[user.uid];

      const currentValidCount = Object.values(playersObj).filter(
        (p) => p && (p.nickname || p.name)
      ).length;

      const metaVal = (await get(metaRef)).val() as RoomMeta | null;
      const maxParticipants = metaVal?.maxParticipants || 30;

      if (!existingPlayer && currentValidCount >= maxParticipants) {
        return {
          success: false,
          error: `인원이 가득 찼습니다! (최대 ${maxParticipants}명)`,
        };
      }

      const now = this.getServerTime();
      const trimmedName = name.trim();

      const playerData: PlayerData = {
        uid: user.uid,
        name: trimmedName,
        nickname: trimmedName,
        avatar: avatar || '🐳',
        score: existingPlayer?.score || 0,
        connected: true,
        isOnline: true,
        lastSeen: now,
        lastActive: now,
        answeredCurrent: existingPlayer?.answeredCurrent || false,
        selectedAnswers: existingPlayer?.selectedAnswers || [],
        isCorrect: existingPlayer?.isCorrect ?? null,
        pointsEarned: existingPlayer?.pointsEarned || 0,
      };

      // Set user player data
      const myPlayerRef = ref(db, `rooms/${roomCode}/players/${user.uid}`);
      await set(myPlayerRef, playerData);

      // On disconnect: update connected=false and lastSeen on the player entry
      const playerDisconnect = onDisconnect(myPlayerRef);
      await playerDisconnect.update({
        connected: false,
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
      this.activeOnDisconnect = playerDisconnect;

      // Save to localStorage for auto reconnection
      try {
        localStorage.setItem('whale_quiz_room_code', roomCode);
        localStorage.setItem('whale_quiz_uid', user.uid);
        localStorage.setItem('whale_quiz_name', trimmedName);
        localStorage.setItem('whale_quiz_avatar', avatar);
      } catch {
        // LocalStorage fallback
      }

      // Subscribe to updates
      await this.subscribeToRoom(roomCode, 'student');

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

  // Active student leaves: cancel onDisconnect & remove node completely
  public async leaveRoom(roomCode: string, uid?: string): Promise<void> {
    const targetUid = uid || this.currentUid;
    const db = getFirebaseDb();
    if (!db || !targetUid) return;

    try {
      const playerRef = ref(db, `rooms/${roomCode}/players/${targetUid}`);

      // 1. Cancel onDisconnect reservation so it will not fire and recreate a ghost item
      if (this.activeOnDisconnect) {
        await this.activeOnDisconnect.cancel().catch(() => {});
        this.activeOnDisconnect = null;
      }
      await onDisconnect(playerRef).cancel().catch(() => {});

      // 2. Completely remove the player node
      await remove(playerRef);
    } catch (err) {
      console.warn('[Firebase] leaveRoom error:', err);
    }
  }

  // Subscribe to room updates (meta, state, players)
  // Ensures anonymous auth completes FIRST before onValue listeners attach
  public async subscribeToRoom(roomCode: string, role: 'student' | 'admin'): Promise<void> {
    this.clearSubscriptions();
    this.currentRoomCode = roomCode;
    this.currentRole = role;

    if (!isFirebaseConfigured()) {
      return;
    }

    // Step 2 Requirement:
    // signInAnonymously가 완료된 뒤(onAuthStateChanged로 user가 확인된 뒤)에만 onValue 구독을 시작
    const user = await ensureAnonymousAuth();
    if (!user) {
      const authErrorMsg = 'Firebase 인증 확인 중... 3초 후 다시 구독합니다.';
      if (this.onErrorCallback) {
        this.onErrorCallback(authErrorMsg);
      }
      this.scheduleRetrySubscription(roomCode, role);
      return;
    }

    this.currentUid = user.uid;

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
      const shouldReveal =
        currentState.revealAnswers ||
        currentState.status === 'review' ||
        currentState.status === 'ranking' ||
        currentState.status === 'ended';

      const sanitizedQuestion: QuizQuestion | undefined = currentQ
        ? {
            ...currentQ,
            correctAnswers: shouldReveal ? currentQ.correctAnswers : [],
            explanation: shouldReveal ? currentQ.explanation : undefined,
          }
        : undefined;

      // Calculate synchronized remaining time
      const now = this.getServerTime();
      const elapsed = Math.max(0, Math.floor((now - (currentState.questionStartedAt || now)) / 1000));
      const remaining = Math.max(0, (currentState.timeLimit || 20) - elapsed);

      // Step 3 Requirement: 빈 참가자(유령 데이터) 제거
      // 목록을 표시할 때 nickname이 없는 항목은 화면에 보여 주지 않고 인원수에서도 제외
      const participantsList: Participant[] = [];
      for (const [key, raw] of Object.entries(currentPlayers || {})) {
        if (!raw || typeof raw !== 'object') continue;
        const p = raw as PlayerData;
        const nickname = (p.nickname || p.name || '').trim();
        if (!nickname) {
          // Skip empty ghost item completely
          continue;
        }

        // Step 1: 접속 끊김(connected=false) 여부 체크
        const isUserOnline = p.connected !== false && p.isOnline !== false;

        participantsList.push({
          id: p.uid || key,
          name: nickname,
          avatar: p.avatar || '🐳',
          score: typeof p.score === 'number' ? p.score : 0,
          answeredCurrent: Boolean(p.answeredCurrent),
          selectedAnswers: Array.isArray(p.selectedAnswers) ? p.selectedAnswers : [],
          isCorrect: p.isCorrect ?? null,
          pointsEarned: typeof p.pointsEarned === 'number' ? p.pointsEarned : 0,
          isOnline: isUserOnline,
        });
      }

      // Step 4 Requirement: 확인용 로그
      // 개발 확인을 위해 선생님 화면에서 구독 방 코드, 인증 uid, 받은 참가자 수를 console.log로 출력
      if (this.currentRole === 'admin' || role === 'admin') {
        console.log(
          `[선생님 화면] 구독 방 코드: ${roomCode} | 인증 UID: ${this.currentUid} | 받은 참가자 수: ${participantsList.length}명`,
          participantsList
        );
      }

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

      // Clear any prior error banner on successful sync
      if (this.onErrorCallback) {
        this.onErrorCallback(null);
      }

      this.onStateChangeCallback(fullState);
    };

    // onValue Error Handler with Korean notification & 3-second auto-retry
    const handleListenerError = (error: any, path: string) => {
      console.error(`[Firebase onValue 에러 - ${path}]:`, error);
      const isPermissionDenied =
        error?.code === 'PERMISSION_DENIED' ||
        error?.message?.includes('permission_denied') ||
        error?.message?.includes('PERMISSION_DENIED');

      const koreanMessage = isPermissionDenied
        ? '데이터베이스 접근 권한 오류(PERMISSION_DENIED)가 발생했습니다. 잠시 후 3초 뒤 자동으로 다시 연결합니다.'
        : `데이터베이스 동기화 오류(${error?.code || '오류'}): 3초 후 자동으로 다시 연결합니다.`;

      if (this.onErrorCallback) {
        this.onErrorCallback(koreanMessage);
      }
      if (this.onConnectionChangeCallback) {
        this.onConnectionChangeCallback(false, koreanMessage);
      }

      this.scheduleRetrySubscription(roomCode, role);
    };

    // 1. Meta listener
    const metaRef = ref(db, `rooms/${roomCode}/meta`);
    const unsubMeta = onValue(
      metaRef,
      (snap) => {
        currentMeta = snap.val() as RoomMeta | null;
        syncState();
      },
      (err) => handleListenerError(err, `rooms/${roomCode}/meta`)
    );
    this.unsubscribers.push(unsubMeta);

    // 2. State listener
    const stateRef = ref(db, `rooms/${roomCode}/state`);
    const unsubState = onValue(
      stateRef,
      (snap) => {
        currentState = snap.val() as RoomState | null;
        syncState();
      },
      (err) => handleListenerError(err, `rooms/${roomCode}/state`)
    );
    this.unsubscribers.push(unsubState);

    // 3. Players listener - 완전히 동일한 경로 rooms/{roomCode}/players
    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const unsubPlayers = onValue(
      playersRef,
      (snap) => {
        currentPlayers = snap.val() || {};
        syncState();
      },
      (err) => handleListenerError(err, `rooms/${roomCode}/players`)
    );
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
      connected: true,
      isOnline: true,
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
    const playerRef = ref(db, `rooms/${roomCode}/players/${uid}`);
    await onDisconnect(playerRef).cancel().catch(() => {});
    await remove(playerRef);
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
    const playerRef = ref(db, `rooms/${this.currentRoomCode}/players/${this.currentUid}`);
    update(playerRef, {
      connected: true,
      isOnline: true,
      lastSeen: now,
      lastActive: now,
    }).catch(() => {});
  }

  public clearSubscriptions() {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public destroy() {
    this.clearSubscriptions();
    if (this.currentRoomCode && this.currentUid && this.db) {
      const playerRef = ref(this.db, `rooms/${this.currentRoomCode}/players/${this.currentUid}`);
      update(playerRef, {
        connected: false,
        isOnline: false,
      }).catch(() => {});
    }
  }
}
