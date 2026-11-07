"use client";
import RoleBadge from "./RoleBadge";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
export type AccountBadge = {
  roleId?: string;
  name: string;
  color: string;
  icon: string;
};
export type AccountAccess = {
  owner: boolean;
  moderate: boolean;
  curate: boolean;
  beta: boolean;
  badges: AccountBadge[];
  premium: {
    active: boolean;
    until: string | null;
    balance: number;
    bonusTenths: number;
    price: number;
    plans?: { days: number; price: number; bonus: number }[];
  };
};
const Context = createContext<{
  account: AccountAccess | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}>({ account: null, loading: false, error: "", refresh: async () => {} });
const BadgeContext = createContext<{
  badges: Record<string, AccountBadge[]>;
  frames: Record<string, string | null>;
  request: (id: string) => void;
}>({ badges: {}, frames: {}, request: () => {} });
export const useAccount = () => useContext(Context);
export default function AccountAccessProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data: session, status } = useSession();
  const id = session?.user?.id;
  const [state, setState] = useState<{
    id: string;
    account: AccountAccess | null;
    error: string;
  } | null>(null);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    if (!id) return;
    try {
      const r = await fetch("/api/account", { cache: "no-store" });
      const data = await r.json();
      if (
        !r.ok ||
        typeof data?.owner !== "boolean" ||
        typeof data?.premium?.active !== "boolean"
      )
        throw Error(data.error || "Не удалось загрузить возможности аккаунта");
      if (current === version.current)
        setState({ id, account: data, error: "" });
    } catch (e) {
      if (current === version.current)
        setState((previous) => ({
          id,
          account: previous?.id === id ? previous.account : null,
          error: e instanceof Error ? e.message : "Ошибка соединения",
        }));
    }
  }, [id]);
  useEffect(() => {
    const invalidate = () => {
      version.current++;
    };
    const timer = setTimeout(() => void refresh(), 0);
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = setInterval(update, 60000);
    window.addEventListener("account-updated", update);
    window.addEventListener("focus", update);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("account-updated", update);
      window.removeEventListener("focus", update);
      invalidate();
    };
  }, [refresh]);
  const [badges, setBadges] = useState<Record<string, AccountBadge[]>>({});
  const [frames, setFrames] = useState<Record<string, string | null>>({});
  const pending = useRef(new Set<string>()),
    loaded = useRef(new Set<string>()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [badgeEpoch, setBadgeEpoch] = useState(0);
  useEffect(() => {
    const update = () => {
      loaded.current.clear();
      setBadgeEpoch((v) => v + 1);
    };
    const t = setInterval(update, 60000);
    window.addEventListener("account-updated", update);
    window.addEventListener("cosmetics-updated", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(t);
      window.removeEventListener("account-updated", update);
      window.removeEventListener("cosmetics-updated", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  const request = useCallback(
    (userId: string) => {
      void badgeEpoch; // Revalidate mounted names when roles expire or are changed.
      if (loaded.current.has(userId)) return;
      pending.current.add(userId);
      if (timer.current) return;
      timer.current = setTimeout(async () => {
        timer.current = null;
        const ids = [...pending.current];
        pending.current.clear();
        for (let i = 0; i < ids.length; i += 50) {
          const batch = ids.slice(i, i + 50);
          try {
            const r = await fetch(
              "/api/account-badges?ids=" +
                encodeURIComponent(batch.join(",")) +
                "&appearance=1",
              { cache: "no-store" },
            );
            if (!r.ok) continue;
            const next = await r.json();
            batch.forEach((x) => loaded.current.add(x));
            setBadges((previous) => ({
              ...previous,
              ...(next.badges || next),
            }));
            if (next.frames)
              setFrames((previous) => ({ ...previous, ...next.frames }));
          } catch {
            /* Names remain readable while offline. */
          }
        }
      }, 10);
    },
    [badgeEpoch],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const account = id && state?.id === id ? state.account : null;
  return (
    <Context.Provider
      value={{
        account,
        loading: status === "loading" || (!!id && state?.id !== id),
        error: state && state.id === id ? state.error : "",
        refresh,
      }}
    >
      <BadgeContext.Provider value={{ badges, frames, request }}>
        {children}
      </BadgeContext.Provider>
    </Context.Provider>
  );
}
export function AccountName({
  userId,
  children,
  highlight = true,
}: {
  userId?: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  const { badges, request } = useContext(BadgeContext);
  useEffect(() => {
    if (userId) request(userId);
  }, [userId, request]);
  const list = userId ? badges[userId] || [] : [];
  return (
    <span
      className="account-name"
      data-highlight={highlight}
      style={
        !highlight
          ? { color: "var(--text)" }
          : list.length
            ? { color: list[0].color }
            : undefined
      }
    >
      <span className="account-name-text">{children}</span>
      {list.map((b) => (
        <RoleBadge
          key={b.roleId || b.name}
          roleId={b.roleId}
          name={b.name}
          icon={b.icon}
          color={b.color}
        />
      ))}
    </span>
  );
}

export function useAccountBadges(userId?: string) {
  const { badges, request } = useContext(BadgeContext);
  useEffect(() => {
    if (userId) request(userId);
  }, [userId, request]);
  return userId ? badges[userId] : undefined;
}

export function useAccountFrame(userId?: string) {
  const { frames, request } = useContext(BadgeContext);
  useEffect(() => {
    if (userId) request(userId);
  }, [userId, request]);
  return userId ? frames[userId] : undefined;
}
