import type { Metadata } from 'next';
import SearchBar from '@/components/SearchBar';

export const metadata: Metadata = { title: 'Поиск — My Shows' };

export default function SearchPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Найдите своё следующее кино</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">Ищите фильмы и сериалы по названию. Откройте карточку, чтобы добавить тайтл в свои планы.</p>
      </div>
      <SearchBar layout="page" autoFocus />
    </section>
  );
}
