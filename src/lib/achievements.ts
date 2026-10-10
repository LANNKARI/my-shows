export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'legend';
export type AchievementTierLabel = 'БРОНЗА' | 'СЕРЕБРО' | 'ЗОЛОТО' | 'ЛЕГЕНДА';

export interface AchievementProgress {
  current: number;
  target: number;
  max: number;
  percent: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  tierLabel: AchievementTierLabel;
  maxProgress: number;
  target: number;
}

export interface AchievementItem extends AchievementDef {
  unlocked: boolean;
  progress: AchievementProgress;
  current: number;
}

export const ACHIEVEMENTS_CONFIG: AchievementDef[] = [
  // 1. Добавленные сериалы
  {
    id: 'first_step',
    name: 'Первый шаг',
    title: 'Первый шаг',
    description: 'Добавлен первый сериал',
    icon: '/achievements/first_step.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 1,
    target: 1,
  },
  {
    id: 'collector',
    name: 'Коллекционер',
    title: 'Коллекционер',
    description: '10 добавленных сериалов',
    icon: '/achievements/collector.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 10,
    target: 10,
  },
  {
    id: 'bibliophile',
    name: 'Библиофил',
    title: 'Библиофил',
    description: '50 добавленных сериалов',
    icon: '/achievements/bibliophile.jpg',
    tier: 'gold',
    tierLabel: 'ЗОЛОТО',
    maxProgress: 50,
    target: 50,
  },
  {
    id: 'legend',
    name: 'Легенда',
    title: 'Легенда',
    description: '100 добавленных сериалов',
    icon: '/achievements/legend.jpg',
    tier: 'legend',
    tierLabel: 'ЛЕГЕНДА',
    maxProgress: 100,
    target: 100,
  },

  // 2. Просмотренные серии
  {
    id: 'beginner',
    name: 'Начинающий',
    title: 'Начинающий',
    description: '10 просмотренных серий',
    icon: '/achievements/beginner.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 10,
    target: 10,
  },
  {
    id: 'avid',
    name: 'Заядлый',
    title: 'Заядлый',
    description: '100 просмотренных серий',
    icon: '/achievements/avid.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 100,
    target: 100,
  },
  {
    id: 'marathoner',
    name: 'Марафонец',
    title: 'Марафонец',
    description: '1000 просмотренных серий',
    icon: '/achievements/marathoner.jpg',
    tier: 'legend',
    tierLabel: 'ЛЕГЕНДА',
    maxProgress: 1000,
    target: 1000,
  },

  // 3. Полностью просмотренные сериалы
  {
    id: 'final_chord',
    name: 'Финальный аккорд',
    title: 'Финальный аккорд',
    description: '5 полностью просмотренных сериалов',
    icon: '/achievements/final_chord.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 5,
    target: 5,
  },

  // 4. Поставленные оценки
  {
    id: 'critic',
    name: 'Критик',
    title: 'Критик',
    description: '10 поставленных оценок',
    icon: '/achievements/critic.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 10,
    target: 10,
  },
  {
    id: 'expert',
    name: 'Эксперт',
    title: 'Эксперт',
    description: '50 поставленных оценок',
    icon: '/achievements/expert.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 50,
    target: 50,
  },
  {
    id: 'judge',
    name: 'Судья',
    title: 'Судья',
    description: '100 поставленных оценок',
    icon: '/achievements/judge.jpg',
    tier: 'gold',
    tierLabel: 'ЗОЛОТО',
    maxProgress: 100,
    target: 100,
  },

  // 5. Комментарии
  {
    id: 'commentator',
    name: 'Комментатор',
    title: 'Комментатор',
    description: '10 комментариев',
    icon: '/achievements/commentator.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 10,
    target: 10,
  },
  {
    id: 'guru',
    name: 'Гуру общения',
    title: 'Гуру общения',
    description: '50 комментариев',
    icon: '/achievements/guru.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 50,
    target: 50,
  },

  // 6. Друзья
  {
    id: 'friendly',
    name: 'Компанейский',
    title: 'Компанейский',
    description: '5 друзей',
    icon: '/achievements/friendly.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 5,
    target: 5,
  },
  {
    id: 'soul_of_party',
    name: 'Душа компании',
    title: 'Душа компании',
    description: '20 друзей',
    icon: '/achievements/soul_of_party.jpg',
    tier: 'gold',
    tierLabel: 'ЗОЛОТО',
    maxProgress: 20,
    target: 20,
  },

  // 7. Стаж аккаунта
  {
    id: 'early_bird',
    name: 'Ранняя пташка',
    title: 'Ранняя пташка',
    description: 'Аккаунт старше года',
    icon: '/achievements/early_bird.jpg',
    tier: 'gold',
    tierLabel: 'ЗОЛОТО',
    maxProgress: 365,
    target: 365,
  },
];

export interface AchievementStats {
  totalTitles?: number;
  addedShowsCount?: number;
  totalShows?: number;
  watchedEpisodesCount?: number;
  totalEpisodes?: number;
  episodesWatched?: number;
  watchedEpisodes?: number;
  ratingsCount?: number;
  totalRatings?: number;
  completedSeriesCount?: number;
  completedSeries?: number;
  completedShows?: number;
  completedCount?: number;
  commentsCount?: number;
  totalComments?: number;
  friendsCount?: number;
  totalFriends?: number;
  daysRegistered?: number;
  hoursWatched?: number;
  [key: string]: any;
}

export function calculateAchievements(stats: AchievementStats): AchievementItem[] {
  const addedCount = stats.addedShowsCount ?? stats.totalTitles ?? stats.totalShows ?? 0;
  const watchedEps = stats.watchedEpisodesCount ?? stats.totalEpisodes ?? stats.episodesWatched ?? stats.watchedEpisodes ?? 0;
  const ratings = stats.ratingsCount ?? stats.totalRatings ?? 0;
  const completedSeries = stats.completedSeriesCount ?? stats.completedSeries ?? stats.completedShows ?? 0;
  const comments = stats.commentsCount ?? stats.totalComments ?? 0;
  const friends = stats.friendsCount ?? stats.totalFriends ?? 0;
  const days = stats.daysRegistered ?? 0;

  return ACHIEVEMENTS_CONFIG.map((ach) => {
    let currentVal = 0;

    switch (ach.id) {
      case 'first_step':
      case 'collector':
      case 'bibliophile':
      case 'legend':
        currentVal = addedCount;
        break;
      case 'beginner':
      case 'avid':
      case 'marathoner':
        currentVal = watchedEps;
        break;
      case 'final_chord':
        currentVal = completedSeries;
        break;
      case 'critic':
      case 'expert':
      case 'judge':
        currentVal = ratings;
        break;
      case 'commentator':
      case 'guru':
        currentVal = comments;
        break;
      case 'friendly':
      case 'soul_of_party':
        currentVal = friends;
        break;
      case 'early_bird':
        currentVal = days;
        break;
      default:
        currentVal = 0;
    }

    const current = Math.min(currentVal, ach.maxProgress);
    const unlocked = current >= ach.maxProgress;
    const percent = ach.maxProgress > 0 ? Math.min(100, Math.round((current / ach.maxProgress) * 100)) : 0;

    return {
      ...ach,
      unlocked,
      current,
      progress: {
        current,
        target: ach.maxProgress,
        max: ach.maxProgress,
        percent,
      },
    };
  });
}