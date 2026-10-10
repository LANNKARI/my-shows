export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legend';
  tierLabel: 'БРОНЗА' | 'СЕРЕБРО' | 'ЗОЛОТО' | 'ЛЕГЕНДА';
  maxProgress: number;
}

export interface AchievementItem extends AchievementDef {
  unlocked: boolean;
  progress: number;
}

export const ACHIEVEMENTS_CONFIG: AchievementDef[] = [
  // Добавление сериалов в библиотеку
  {
    id: 'first_step',
    title: 'Первый шаг',
    description: 'Добавлен первый сериал',
    icon: '/achievements/first_step.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 1,
  },
  {
    id: 'collector',
    title: 'Коллекционер',
    description: '10 добавленных сериалов',
    icon: '/achievements/collector.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 10,
  },
  {
    id: 'bibliophile',
    title: 'Библиофил',
    description: '50 добавленных сериалов',
    icon: '/achievements/bibliophile.jpg',
    tier: 'gold',
    tierLabel: 'ЗОЛОТО',
    maxProgress: 50,
  },
  {
    id: 'legend',
    title: 'Легенда',
    description: '100 добавленных сериалов',
    icon: '/achievements/legend.jpg',
    tier: 'legend',
    tierLabel: 'ЛЕГЕНДА',
    maxProgress: 100,
  },

  // Просмотренные серии
  {
    id: 'beginner',
    title: 'Начинающий',
    description: '10 просмотренных серий',
    icon: '/achievements/beginner.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 10,
  },
  {
    id: 'avid',
    title: 'Заядлый',
    description: '100 просмотренных серий',
    icon: '/achievements/avid.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 100,
  },
  {
    id: 'marathoner',
    title: 'Марафонец',
    description: '1000 просмотренных серий',
    icon: '/achievements/marathoner.jpg',
    tier: 'legend',
    tierLabel: 'ЛЕГЕНДА',
    maxProgress: 1000,
  },

  // Полностью просмотренные сериалы
  {
    id: 'final_chord',
    title: 'Финальный аккорд',
    description: '5 полностью просмотренных сериалов',
    icon: '/achievements/final_chord.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 5,
  },

  // Личные оценки
  {
    id: 'critic',
    title: 'Критик',
    description: '10 поставленных оценок',
    icon: '/achievements/critic.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 10,
  },
  {
    id: 'expert',
    title: 'Эксперт',
    description: '50 поставленных оценок',
    icon: '/achievements/expert.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 50,
  },
  {
    id: 'judge',
    title: 'Судья',
    description: '100 поставленных оценок',
    icon: '/achievements/judge.jpg',
    tier: 'gold',
    tierLabel: 'ЗОЛОТО',
    maxProgress: 100,
  },

  // Комментарии
  {
    id: 'commentator',
    title: 'Комментатор',
    description: '10 комментариев',
    icon: '/achievements/commentator.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 10,
  },
  {
    id: 'guru',
    title: 'Гуру общения',
    description: '50 комментариев',
    icon: '/achievements/guru.jpg',
    tier: 'silver',
    tierLabel: 'СЕРЕБРО',
    maxProgress: 50,
  },

  // Друзья
  {
    id: 'friendly',
    title: 'Компанейский',
    description: '5 друзей',
    icon: '/achievements/friendly.jpg',
    tier: 'bronze',
    tierLabel: 'БРОНЗА',
    maxProgress: 5,
  },
  {
    id: 'soul_of_party',
    title: 'Душа компании',
    description: '20 друзей',
    icon: '/achievements/soul_of_party.jpg',
    tier: 'gold',
    tierLabel: 'ЗОЛОТО',
    maxProgress: 20,
  },

  // Стаж аккаунта
  {
    id: 'early_bird',
    title: 'Ранняя пташка',
    description: 'Аккаунт старше года',
    icon: '/achievements/early_bird.jpg',
    tier: 'gold',
    tierLabel: 'ЗОЛОТО',
    maxProgress: 365,
  },
];

export interface AchievementStats {
  addedShowsCount: number;
  watchedEpisodesCount: number;
  ratingsCount: number;
  completedSeriesCount: number;
  commentsCount?: number;
  friendsCount?: number;
  daysRegistered?: number;
}

export function calculateAchievements(stats: AchievementStats): AchievementItem[] {
  return ACHIEVEMENTS_CONFIG.map((ach) => {
    let currentVal = 0;

    switch (ach.id) {
      case 'first_step':
      case 'collector':
      case 'bibliophile':
      case 'legend':
        currentVal = stats.addedShowsCount;
        break;
      case 'beginner':
      case 'avid':
      case 'marathoner':
        currentVal = stats.watchedEpisodesCount;
        break;
      case 'final_chord':
        currentVal = stats.completedSeriesCount;
        break;
      case 'critic':
      case 'expert':
      case 'judge':
        currentVal = stats.ratingsCount;
        break;
      case 'commentator':
      case 'guru':
        currentVal = stats.commentsCount || 0;
        break;
      case 'friendly':
      case 'soul_of_party':
        currentVal = stats.friendsCount || 0;
        break;
      case 'early_bird':
        currentVal = stats.daysRegistered || 0;
        break;
      default:
        currentVal = 0;
    }

    const progress = Math.min(currentVal, ach.maxProgress);
    const unlocked = progress >= ach.maxProgress;

    return {
      ...ach,
      progress,
      unlocked,
    };
  });
}