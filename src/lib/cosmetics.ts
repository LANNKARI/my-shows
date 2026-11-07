export type CosmeticKind = "frame" | "profile" | "theme";
export type CosmeticItem = {
  id: string;
  kind: CosmeticKind;
  name: string;
  price: number;
  description: string;
  tone?: "light" | "dark";
  premium?: boolean;
  roleId?: string;
  animated?: boolean;
};
export const STANDARD_FRAME = "frame-standard",
  STANDARD_PROFILE = "profile-standard";
export const COSMETICS: readonly CosmeticItem[] = [
  { id: "theme-obsidian", kind: "theme", name: "Обсидиан", price: 0, tone: "dark", premium: true, description: "Глубокий графит и золотые акценты. Эксклюзив Premium." },
  { id: "frame-premium-orbit", kind: "frame", name: "Золотая орбита", price: 0, premium: true, animated: true, description: "Светящаяся точка плавно движется по золотому кольцу. Доступна с активным Premium." },
  { id: "frame-pioneer", kind: "frame", name: "Первопроходец", price: 0, roleId: "pioneer", description: "Памятная рамка для роли «Первопроходец»." },
  { id: "theme-cosmos", kind: "theme", name: "Космос", price: 0, tone: "dark", description: "Знакомая тёмная тема с космическим фоном." },
  { id: "theme-mint", kind: "theme", name: "Мята", price: 0, tone: "light", description: "Свежая светлая тема в зелёных оттенках." },
  { id: "theme-autumn-2026", kind: "theme", name: "Осень 2026", price: 500, tone: "light", description: "Тёплый свет, уютный камин и золотая осень за окном." },
  {
    id: STANDARD_FRAME,
    kind: "frame",
    name: "Стандартная",
    price: 0,
    description: "Классическая рамка без эффектов.",
  },
  {
    id: "frame-pink",
    kind: "frame",
    name: "Розовый неон",
    price: 80,
    description: "Мягкое розовое свечение.",
  },
  {
    id: "frame-gold",
    kind: "frame",
    name: "Золотая",
    price: 120,
    description: "Тёплое золотое двойное кольцо.",
  },
  {
    id: "frame-gold-light", kind: "frame", name: "Золотой свет", price: 120, animated: true,
    description: "Тёплый блик плавно проходит по золотому кольцу. Покупка навсегда, без подписки.",
  },
  {
    id: "frame-film",
    kind: "frame",
    name: "Киноплёнка",
    price: 100,
    description: "Рамка с перфорацией киноплёнки.",
  },
  {
    id: "frame-moon",
    kind: "frame",
    name: "Лунный свет",
    price: 100,
    description: "Спокойное серебристое сияние.",
  },
  {
    id: "frame-stars",
    kind: "frame",
    name: "Звёздная пыль",
    price: 160,
    description: "Фиолетовый акцент с маленькими звёздами.",
  },
  {
    id: STANDARD_PROFILE,
    kind: "profile",
    name: "Стандартное",
    price: 0,
    description: "Личная загруженная обложка или стандартный фон.",
  },
  {
    id: "profile-wine",
    kind: "profile",
    name: "Винный акцент",
    price: 140,
    description: "Глубокий винный градиент для шапки профиля.",
  },
  {
    id: "profile-cinema",
    kind: "profile",
    name: "Кинозал",
    price: 180,
    description: "Тёмный зал с мягкими красными акцентами.",
  },
];
export const cosmeticItem = (id: unknown) =>
  typeof id === "string" ? COSMETICS.find((item) => item.id === id) : undefined;
export const frameId = (id: unknown) =>
  cosmeticItem(id)?.kind === "frame" ? String(id) : STANDARD_FRAME;
export const profileStyleId = (id: unknown) =>
  cosmeticItem(id)?.kind === "profile" ? String(id) : STANDARD_PROFILE;
export type CosmeticUser = {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  popcorn: number;
  avatarFrame: string;
  profileStyle: string;
  siteTheme?: string | null;
};
export type CosmeticsData = {
  user: CosmeticUser;
  entitlements?: string[];
  catalog: CosmeticItem[];
  purchases: { itemId: string; pricePaid: number; purchasedAt: string }[];
  stats: {
    moviesCount: number;
    seriesCount: number;
    ratingsCount: number;
    hoursWatched: number;
  };
};
