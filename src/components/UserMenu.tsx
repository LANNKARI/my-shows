'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const username =
    (session?.user as { username?: string })?.username ||
    session?.user?.name ||
    'profile';

  // Закрытие меню при клике вне его области
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-sm"
      >
        Войти
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-xs font-bold text-rose-400 overflow-hidden">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            username.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-xs font-semibold text-neutral-200 hidden sm:inline max-w-[120px] truncate">
          {username}
        </span>
        <span className="text-[10px] text-neutral-500 hidden sm:inline">▾</span>
      </button>

      {/* Выпадающий список */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl py-2 z-50 text-xs">
          <div className="px-3 py-2 border-b border-neutral-800/80 mb-1">
            <p className="font-semibold text-white truncate">
              {session.user.name || username}
            </p>
            <p className="text-[11px] text-neutral-400 truncate">@{username}</p>
          </div>

          <Link
            href={`/u/${username}`}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <span>👤</span>
            <span>Мой профиль</span>
          </Link>

          <Link
            href="/friends"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <span>👥</span>
            <span>Друзья</span>
          </Link>

          <Link
            href="/top"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <span>🏆</span>
            <span>Топ</span>
          </Link>

          <div className="my-1 border-t border-neutral-800/80" />

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              signOut({ callbackUrl: '/' });
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-neutral-800 transition-colors text-left"
          >
            <span>🚪</span>
            <span>Выйти</span>
          </button>
        </div>
      )}
    </div>
  );
}