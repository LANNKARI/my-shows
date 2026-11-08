import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  const alive = useAlive();
  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      try {
        return await request<T>(path, session.token, init);
      } catch (error) {
        if (alive.current && error instanceof ApiError && error.status === 401)
          await onExpired();
        throw error;
      }
    },
    [session.token, onExpired, alive],
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
  const activePath = useRef(path);
  useLayoutEffect(() => {
    activePath.current = path;
    sequence.current++;
  }, [path]);
  const [state, setState] = useState<State<T>>({
    path,
    data: null,
    loading: !!path,
    error: "",
  });
  const refresh = useCallback(async () => {
    const endpoint = activePath.current;
    if (!endpoint || !alive.current) return;
    const version = ++sequence.current;
    setState((current) => ({
      path: endpoint,
      data: current.path === endpoint ? current.data : null,
      loading: true,
      error: "",
    }));
    try {
      const data = await api<T>(endpoint);
      if (
        alive.current &&
        endpoint === activePath.current &&
        version === sequence.current
      )
        setState({ path: endpoint, data, loading: false, error: "" });
    } catch (error) {
      if (
        alive.current &&
        endpoint === activePath.current &&
        version === sequence.current
      )
        setState((current) => ({
          ...current,
          loading: false,
          error: errorMessage(error),
        }));
    }
  }, [api, alive]);
  useFocusEffect(
    useCallback(() => {
      if (path) void refresh();
      const listener = AppState.addEventListener("change", (value) => {
        if (value === "active") void refresh();
      });
      return () => {
        sequence.current++;
        listener.remove();
      };
    }, [refresh, path]),
  );
  const update = useCallback(
    (change: (value: T) => T) => {
      if (!alive.current || activePath.current !== path) return;
      sequence.current++;
      if (alive.current)
        setState((current) =>
          current.path === path && current.data !== null
            ? { ...current, data: change(current.data), loading: false }
            : current,
        );
    },
    [path, alive],
  );
  const invalidate = useCallback(() => {
    if (!alive.current || activePath.current !== path) return;
    sequence.current++;
    if (alive.current) setState((current) => ({ ...current, loading: false }));
  }, [alive, path]);
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
