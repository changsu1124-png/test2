import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { ALL_QUESTIONS } from './src/data/questions.ts';
import { GameState, Participant, QuizQuestion, WebSocketClientMessage } from './src/types.ts';

const PORT = 3000;
const app = express();
const server = http.createServer(app);

app.use(express.json());

// In-memory Quiz State
const MAX_PARTICIPANTS = 20;
let questionsList: QuizQuestion[] = [...ALL_QUESTIONS];

let gameState: GameState = {
  status: 'lobby',
  currentQuestionIndex: 0,
  timeLimit: 20, // 20 seconds default
  timeRemaining: 20,
  participants: [],
  maxParticipants: MAX_PARTICIPANTS,
  selectedQuestionSet: 'all',
  totalQuestions: questionsList.length,
  revealAnswers: false,
};

// Map of socket -> participantId
const socketMap = new Map<WebSocket, { participantId?: string; role: 'student' | 'admin' }>();
let timerInterval: NodeJS.Timeout | null = null;
let autoNextTimeout: NodeJS.Timeout | null = null;

function broadcastState() {
  const currentQ = (gameState.status === 'question' || gameState.status === 'review') 
    ? questionsList[gameState.currentQuestionIndex] 
    : undefined;

  const publicQuestion = currentQ ? {
    ...currentQ,
    // Hide correct answers during question solving phase from students!
    correctAnswers: gameState.revealAnswers || gameState.status === 'review' || gameState.status === 'ranking' 
      ? currentQ.correctAnswers 
      : [],
    explanation: gameState.revealAnswers || gameState.status === 'review' 
      ? currentQ.explanation 
      : undefined,
  } : undefined;

  const payload = {
    type: 'state_update',
    state: {
      ...gameState,
      totalQuestions: questionsList.length,
      currentQuestion: publicQuestion,
    },
  };

  const jsonStr = JSON.stringify(payload);
  for (const [ws, info] of socketMap.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      if (info.role === 'admin') {
        // Admin always sees correct answers and full details
        const adminPayload = JSON.stringify({
          type: 'state_update',
          state: {
            ...gameState,
            totalQuestions: questionsList.length,
            currentQuestion: currentQ,
          },
          role: 'admin',
        });
        ws.send(adminPayload);
      } else {
        ws.send(jsonStr);
      }
    }
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (autoNextTimeout) {
    clearTimeout(autoNextTimeout);
    autoNextTimeout = null;
  }
}

function startQuestionTimer() {
  stopTimer();
  gameState.timeRemaining = gameState.timeLimit;
  gameState.revealAnswers = false;

  const startTime = Date.now();
  const totalDuration = gameState.timeLimit * 1000;

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, Math.ceil((totalDuration - elapsed) / 100) / 10);
    gameState.timeRemaining = remaining;

    if (elapsed >= totalDuration) {
      // Time out!
      stopTimer();
      handleTimeOut();
    } else {
      broadcastState();
    }
  }, 100);
}

function handleTimeOut() {
  gameState.timeRemaining = 0;
  gameState.revealAnswers = true;
  gameState.status = 'review';

  // Mark all unanswered as timed out / incorrect
  const currentQ = questionsList[gameState.currentQuestionIndex];
  for (const p of gameState.participants) {
    if (!p.answeredCurrent) {
      p.answeredCurrent = true;
      p.isCorrect = false;
      p.pointsEarned = 0;
      p.selectedAnswers = [];
    }
  }

  broadcastState();
}

function checkAllAnswered() {
  const onlineParticipants = gameState.participants.filter(p => p.isOnline);
  if (onlineParticipants.length === 0) return;

  const allAnswered = onlineParticipants.every(p => p.answeredCurrent);
  if (allAnswered && gameState.status === 'question') {
    stopTimer();
    gameState.revealAnswers = true;
    gameState.status = 'review';
    broadcastState();
  }
}

