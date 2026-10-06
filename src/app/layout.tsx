import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Providers from "./providers";
import UserMenu from "@/components/UserMenu";
import SearchBar from "@/components/SearchBar";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Shows — трекер сериалов",
  description: "Личный трекер сериалов и фильмов",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>
        <Providers>
          <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/60 border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-900/40 group-hover:scale-105 transition">
                  <span className="text-white text-sm font-black">M</span>
                </div>
                <span className="text-lg font-bold tracking-tight">
                  My<span className="text-red-500">Shows</span>
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-1 text-sm">
                <Link href="/" className="px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition">
                  Главная
                </Link>
                <Link href="/collections" className="px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition">
                  Коллекции
                </Link>
                <Link href="/friends" className="px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition">
  Друзья
</Link>
<Link
  href="/top"
  className="px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition"
>
  🥇 Топ
</Link>
              </nav>
              
{/* Поиск */}
              <div className="hidden md:flex flex-1 max-w-md mx-4">
  <SearchBar />
</div>

              <div className="ml-auto flex items-center gap-3">
                <Link href="/new" className="btn btn-primary">
                  <span className="text-base leading-none">+</span>
                  <span className="hidden sm:inline">Добавить</span>
                </Link>
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">{children}</main>

          <footer className="max-w-7xl mx-auto px-4 md:px-6 py-10 text-center text-xs text-neutral-600">
            My Shows — личный трекер сериалов
          </footer>
        </Providers>
      </body>
    </html>
  );
}