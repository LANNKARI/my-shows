import type { Metadata } from 'next';
import { Suspense } from 'react';
import Library from '@/components/Library';

export const metadata: Metadata = { title: 'Моя библиотека — My Shows' };

export default function WatchingPage() {
  return <Suspense fallback={<p role="status" className="text-sm text-neutral-400">Загружаем библиотеку…</p>}><Library /></Suspense>;
}
