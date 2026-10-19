export interface UniverseConfig {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  collections: number[];
  companyId: string;
  movieIds: number[];
  tvIds: number[];
}

export interface DirectorConfig {
  id: string;
  name: string;
  tag: string;
  bio: string;
  personId: number;
  tvIds: number[];
}

// 15 киновселенных (фильмы + сериалы + спин-оффы)
export const UNIVERSES_CONFIG: UniverseConfig[] = [
  {
    id: 'marvel',
    name: 'Киновселенная Marvel (MCU)',
    subtitle: 'Все фильмы и сериалы Саги Бесконечности и Мультивселенной',
    icon: '🛡️',
    accentColor: 'from-red-600/30 via-rose-900/20 to-neutral-900',
    collections: [86311, 131292, 131295, 131296, 284433, 531241, 422834, 618529, 529892, 623911, 448150],
    companyId: '420',
    movieIds: [1724, 497698, 566525, 524434, 533535, 822119, 986056, 617126],
    tvIds: [84958, 85271, 88396, 88329, 92749, 91363, 61889, 202555, 67178, 38472, 1403, 138501, 114472, 92782, 92783, 122226, 138502],
  },
  {
    id: 'dc',
    name: 'Вселенная DC',
    subtitle: 'Супергерои, антигерои и мрачные истории комиксов DC',
    icon: '⚡',
    accentColor: 'from-blue-600/30 via-indigo-900/20 to-neutral-900',
    collections: [209112, 468552, 573693, 724848, 531242, 987044, 263, 948485],
    companyId: '9993',
    movieIds: [414906, 475557, 889737, 1061474, 13183, 561, 752, 298618, 565770, 436270],
    tvIds: [194764, 110492, 90802, 219543, 79788, 60708, 4604, 60735, 1412, 63174, 79501, 75450, 95057],
  },
  {
    id: 'harry_potter',
    name: 'Гарри Поттер и Волшебный мир',
    subtitle: 'Все части поттерианы, Фантастические твари и спецвыпуски',
    icon: '🪄',
    accentColor: 'from-amber-500/30 via-yellow-900/20 to-neutral-900',
    collections: [1241, 435259],
    companyId: '',
    movieIds: [899082],
    tvIds: [254572, 138179],
  },
  {
    id: 'middle_earth',
    name: 'Средиземье: Властелин колец',
    subtitle: 'Трилогии Властелин колец, Хоббит и сериал Кольца власти',
    icon: '💍',
    accentColor: 'from-emerald-600/30 via-teal-900/20 to-neutral-900',
    collections: [119, 121938],
    companyId: '',
    movieIds: [839033, 123, 354287],
    tvIds: [84773],
  },
  {
    id: 'star_wars',
    name: 'Звёздные войны',
    subtitle: 'Сага Скайуокеров, изгои и сериалы далёкой-далёкой галактики',
    icon: '⚔️',
    accentColor: 'from-sky-500/30 via-blue-900/20 to-neutral-900',
    collections: [10, 302331],
    companyId: '1',
    movieIds: [330459, 348350, 1125899],
    tvIds: [82856, 83867, 92830, 114461, 115036, 114479, 202879, 4194, 105971, 60554],
  },
  {
    id: 'spider_man',
    name: 'Вселенная Человека-паука',
    subtitle: 'Три поколения Питера Паркера, Веном и Паучьи миры',
    icon: '🕷️',
    accentColor: 'from-rose-600/30 via-red-900/20 to-neutral-900',
    collections: [531241, 556, 125574, 573436, 558216],
    companyId: '',
    movieIds: [539972, 526896, 634492],
    tvIds: [138503, 888, 3854],
  },
  {
    id: 'dark_knight',
    name: 'Бэтмен и Готэм',
    subtitle: 'Тёмный рыцарь, Бэтмен Мэтта Ривза, Джокер и Пингвин',
    icon: '🦇',
    accentColor: 'from-slate-600/40 via-neutral-800/40 to-neutral-900',
    collections: [263, 948485, 120794, 987044],
    companyId: '',
    movieIds: [414906, 209112, 475557, 889737, 324849],
    tvIds: [194764, 60708, 79588, 2098, 125909],
  },
  {
    id: 'dune',
    name: 'Вселенная Дюны',
    subtitle: 'Экранизации Фрэнка Герберта и сериал Дюна: Пророчество',
    icon: '🏜️',
    accentColor: 'from-orange-500/30 via-amber-900/20 to-neutral-900',
    collections: [726871],
    companyId: '',
    movieIds: [438631, 693134, 841],
    tvIds: [90228, 877, 14102],
  },
  {
    id: 'john_wick',
    name: 'Вселенная Джона Уика',
    subtitle: 'Основная тетралогия, Балерина и мини-сериал Континенталь',
    icon: '🔫',
    accentColor: 'from-purple-600/30 via-fuchsia-900/20 to-neutral-900',
    collections: [404609],
    companyId: '',
    movieIds: [541671],
    tvIds: [78191],
  },
  {
    id: 'x_men',
    name: 'Люди Икс, Росомаха и Дэдпул',
    subtitle: 'Сага о мутантах, Логан, Дэдпул и сериал Легион',
    icon: '🧬',
    accentColor: 'from-yellow-500/30 via-amber-900/20 to-neutral-900',
    collections: [748, 453993, 448150],
    companyId: '',
    movieIds: [340102, 533535],
    tvIds: [67195, 69629, 138502, 4574],
  },
  {
    id: 'fast_furious',
    name: 'Вселенная Форсажа',
    subtitle: 'Все части гоночной саги и спин-офф Хоббс и Шоу',
    icon: '🏎️',
    accentColor: 'from-cyan-500/30 via-sky-900/20 to-neutral-900',
    collections: [9485, 688042],
    companyId: '',
    movieIds: [384018],
    tvIds: [93732],
  },
  {
    id: 'pirates',
    name: 'Пираты Карибского моря',
    subtitle: 'Приключения капитана Джека Воробья во всех пяти частях',
    icon: '🏴‍☠️',
    accentColor: 'from-teal-500/30 via-emerald-900/20 to-neutral-900',
    collections: [295],
    companyId: '',
    movieIds: [],
    tvIds: [],
  },
  {
    id: 'mission_impossible',
    name: 'Миссия невыполнима',
    subtitle: 'Шпионский экшен с Томом Крузом и классический сериал',
    icon: '🕶️',
    accentColor: 'from-red-500/30 via-orange-900/20 to-neutral-900',
    collections: [87359],
    companyId: '',
    movieIds: [575265],
    tvIds: [4357],
  },
  {
    id: 'conjuring',
    name: 'Вселенная Заклятия',
    subtitle: 'Дела Уорренов, Проклятие Аннабель и Проклятие монахини',
    icon: '🕯️',
    accentColor: 'from-zinc-600/40 via-neutral-900 to-black',
    collections: [313086, 402074, 968086],
    companyId: '',
    movieIds: [480414, 1038392],
    tvIds: [],
  },
  {
    id: 'james_bond',
    name: 'Агент 007: Джеймс Бонд',
    subtitle: 'Полная антология фильмов о легендарном британском агенте',
    icon: '🍸',
    accentColor: 'from-amber-600/30 via-stone-900 to-neutral-950',
    collections: [645],
    companyId: '',
    movieIds: [36670],
    tvIds: [238050],
  },
];

