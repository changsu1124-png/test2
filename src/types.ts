export interface QuizQuestion {
  id: number;
  category: '우리 학교' | '과학' | '역사' | '시사' | '상식';
  question: string;
  options: string[];
  correctAnswers: number[]; // 0-indexed indices (length 1 or 2)
  points: number; // 10 for 1 answer, 20 for 2 answers (double points)
  explanation?: string;
}

export interface Participant {
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
}

export type GameStatus = 'lobby' | 'countdown' | 'question' | 'feedback' | 'review' | 'ranking' | 'ended';

export interface GameState {
  status: GameStatus;
  currentQuestionIndex: number;
  timeLimit: number; // in seconds (default 10)
  timeRemaining: number;
  participants: Participant[];
  maxParticipants: number;
  selectedQuestionSet: string;
  totalQuestions: number;
  currentQuestion?: QuizQuestion;
  revealAnswers: boolean;
}

export type WebSocketClientMessage =
  | { type: 'join'; name: string; avatar: string }
  | { type: 'submit_answer'; questionIndex: number; selectedAnswers: number[] }
  | { type: 'admin:start_quiz' }
  | { type: 'admin:next_question' }
  | { type: 'admin:show_ranking' }
  | { type: 'admin:show_review' }
  | { type: 'admin:reset_quiz' }
  | { type: 'admin:set_time_limit'; seconds: number }
  | { type: 'admin:set_question_set'; questionSet: string }
  | { type: 'admin:kick_participant'; participantId: string }
  | { type: 'ping' };

export type WebSocketServerMessage =
  | { type: 'state_update'; state: GameState; role?: 'student' | 'admin' }
  | { type: 'join_success'; participantId: string }
  | { type: 'error'; message: string }
  | { type: 'answer_result'; isCorrect: boolean; points: number; correctAnswers: number[]; explanation?: string }
  | { type: 'pong' };
