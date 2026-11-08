import Dashboard from "./Dashboard";
import { useSessionActions } from "./session-context";
export default function MobileScreen() {
  const actions = useSessionActions();
  return <Dashboard {...actions} />;
}
