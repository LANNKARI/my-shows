'use client';

import React from 'react';

export interface BadgeItem {
  id: string;
  name?: string;
  title?: string;
  icon: string;
  tier?: string;
  tierLabel?: string;
}

interface AchievementBadgesProps {
  badges: BadgeItem[];
  maxDisplay?: number;
}

export default function AchievementBadges({
  badges = [],
  maxDisplay = 5,
}: AchievementBadgesProps) {
  if (!badges || badges.length === 0) return null;

  const displayBadges = badges.slice(0, maxDisplay);
  const remainingCount = badges.length - maxDisplay;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {displayBadges.map((badge, idx) => {
        const title = badge.name || badge.title || 'Достижение';
        const isImagePath =
          badge.icon.startsWith('/') ||
          badge.icon.includes('.') ||
          badge.icon.startsWith('http');

        return (
          <div
            key={badge.id || idx}
            title={title}
            className="w-6 h-6 rounded-full overflow-hidden bg-neutral-900 border border-amber-500/40 flex items-center justify-center flex-shrink-0 shadow-sm"
          >
            {isImagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={badge.icon}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs leading-none">{badge.icon}</span>
            )}
          </div>
        );
      })}

      {remainingCount > 0 && (
        <span className="text-[10px] text-neutral-500 font-semibold px-1.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800">
          +{remainingCount}
        </span>
      )}
    </div>
  );
}