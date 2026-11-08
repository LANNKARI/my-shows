import { createContext, PropsWithChildren, useContext, useState } from "react";
import { request } from "./api";
import { DataCache } from "./data-cache";
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
  return <Context.Provider value={cache}>{children}</Context.Provider>;
}
export function useDataCache() {
  const cache = useContext(Context);
  if (!cache) throw new Error("Session data provider is missing");
  return cache;
}
