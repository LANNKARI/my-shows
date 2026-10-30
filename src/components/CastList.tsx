"use client";

import Link from "next/link";
import React, { useRef } from "react";

interface Actor {
  id: number;
  name: string;
  character?: string;
  profileUrl?: string | null;
  image?: string | null;
  photoUrl?: string | null;
  profile_path?: string | null;
}

interface CastListProps {
  cast: Actor[];
}

export default function CastList({ cast }: CastListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (!cast || cast.length === 0) return null;

  return (
    <div className="relative group/cast">
      {/* Кнопки перелистывания сверху/справа */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🎭 В главных ролях</span>
          <span className="text-xs font-normal text-neutral-500">
            ({cast.length})
          </span>
        </h2>

        {cast.length > 5 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center text-sm transition-all shadow-md cursor-pointer active:scale-95"
              aria-label="Назад"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center text-sm transition-all shadow-md cursor-pointer active:scale-95"
              aria-label="Вперёд"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Горизонтальная лента без стандартной серой полосы прокрутки */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {cast.map((actor) => {
          const photo =
            actor.profileUrl ||
            actor.photoUrl ||
            actor.image ||
            (actor.profile_path
              ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
              : null);
          return (
            <Link
              href={`/actors/${actor.id}`}
              aria-label={`Открыть страницу актёра ${actor.name}`}
              key={actor.id}
              className="w-32 sm:w-36 flex-shrink-0 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-2 flex flex-col group hover:border-neutral-700 transition-all shadow-md focus-visible:outline-2 focus-visible:outline-rose-400"
            >
              <div className="aspect-[3/4] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={actor.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-neutral-600 bg-neutral-900">
                    👤
                  </div>
                )}
              </div>
              <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
                {actor.name}
              </p>
              {actor.character && (
                <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                  {actor.character}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
