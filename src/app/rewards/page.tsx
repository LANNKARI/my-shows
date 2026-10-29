"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import DailyBonus from "@/components/DailyBonus";
import { privateFetch } from "@/lib/private-fetch";
type Quest = {
  id: string;
  name: string;
  count: number;
  target: number;
  reward: number;
  claimed: boolean;
};
type Data = {
  popcorn: number;
  canClaimDaily: boolean;
  dailyStreak: number;
  nextStreak: number;
  streakRewards: Record<number, number>;
  activityEarned?: number;
  activityLimit?: number;
  gameEarned?: number;
  gameLimit?: number | null;
  tasks?: Quest[];
  allTasksClaimed?: boolean;
  nextResetAt?: string;
};
type History = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};
export default function RewardsPage() {
  const { data, status } = useSession();
  if (status === "loading") return <p>Загрузка наград…</p>;
  if (!data?.user?.id)
    return (
      <div>
        <h1 className="text-2xl font-bold">Центр наград</h1>
        <Link href="/login?callbackUrl=%2Frewards">
          Войдите, чтобы открыть награды
        </Link>
      </div>
    );
  return <Rewards key={data.user.id} />;
}
function Rewards() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [history, setHistory] = useState<History[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [historyError, setHistoryError] = useState(""),
    [historyBusy, setHistoryBusy] = useState(false);
  const lock = useRef(false),
    historyLock = useRef(false);
  async function load() {
    try {
      const r = await privateFetch("/api/popcorn");
      if (!r.ok)
        throw Error(
          r.status === 401
            ? "Войдите, чтобы открыть награды."
            : "Не удалось загрузить баланс. Попробуйте ещё раз.",
        );
      setData(await r.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    }
  }
  async function loadHistory(next?: string) {
    if (historyLock.current) return;
    historyLock.current = true;
    setHistoryBusy(true);
    try {
      const r = await privateFetch(
        "/api/popcorn-history" +
          (next ? "?cursor=" + encodeURIComponent(next) : ""),
      );
      if (!r.ok) throw Error("История временно недоступна");
      const v = await r.json();
      setHistory((old) => (next ? [...old, ...v.items] : v.items));
      setCursor(v.nextCursor);
      setHistoryError("");
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Ошибка истории");
    } finally {
      historyLock.current = false;
      setHistoryBusy(false);
    }
  }
  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      void loadHistory();
    }, 0);
    return () => clearTimeout(t);
  }, []);
  async function claim(action: string, taskId?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/popcorn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, taskId }),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error || "Не удалось получить награду");
      setMessage(
        v.alreadyClaimed ? "Награда уже получена" : `Получено +${v.reward} 🍿`,
      );
      window.dispatchEvent(new Event("popcorn-updated"));
      await load();
      await loadHistory();
    } catch (e) {
      setMessage(
        (e instanceof Error ? e.message : "Ошибка соединения") +
          ". Обновите баланс перед повторной попыткой.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-4">
        <h1 className="text-2xl font-bold">Центр наград</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="btn btn-primary" onClick={() => void load()}>
              Повторить загрузку
            </button>
          </>
        ) : (
          <p>Загрузка наград…</p>
        )}
      </div>
    );
  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6 pb-20">
      <h1 className="text-3xl font-bold">Центр наград</h1>
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => void load()}>Повторить загрузку</button>
        </p>
      )}
      <section className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-neutral-900 p-6 sm:p-8">
        <div className="flex flex-wrap justify-between items-center gap-5">
          <div>
            <p className="text-neutral-400 text-sm">Ваш баланс</p>
            <strong className="text-4xl text-amber-400">
              {data.popcorn} 🍿
            </strong>
          </div>
          <Link className="btn btn-primary" href="/cosmetics">
            Магазин оформления →
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mt-6">
          <div>
            Активность сегодня:{" "}
            <strong>
              {data.activityEarned ?? 0} / {data.activityLimit ?? 60} 🍿
            </strong>
          </div>
          <div>
            Мини-игры сегодня:{" "}
            <strong>{data.gameEarned ?? 0} 🍿 · без дневного лимита</strong>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-4">
          Лимиты обновляются в 00:00 UTC
          {data.nextResetAt
            ? ` · ${new Date(data.nextResetAt).toLocaleString()} по вашему времени`
            : ""}
          . Ежедневный бонус и задания учитываются отдельно.
        </p>
      </section>
      <DailyBonus
        {...data}
        busy={busy}
        onClaim={() => void claim("claim-daily")}
      />
      {message && (
        <p role="status" className="text-amber-300">
          {message}
        </p>
      )}
      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-bold">Задания на сегодня</h2>
        {(data.tasks || []).map((task) => (
          <div
            key={task.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4"
          >
            <div>
              <h3>{task.name}</h3>
              <p className="text-xs text-neutral-400">
                {task.count} из {task.target}
              </p>
            </div>
            <button
              className="btn btn-secondary"
              disabled={busy || task.claimed || task.count < task.target}
              onClick={() => void claim("claim-task", task.id)}
            >
              {task.claimed ? "Получено" : `Забрать +${task.reward} 🍿`}
            </button>
          </div>
        ))}
        <button
          className="btn btn-primary"
          disabled={
            busy ||
            data.allTasksClaimed ||
            !data.tasks?.length ||
            !data.tasks.every((t) => t.claimed)
          }
          onClick={() => void claim("claim-task", "all")}
        >
          {data.allTasksClaimed
            ? "Бонус за все задания получен"
            : "Все 3 задания: ещё +10 🍿"}
        </button>
      </section>
      <section className="grid sm:grid-cols-2 gap-5">
        <Link href="/rewards/quiz" className="card p-6">
          <h2 className="font-bold text-lg">🎬 Угадай фильм по кадру</h2>
          <p className="text-sm text-neutral-400 mt-2">
            +1 🍿 за верный ответ. Без дневного лимита наград.
          </p>
        </Link>
        <Link href="/rewards/higher-lower" className="card p-6">
          <h2 className="font-bold text-lg">⚖️ Больше или меньше</h2>
          <p className="text-sm text-neutral-400 mt-2">
            +1 🍿 в банк за верный ответ. Заберите банк или пройдите 5 раундов.
            Играть и получать награды можно без дневного лимита.
          </p>
        </Link>
      </section>
      <section className="card p-6 space-y-3">
        <h2 className="text-xl font-bold">История операций</h2>
        {historyError && (
          <p className="text-sm text-neutral-400">
            {historyError}{" "}
            <button onClick={() => void loadHistory()}>
              Повторить загрузку истории
            </button>
          </p>
        )}
        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex justify-between gap-4 border-b border-neutral-800 pb-3"
          >
            <div>
              <p className="text-sm">{entry.reason}</p>
              <time className="text-xs text-neutral-500">
                {new Date(entry.createdAt).toLocaleString()}
              </time>
            </div>
            <strong
              className={
                entry.amount > 0 ? "text-emerald-400" : "text-neutral-300"
              }
            >
              {entry.amount > 0 ? "+" : ""}
              {entry.amount} 🍿
            </strong>
          </div>
        ))}
        {!history.length && !historyError && (
          <p className="text-neutral-400 text-sm">Пока нет операций.</p>
        )}
        {cursor && (
          <button
            className="btn btn-secondary"
            disabled={historyBusy}
            onClick={() => void loadHistory(cursor)}
          >
            Показать ещё
          </button>
        )}
      </section>
    </div>
  );
}
