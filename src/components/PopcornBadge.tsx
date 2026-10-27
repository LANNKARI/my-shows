"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { privateFetch } from "@/lib/private-fetch";
import { useSession } from "next-auth/react";
export default function PopcornBadge() {
  const { data: session } = useSession();
  return session?.user?.id ? <Wallet key={session.user.id} /> : null;
}
function Wallet() {
  const [popcorn, setPopcorn] = useState<number | null>(null),
    [canClaim, setCanClaim] = useState(false);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const fetchBalance = async () => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      try {
        const response = await privateFetch("/api/popcorn", abort.signal);
        if (!response.ok) throw new Error("balance unavailable");
        if (response.ok) {
          const data = await response.json();
          if (!abort.signal.aborted) {
            setFailed(false);
            setPopcorn(data.popcorn ?? 0);
            setCanClaim(!!data.canClaimDaily);
          }
        }
      } catch {
        if (!abort.signal.aborted) setFailed(true);
      }
    };
    const update = () => {
      void fetchBalance();
    };
    const timer = setTimeout(update, 0);
    window.addEventListener("popcorn-updated", update);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
      window.removeEventListener("popcorn-updated", update);
    };
  }, []);
  return (
    <Link
      href="/rewards"
      title="Попкорн — валюта сайта. Нажмите, чтобы забрать ежедневные награды и заработать ещё!"
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-amber-500/30 hover:border-amber-500/60 transition-all group shadow-sm"
    >
      <span className="text-base group-hover:scale-110 transition-transform">
        🍿
      </span>
      <span className="text-xs font-black text-amber-400 tracking-tight">
        {popcorn !== null ? popcorn : failed ? "↻" : "…"}
      </span>
      {canClaim && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
      )}
    </Link>
  );
}
