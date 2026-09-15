import { ALL_QUESTIONS } from '../data/questions';
import { GameState, Participant, QuizQuestion, WebSocketClientMessage, WebSocketServerMessage } from '../types';

export interface QuizHostCallbacks {
  onBroadcast: (publicState: GameState, adminState: GameState) => void;
  onDirectResponse: (participantId: string, message: WebSocketServerMessage) => void;
}

export class QuizHostEngine {
  private questionsList: QuizQuestion[] = [...ALL_QUESTIONS];
  private timerInterval: any = null;
  private autoNextTimeout: any = null;
  private callbacks: QuizHostCallbacks;

  public state: GameState = {
    status: 'lobby',
    currentQuestionIndex: 0,
    timeLimit: 20,
    timeRemaining: 20,
    participants: [],
    maxParticipants: 20,
    selectedQuestionSet: 'all',
    totalQuestions: ALL_QUESTIONS.length,
    revealAnswers: false,
  };

  constructor(callbacks: QuizHostCallbacks) {
    this.callbacks = callbacks;
  }

  public getPublicState(): GameState {
    const currentQ = (this.state.status === 'question' || this.state.status === 'review')
      ? this.questionsList[this.state.currentQuestionIndex]
      : undefined;

    const publicQuestion = currentQ ? {
      ...currentQ,
      correctAnswers: this.state.revealAnswers || this.state.status === 'review' || this.state.status === 'ranking'
        ? currentQ.correctAnswers
        : [],
      explanation: this.state.revealAnswers || this.state.status === 'review'
        ? currentQ.explanation
        : undefined,
    } : undefined;

    return {
      ...this.state,
      totalQuestions: this.questionsList.length,
      currentQuestion: publicQuestion,
    };
  }

  public getAdminState(): GameState {
    const currentQ = this.questionsList[this.state.currentQuestionIndex];
    return {
      ...this.state,
      totalQuestions: this.questionsList.length,
      currentQuestion: currentQ,
    };
  }

  public broadcast() {
    this.callbacks.onBroadcast(this.getPublicState(), this.getAdminState());
  }

