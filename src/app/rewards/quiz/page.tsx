'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface QuizQuestion {
  limitReached: boolean;
  message?: string;
  attemptsLeft: number;
  attemptsUsed: number;
  backdropUrl?: string;
  targetId?: number;
  options?: string[];
}

export default function QuizPage() {
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    correctTitle: string;
    reward: number;
    attemptsLeft: number;
  } | null>(null);

  // Хранилище показанных фильмов, чтобы они не повторялись в рамках сессии
  const excludedIdsRef = useRef<number[]>([]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('episy_quiz_excluded_ids');
      if (stored) {
        excludedIdsRef.current = JSON.parse(stored);
      }
    } catch {}
  }, []);

  const loadQuestion = async () => {
    setLoading(true);
    setSelectedOption(null);
    setResult(null);

    try {
      const excludeQuery = excludedIdsRef.current.length > 0
        ? `&exclude=${excludedIdsRef.current.join(',')}`
        : '';

      const res = await fetch(`/api/popcorn?action=get-quiz${excludeQuery}`);
      if (res.ok) {
        const data: QuizQuestion = await res.json();
        setQuestion(data);

        // Добавляем новый фильм в список исключений для последующих раундов
        if (data.targetId && !excludedIdsRef.current.includes(data.targetId)) {
          excludedIdsRef.current.push(data.targetId);
          try {
            sessionStorage.setItem('episy_quiz_excluded_ids', JSON.stringify(excludedIdsRef.current));
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestion();
  }, []);

  const handleSelectAnswer = async (title: string) => {
    if (selectedOption || submitting || !question?.targetId) return;

    setSelectedOption(title);
    setSubmitting(true);
    try {
      const res = await fetch('/api/popcorn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-quiz',
          targetId: question.targetId,
          selectedTitle: title,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResult(json);
        window.dispatchEvent(new Event('popcorn-updated'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-neutral-400">Подбираем уникальный кадр...</p>
      </div>
    );
  }

  // Финал дневного лимита
  if (question?.limitReached) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-5">
        <div className="text-6xl animate-bounce">🎬</div>
        <h1 className="text-2xl font-black text-white">Викторина на сегодня завершена!</h1>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Вы отгадали все 10 кадров на сегодня. Возвращайтесь завтра за новыми вопросами и дополнительным попкорном!
        </p>
        <div className="pt-2">
          <Link
            href="/rewards"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-transform hover:scale-105 shadow-lg shadow-amber-500/20"
          >
            <span>← Вернуться в центр наград</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 pb-20">
      {/* Навигация */}
      <div className="flex items-center justify-between">
        <Link
          href="/rewards"
          className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <span>←</span>
          <span>В центр наград</span>
        </Link>
        <span className="text-xs font-bold text-neutral-400 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl">
          Осталось попыток: <strong className="text-amber-400">{question?.attemptsLeft} / 10</strong>
        </span>
      </div>

      {/* Карточка кадра */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="aspect-video w-full bg-neutral-950 relative overflow-hidden">
          {question?.backdropUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={question.backdropUrl}
              alt="Кадр из фильма"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/75 backdrop-blur-md rounded-xl border border-white/10 text-[11px] font-bold text-white flex items-center gap-1.5">
            <span>🎬 Угадайте тайтл</span>
          </div>
        </div>

        {/* 4 варианта ответа */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question?.options?.map((opt, i) => {
              const isSelected = selectedOption === opt;
              let btnStyle = 'bg-neutral-950 hover:bg-neutral-800/80 border-neutral-800 text-neutral-200';

              if (result) {
                if (opt.toLowerCase().trim() === result.correctTitle.toLowerCase().trim()) {
                  btnStyle = 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold';
                } else if (isSelected && !result.isCorrect) {
                  btnStyle = 'bg-rose-600/20 border-rose-500 text-rose-300 font-bold';
                }
              }

              return (
                <button
                  key={i}
                  type="button"
                  disabled={Boolean(result) || submitting}
                  onClick={() => handleSelectAnswer(opt)}
                  className={`p-3.5 rounded-2xl border text-xs text-left transition-all cursor-pointer leading-snug flex items-center justify-between ${btnStyle}`}
                >
                  <span className="truncate pr-2">{opt}</span>
                  {result && opt.toLowerCase().trim() === result.correctTitle.toLowerCase().trim() && (
                    <span className="text-emerald-400 font-bold">✓</span>
                  )}
                  {result && isSelected && !result.isCorrect && (
                    <span className="text-rose-400 font-bold">✕</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Результат раунда */}
          {result && (
            <div
              className={`p-5 rounded-2xl border text-center space-y-3.5 ${
                result.isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div>
                <p className="text-base font-black">
                  {result.isCorrect
                    ? '🎉 Верно! Вы получили +5 🍿'
                    : `Неверно! Это был фильм «${result.correctTitle}»`}
                </p>
                {result.attemptsLeft === 0 && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Это был последний 10-й вопрос на сегодня. Игра завершена!
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                {result.attemptsLeft > 0 ? (
                  <button
                    type="button"
                    onClick={loadQuestion}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors shadow-md cursor-pointer"
                  >
                    Следующий кадр ({result.attemptsLeft} ост.) →
                  </button>
                ) : null}

                <Link
                  href="/rewards"
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${
                    result.attemptsLeft === 0
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700'
                  }`}
                >
                  <span>← Вернуться к наградам</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}