"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AchievementBadges from "@/components/AchievementBadges";

type Comment = {
  id: number;
  text: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
  };
  isOwn: boolean;
  topBadge?: {
    id: string;
    name: string;
    icon: string;
    tier: "bronze" | "silver" | "gold" | "legendary";
    description: string;
  } | null;
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return d.toLocaleDateString("ru-RU");
}

export default function CommentSection({ titleId }: { titleId: number }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/titles/${titleId}/comments`);
    if (r.ok) setComments(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);

    const r = await fetch(`/api/titles/${titleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError(data.error || "Ошибка отправки");
      setSending(false);
      return;
    }

    setText("");
    setSending(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Удалить комментарий?")) return;
    await fetch(`/api/comments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        Комментарии
        <span className="text-neutral-500 font-normal text-sm">
          ({comments.length})
        </span>
      </h2>

      {/* Форма */}
      {session?.user ? (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder="Поделитесь впечатлениями..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              {text.length} / 1000
            </span>
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="btn btn-primary"
            >
              {sending ? "Отправляю..." : "Отправить"}
            </button>
          </div>
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
        </form>
      ) : (
        <div className="rounded-xl bg-neutral-900/40 border border-white/5 p-4 text-sm text-neutral-400 text-center">
          <Link href="/login" className="text-red-500 hover:underline">
            Войдите
          </Link>{" "}
          чтобы оставить комментарий
        </div>
      )}

      {/* Список */}
      {loading ? (
        <p className="text-neutral-500 text-sm">Загрузка...</p>
      ) : comments.length === 0 ? (
        <p className="text-neutral-500 text-sm py-6 text-center">
          Пока нет комментариев. Будьте первым!
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-xl bg-neutral-900/40 border border-white/5 p-4"
            >
              <div className="flex items-start gap-3">
                {/* Аватарка */}
                <Link href={`/u/${c.user.username}`} className="shrink-0">
                  {c.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.user.avatarUrl}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
                      {(c.user.name || c.user.username)[0].toUpperCase()}
                    </div>
                  )}
                </Link>

                {/* Тело */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
  <Link
    href={`/u/${c.user.username}`}
    className="text-sm font-medium hover:text-red-400 transition"
  >
    {c.user.name || c.user.username}
  </Link>
  {c.topBadge && (
    <AchievementBadges badges={[c.topBadge]} max={1} size="sm" />
  )}
  <span className="text-xs text-neutral-600">
    {timeAgo(c.createdAt)}
  </span>
  {c.isOwn && (
    <button
      onClick={() => remove(c.id)}
      className="text-xs text-red-400 hover:text-red-300 ml-auto transition"
      type="button"
    >
      Удалить
    </button>
  )}
</div>
                  <p className="text-sm text-neutral-200 mt-1 whitespace-pre-wrap break-words">
                    {c.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}