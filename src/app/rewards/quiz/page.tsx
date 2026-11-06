"use client";
import { tmdbImageUrl } from "@/lib/tmdb-image";
import { prepareImages } from "@/lib/prepare-images";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { privateFetch } from "@/lib/private-fetch";
type Question = { roundId: string; options: string[]; backdropUrl: string };
type Daily = {
  dailyLimit?: number;
  dailyUsed?: number;
  dailyAnswered?: number;
  dailyReward?: number;
  nextResetAt?: string;
};
type Answer = Daily & {
  alreadyAnswered?: boolean;
  originalReward?: number;
  isCorrect: boolean;
  correctTitle: string;
  reward: number;
  streak?: number;
  gameEarned?: number;
};
export default function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null),
    [result, setResult] = useState<Answer | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState("");
  const pending = useRef(false);
  const imageLoad = useRef<AbortController | null>(null);
  useEffect(() => () => imageLoad.current?.abort(), []);
  const [daily, setDaily] = useState<Daily>({ dailyLimit: 10 });
  const [limitReached, setLimitReached] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);
  async function load() {
    if (pending.current) return;
    pending.current = true;
    const controller = new AbortController();
    imageLoad.current = controller;
    setBusy(true);
    setError("");
    try {
      const r = await privateFetch("/api/popcorn?action=get-quiz", controller.signal);
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Не удалось загрузить кадр");
      if (!data.limitReached) await prepareImages([data.backdropUrl], controller.signal);
      if (controller.signal.aborted) return;
      setDaily((previous) => ({ ...previous, ...data }));
      setLimitReached(!!data.limitReached);
      setQuestion(data.limitReached ? null : data);
      setResult(null);
      setSelected("");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);
  async function answer(title: string) {
    if (pending.current || result || !question) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setSelected(title);
    try {
      const r = await fetch("/api/popcorn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit-quiz",
          roundId: question.roundId,
          selectedTitle: title,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Не удалось проверить ответ");
      setResult(data);
      setDaily((previous) => ({ ...previous, ...data }));
      if (data.dailyUsed >= 10) setLimitReached(true);
      window.dispatchEvent(new Event("popcorn-updated"));
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Ошибка соединения") +
          " Повтор ответа не начисляет награду дважды.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="max-w-2xl mx-auto py-8 space-y-5">
      <Link href="/rewards" className="text-rose-400">
        ← В центр наград
      </Link>
      <h1 className="text-2xl font-bold">Угадай фильм по кадру</h1>
      <p className="text-sm text-neutral-400">
        10 кадров в сутки · +1 🍿 за верный ответ. Без аниме и повторов
        загаданных фильмов в течение 7 дней.
      </p>
      <div className="flex flex-wrap gap-3 text-sm text-neutral-300">
        <span>
          Показано: {daily.dailyUsed ?? 0} из {daily.dailyLimit ?? 10}
        </span>
        {daily.nextResetAt && (
          <span>
            До обновления:{" "}
            {Math.floor(
              Math.max(0, new Date(daily.nextResetAt).getTime() - clock) /
                3600000,
            )}{" "}
            ч{" "}
            {Math.floor(
              Math.max(0, new Date(daily.nextResetAt).getTime() - clock) /
                60000,
            ) % 60}{" "}
            мин · 00:00 UTC
          </span>
        )}
      </div>
      {limitReached && (
        <section className="card p-5 space-y-3" aria-label="Результаты дня">
          <h2 className="font-bold text-lg">На сегодня кадры закончились</h2>
          <p>
            Ответов: {daily.dailyAnswered ?? 0}. Начислено за викторину:{" "}
            {daily.dailyReward ?? 0} 🍿.
          </p>
          <p className="text-sm text-neutral-400">
            Новая подборка — после обновления суток. Во второй мини-игре можно
            продолжить играть.
          </p>
          <Link className="btn btn-secondary" href="/rewards/higher-lower">
            Больше или меньше →
          </Link>
        </section>
      )}
      {error && (
        <p role="alert" className="text-rose-400">
          {error}
        </p>
      )}
      {question && (
        <section className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={question.backdropUrl}
            src={tmdbImageUrl(question.backdropUrl)}
            alt="Кадр из фильма"
            className="w-full aspect-video object-cover"
          />
          <div className="p-5 grid sm:grid-cols-2 gap-3">
            {question.options.map((title) => (
              <button
                key={title}
                disabled={busy || !!result}
                onClick={() => void answer(title)}
                data-answer={
                  result
                    ? result.correctTitle === title
                      ? "correct"
                      : selected === title
                        ? "wrong"
                        : "neutral"
                    : "pending"
                }
                className="quiz-option"
              >
                {result?.correctTitle === title
                  ? "✓ "
                  : result && selected === title
                    ? "✕ "
                    : ""}
                {title}
              </button>
            ))}
          </div>
        </section>
      )}
      {result && (
        <p role="status">
          {result.isCorrect ? "Верно!" : "Верный ответ: " + result.correctTitle}{" "}
          {result.alreadyAnswered
            ? `Этот ответ уже учтён: ранее начислено ${result.originalReward ?? 0} 🍿. Повторного списания или начисления нет.`
            : result.isCorrect
              ? `Начислено +${result.reward} 🍿.`
              : "За неверный ответ награда не начисляется."}
          {result.streak ? ` Серия: ${result.streak}.` : ""}
        </p>
      )}
      {error && question && !result && selected && (
        <button
          disabled={busy}
          className="btn btn-secondary"
          onClick={() => void answer(selected)}
        >
          Повторить проверку ответа
        </button>
      )}
      {(!limitReached ||
        (daily.nextResetAt &&
          new Date(daily.nextResetAt).getTime() <= clock)) && (
        <button
          disabled={busy}
          className="btn btn-primary"
          onClick={() => void load()}
        >
          {busy
            ? "Загрузка…"
            : result
              ? "Следующий кадр"
              : question
                ? "Продолжить этот раунд"
                : "Загрузить кадр"}
        </button>
      )}
    </div>
  );
}
