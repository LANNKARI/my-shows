export type CosmeticKind = "frame" | "profile";
export type CosmeticItem = {
  id: string;
  kind: CosmeticKind;
  name: string;
  price: number;
  description: string;
};
export const STANDARD_FRAME = "frame-standard",
  STANDARD_PROFILE = "profile-standard";
export const COSMETICS: readonly CosmeticItem[] = [
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
};
export type CosmeticsData = {
  user: CosmeticUser;
  catalog: CosmeticItem[];
  purchases: { itemId: string; pricePaid: number; purchasedAt: string }[];
  stats: {
    moviesCount: number;
    seriesCount: number;
    ratingsCount: number;
    hoursWatched: number;
  };
};
