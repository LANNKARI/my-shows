'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface FriendUser {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
}

interface IncomingRequest {
  friendshipId: number;
  user: FriendUser;
  createdAt: string;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Поиск пользователей
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchFriendships = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/friendships');
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
        setIncoming(data.incomingRequests || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriendships();
  }, [fetchFriendships]);

  // Дебаунс-поиск пользователей
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const list = await res.json();
          setSearchResults(list);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAccept = async (userId: string) => {
    try {
      const res = await fetch('/api/friendships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, action: 'accept' }),
      });
      if (res.ok) {
        fetchFriendships();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/friendships?userId=${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchFriendships();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      const res = await fetch('/api/friendships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, action: 'request' }),
      });
      if (res.ok) {
        alert('Заявка в друзья отправлена!');
        setSearchQuery('');
        setSearchResults([]);
        fetchFriendships();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      <div className="border-b border-neutral-800 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>👥 Мои друзья</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {friends.length}
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Следите за активностью друзей и делитесь оценками
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Поиск и добавление пользователей */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <span>🔍 Найти пользователей</span>
          </h2>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Введите имя или @username..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searching && (
              <div className="absolute right-3 top-3 w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 divide-y divide-neutral-800 border border-neutral-800 rounded-2xl bg-neutral-950 overflow-hidden">
              {searchResults.map((u) => (
                <div key={u.id} className="p-3 flex items-center justify-between gap-3">
                  <Link href={`/u/${u.username}`} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-neutral-300">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        u.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {u.name || u.username}
                      </p>
                      <p className="text-[11px] text-neutral-500">@{u.username}</p>
                    </div>
                  </Link>

                  <button
                    onClick={() => handleSendRequest(u.id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition-colors"
                  >
                    + Добавить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Входящие заявки */}
        {incoming.length > 0 && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span>📩 Входящие заявки</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                {incoming.length}
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {incoming.map((req) => (
                <div
                  key={req.friendshipId}
                  className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between gap-3"
                >
                  <Link href={`/u/${req.user.username}`} className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-neutral-300 flex-shrink-0">
                      {req.user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={req.user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        req.user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{req.user.name || req.user.username}</p>
                      <p className="text-[10px] text-neutral-500 truncate">@{req.user.username}</p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(req.user.id)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                    >
                      Принять
                    </button>
                    <button
                      onClick={() => handleRemove(req.user.id)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-lg text-xs"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Список текущих друзей */}
        <div>
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span>Ваши друзья</span>
            <span className="text-xs font-normal text-neutral-500">({friends.length})</span>
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-neutral-900 border border-neutral-800 rounded-2xl" />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-3xl">
              <span className="text-3xl block mb-2">👥</span>
              <p className="text-sm font-semibold text-white mb-1">Список друзей пуст</p>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Найдите пользователей в поиске выше или перейдите в их профили, чтобы отправить заявку.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl flex items-center justify-between gap-3 shadow-md hover:border-neutral-700 transition-colors"
                >
                  <Link href={`/u/${f.username}`} className="flex items-center gap-3 min-w-0 group">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-neutral-300 flex-shrink-0">
                      {f.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        f.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {f.name || f.username}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">@{f.username}</p>
                    </div>
                  </Link>

                  <button
                    onClick={() => {
                      if (confirm(`Удалить ${f.name || f.username} из друзей?`)) {
                        handleRemove(f.id);
                      }
                    }}
                    className="text-neutral-500 hover:text-rose-400 p-1.5 rounded-lg text-xs transition-colors"
                    title="Удалить из друзей"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}