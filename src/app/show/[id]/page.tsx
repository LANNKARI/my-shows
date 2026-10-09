'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CastList from '@/components/CastList';
import ShowDetails from '@/components/ShowDetails';
import CommentSection from '@/components/CommentSection';

interface ShowPageProps {
  params: Promise<{ id: string }>;
}

export default function ShowPage({ params }: ShowPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [show, setShow] = useState<any>(null);
  const [userShow, setUserShow] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingLibrary, setUpdatingLibrary] = useState<boolean>(false);
  const [userRating, setUserRating] = useState<number>(0);

  const loadShow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shows/${id}`);
      if (!res.ok) {
        throw new Error('Карточка фильма или сериала не найдена');
      }
      const data = await res.json();
      setShow(data.show);
      setUserShow(data.userShow || null);

      if (data.userShow?.ratings?.[0]?.score) {
        setUserRating(data.userShow.ratings[0].score);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSetStatus = async (newStatus: string) => {
    if (!show) return;
    setUpdatingLibrary(true);
    try {
      const res = await fetch('/api/user-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: show.id,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || 'Не удалось обновить статус');
      }

      const updated = await res.json();
      setUserShow(updated.item || updated.userShow || updated);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Ошибка при сохранении в библиотеку');
    } finally {
      setUpdatingLibrary(false);
    }
  };

  const handleRate = async (score: number) => {
    if (!show) return;
    setUserRating(score);
    try {
      await fetch('/api/user-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: show.id,
          score,
        }),
      });
    } catch (err) {
      console.error('Ошибка выставления оценки:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-400">Загрузка карточки...</p>
        </div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center shadow-xl">
          <div className="text-4xl mb-3">🎬</div>
          <h1 className="text-xl font-bold text-white mb-2">Тайтл не найден</h1>
          <p className="text-sm text-neutral-400 mb-6">{error || 'Не удалось загрузить информацию о тайтле.'}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium rounded-xl transition-colors"
            >
              ← Назад
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const title = show.name || show.title;
  const originalTitle = show.originalName || show.originalTitle;
  const currentStatus = userShow?.status || null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      <div className="relative border-b border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
          <button
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>Назад</span>
          </button>

          <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            <div className="w-48 sm:w-64 flex-shrink-0 mx-auto md:mx-0">
              <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl relative">
                {show.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={show.posterUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                    Нет постера
                  </div>
                )}

                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-bold uppercase text-white border border-white/10">
                  {show.kind === 'movie' ? 'Фильм' : 'Сериал'}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col w-full">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                {show.year && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {show.year}
                  </span>
                )}
                {show.tmdbRating > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs">
                    <span>★</span>
                    <span>{show.tmdbRating.toFixed(1)}</span>
                    <span className="text-neutral-500 text-[11px] font-normal">
                      ({show.tmdbVotes || 0})
                    </span>
                  </div>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                {title}
              </h1>

              {originalTitle && originalTitle !== title && (
                <p className="text-sm text-neutral-400 italic mb-4 font-normal">
                  {originalTitle}
                </p>
              )}

              {show.genres && show.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {show.genres.map((g: string) => (
                    <span
                      key={g}
                      className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800/80 text-neutral-300 border border-neutral-700/60"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Блок «Моя библиотека» */}
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 mb-6 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📚</span>
                    <span className="text-sm font-semibold text-white">Моя библиотека</span>
                  </div>

                  <Link
                    href={`/library/${show.id}`}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>📖 Открыть трекер серий и заметки →</span>
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[
                    { key: 'watching', label: '👀 Смотрю' },
                    { key: 'planned', label: '🔖 В планах' },
                    { key: 'completed', label: '✓ Просмотрено' },
                    { key: 'dropped', label: '✕ Брошено' },
                  ].map((st) => (
                    <button
                      key={st.key}
                      disabled={updatingLibrary}
                      onClick={() => handleSetStatus(st.key)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium transition-all border ${
                        currentStatus === st.key
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                          : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-neutral-800/80 text-xs">
                  <span className="text-neutral-400">Моя оценка:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(star)}
                        className={`text-sm transition-transform hover:scale-125 ${
                          userRating >= star ? 'text-amber-400' : 'text-neutral-700 hover:text-neutral-400'
                        }`}
                        title={`Поставить ${star} из 10`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {userRating > 0 && (
                    <span className="font-bold text-amber-400 ml-1">{userRating}/10</span>
                  )}
                </div>
              </div>

              {show.description && (
                <div className="text-sm text-neutral-300 leading-relaxed">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    О тайтле
                  </h3>
                  <p className="line-clamp-6">{show.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        <section>
          <ShowDetails show={show} />
        </section>

        {show.cast && Array.isArray(show.cast) && show.cast.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🎭 В главных ролях</span>
              <span className="text-xs font-normal text-neutral-500">({show.cast.length})</span>
            </h2>
            <CastList cast={show.cast} />
          </section>
        )}

        <section className="pt-6 border-t border-neutral-800">
          <CommentSection
            showId={show.id}
            initialComments={show.comments || []}
          />
        </section>
      </div>
    </div>
  );
}