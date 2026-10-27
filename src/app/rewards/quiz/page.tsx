"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { privateFetch } from "@/lib/private-fetch";
type Question = { roundId: string; options: string[]; backdropUrl: string };
type Answer = {
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
  async function load() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await privateFetch("/api/popcorn?action=get-quiz");
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Не удалось загрузить кадр");
      setQuestion(data);
      setResult(null);
      setSelected("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    } finally {
      pending.current = false;
      setBusy(false);
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
        +5 🍿 за верный ответ. Бонусы за 3 и 5 подряд. Общий лимит двух игр — 50
        🍿 в день, затем можно играть без валюты.
      </p>
      {error && (
        <p role="alert" className="text-rose-400">
          {error}
        </p>
      )}
      {question && (
        <section className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.backdropUrl}
            alt="Кадр из фильма"
            className="w-full aspect-video object-cover"
          />
          <div className="p-5 grid sm:grid-cols-2 gap-3">
            {question.options.map((title) => (
              <button
                key={title}
                disabled={busy || !!result}
                onClick={() => void answer(title)}
                className={`btn btn-secondary ${result?.correctTitle === title ? "border-emerald-500 text-emerald-400" : selected === title ? "border-rose-500" : ""}`}
              >
                {title}
              </button>
            ))}
          </div>
        </section>
      )}
      {result && (
        <p role="status">
          {result.isCorrect ? "Верно!" : "Верный ответ: " + result.correctTitle}{" "}
          Начислено {result.reward} 🍿.
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
              ? "Обновить раунд"
              : "Загрузить кадр"}
      </button>
    </div>
  );
}
