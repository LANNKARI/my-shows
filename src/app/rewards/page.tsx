"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface RewardsData {
  popcorn: number;
  canClaimDaily: boolean;
  dailyStreak: number;
  nextStreak: number;
  streakRewards: Record<number, number>;
  quizAttemptsLeft: number;
}

export default function RewardsPage() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/popcorn");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => void fetchRewards(), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    setClaimMessage(null);
    try {
      const res = await fetch("/api/popcorn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim-daily" }),
      });
      const result = await res.json();
      if (res.ok) {
        setClaimMessage(`Ура! Вы получили +${result.reward} 🍿!`);
        window.dispatchEvent(new Event("popcorn-updated"));
        fetchRewards();
      } else {
        setClaimMessage(result.error || "Ошибка получения");
      }
    } catch {
      setClaimMessage("Ошибка соединения");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-neutral-400">Загрузка наград...</p>
      </div>
    );
  }

  const days = [1, 2, 3, 4, 5, 6, 7];
  const streakRewards: Record<number, number> = data?.streakRewards || {
    1: 10,
    2: 15,
    3: 20,
    4: 25,
    5: 30,
    6: 40,
    7: 50,
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-10 pb-20">
      {/* Баннер баланса */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-500/20 via-neutral-900 to-neutral-950 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-4xl shadow-inner">
            🍿
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Центр наград</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Собирайте ежедневный попкорн и зарабатывайте его в играх!
            </p>
          </div>
        </div>

        <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl px-6 py-3 text-center sm:text-right">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Ваш баланс
          </span>
          <span className="text-2xl sm:text-3xl font-black text-amber-400">
            {data?.popcorn || 0} 🍿
          </span>
        </div>
      </div>

      <Link
        href="/cosmetics"
        className="inline-flex min-h-11 items-center px-4 py-2 mb-6 rounded-xl bg-rose-600 text-white text-sm font-semibold"
      >
        Магазин оформления →
      </Link>
      {/* 1. БЛОК: ЕЖЕДНЕВНЫЙ ВХОД (1-7 ДНЕЙ) */}
      <section className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📅 Ежедневный бонус</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Заходите каждый день подряд, чтобы увеличивать количество
              попкорна!
            </p>
          </div>

          <div className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl self-start sm:self-auto">
            Серия: {data?.dailyStreak || 0} из 7 дней
          </div>
        </div>

        {/* Сетка 7 дней */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {days.map((day) => {
            const reward = streakRewards[day];
            const isCompleted = (data?.dailyStreak || 0) >= day;
            const isCurrent =
              (data?.nextStreak || 1) === day && data?.canClaimDaily;

            return (
              <div
                key={day}
                className={`p-3.5 rounded-2xl border text-center flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/10 scale-105"
                    : isCompleted
                      ? "bg-neutral-900 border-neutral-800 opacity-60"
                      : "bg-neutral-950/50 border-neutral-800/80"
                }`}
              >
                <span className="text-[10px] font-bold uppercase text-neutral-400">
                  День {day}
                </span>
                <span className="text-2xl my-2">🍿</span>
                <div>
                  <span className="text-xs font-black text-amber-400 block">
                    +{reward}
                  </span>
                  <span className="text-[9px] text-neutral-500 block mt-0.5">
                    {isCompleted
                      ? "✓ Получено"
                      : isCurrent
                        ? "Доступно!"
                        : "Ожидает"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          {claimMessage && (
            <p className="text-xs font-semibold text-amber-300">
              {claimMessage}
            </p>
          )}
          <button
            type="button"
            onClick={handleClaim}
            disabled={!data?.canClaimDaily || claiming}
            className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
              data?.canClaimDaily
                ? "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20 hover:scale-[1.02]"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50"
            }`}
          >
            {claiming
              ? "Зачисление..."
              : data?.canClaimDaily
                ? "🎁 Забрать бонус сегодня"
                : "✓ Сегодня уже получено (возвращайтесь завтра)"}
          </button>
        </div>
      </section>

      {/* 2. БЛОК: ИГРЫ И ЗАРАБОТОК ПОПКОРНА */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎮 Мини-игры для заработка</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Проверяйте свои знания кино и получайте попкорн
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Игра 1: Угадай по кадру */}
          <div className="p-6 rounded-3xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between hover:border-neutral-700 transition-all shadow-lg group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                  🎬
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  +5 🍿 за ответ
                </span>
              </div>

              <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                Угадай по кадру
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Смотрите случайный кадр из популярного фильма или сериала и
                выберите верное название из 4 похожих вариантов.
              </p>

              <div className="text-[11px] text-neutral-500 font-medium">
                Осталось попыток на сегодня:{" "}
                <strong className="text-white">
                  {data?.quizAttemptsLeft ?? 10} / 10
                </strong>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/rewards/quiz"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <span>Играть в викторину</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Игра 2: Больше или Меньше */}
          <div className="p-6 rounded-3xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between hover:border-neutral-700 transition-all shadow-lg group">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                  ⚖️
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  До +15 🍿 за победу
                </span>
              </div>

              <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                Больше или Меньше
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                5 раундов нарастающей сложности! Сравнивайте культовые фильмы по
                рейтингу и годам выхода. Заберите банк или рискните всем!
              </p>

              <div className="text-[11px] text-neutral-500 font-medium">
                Попыток в день: <strong className="text-white">5 жизней</strong>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/rewards/higher-lower"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <span>Играть в дуэль</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
