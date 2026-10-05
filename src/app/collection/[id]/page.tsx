"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TitleCard, { TitleCardData } from "@/components/TitleCard";

type C = {
  id: number;
  name: string;
  items: {
    title: TitleCardData & {
      ratings: { score: number }[];
      episodes: { watched: boolean }[];
    };
  }[];
};

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<C | null>(null);

  useEffect(() => {
    fetch(`/api/collections/${id}`)
      .then((r) => r.json())
      .then(setC);
  }, [id]);

  if (!c) return <p className="text-neutral-400">Загрузка...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📁 {c.name}</h1>

      {c.items.length === 0 ? (
        <p className="text-neutral-400">
          Пусто. Добавьте тайтлы через их страницы.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {c.items.map(({ title: t }) => (
            <TitleCard
              key={t.id}
              t={{
                id: t.id,
                name: t.name,
                posterUrl: t.posterUrl,
                isCompleted: t.isCompleted,
                kind: t.kind,
                avgRating: t.ratings.length
                  ? t.ratings.reduce((s, r) => s + r.score, 0) / t.ratings.length
                  : null,
                watchedEpisodes: t.episodes.filter((e) => e.watched).length,
                episodesCount: t.episodes.length,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}