"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import CosmeticAvatar from "./CosmeticAvatar";
import { useAccount, AccountName } from "./AccountAccess";
import RoleBadge from "./RoleBadge";
import PremiumBadge from "./PremiumBadge";
import ThemeToggle from "./ThemeToggle";
import { useSession, signOut } from "next-auth/react";

export default function UserMenu() {
  const { data: session } = useSession();
  const { account } = useAccount();
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
      if (
        event.key === "Escape" &&
        menuRef.current?.contains(document.activeElement)
      ) {
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
    <div
      className={`relative flex items-center gap-2${!session?.user ? " guest-actions" : ""}`}
      ref={menuRef}
    >
      {!session?.user && (
        <>
          <Link href="/login" className="guest-login">
            Войти
          </Link>
          <Link href="/register" className="guest-register">
            Регистрация
          </Link>
        </>
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
        {session?.user ? (
          <>
            <CosmeticAvatar
              name={username}
              userId={session.user.id}
              src={session.user.image}
              frame={
                session.user.avatarFrame === "frame-premium-orbit" &&
                !account?.premium.active
                  ? "frame-standard"
                  : session.user.avatarFrame
              }
              size={28}
            />
            <span className="text-xs font-semibold text-neutral-200 hidden sm:inline max-w-[120px] truncate">
              <AccountName userId={session.user.id}>{username}</AccountName>
            </span>
            <span className="text-[10px] text-neutral-500 hidden sm:inline">
              ▾
            </span>
          </>
        ) : (
          <span
            className="flex h-7 w-7 items-center justify-center text-lg"
            aria-hidden="true"
          >
            ☾
          </span>
        )}
      </button>

      {/* Выпадающий список */}
      {isOpen && (
        <div
          id={panelId}
          className="profile-menu-panel absolute right-0 top-full mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 text-xs"
        >
          {session?.user && (
            <div className="profile-menu-identity">
              <p className="profile-menu-name font-semibold text-white truncate">
                {session.user.name || username}
              </p>
              <p className="text-[11px] text-neutral-400 truncate">
                @{username}
              </p>
            </div>
          )}
          {!session?.user && (
            <>
              <div className="profile-menu-appearance">
                <p className="text-neutral-400">Тема оформления</p>
                <ThemeToggle />
              </div>
            </>
          )}
          {session?.user && (
            <>
              <div className="profile-menu-group">
                <Link
                  href={`/u/${username}`}
                  onClick={() => setIsOpen(false)}
                  className="profile-menu-link"
                >
                  <MenuIcon name="profile" />
                  Мой профиль
                </Link>
                <Link
                  href="/friends"
                  onClick={() => setIsOpen(false)}
                  className="profile-menu-link"
                >
                  <MenuIcon name="friends" />
                  Друзья
                </Link>
                <Link
                  href={`/u/${username}/achievements`}
                  onClick={() => setIsOpen(false)}
                  className="profile-menu-link"
                >
                  <MenuIcon name="trophy" />
                  Достижения
                </Link>
                <Link
                  href="/top"
                  onClick={() => setIsOpen(false)}
                  className="profile-menu-link"
                >
                  <MenuIcon name="top" />
                  Топ
                </Link>
              </div>
              <div className="profile-menu-group">
                <Link
                  href="/premium"
                  onClick={() => setIsOpen(false)}
                  className="profile-menu-premium"
                >
                  <PremiumBadge decorative size={30} />
                  <span>
                    <strong>EpisyHub Premium</strong>
                    <small>
                      {account?.premium.active
                        ? "Подписка активна"
                        : "Больше возможностей для вашего кино"}
                    </small>
                  </span>
                  <span className="profile-menu-premium-tag">PREMIUM</span>
                </Link>
                <Link
                  href="/statistics"
                  onClick={() => setIsOpen(false)}
                  className="profile-menu-link"
                >
                  <MenuIcon name="stats" />
                  Статистика просмотров
                </Link>
                <Link
                  href="/cosmetics"
                  onClick={() => setIsOpen(false)}
                  className="profile-menu-link"
                >
                  <MenuIcon name="palette" />
                  Оформление
                </Link>
              </div>
              <div className="profile-menu-group">
                <Link
                  href="/settings"
                  onClick={() => setIsOpen(false)}
                  className="profile-menu-link"
                >
                  <MenuIcon name="settings" />
                  Настройки
                </Link>
                {(account?.owner || account?.moderate) && (
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="profile-menu-link"
                  >
                    <RoleBadge
                      roleId={account?.owner ? "owner" : "moderator"}
                      name="Управление сайтом"
                      decorative
                    />{" "}
                    Управление сайтом
                  </Link>
                )}
              </div>
              <div className="profile-menu-appearance">
                <p className="text-neutral-400">Тема оформления</p>
                <ThemeToggle />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="profile-menu-link profile-menu-logout"
              >
                <MenuIcon name="exit" />
                <span>Выйти</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    profile: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
        <circle cx="12" cy="12" r="10" />
      </>
    ),
    friends: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M2 20v-2a7 7 0 0 1 14 0v2M16 5a3 3 0 0 1 0 6M19 14a6 6 0 0 1 3 5" />
      </>
    ),
    trophy: (
      <>
        <path d="M7 3h10v5a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 13v6M8 21h8" />
      </>
    ),
    top: (
      <>
        <path d="M3 21V11h5v10M10 21V4h5v17M17 21v-7h4v7" />
      </>
    ),
    stats: (
      <>
        <path d="M3 3v18h18M7 15l4-5 4 3 5-8" />
      </>
    ),
    palette: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a3 3 0 0 0 3-3c0-4-4-7-9-7Z" />
        <path d="M7 9h.01M10 6h.01M15 7h.01M6 14h.01" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h4l1-3 3-1v-3l2-2-2-3-3-1-1-3z" />
        <circle cx="11" cy="11" r="3" />
      </>
    ),
    exit: (
      <>
        <path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4" />
      </>
    ),
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