// 8 великих режиссёров (фильмы + знаковые сериалы)
export const DIRECTORS_CONFIG: DirectorConfig[] = [
  {
    id: 'nolan',
    name: 'Кристофер Нолан',
    tag: 'Масштаб, время и интеллектуальный блокбастер',
    bio: 'Мастер нелинейного повествования, практических эффектов и эпических полотен («Интерстеллар», «Начало», «Оппенгеймер», «Тёмный рыцарь»).',
    personId: 525,
    tvIds: [],
  },
  {
    id: 'ritchie',
    name: 'Гай Ричи',
    tag: 'Криминальный драйв, британский стиль и юмор',
    bio: 'Создатель культовых криминальных комедий, динамичного монтажа и харизматичных героев («Джентльмены», «Большой куш», «Карты, деньги, два ствола»).',
    personId: 956,
    tvIds: [236235, 247718],
  },
  {
    id: 'tarantino',
    name: 'Квентин Тарантино',
    tag: 'Острые диалоги и постмодернистский шедевр',
    bio: 'Легенда авторского кино с неповторимыми диалогами и саундтреками («Криминальное чтиво», «Бесславные ублюдки», «Джанго освобождённый»).',
    personId: 138,
    tvIds: [],
  },
  {
    id: 'scorsese',
    name: 'Мартин Скорсезе',
    tag: 'Классика гангстерской драмы и психологизма',
    bio: 'Живой классик мирового кинематографа («Волк с Уолл-стрит», «Остров проклятых», «Отступники», «Славные парни», «Подпольная империя»).',
    personId: 1032,
    tvIds: [1621, 62823],
  },
  {
    id: 'villeneuve',
    name: 'Дени Вильнёв',
    tag: 'Визуальное величие и научная фантастика',
    bio: 'Главный визионер современной фантастики и напряжённого триллера («Дюна», «Бегущий по лезвию 2049», «Прибытие», «Пленницы»).',
    personId: 137427,
    tvIds: [],
  },
  {
    id: 'fincher',
    name: 'Дэвид Финчер',
    tag: 'Безупречный психологический триллер и нуар',
    bio: 'Перфекционист мрачного детектива и саспенса («Бойцовский клуб», «Семь», «Исчезнувшая», «Охотник за разумом»).',
    personId: 7467,
    tvIds: [67744, 1425, 86831],
  },
  {
    id: 'spielberg',
    name: 'Стивен Спилберг',
    tag: 'Эпоха великих приключений и драмы',
    bio: 'Человек, подаривший миру главные блокбастеры и пронзительные исторические картины («Список Шиндлера», «Парк Юрского периода», «Поймай меня, если сможешь»).',
    personId: 488,
    tvIds: [4613, 16997, 119051],
  },
  {
    id: 'cameron',
    name: 'Джеймс Кэмерон',
    tag: 'Революция спецэффектов и мировые рекорды',
    bio: 'Режиссёр самых кассовых и технологически прорывных фильмов в истории («Терминатор 2», «Аватар», «Титаник», «Чужие»).',
    personId: 2710,
    tvIds: [],
  },
];