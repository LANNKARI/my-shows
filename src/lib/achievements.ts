export type AchievementStats = {
  totalTitles: number;
  completedTitles: number;
  totalWatchedEpisodes: number;
  totalRatings: number;
  totalComments: number;
  totalFriends: number;
  accountAgeDays: number;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  progress: { current: number; target: number };
  unlocked: boolean;
};

export function calculateAchievements(stats: AchievementStats): Achievement[] {
  const a: Achievement[] = [
    // 📚 Коллекционер — по количеству сериалов
    {
      id: "titles_1",
      name: "Первый шаг",
      description: "Добавлен первый сериал",
      icon: "🌱",
      tier: "bronze",
      progress: { current: stats.totalTitles, target: 1 },
      unlocked: stats.totalTitles >= 1,
    },
    {
      id: "titles_10",
      name: "Коллекционер",
      description: "10 добавленных сериалов",
      icon: "📚",
      tier: "silver",
      progress: { current: stats.totalTitles, target: 10 },
      unlocked: stats.totalTitles >= 10,
    },
    {
      id: "titles_50",
      name: "Библиофил",
      description: "50 добавленных сериалов",
      icon: "📖",
      tier: "gold",
      progress: { current: stats.totalTitles, target: 50 },
      unlocked: stats.totalTitles >= 50,
    },
    {
      id: "titles_100",
      name: "Легенда",
      description: "100 добавленных сериалов",
      icon: "🏆",
      tier: "legendary",
      progress: { current: stats.totalTitles, target: 100 },
      unlocked: stats.totalTitles >= 100,
    },

    // 🎬 Просмотренные серии
    {
      id: "watched_10",
      name: "Начинающий",
      description: "10 просмотренных серий",
      icon: "▶️",
      tier: "bronze",
      progress: { current: stats.totalWatchedEpisodes, target: 10 },
      unlocked: stats.totalWatchedEpisodes >= 10,
    },
    {
      id: "watched_100",
      name: "Заядлый",
      description: "100 просмотренных серий",
      icon: "🎬",
      tier: "silver",
      progress: { current: stats.totalWatchedEpisodes, target: 100 },
      unlocked: stats.totalWatchedEpisodes >= 100,
    },
    {
      id: "watched_1000",
      name: "Марафонец",
      description: "1000 просмотренных серий",
      icon: "🚀",
      tier: "legendary",
      progress: { current: stats.totalWatchedEpisodes, target: 1000 },
      unlocked: stats.totalWatchedEpisodes >= 1000,
    },

    // ⭐ Оценки
    {
      id: "ratings_10",
      name: "Критик",
      description: "10 поставленных оценок",
      icon: "⭐",
      tier: "bronze",
      progress: { current: stats.totalRatings, target: 10 },
      unlocked: stats.totalRatings >= 10,
    },
    {
      id: "ratings_50",
      name: "Эксперт",
      description: "50 поставленных оценок",
      icon: "🌟",
      tier: "silver",
      progress: { current: stats.totalRatings, target: 50 },
      unlocked: stats.totalRatings >= 50,
    },
    {
      id: "ratings_100",
      name: "Судья",
      description: "100 поставленных оценок",
      icon: "👑",
      tier: "gold",
      progress: { current: stats.totalRatings, target: 100 },
      unlocked: stats.totalRatings >= 100,
    },

    // 💬 Комментарии
    {
      id: "comments_10",
      name: "Комментатор",
      description: "10 комментариев",
      icon: "💬",
      tier: "bronze",
      progress: { current: stats.totalComments, target: 10 },
      unlocked: stats.totalComments >= 10,
    },
    {
      id: "comments_50",
      name: "Гуру общения",
      description: "50 комментариев",
      icon: "🗣️",
      tier: "silver",
      progress: { current: stats.totalComments, target: 50 },
      unlocked: stats.totalComments >= 50,
    },

    // 🤝 Друзья
    {
      id: "friends_5",
      name: "Компанейский",
      description: "5 друзей",
      icon: "🤝",
      tier: "bronze",
      progress: { current: stats.totalFriends, target: 5 },
      unlocked: stats.totalFriends >= 5,
    },
    {
      id: "friends_20",
      name: "Душа компании",
      description: "20 друзей",
      icon: "🎉",
      tier: "gold",
      progress: { current: stats.totalFriends, target: 20 },
      unlocked: stats.totalFriends >= 20,
    },

    // ✅ Завершённые сериалы
    {
      id: "completed_5",
      name: "Финальный аккорд",
      description: "5 полностью просмотренных сериалов",
      icon: "✅",
      tier: "silver",
      progress: { current: stats.completedTitles, target: 5 },
      unlocked: stats.completedTitles >= 5,
    },

    // 👑 Особые
    {
      id: "early_bird",
      name: "Ранняя пташка",
      description: "Аккаунт старше года",
      icon: "🐣",
      tier: "gold",
      progress: { current: stats.accountAgeDays, target: 365 },
      unlocked: stats.accountAgeDays >= 365,
    },
  ];

  return a;
}

/** Возвращает только полученные достижения */
export function getUnlockedAchievements(stats: AchievementStats): Achievement[] {
  return calculateAchievements(stats).filter((a) => a.unlocked);
}