function evaluateAnswer(selected: number[], correct: number[], basePoints: number): boolean {
  if (selected.length !== correct.length) return false;
  const sortedSelected = [...selected].sort();
  const sortedCorrect = [...correct].sort();
  return sortedSelected.every((val, index) => val === sortedCorrect[index]);
}

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket, request) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const role = url.searchParams.get('role') === 'admin' ? 'admin' : 'student';

  socketMap.set(ws, { role });

  // Send initial state (ensuring question answering confidentiality)
  const initialQ = questionsList[gameState.currentQuestionIndex];
  const publicInitialQ = (role === 'admin' || gameState.revealAnswers || gameState.status === 'review' || gameState.status === 'ranking')
    ? initialQ
    : (initialQ ? { ...initialQ, correctAnswers: [], explanation: undefined } : undefined);

  ws.send(JSON.stringify({
    type: 'state_update',
    state: {
      ...gameState,
      totalQuestions: questionsList.length,
      currentQuestion: publicInitialQ,
    },
    role,
  }));

  ws.on('message', (rawData) => {
    try {
      const msg: WebSocketClientMessage = JSON.parse(rawData.toString());

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'join') {
        // Check if student already exists or reconnected
        let participant = gameState.participants.find(p => p.name === msg.name.trim());
        if (participant) {
          participant.isOnline = true;
          participant.avatar = msg.avatar || participant.avatar;
          socketMap.set(ws, { participantId: participant.id, role: 'student' });
          ws.send(JSON.stringify({ type: 'join_success', participantId: participant.id }));
          broadcastState();
          return;
        }

        if (gameState.participants.length >= gameState.maxParticipants) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `참여 인원이 가득 찼습니다 (최대 ${gameState.maxParticipants}명)`,
          }));
          return;
        }

        const newParticipant: Participant = {
          id: 'p_' + Math.random().toString(36).substring(2, 9),
          name: msg.name.trim() || `학생 ${gameState.participants.length + 1}`,
          avatar: msg.avatar || '🐳',
          score: 0,
          answeredCurrent: false,
          selectedAnswers: [],
          isCorrect: null,
          pointsEarned: 0,
          isOnline: true,
        };

        gameState.participants.push(newParticipant);
        socketMap.set(ws, { participantId: newParticipant.id, role: 'student' });

        ws.send(JSON.stringify({ type: 'join_success', participantId: newParticipant.id }));
        broadcastState();
        return;
      }

      if (msg.type === 'submit_answer') {
        const info = socketMap.get(ws);
        if (!info?.participantId || gameState.status !== 'question') return;

        const participant = gameState.participants.find(p => p.id === info.participantId);
        if (!participant || participant.answeredCurrent) return;

        const currentQ = questionsList[gameState.currentQuestionIndex];
        if (!currentQ) return;

        const isCorrect = evaluateAnswer(msg.selectedAnswers, currentQ.correctAnswers, currentQ.points);
        const points = isCorrect ? currentQ.points : 0;

        participant.answeredCurrent = true;
        participant.selectedAnswers = msg.selectedAnswers;
        participant.isCorrect = isCorrect;
        participant.pointsEarned = points;
        participant.score += points;
        participant.lastAnswerTime = Date.now();

        // Send individual feedback to the submitting student
        ws.send(JSON.stringify({
          type: 'answer_result',
          isCorrect,
          points,
          correctAnswers: currentQ.correctAnswers,
          explanation: currentQ.explanation,
        }));

        broadcastState();
        checkAllAnswered();
        return;
      }

      // Admin actions
      if (msg.type === 'admin:start_quiz') {
        stopTimer();
        gameState.status = 'question';
        gameState.currentQuestionIndex = 0;
        gameState.revealAnswers = false;
        // Reset answer states
        for (const p of gameState.participants) {
          p.score = 0;
          p.answeredCurrent = false;
          p.selectedAnswers = [];
          p.isCorrect = null;
          p.pointsEarned = 0;
        }
        startQuestionTimer();
        broadcastState();
        return;
      }

      if (msg.type === 'admin:next_question') {
        stopTimer();
        const nextIdx = gameState.currentQuestionIndex + 1;
        if (nextIdx < questionsList.length) {
          gameState.currentQuestionIndex = nextIdx;
          gameState.status = 'question';
          gameState.revealAnswers = false;
          for (const p of gameState.participants) {
            p.answeredCurrent = false;
            p.selectedAnswers = [];
            p.isCorrect = null;
            p.pointsEarned = 0;
          }
          startQuestionTimer();
        } else {
          gameState.status = 'ended';
        }
        broadcastState();
        return;
      }

      if (msg.type === 'admin:show_ranking') {
        stopTimer();
        gameState.status = 'ranking';
        broadcastState();
        return;
      }

      if (msg.type === 'admin:show_review') {
        stopTimer();
        gameState.status = 'review';
        gameState.revealAnswers = true;
        broadcastState();
        return;
      }

      if (msg.type === 'admin:reset_quiz') {
        stopTimer();
        gameState.status = 'lobby';
        gameState.currentQuestionIndex = 0;
        gameState.revealAnswers = false;
        for (const p of gameState.participants) {
          p.score = 0;
          p.answeredCurrent = false;
          p.selectedAnswers = [];
          p.isCorrect = null;
          p.pointsEarned = 0;
        }
        broadcastState();
        return;
      }

      if (msg.type === 'admin:set_time_limit') {
        if (msg.seconds >= 5 && msg.seconds <= 60) {
          gameState.timeLimit = msg.seconds;
          if (gameState.status !== 'question') {
            gameState.timeRemaining = msg.seconds;
          }
          broadcastState();
        }
        return;
      }

      if (msg.type === 'admin:kick_participant') {
        gameState.participants = gameState.participants.filter(p => p.id !== msg.participantId);
        broadcastState();
        return;
      }

    } catch (err) {
      console.error('Error handling ws message:', err);
    }
  });

  ws.on('close', () => {
    const info = socketMap.get(ws);
    if (info?.participantId) {
      const p = gameState.participants.find(part => part.id === info.participantId);
      if (p) {
        p.isOnline = false;
      }
    }
    socketMap.delete(ws);
    broadcastState();
  });
});

// Upgrade handling for WebSockets
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/state', (req, res) => {
  const currentQ = questionsList[gameState.currentQuestionIndex];
  const publicQuestion = currentQ ? {
    ...currentQ,
    correctAnswers: gameState.revealAnswers || gameState.status === 'review' || gameState.status === 'ranking'
      ? currentQ.correctAnswers
      : [],
    explanation: gameState.revealAnswers || gameState.status === 'review'
      ? currentQ.explanation
      : undefined,
  } : undefined;

  res.json({
    ...gameState,
    currentQuestion: publicQuestion,
  });
});

// Vite Integration
async function startApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[하늘고래 퀴즈] Server running on http://0.0.0.0:${PORT}`);
  });
}

startApp().catch(err => {
  console.error('Failed to start server:', err);
});
