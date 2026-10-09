'use client';

import React from 'react';

export interface CastMember {
  id?: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  profileUrl?: string | null;
  image?: string | null;
  photoUrl?: string | null;
  avatarUrl?: string | null;
}

export interface CastListProps {
  cast?: CastMember[] | any;
}

export default function CastList({ cast }: CastListProps) {
  let list: CastMember[] = [];

  if (Array.isArray(cast)) {
    list = cast;
  } else if (typeof cast === 'string') {
    try {
      const parsed = JSON.parse(cast);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }

  if (!list || list.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 text-xs text-neutral-500 italic">
        Информация об актерском составе отсутствует.
      </div>
    );
  }

  const getActorPhoto = (member: CastMember): string | null => {
    const raw =
      member.profileUrl ||
      member.image ||
      member.photoUrl ||
      member.avatarUrl ||
      member.profile_path;

    if (!raw || typeof raw !== 'string') return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    const clean = raw.startsWith('/') ? raw : `/${raw}`;
    return `https://image.tmdb.org/t/p/w185${clean}`;
  };

  const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="relative">
      {/* Горизонтальный скролл-контейнер для мобильных и десктопов */}
      <div className="flex gap-3.5 overflow-x-auto pb-4 pt-1 no-scrollbar scroll-smooth">
        {list.map((actor, idx) => {
          const photoUrl = getActorPhoto(actor);
          const initials = getInitials(actor.name);

          return (
            <div
              key={actor.id ? `${actor.id}-${idx}` : idx}
              className="w-28 sm:w-32 flex-shrink-0 flex flex-col group"
            >
              <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-md relative mb-2">
                {/* Запасная плашка с инициалами (видна если фото нет или не загрузилось) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-850 text-neutral-500 font-bold text-sm select-none">
                  <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 text-xs mb-1">
                    {initials}
                  </div>
                </div>

                {photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={actor.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      // При ошибке скрываем изображение, показывая инициалы под ним
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>

              <span className="font-medium text-xs text-neutral-200 line-clamp-1 group-hover:text-blue-400 transition-colors">
                {actor.name}
              </span>

              {actor.character && (
                <span className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                  {actor.character}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}