  public stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.autoNextTimeout) {
      clearTimeout(this.autoNextTimeout);
      this.autoNextTimeout = null;
    }
  }

  public startQuestionTimer() {
    this.stopTimer();
    this.state.timeRemaining = this.state.timeLimit;
    this.state.revealAnswers = false;

    const startTime = Date.now();
    const totalDuration = this.state.timeLimit * 1000;

    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((totalDuration - elapsed) / 100) / 10);
      this.state.timeRemaining = remaining;

      if (elapsed >= totalDuration) {
        this.stopTimer();
        this.handleTimeOut();
      } else {
        this.broadcast();
      }
    }, 100);
  }

  public handleTimeOut() {
    this.state.timeRemaining = 0;
    this.state.revealAnswers = true;
    this.state.status = 'review';

    for (const p of this.state.participants) {
      if (!p.answeredCurrent) {
        p.answeredCurrent = true;
        p.isCorrect = false;
        p.pointsEarned = 0;
        p.selectedAnswers = [];
      }
    }

    this.broadcast();
  }

  public checkAllAnswered() {
    const onlineParticipants = this.state.participants.filter(p => p.isOnline);
    if (onlineParticipants.length === 0) return;

    const allAnswered = onlineParticipants.every(p => p.answeredCurrent);
    if (allAnswered && this.state.status === 'question') {
      this.stopTimer();
      this.state.revealAnswers = true;
      this.state.status = 'review';
      this.broadcast();
    }
  }

  public evaluateAnswer(selected: number[], correct: number[]): boolean {
    if (selected.length !== correct.length) return false;
    const sortedSelected = [...selected].sort();
    const sortedCorrect = [...correct].sort();
    return sortedSelected.every((val, index) => val === sortedCorrect[index]);
  }

  public handleClientMessage(msg: WebSocketClientMessage, senderParticipantId?: string): { participantId?: string } {
    if (msg.type === 'join') {
      const trimmedName = msg.name.trim();
      let participant = this.state.participants.find(p => p.name === trimmedName);
      if (participant) {
        participant.isOnline = true;
        participant.avatar = msg.avatar || participant.avatar;
        this.callbacks.onDirectResponse(participant.id, {
          type: 'join_success',
          participantId: participant.id,
        });
        this.broadcast();
        return { participantId: participant.id };
      }

      if (this.state.participants.length >= this.state.maxParticipants) {
        this.callbacks.onDirectResponse('unregistered', {
          type: 'error',
          message: `참여 인원이 가득 찼습니다 (최대 ${this.state.maxParticipants}명)`,
        });
        return {};
      }

      const newParticipant: Participant = {
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        name: trimmedName || `학생 ${this.state.participants.length + 1}`,
        avatar: msg.avatar || '🐳',
        score: 0,
        answeredCurrent: false,
        selectedAnswers: [],
        isCorrect: null,
        pointsEarned: 0,
        isOnline: true,
      };

      this.state.participants.push(newParticipant);
      this.callbacks.onDirectResponse(newParticipant.id, {
        type: 'join_success',
        participantId: newParticipant.id,
      });
      this.broadcast();
      return { participantId: newParticipant.id };
    }

    if (msg.type === 'submit_answer') {
      const pId = senderParticipantId;
      if (!pId || this.state.status !== 'question') return {};

      const participant = this.state.participants.find(p => p.id === pId);
      if (!participant || participant.answeredCurrent) return {};

      const currentQ = this.questionsList[this.state.currentQuestionIndex];
      if (!currentQ) return {};

      const isCorrect = this.evaluateAnswer(msg.selectedAnswers, currentQ.correctAnswers);
      const points = isCorrect ? currentQ.points : 0;

      participant.answeredCurrent = true;
      participant.selectedAnswers = msg.selectedAnswers;
      participant.isCorrect = isCorrect;
      participant.pointsEarned = points;
      participant.score += points;
      participant.lastAnswerTime = Date.now();

      this.callbacks.onDirectResponse(participant.id, {
        type: 'answer_result',
        isCorrect,
        points,
        correctAnswers: currentQ.correctAnswers,
        explanation: currentQ.explanation,
      });

      this.broadcast();
      this.checkAllAnswered();
      return { participantId: pId };
    }

    if (msg.type === 'admin:start_quiz') {
      this.stopTimer();
      this.state.status = 'question';
      this.state.currentQuestionIndex = 0;
      this.state.revealAnswers = false;
      for (const p of this.state.participants) {
        p.score = 0;
        p.answeredCurrent = false;
        p.selectedAnswers = [];
        p.isCorrect = null;
        p.pointsEarned = 0;
      }
      this.startQuestionTimer();
      this.broadcast();
      return {};
    }

    if (msg.type === 'admin:next_question') {
      this.stopTimer();
      const nextIdx = this.state.currentQuestionIndex + 1;
      if (nextIdx < this.questionsList.length) {
        this.state.currentQuestionIndex = nextIdx;
        this.state.status = 'question';
        this.state.revealAnswers = false;
        for (const p of this.state.participants) {
          p.answeredCurrent = false;
          p.selectedAnswers = [];
          p.isCorrect = null;
          p.pointsEarned = 0;
        }
        this.startQuestionTimer();
      } else {
        this.state.status = 'ended';
      }
      this.broadcast();
      return {};
    }

    if (msg.type === 'admin:show_ranking') {
      this.stopTimer();
      this.state.status = 'ranking';
      this.broadcast();
      return {};
    }

    if (msg.type === 'admin:show_review') {
      this.stopTimer();
      this.state.status = 'review';
      this.state.revealAnswers = true;
      this.broadcast();
      return {};
    }

    if (msg.type === 'admin:reset_quiz') {
      this.stopTimer();
      this.state.status = 'lobby';
      this.state.currentQuestionIndex = 0;
      this.state.revealAnswers = false;
      for (const p of this.state.participants) {
        p.score = 0;
        p.answeredCurrent = false;
        p.selectedAnswers = [];
        p.isCorrect = null;
        p.pointsEarned = 0;
      }
      this.broadcast();
      return {};
    }

    if (msg.type === 'admin:set_time_limit') {
      if (msg.seconds >= 5 && msg.seconds <= 60) {
        this.state.timeLimit = msg.seconds;
        if (this.state.status !== 'question') {
          this.state.timeRemaining = msg.seconds;
        }
        this.broadcast();
      }
      return {};
    }

    if (msg.type === 'admin:kick_participant') {
      this.state.participants = this.state.participants.filter(p => p.id !== msg.participantId);
      this.broadcast();
      return {};
    }

    return {};
  }

  public markParticipantOffline(participantId: string) {
    const p = this.state.participants.find(part => part.id === participantId);
    if (p) {
      p.isOnline = false;
      this.broadcast();
    }
  }

  public destroy() {
    this.stopTimer();
  }
}
