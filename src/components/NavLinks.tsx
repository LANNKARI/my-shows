"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export default function NavLinks() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [counts, setCounts] = useState({
    watchingCount: 0,
    plannedCount: 0,
  });

  const fetchCounts = useCallback(async () => {
    if (!session?.user) {
      setCounts({ watchingCount: 0, plannedCount: 0 });
      return;
    }

    try {
      const res = await fetch("/api/users/counts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCounts({
          watchingCount: data.watchingCount || 0,
          plannedCount: data.plannedCount || 0,
        });
      }
    } catch (err) {
      console.error("Ошибка загрузки счетчиков:", err);
    }
  }, [session?.user]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchCounts(), 0);
    return () => clearTimeout(timer);
  }, [fetchCounts, pathname]);

  // Слушатель для обновления счетчиков при изменении статусов в трекере
  useEffect(() => {
    const handleUpdate = () => fetchCounts();
    window.addEventListener("user-shows-updated", handleUpdate);
    return () => window.removeEventListener("user-shows-updated", handleUpdate);
  }, [fetchCounts]);

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="hidden xl:flex items-center gap-1.5 text-xs font-semibold">
      {/* Главная */}
      <Link
        href="/"
        className={`px-3 py-2 rounded-xl transition-all ${
          isActive("/")
            ? "bg-neutral-900 text-white font-bold border border-neutral-800"
            : "text-neutral-400 hover:text-white hover:bg-neutral-900/60"
        }`}
      >
        Главная
      </Link>

      {/* Смотрю сейчас + счетчик */}
      <Link
        href="/watching"
        className={`px-3 py-2 rounded-xl transition-all flex items-center gap-2 ${
          isActive("/watching")
            ? "bg-neutral-900 text-white font-bold border border-neutral-800"
            : "text-neutral-400 hover:text-white hover:bg-neutral-900/60"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span>👀</span>
          <span>Библиотека</span>
        </span>
        {counts.watchingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {counts.watchingCount}
          </span>
        )}
      </Link>

      {/* Что посмотреть (Рандомайзер) */}
      <Link
        href="/random"
        className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
          isActive("/random")
            ? "bg-neutral-900 text-white font-bold border border-neutral-800"
            : "text-neutral-400 hover:text-white hover:bg-neutral-900/60"
        }`}
      >
        <span>🎲</span>
        <span>Что посмотреть</span>
      </Link>

      <Link
        href="/calendar"
        className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${isActive("/calendar") ? "bg-neutral-900 text-white border border-neutral-800" : "text-neutral-400 hover:text-white hover:bg-neutral-900/60"}`}
      >
        <span aria-hidden="true">▦</span>
        <span>Календарь</span>
      </Link>
    </nav>
  );
}
