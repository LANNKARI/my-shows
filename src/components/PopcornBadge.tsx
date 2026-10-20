'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function PopcornBadge() {
  const { data: session } = useSession();
  const [popcorn, setPopcorn] = useState<number | null>(null);
  const [canClaim, setCanClaim] = useState<boolean>(false);

  const fetchBalance = async () => {
    if (!session?.user) return;
    try {
      const res = await fetch('/api/popcorn', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPopcorn(data.popcorn ?? 0);
        setCanClaim(Boolean(data.canClaimDaily));
      }
    } catch (err) {
      console.error('Ошибка загрузки баланса попкорна:', err);
    }
  };

  useEffect(() => {
    fetchBalance();
    const handleUpdate = () => fetchBalance();
    window.addEventListener('popcorn-updated', handleUpdate);
    return () => window.removeEventListener('popcorn-updated', handleUpdate);
  }, [session?.user]);

  if (!session?.user) return null;

  return (
    <Link
      href="/rewards"
      title="Попкорн — валюта сайта. Нажмите, чтобы забрать ежедневные награды и заработать ещё!"
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-amber-500/30 hover:border-amber-500/60 transition-all group shadow-sm"
    >
      <span className="text-base group-hover:scale-110 transition-transform">🍿</span>
      <span className="text-xs font-black text-amber-400 tracking-tight">
        {popcorn !== null ? popcorn : '...'}
      </span>

      {/* Индикатор доступности ежедневной награды */}
      {canClaim && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
        </span>
      )}
    </Link>
  );
}