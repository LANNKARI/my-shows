"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import CosmeticAvatar from "./CosmeticAvatar";
import ThemeToggle from "./ThemeToggle";
import { useSession, signOut } from "next-auth/react";

export default function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const username =
    (session?.user as { username?: string })?.username ||
    session?.user?.name ||
    "profile";

  // Закрытие меню при клике вне его области
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      {!session?.user && (
        <Link href="/login" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-sm">Войти</Link>
      )}
      <button
        ref={triggerRef}
        aria-label={session?.user ? "Меню профиля" : "Настройки оформления"}
        aria-expanded={isOpen}
        aria-controls={panelId}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors"
      >
        {session?.user ? <>
        <CosmeticAvatar
          name={username}
          src={session.user.image}
          frame={session.user.avatarFrame}
          size={28}
        />
        <span className="text-xs font-semibold text-neutral-200 hidden sm:inline max-w-[120px] truncate">
          {username}
        </span>
        <span className="text-[10px] text-neutral-500 hidden sm:inline">▾</span>
        </> : <span className="flex h-7 w-7 items-center justify-center text-lg" aria-hidden="true">☾</span>}
      </button>

      {/* Выпадающий список */}
      {isOpen && (
        <div id={panelId} className="profile-menu-panel absolute right-0 top-full mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 text-xs">
          {session?.user && <div className="profile-menu-identity">
            <p className="profile-menu-name font-semibold text-white truncate">
              {session.user.name || username}
            </p>
            <p className="text-[11px] text-neutral-400 truncate">@{username}</p>
          </div>}
          <div className="profile-menu-appearance">
            <p className="text-neutral-400">Тема оформления</p>
            <ThemeToggle />
          </div>
          {session?.user && <>
          <Link
            href={`/u/${username}`}
            onClick={() => setIsOpen(false)}
            className="profile-menu-link"
          >
            <span>👤</span>
            <span>Мой профиль</span>
          </Link>

          <Link
            href="/cosmetics"
            onClick={() => setIsOpen(false)}
            className="profile-menu-link"
          >
            <span aria-hidden="true">🍿</span>
            <span>Оформление</span>
          </Link>

          <Link
            href="/friends"
            onClick={() => setIsOpen(false)}
            className="profile-menu-link"
          >
            <span>👥</span>
            <span>Друзья</span>
          </Link>

          <Link
            href={`/u/${username}/achievements`}
            onClick={() => setIsOpen(false)}
            className="profile-menu-link"
          >
            <span>🎖️</span>
            <span>Достижения</span>
          </Link>

          <Link
            href="/top"
            onClick={() => setIsOpen(false)}
            className="profile-menu-link"
          >
            <span>🏆</span>
            <span>Топ</span>
          </Link>

          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="profile-menu-link"
          >
            <span>⚙️</span>
            <span>Настройки</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="profile-menu-link profile-menu-logout"
          >
            <span>🚪</span>
            <span>Выйти</span>
          </button>
          </>}
        </div>
      )}
    </div>
  );
}
