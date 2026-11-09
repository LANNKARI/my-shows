import { createContext, PropsWithChildren, useContext, useState } from "react";
import { request } from "./api";
import { ProgressQueue } from "./progress-queue";
import { DataCache } from "./data-cache";
const QueueContext = createContext<ProgressQueue | null>(null);
const Context = createContext<DataCache | null>(null);
export function SessionData({
  token,
  children,
}: PropsWithChildren<{ token: string }>) {
  const [cache] = useState(
    () =>
      new DataCache(<T,>(path: string, init?: RequestInit) =>
        request<T>(path, token, init),
      ),
  );
  const [queue] = useState(() => new ProgressQueue(cache));
  return (
    <Context.Provider value={cache}>
      <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>
    </Context.Provider>
  );
}
export function useDataCache() {
  const cache = useContext(Context);
  if (!cache) throw new Error("Session data provider is missing");
  return cache;
}

export function useProgressQueue() {
  const queue = useContext(QueueContext);
  if (!queue) throw new Error("Progress queue provider is missing");
  return queue;
}
