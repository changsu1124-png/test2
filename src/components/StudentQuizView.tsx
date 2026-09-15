import React, { useState, useEffect } from 'react';
import { GameState, Participant, QuizQuestion } from '../types';
import { TimerGaugeBar } from './TimerGaugeBar';
import { FeedbackOverlay } from './WaterRiseAnimation';
import { sounds } from '../utils/sound';
import { CheckCircle2, XCircle, Award, Star, HelpCircle } from 'lucide-react';

interface StudentQuizViewProps {
  gameState: GameState;
  participant: Participant | undefined;
  onSubmitAnswer: (selectedIndices: number[]) => void;
  onExit?: () => void;
}

export const StudentQuizView: React.FC<StudentQuizViewProps> = ({
  gameState,
  participant,
  onSubmitAnswer,
}) => {
  const currentQ: QuizQuestion | undefined = gameState.currentQuestion;
  const isQuestionActive = gameState.status === 'question' && !participant?.answeredCurrent;
  const isReviewPhase = gameState.status === 'review' || participant?.answeredCurrent;

  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | 'timeout' | null>(null);
  const [hasShownFeedback, setHasShownFeedback] = useState(false);

  // Reset local selection when question changes
  useEffect(() => {
    setSelectedAnswers([]);
    setFeedbackType(null);
    setHasShownFeedback(false);
  }, [gameState.currentQuestionIndex, gameState.status]);

  // Handle server feedback / evaluation
  useEffect(() => {
    if (participant?.answeredCurrent && !hasShownFeedback && participant.isCorrect !== null) {
      setHasShownFeedback(true);
      if (participant.isCorrect) {
        setFeedbackType('correct');
        sounds.playCorrect();
      } else {
        setFeedbackType('incorrect');
        sounds.playIncorrect();
      }
    }
  }, [participant?.answeredCurrent, participant?.isCorrect, hasShownFeedback]);

  // Handle timeout condition:
  // "10초안에 못맞추면 시계가 나오고 TIME OUT이라고 동글동글 한 검은색 문자가 나오는데 1초후에 다음문제로 넘어가."
  useEffect(() => {
    if (gameState.status === 'review' && !participant?.answeredCurrent && !hasShownFeedback) {
      setHasShownFeedback(true);
      setFeedbackType('timeout');
      sounds.playTimeout();
    }
  }, [gameState.status, participant?.answeredCurrent, hasShownFeedback]);

  const maxSelectable = currentQ?.correctAnswers?.length === 2 ? 2 : 1;
  const isTwoAnswerQuestion = currentQ?.points === 20 || currentQ?.correctAnswers?.length === 2;

  const handleOptionClick = (index: number) => {
    if (!isQuestionActive) return;
    sounds.playSelect();

    if (maxSelectable === 1) {
      setSelectedAnswers([index]);
    } else {
      if (selectedAnswers.includes(index)) {
        setSelectedAnswers(selectedAnswers.filter(i => i !== index));
      } else {
        if (selectedAnswers.length < maxSelectable) {
          setSelectedAnswers([...selectedAnswers, index]);
        } else {
          // Replace second choice
          setSelectedAnswers([selectedAnswers[0], index]);
        }
      }
    }
  };

  const handleConfirmSubmit = () => {
    if (selectedAnswers.length === 0 || !isQuestionActive) return;
    onSubmitAnswer(selectedAnswers);
  };

  // Choice badge colors (1, 2, 3, 4) - Using neutral sky/slate/indigo palettes to avoid green during solving
  const optionColors = [
    { bg: 'bg-white hover:bg-sky-50/70 border-sky-200 text-slate-800', tag: 'bg-sky-500 text-white' },
    { bg: 'bg-white hover:bg-indigo-50/70 border-indigo-200 text-slate-800', tag: 'bg-indigo-500 text-white' },
    { bg: 'bg-white hover:bg-amber-50/70 border-amber-200 text-slate-800', tag: 'bg-amber-500 text-white' },
    { bg: 'bg-white hover:bg-purple-50/70 border-purple-200 text-slate-800', tag: 'bg-purple-500 text-white' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 px-4 py-3 sm:py-6">
      {/* Top Participant Status Bar */}
      <div className="flex items-center justify-between bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-sm border border-sky-100 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{participant?.avatar || '🐳'}</span>
          <div>
            <div className="text-xs text-slate-500 font-medium">참여 학생</div>
            <div className="font-jua text-base sm:text-lg text-slate-800 leading-tight">
              {participant?.name || '학생'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500 font-medium">내 점수</div>
            <div className="font-jua text-lg sm:text-xl text-sky-600 flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-500" />
              <span>{participant?.score || 0}점</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timer Gauge Bar:
          User Requirement: "참고로 시간이 가는건 빨간색 게이지바가 점점 하얀색으로 변해" */}
      <TimerGaugeBar
        timeRemaining={gameState.timeRemaining}
        timeLimit={gameState.timeLimit}
        isActive={gameState.status === 'question'}
      />

      {/* Question Card */}
      {currentQ ? (
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-5 sm:p-7 shadow-lg border-2 border-sky-100 flex flex-col mb-4 transition-all">
          {/* Question Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700 border border-sky-200 shadow-2xs">
                {currentQ.category}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                문제 {gameState.currentQuestionIndex + 1} / {gameState.totalQuestions}
              </span>
            </div>

            {/* Score & Multi-answer Indicator */}
            {isTwoAnswerQuestion ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse shadow-2xs">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>정답 2개 (점수 2배! 20점)</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                기본 점수 10점 (정답 1개)
              </span>
            )}
          </div>

          {/* Question Text */}
          <h2 className="font-jua text-xl sm:text-2xl text-slate-900 leading-snug mb-5 select-text">
            {currentQ.question}
          </h2>

          {/* Instructions hint for student */}
          {isQuestionActive && (
            <div className="text-xs sm:text-sm text-sky-700 bg-sky-50/80 px-3.5 py-1.5 rounded-xl mb-4 flex items-center gap-1.5 border border-sky-200/70">
              <HelpCircle className="w-4 h-4 text-sky-500 shrink-0" />
              <span>
                {isTwoAnswerQuestion
                  ? '정답 2개를 모두 선택한 후 [정답 제출하기]를 눌러주세요!'
                  : '정답 1개를 선택한 후 [정답 제출하기]를 눌러주세요!'}
              </span>
            </div>
          )}

          {/* 4 Choices Grid (4지 선다의 객관식 문제) */}
          <div className="grid grid-cols-1 gap-3">
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedAnswers.includes(idx);
              const colorInfo = optionColors[idx % optionColors.length];

              // In review phase, show correct and user choices
              const isCorrectAnswer = currentQ.correctAnswers.includes(idx);
              const isUserChoice = participant?.selectedAnswers?.includes(idx);

              let cardStyle = `${colorInfo.bg} border-2`;
              if (isSelected) {
                cardStyle = 'bg-sky-500 text-white border-sky-600 shadow-md ring-4 ring-sky-200';
              }

              if (isReviewPhase && currentQ.correctAnswers.length > 0) {
                if (isCorrectAnswer) {
                  cardStyle = 'bg-emerald-500 text-white border-emerald-600 shadow-md ring-4 ring-emerald-200 font-bold';
                } else if (isUserChoice && !isCorrectAnswer) {
                  cardStyle = 'bg-rose-100 border-rose-400 text-rose-800 opacity-80';
                } else {
                  cardStyle = 'bg-slate-100 border-slate-200 text-slate-400 opacity-60';
                }
              }

              return (
                <button
                  key={idx}
                  id={`choice-btn-${idx}`}
                  type="button"
                  disabled={!isQuestionActive}
                  onClick={() => handleOptionClick(idx)}
                  className={`relative flex items-center gap-3 p-4 rounded-2xl text-left font-semibold text-lg sm:text-xl min-h-[52px] transition-all transform active:scale-[0.98] cursor-pointer disabled:cursor-default ${cardStyle}`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0 shadow-xs ${
                      isSelected || (isReviewPhase && isCorrectAnswer)
                        ? 'bg-white text-slate-900'
                        : colorInfo.tag
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-lg leading-snug">{option}</span>

                  {/* Review Indicators */}
                  {isReviewPhase && isCorrectAnswer && (
                    <span className="flex items-center gap-1 bg-white text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 정답 (◯)
                    </span>
                  )}
                  {isReviewPhase && isUserChoice && !isCorrectAnswer && (
                    <span className="flex items-center gap-1 bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full text-xs font-bold">
                      <XCircle className="w-4 h-4 text-rose-600" /> 내가 선택
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Submit Button for Question Phase */}
          {isQuestionActive && (
            <div className="mt-5">
              <button
                id="submit-answer-btn"
                type="button"
                disabled={selectedAnswers.length !== maxSelectable}
                onClick={handleConfirmSubmit}
                className={`w-full py-3.5 sm:py-4 rounded-2xl font-jua text-xl tracking-wide text-white transition-all shadow-md flex items-center justify-center gap-2 ${
                  selectedAnswers.length === maxSelectable
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 active:scale-98 cursor-pointer ring-2 ring-sky-300'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>정답 제출하기</span>
                {maxSelectable > 1 && (
                  <span className="text-sm font-sans bg-white/20 px-2 py-0.5 rounded-full">
                    ({selectedAnswers.length}/{maxSelectable})
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Review Explanation Card:
              User Requirement: "각 문제를 다 풀고 바로 오답을 확인 할 수 있을 것" */}
          {isReviewPhase && (
            <div className="mt-5 pt-4 border-t border-slate-200">
              <div
                className={`p-4 rounded-2xl border-2 mb-3 ${
                  participant?.isCorrect
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-2 font-jua text-lg mb-1">
                  {participant?.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="text-emerald-700">정답을 맞혔습니다! (+{participant?.pointsEarned || 10}점)</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span className="text-rose-700">아쉽게도 오답입니다! (0점)</span>
                    </>
                  )}
                </div>

                {currentQ.explanation && (
                  <div className="mt-2 text-sm sm:text-base bg-white/80 p-3 rounded-xl border border-slate-200 leading-relaxed font-sans text-slate-800">
                    <span className="font-bold text-sky-700 mr-1">💡 문제 해설:</span>
                    {currentQ.explanation}
                  </div>
                )}
              </div>

              <div className="text-center py-2 text-sm text-sky-700 font-medium flex items-center justify-center gap-1.5">
                <span className="animate-spin text-lg">⏳</span>
                <span>선생님(관리자)이 다음 문제를 진행할 때까지 잠시 기다려주세요 🐳</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white/90 rounded-3xl p-8 text-center shadow-lg border border-sky-200 my-auto">
          <span className="text-6xl animate-bounce inline-block mb-3">🐳</span>
          <h3 className="font-jua text-2xl text-sky-800 mb-2">문제를 준비하고 있어요!</h3>
          <p className="text-slate-600 text-sm">
            선생님이 퀴즈를 시작하면 화면에 문제가 나타납니다.
          </p>
        </div>
      )}

      {/* 
        Feedback Overlays:
        1. Correct -> Whale 🐳 emoji + rising water filling the screen
        2. Incorrect -> Soft red edges + center white X + 1s transition
        3. Timeout -> Clock ⏰ + rounded black "TIME OUT" + 1s transition
      */}
      <FeedbackOverlay
        type={feedbackType}
        pointsEarned={participant?.pointsEarned || 10}
        onAnimationComplete={() => {
          setFeedbackType(null);
        }}
      />
    </div>
  );
};
