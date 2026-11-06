"use client";

import { SessionProvider } from "next-auth/react";
import AccountAccessProvider from "@/components/AccountAccess";
import ThemeSync from "@/components/ThemeSync";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><AccountAccessProvider><ThemeSync />{children}</AccountAccessProvider></SessionProvider>;
}