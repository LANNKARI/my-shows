import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Providers from "./providers";
import UserMenu from "@/components/UserMenu";
import SearchBar from "@/components/SearchBar";
import NavLinks from "@/components/NavLinks";
import PopcornBadge from "@/components/PopcornBadge";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Shows — трекер сериалов",
  description: "Личный трекер сериалов и фильмов",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="bg-neutral-950 text-neutral-100 antialiased selection:bg-rose-500 selection:text-white">
        <Providers>
          <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-850">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
              {/* Логотип */}
              <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-900/30 group-hover:scale-105 transition-transform">
                  <span className="text-white text-sm font-black">M</span>
                </div>
                <span className="text-lg font-extrabold tracking-tight hidden sm:inline">
                  My<span className="text-rose-500">Shows</span>
                </span>
              </Link>

              {/* Навигация с вкладками и счётчиками */}
              <NavLinks />

              {/* Поиск */}
              <div className="hidden md:flex flex-1 max-w-md mx-2">
                <SearchBar />
              </div>

              {/* Валюта сайта (Попкорн) и Меню профиля */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <PopcornBadge />
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">{children}</main>

          <footer className="max-w-7xl mx-auto px-4 md:px-6 py-10 text-center text-xs text-neutral-600 border-t border-neutral-900">
            My Shows — личный трекер сериалов
          </footer>
        </Providers>
      </body>
    </html>
  );
}