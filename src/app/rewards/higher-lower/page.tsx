"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface MovieData {
  id: number;
  title: string;
  posterUrl: string;
  rating?: number;
  year?: string;
}

interface GameRoundData {
  reward?: number;
  practice?: boolean;
  practiceAvailable?: boolean;
  roundId: string;
  bank: number;
  phase: "question" | "answered" | "failed" | "paid";
  limitReached: boolean;
  message?: string;
  attemptsLeft: number;
  round: number;
  questionType: "rating" | "year";
  rewardForRound: number;
  leftMovie: MovieData;
  rightMovie: MovieData;
}

async function fetchGameRound(signal?: AbortSignal): Promise<GameRoundData> {
  const res = await fetch("/api/higher-lower", { signal });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Не удалось загрузить игру");
  return json;
}

export default function HigherLowerPage() {
  const [data, setData] = useState<GameRoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);
  const [accumulatedBank, setAccumulatedBank] = useState(0);

  const [hasAnswered, setHasAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cashoutDone, setCashoutDone] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const applyRound = useCallback((json: GameRoundData) => {
    setData(json);
    setCurrentRound(json.round || 1);
    setAccumulatedBank(json.bank || 0);
    setHasAnswered(["answered", "failed", "paid"].includes(json.phase));
    setIsCorrect(json.phase === "question" ? null : json.phase !== "failed");
    setCashoutDone(json.phase === "paid");
  }, []);

  const loadRound = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const json = await fetchGameRound(signal);
        if (!signal?.aborted) applyRound(json);
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : "Ошибка сети");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [applyRound],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchGameRound(controller.signal)
      .then((json) => {
        if (!controller.signal.aborted) applyRound(json);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [applyRound]);

  const requestAction = async (action: string, choice?: "higher" | "lower") => {
    if (submitting || !data) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/higher-lower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, roundId: data.roundId, choice }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Не удалось выполнить действие");
      applyRound(json);
      if (json.phase === "paid")
        window.dispatchEvent(new Event("popcorn-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChoice = (choice: "higher" | "lower") => {
    if (!hasAnswered) void requestAction("answer", choice);
  };
  const handleCashout = () => {
    void requestAction("cashout");
  };
  const handleRestart = () => {
    void requestAction("restart");
  };
  const handleNextRound = () => {
    void requestAction("next");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-neutral-400">
          Подбираем сбалансированную пару фильмов...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-5">
        <p role="alert" className="text-neutral-300">
          {error || "Не удалось загрузить игру"}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            void loadRound();
          }}
          className="btn btn-primary"
        >
          Попробовать ещё раз
        </button>
        <Link href="/rewards" className="block text-blue-400">
          Вернуться в центр наград
        </Link>
      </div>
    );
  }

  if (data?.limitReached || cashoutDone) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-5">
        <div className="text-6xl animate-bounce">
          {cashoutDone ? "🏆" : "🛑"}
        </div>
        <h1 className="text-2xl font-black text-white">
          {cashoutDone ? "Отличный куш!" : "Игра на сегодня завершена"}
        </h1>
        <p className="text-xs text-neutral-400 leading-relaxed">
          {cashoutDone
            ? data?.practice
              ? "Тренировка завершена. Валюта не начисляется."
              : `Начислено +${data?.reward ?? 0} 🍿 на баланс. Дневного лимита наград нет.`
            : data?.message || "Вы исчерпали все 5 попыток на сегодня."}
        </p>
        {data?.practiceAvailable && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={submitting}
            onClick={() => void requestAction("practice")}
          >
            Сыграть ещё
          </button>
        )}
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

  const { questionType, leftMovie, rightMovie } = data!;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 pb-20">
      {/* Аккуратная верхняя панель */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/40 p-3 rounded-2xl border border-neutral-800">
        <Link
          href="/rewards"
          className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 shrink-0"
        >
          <span>←</span>
          <span>В центр наград</span>
        </Link>

        {/* Индикаторы раундов в один ряд без переноса */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {[1, 2, 3, 4, 5].map((r) => (
            <div
              key={r}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border whitespace-nowrap transition-all ${
                r === currentRound
                  ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20"
                  : r < currentRound
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-neutral-950 text-neutral-500 border-neutral-800"
              }`}
            >
              Раунд {r} <span className="opacity-80">(+{1} 🍿)</span>
            </div>
          ))}
        </div>

        {/* Счётчики попыток и банка */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-neutral-300 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl whitespace-nowrap">
            +1 🍿 · без лимита
          </span>
          <span className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl whitespace-nowrap">
            Банк: <strong>{accumulatedBank} 🍿</strong>
          </span>
        </div>
      </div>

      {/* Заголовок раунда */}
      <div className="text-center space-y-1">
        <h2 className="text-xl sm:text-2xl font-black text-white flex items-center justify-center gap-2">
          <span>{questionType === "rating" ? "⭐" : "📅"}</span>
          <span>
            {questionType === "rating"
              ? "У какого фильма рейтинг выше?"
              : "Какой фильм вышел позже (новее)?"}
          </span>
        </h2>
        <p className="text-xs text-neutral-400">
          Сравните правый фильм с левым: его показатель больше или меньше?
        </p>
      </div>

      {/* Карточки дуэли */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch max-w-4xl mx-auto">
        {/* ЛЕВЫЙ ФИЛЬМ */}
        <div className="min-w-0 bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between items-center text-center shadow-xl">
          <div className="aspect-[2/3] w-52 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 mb-4 bg-neutral-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={leftMovie.posterUrl}
              alt={leftMovie.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-1 w-full">
            <h3 className="text-sm font-bold text-white whitespace-normal break-words">
              {leftMovie.title}
            </h3>
            <span className="text-xs text-neutral-400 block">
              {leftMovie.year} год
            </span>

            <div className="pt-2">
              <span className="inline-block px-4 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-base font-black text-amber-400 shadow-inner">
                {questionType === "rating"
                  ? `★ ${leftMovie.rating}`
                  : `${leftMovie.year} г.`}
              </span>
            </div>
          </div>
        </div>

        {/* ПРАВЫЙ ФИЛЬМ */}
        <div className="min-w-0 bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between items-center text-center shadow-xl">
          <div className="aspect-[2/3] w-52 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 mb-4 bg-neutral-950 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rightMovie.posterUrl}
              alt={rightMovie.title}
              className="w-full h-full object-cover"
            />
            {!hasAnswered && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                <span className="text-4xl font-black text-white/80 animate-pulse">
                  ?
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 w-full">
            <div>
              <h3 className="text-sm font-bold text-white whitespace-normal break-words">
                {rightMovie.title}
              </h3>
              {hasAnswered ? (
                <span className="text-xs text-neutral-400 block">
                  {rightMovie.year} год
                </span>
              ) : (
                <span className="text-xs text-neutral-500 block">
                  Показатель скрыт
                </span>
              )}
            </div>

            {!hasAnswered ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleChoice("higher")}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>▲</span>
                  <span>{questionType === "rating" ? "ВЫШЕ" : "ПОЗЖЕ"}</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleChoice("lower")}
                  className="py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-2xl transition-all shadow-lg shadow-rose-600/20 hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>▼</span>
                  <span>{questionType === "rating" ? "НИЖЕ" : "РАНЬШЕ"}</span>
                </button>
              </div>
            ) : (
              <div className="pt-1">
                <span
                  className={`inline-block px-4 py-1.5 rounded-xl text-base font-black border shadow-inner ${
                    isCorrect
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {questionType === "rating"
                    ? `★ ${rightMovie.rating}`
                    : `${rightMovie.year} г.`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Панель результатов */}
      {hasAnswered && (
        <div
          className={`max-w-4xl mx-auto p-6 rounded-3xl border text-center space-y-4 shadow-2xl transition-all ${
            isCorrect
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
              : "bg-rose-950/40 border-rose-500/30 text-rose-200"
          }`}
        >
          <div>
            <h3 className="text-lg font-black">
              {isCorrect
                ? `🎉 Точно! +1 🍿 в банк (Всего: ${accumulatedBank} 🍿)`
                : "💥 Ошибка! Накопленный банк сгорел."}
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              {isCorrect
                ? currentRound === 5
                  ? "Вы прошли все 5 раундов! Награда зачислена на ваш баланс."
                  : "Продолжайте игру ради большего куша или заберите банк прямо сейчас!"
                : "Можно сразу начать новую игру. Число попыток не ограничено."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            {isCorrect && currentRound < 5 && (
              <>
                <button
                  type="button"
                  onClick={handleNextRound}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-black font-black text-xs hover:bg-neutral-200 transition-all shadow-lg cursor-pointer"
                >
                  Продолжить → Раунд {currentRound + 1}
                </button>

                <button
                  type="button"
                  onClick={handleCashout}
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  💰 Забрать {accumulatedBank} 🍿 и завершить
                </button>
              </>
            )}

            {!isCorrect && (
              <button
                type="button"
                onClick={handleRestart}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all cursor-pointer shadow-lg"
              >
                🔄 Попробовать снова
              </button>
            )}

            {isCorrect && currentRound === 5 ? (
              <Link
                href="/rewards"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-lg shadow-amber-500/20"
              >
                ← Вернуться в центр наград
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
