import { createContext, useContext } from "react";
import { Session } from "./api";
export type SessionActions = {
  session: Session;
  onLogout: () => Promise<void>;
  onExpired: () => Promise<void>;
};
export const SessionContext = createContext<SessionActions | null>(null);
export function useSessionActions() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session provider is missing");
  return value;
}
