'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import NavigationIcon, { type NavigationIconName } from './NavigationIcon';

const matches = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

export function MobileLibraryTabs() {
  const pathname = usePathname();
  const sections = [
    { label: 'Смотрю', href: '/watching', paths: ['/watching'] },
    { label: 'В планах', href: '/wishlist', paths: ['/wishlist', '/planned'] },
    { label: 'Коллекции', href: '/collections', paths: ['/collections', '/collection'] },
  ];
  if (!sections.some(section => section.paths.some(path => matches(pathname, path)))) return null;
  return (
    <nav aria-label="Разделы библиотеки" className="mb-6 flex gap-2 overflow-x-auto pb-1 xl:hidden">
      {sections.map(section => {
        const active = section.paths.some(path => matches(pathname, path));
        return <Link key={section.href} href={section.href} aria-current={active ? 'page' : undefined} className={`flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-rose-400 ${active ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' : 'border-neutral-800 bg-neutral-900/50 text-neutral-400'}`}>{section.label}</Link>;
      })}
    </nav>
  );
}

export default function MobileNavigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const username = session?.user?.username;
  const profilePath = username ? `/u/${encodeURIComponent(username)}` : session?.user ? '/settings' : '/login';
  const items: { label: string; href: string; icon: NavigationIconName; active: boolean }[] = [
    { label: 'Главная', href: '/', icon: 'home', active: pathname === '/' },
    { label: 'Поиск', href: '/search', icon: 'search', active: matches(pathname, '/search') },
    { label: 'Библиотека', href: '/watching', icon: 'library', active: ['/watching', '/wishlist', '/planned', '/library', '/collections', '/collection'].some(path => matches(pathname, path)) },
    { label: 'Профиль', href: profilePath, icon: 'profile', active: matches(pathname, profilePath) || ['/register', '/settings'].some(path => matches(pathname, path)) },
  ];

  return (
    <nav aria-label="Мобильная навигация" className="mobile-navigation fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-xl xl:hidden">
      <div className="mx-auto grid h-[4.5rem] max-w-lg grid-cols-4 px-2">
        {items.map(item => (
          <Link key={item.icon} href={item.href} prefetch={false} aria-current={item.active ? 'page' : undefined}
            className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-rose-400 ${item.active ? 'text-rose-500' : 'text-neutral-400 hover:text-neutral-100'}`}>
            {item.active && <span className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-rose-500" />}
            <NavigationIcon name={item.icon} className="h-6 w-6" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
