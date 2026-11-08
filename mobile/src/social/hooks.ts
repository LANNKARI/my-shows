import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError, request } from "../api";
import { useSessionActions } from "../session-context";
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось выполнить действие";
export const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
export function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
export function useSocialApi() {
  const { session, onExpired } = useSessionActions();
  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      try {
        return await request<T>(path, session.token, init);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          await onExpired();
        throw error;
      }
    },
    [session.token, onExpired],
  );
}
type State<T> = {
  path: string | null;
  data: T | null;
  loading: boolean;
  error: string;
};
export function useResource<T>(path: string | null) {
  const api = useSocialApi();
  const alive = useAlive();
  const sequence = useRef(0);
  const [state, setState] = useState<State<T>>({
    path,
    data: null,
    loading: !!path,
    error: "",
  });
  const refresh = useCallback(async () => {
    if (!path) return;
    const version = ++sequence.current;
    setState((current) => ({
      path,
      data: current.path === path ? current.data : null,
      loading: true,
      error: "",
    }));
    try {
      const data = await api<T>(path);
      if (alive.current && version === sequence.current)
        setState({ path, data, loading: false, error: "" });
    } catch (error) {
      if (alive.current && version === sequence.current)
        setState((current) => ({
          ...current,
          loading: false,
          error: errorMessage(error),
        }));
    }
  }, [path, api, alive]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const listener = AppState.addEventListener("change", (value) => {
        if (value === "active") void refresh();
      });
      return () => {
        sequence.current++;
        listener.remove();
      };
    }, [refresh]),
  );
  const update = useCallback(
    (change: (value: T) => T) => {
      sequence.current++;
      if (alive.current)
        setState((current) =>
          current.path === path && current.data
            ? { ...current, data: change(current.data), loading: false }
            : current,
        );
    },
    [path, alive],
  );
  const invalidate = useCallback(() => {
    sequence.current++;
    if (alive.current) setState((current) => ({ ...current, loading: false }));
  }, [alive]);
  return {
    data: state.path === path ? state.data : null,
    loading: !!path && (state.path !== path || state.loading),
    error: state.path === path ? state.error : "",
    refresh,
    update,
    invalidate,
  };
}
export function useTask() {
  const alive = useAlive();
  const locked = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run(key: string, work: () => Promise<string | void>) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const message = await work();
      if (alive.current && message) setNotice(message);
      return true;
    } catch (error) {
      if (alive.current) setError(errorMessage(error));
      return false;
    } finally {
      locked.current = false;
      if (alive.current) setBusy(null);
    }
  }
  return { busy, error, notice, run };
}
export function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
