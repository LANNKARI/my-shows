'use client';

import React, { useEffect, useState } from 'react';
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

  const loadQuestion = async () => {
    setLoading(true);
    setSelectedOption(null);
    setResult(null);
    try {
      const res = await fetch('/api/popcorn?action=get-quiz');
      if (res.ok) {
        const data = await res.json();
        setQuestion(data);
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
        <p className="text-xs text-neutral-400">Подбираем интересный кадр...</p>
      </div>
    );
  }

  // Если превышен дневной лимит в 10 фильмов
  if (question?.limitReached) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="text-5xl">🛑</div>
        <h1 className="text-xl font-bold text-white">Лимит на сегодня исчерпан!</h1>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Вы уже отгадали 10 фильмов/сериалов сегодня. Отдохните и возвращайтесь завтра за новой порцией попкорна!
        </p>
        <div className="pt-4">
          <Link
            href="/rewards"
            className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white rounded-xl text-xs font-semibold"
          >
            ← В центр наград
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
          className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>← Назад к наградам</span>
        </Link>
        <span className="text-xs font-bold text-neutral-400 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-xl">
          Осталось на сегодня: <strong className="text-amber-400">{question?.attemptsLeft} / 10</strong>
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
          <div className="absolute top-3 left-3 px-3 py-1 bg-black/75 backdrop-blur-md rounded-xl border border-white/10 text-[11px] font-bold text-white flex items-center gap-1.5">
            <span>🎬 Угадайте тайтл</span>
          </div>
        </div>

        {/* 4 варианта ответа */}
        <div className="p-6 space-y-3">
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
                    <span className="text-emerald-400">✓</span>
                  )}
                  {result && isSelected && !result.isCorrect && (
                    <span className="text-rose-400">✕</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Результат раунда */}
          {result && (
            <div
              className={`p-4 rounded-2xl border mt-4 text-center space-y-2 ${
                result.isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <p className="text-sm font-black">
                {result.isCorrect
                  ? '🎉 Верно! Вы получили +5 🍿'
                  : `Неверно! Это был фильм «${result.correctTitle}»`}
              </p>
              {result.attemptsLeft > 0 ? (
                <button
                  type="button"
                  onClick={loadQuestion}
                  className="px-5 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors shadow-md"
                >
                  Следующий кадр →
                </button>
              ) : (
                <p className="text-xs text-neutral-400">
                  Вы использовали все 10 попыток на сегодня! Возвращайтесь завтра.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}