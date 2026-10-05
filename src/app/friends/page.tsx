"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Friend = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  friendshipId?: number;
};

type SearchUser = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  friendshipStatus: "none" | "pending_out" | "pending_in" | "friends";
};

export default function FriendsPage() {
  const router = useRouter();
  const { status } = useSession();

  const [tab, setTab] = useState<"friends" | "requests" | "search">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Friend[]>([]);
  const [outgoing, setOutgoing] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  async function loadFriends() {
    setLoading(true);
    const r = await fetch("/api/friendships");
    if (r.ok) {
      const data = await r.json();
      setFriends(data.friends || []);
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (status === "authenticated") loadFriends();
  }, [status]);

  // Поиск — debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (r.ok) setSearchResults(await r.json());
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function sendRequest(userId: string) {
    await fetch("/api/friendships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    // Обновляем статус в результатах поиска
    setSearchResults((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, friendshipStatus: "pending_out" } : u
      )
    );
    loadFriends();
  }

  async function acceptRequest(friendshipId: number) {
    await fetch("/api/friendships", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, action: "accept" }),
    });
    loadFriends();
  }

  async function rejectRequest(friendshipId: number) {
    await fetch("/api/friendships", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, action: "reject" }),
    });
    loadFriends();
  }

  async function removeFriend(friendshipId: number) {
    if (!confirm("Удалить из друзей?")) return;
    await fetch("/api/friendships", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, action: "remove" }),
    });
    loadFriends();
  }

  if (status === "loading" || loading) {
    return <p className="text-neutral-500">Загрузка...</p>;
  }

  const incomingCount = incoming.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Друзья</h1>

      {/* Табы */}
      <div className="flex gap-2 border-b border-white/5">
        {(
          [
            ["friends", `Мои друзья${friends.length ? ` (${friends.length})` : ""}`],
            ["requests", `Заявки${incomingCount ? ` (${incomingCount})` : ""}`],
            ["search", "Поиск"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              tab === k
                ? "border-red-500 text-white"
                : "border-transparent text-neutral-500 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Вкладка: Мои друзья */}
      {tab === "friends" && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <p className="text-neutral-500 py-12 text-center">
              Пока нет друзей. Найдите через{" "}
              <button
                onClick={() => setTab("search")}
                className="text-red-500 hover:underline"
              >
                поиск
              </button>
              .
            </p>
          ) : (
            friends.map((f) => (
              <UserRow
                key={f.id}
                user={f}
                action={{
                  label: "Удалить",
                  variant: "danger",
                  onClick: () =>
                    f.friendshipId != null && removeFriend(f.friendshipId),
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Вкладка: Заявки */}
      {tab === "requests" && (
        <div className="space-y-4">
          {incoming.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-wider text-neutral-400 mb-2">
                Входящие
              </h2>
              <div className="space-y-2">
                {incoming.map((f) => (
                  <UserRow
                    key={f.id}
                    user={f}
                    action={{
                      label: "Принять",
                      variant: "primary",
                      onClick: () =>
                        f.friendshipId != null && acceptRequest(f.friendshipId),
                      secondary: {
                        label: "Отклонить",
                        onClick: () =>
                          f.friendshipId != null && rejectRequest(f.friendshipId),
                      },
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {outgoing.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-wider text-neutral-400 mb-2">
                Исходящие
              </h2>
              <div className="space-y-2">
                {outgoing.map((f) => (
                  <UserRow
                    key={f.id}
                    user={f}
                    action={{
                      label: "Отменить",
                      variant: "secondary",
                      onClick: () =>
                        f.friendshipId != null && rejectRequest(f.friendshipId),
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {incoming.length === 0 && outgoing.length === 0 && (
            <p className="text-neutral-500 py-12 text-center">Заявок нет</p>
          )}
        </div>
      )}

      {/* Вкладка: Поиск */}
      {tab === "search" && (
        <div className="space-y-4">
          <input
            className="input"
            placeholder="Поиск по username или имени (мин. 2 символа)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {searching && <p className="text-sm text-neutral-500">Поиск...</p>}

          {searchResults.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              action={
                u.friendshipStatus === "none"
                  ? {
                      label: "Добавить",
                      variant: "primary",
                      onClick: () => sendRequest(u.id),
                    }
                  : u.friendshipStatus === "pending_out"
                  ? { label: "Заявка отправлена", variant: "secondary", disabled: true }
                  : u.friendshipStatus === "pending_in"
                  ? { label: "Входящая заявка", variant: "secondary", disabled: true }
                  : { label: "✓ В друзьях", variant: "secondary", disabled: true }
              }
            />
          ))}

          {query.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-neutral-500 py-8 text-center">Никого не найдено</p>
          )}

          {query.length < 2 && (
            <p className="text-neutral-500 py-8 text-center text-sm">
              Введите минимум 2 символа
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Универсальный "ряд" с пользователем ---------- */

function UserRow({
  user,
  action,
}: {
  user: { username: string; name: string | null; avatarUrl: string | null };
  action: {
    label: string;
    variant?: "primary" | "secondary" | "danger";
    onClick?: () => void;
    disabled?: boolean;
    secondary?: { label: string; onClick: () => void };
  };
}) {
  const btnClass =
    action.variant === "danger"
      ? "btn btn-danger text-xs"
      : action.variant === "secondary"
      ? "btn btn-secondary text-xs"
      : "btn btn-primary text-xs";

  return (
    <div className="flex items-center gap-3 rounded-xl bg-neutral-900/40 border border-white/5 px-3 py-2.5">
      <Link
        href={`/u/${user.username}`}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {(user.name || user.username)[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {user.name || user.username}
          </div>
          <div className="text-xs text-neutral-500 truncate">
            @{user.username}
          </div>
        </div>
      </Link>

      <div className="flex gap-2 shrink-0">
        {action.secondary && (
          <button
            onClick={action.secondary.onClick}
            className="btn btn-secondary text-xs"
            type="button"
          >
            {action.secondary.label}
          </button>
        )}
        <button
          onClick={action.onClick}
          className={btnClass}
          type="button"
          disabled={action.disabled}
        >
          {action.label}
        </button>
      </div>
    </div>
  );
}