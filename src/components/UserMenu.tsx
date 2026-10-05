"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="w-8 h-8 rounded-full bg-neutral-800 animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <Link href="/login" className="btn btn-secondary">
        Войти
      </Link>
    );
  }

  const user = session.user as any;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full hover:bg-white/5 transition pl-1 pr-3 py-1"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
            {(user.username || user.email || "?")[0].toUpperCase()}
          </div>
        )}
        <span className="text-sm text-neutral-300 max-w-[100px] truncate">
          {user.username || user.email}
        </span>
      </button>

      {open && (
        <>
          {/* Клик вне меню — закрыть */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-neutral-900 shadow-2xl overflow-hidden z-50">
            <Link
              href={`/u/${user.username}`}
              className="block px-4 py-2.5 text-sm text-neutral-300 hover:bg-white/5 transition"
              onClick={() => setOpen(false)}
            >
              👤 Мой профиль
            </Link>

            <Link
              href="/settings"
              className="block px-4 py-2.5 text-sm text-neutral-300 hover:bg-white/5 transition"
              onClick={() => setOpen(false)}
            >
              ⚙️ Настройки
            </Link>

            <div className="border-t border-white/5" />

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition"
            >
              🚪 Выйти
            </button>
          </div>
        </>
      )}
    </div>
  );
}