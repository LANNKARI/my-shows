import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { translateGenres } from '@/lib/genres';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing show id' }, { status: 400 });
    }

    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const requestedType = request.nextUrl.searchParams.get('type');

    const session = await auth();
    let currentUserId = (session?.user as { id?: string })?.id;
    if (!currentUserId && session?.user?.email) {
      const u = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      currentUserId = u?.id;
    }

    // 1. Поиск в Show по id или tmdbId с учётом переданного типа
    let show = await prisma.show.findFirst({
      where: {
        OR: [{ id: numId }, { tmdbId: numId }],
        ...(requestedType ? { kind: requestedType === 'tv' ? 'series' : 'movie' } : {}),
      },
      include: {
        episodes: true,
        comments: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 2. Если не найден в Show — проверяем UserShow.id
    if (!show) {
      const userShowItem = await prisma.userShow.findUnique({
        where: { id: numId },
        include: {
          show: {
            include: {
              episodes: true,
              comments: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, avatarUrl: true },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      });
      if (userShowItem?.show) {
        show = userShowItem.show;
      }
    }

    // 3. Загрузка из TMDB при первом открытии тайтла
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;

    const buildUrl = (type: 'movie' | 'tv') => {
      let u = `https://api.themoviedb.org/3/${type}/${numId}?language=ru-RU&append_to_response=credits`;
      if (!apiKey.startsWith('eyJ')) u += `&api_key=${apiKey}`;
      return u;
    };

    // Вспомогательная функция для сборки каста с гарантированной подгрузкой фото
    const processCast = async (rawCastList: any[]) => {
      return await Promise.all(
        rawCastList.slice(0, 25).map(async (a: any) => {
          let profilePath = a.profile_path;

          // Если фото нет в объекте фильма, пробуем достать из прямого профиля персоны TMDB
          if (!profilePath && a.id && apiKey) {
            try {
              let pUrl = `https://api.themoviedb.org/3/person/${a.id}`;
              if (!apiKey.startsWith('eyJ')) pUrl += `?api_key=${apiKey}`;
              const pRes = await fetch(pUrl, { headers, next: { revalidate: 86400 } });
              if (pRes.ok) {
                const pData = await pRes.json();
                profilePath = pData.profile_path || null;
              }
            } catch {
              // Игнорируем сетевые сбои единичного профиля
            }
          }

          return {
            id: a.id,
            name: a.name,
            character: a.character || '',
            profile_path: profilePath,
            profileUrl: profilePath ? `https://image.tmdb.org/t/p/w185${profilePath}` : null,
            image: profilePath ? `https://image.tmdb.org/t/p/w185${profilePath}` : null,
          };
        })
      );
    };

    if (!show && apiKey) {
      let tmdbRes: Response | null = null;
      let mediaKind: 'movie' | 'series' = 'movie';

      // Проверяем тип, переданный в URL (tv или movie)
      if (requestedType === 'tv' || requestedType === 'series') {
        tmdbRes = await fetch(buildUrl('tv'), { headers });
        mediaKind = 'series';
        if (!tmdbRes.ok) {
          tmdbRes = await fetch(buildUrl('movie'), { headers });
          mediaKind = 'movie';
        }
      } else {
        tmdbRes = await fetch(buildUrl('movie'), { headers });
        mediaKind = 'movie';
        if (!tmdbRes.ok) {
          tmdbRes = await fetch(buildUrl('tv'), { headers });
          mediaKind = 'series';
        }
      }

      if (tmdbRes && tmdbRes.ok) {
        const data = await tmdbRes.json();
        const name = data.title || data.name || 'Без названия';
        const originalName = data.original_title || data.original_name || null;
        const description = data.overview || '';
        const releaseDate = data.release_date || data.first_air_date || null;
        const year = releaseDate ? releaseDate.slice(0, 4) : null;
        const posterUrl = data.poster_path
          ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
          : null;
        const tmdbRating = data.vote_average ? Math.round(data.vote_average * 10) / 10 : 0;
        const tmdbVotes = data.vote_count || 0;

        const runtime = data.runtime || data.episode_run_time?.[0] || null;
        const budget = data.budget && data.budget > 0 ? BigInt(data.budget) : null;
        const revenue = data.revenue && data.revenue > 0 ? BigInt(data.revenue) : null;

        const countries = (data.production_countries || []).map((c: { name: string }) => c.name);
        const studios = (data.production_companies || []).map((c: { name: string }) => c.name);

        const rawGenreNames = (data.genres || []).map((g: { name: string }) => g.name);
        const translatedGenres: string[] = translateGenres(rawGenreNames);

        const director =
          data.credits?.crew?.find((c: { job: string; name: string }) => c.job === 'Director')?.name ||
          data.created_by?.[0]?.name ||
          null;

        const creators = (data.created_by || []).map((c: { name: string }) => c.name);
        const cast = await processCast(data.credits?.cast || []);

        show = await prisma.show.create({
          data: {
            tmdbId: numId,
            name,
            originalName,
            description,
            kind: mediaKind,
            posterUrl,
            year,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            runtime,
            budget,
            revenue,
            countries,
            studios,
            genres: translatedGenres,
            director,
            creators,
            cast,
            tmdbRating,
            tmdbVotes,
          },
          include: {
            episodes: true,
            comments: {
              include: {
                user: {
                  select: { id: true, name: true, username: true, avatarUrl: true },
                },
              },
            },
          },
        });
      }
    }

    if (!show) {
      return NextResponse.json({ error: 'Тайтл не найден' }, { status: 404 });
    }

    // 4. Если в существующей записи нет фотографий актёров — обновляем их
    const castArray = Array.isArray(show.cast) ? (show.cast as any[]) : [];
    const hasAnyPhoto = castArray.some((a: any) => Boolean(a.profileUrl || a.image || a.profile_path));

    if (show.tmdbId && (!hasAnyPhoto || castArray.length === 0) && apiKey) {
      try {
        const type = show.kind === 'series' ? 'tv' : 'movie';
        let creditsUrl = `https://api.themoviedb.org/3/${type}/${show.tmdbId}/credits?language=ru-RU`;
        if (!apiKey.startsWith('eyJ')) creditsUrl += `&api_key=${apiKey}`;

        let creditsRes = await fetch(creditsUrl, { headers });
        let creditsData = creditsRes.ok ? await creditsRes.json() : null;

        // Если с ru-RU каст пустой или без фото, делаем fallback на глобальный запрос
        if (!creditsData?.cast?.some((c: any) => c.profile_path)) {
          let fallbackUrl = `https://api.themoviedb.org/3/${type}/${show.tmdbId}/credits`;
          if (!apiKey.startsWith('eyJ')) fallbackUrl += `&api_key=${apiKey}`;
          const fallbackRes = await fetch(fallbackUrl, { headers });
          if (fallbackRes.ok) creditsData = await fallbackRes.json();
        }

        if (creditsData?.cast && creditsData.cast.length > 0) {
          const cast = await processCast(creditsData.cast);
          const director =
            creditsData.crew?.find((c: { job: string; name: string }) => c.job === 'Director')?.name ||
            show.director;

          show = await prisma.show.update({
            where: { id: show.id },
            data: { cast, director },
            include: {
              episodes: true,
              comments: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, avatarUrl: true },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          });
        }
      } catch {
        // Оставляем текущую запись при недоступности сети
      }
    }

    // 5. Загрузка трейлеров (RU + EN) из TMDB
    let trailers: {
      russian: { id: string; key: string; name: string; site: string; type: string } | null;
      english: { id: string; key: string; name: string; site: string; type: string } | null;
    } = { russian: null, english: null };

    const targetTmdbId = show.tmdbId || numId;
    if (targetTmdbId && apiKey) {
      try {
        const type = show.kind === 'series' ? 'tv' : 'movie';
        const makeVideoUrl = (lang: string) => {
          let u = `https://api.themoviedb.org/3/${type}/${targetTmdbId}/videos?language=${lang}`;
          if (!apiKey.startsWith('eyJ')) u += `&api_key=${apiKey}`;
          return u;
        };

        const [ruRes, enRes] = await Promise.all([
          fetch(makeVideoUrl('ru-RU'), { headers, next: { revalidate: 3600 } }),
          fetch(makeVideoUrl('en-US'), { headers, next: { revalidate: 3600 } }),
        ]);

        const findBestTrailer = (list: any[]) => {
          if (!Array.isArray(list) || list.length === 0) return null;
          const yt = list.filter((v: any) => v.site === 'YouTube');
          const trailer =
            yt.find((v: any) => v.type === 'Trailer' && v.official) ||
            yt.find((v: any) => v.type === 'Trailer') ||
            yt.find((v: any) => v.type === 'Teaser') ||
            yt[0];

          return trailer
            ? {
                id: trailer.id,
                key: trailer.key,
                name: trailer.name,
                site: trailer.site,
                type: trailer.type,
              }
            : null;
        };

        const ruData = ruRes.ok ? await ruRes.json() : null;
        const enData = enRes.ok ? await enRes.json() : null;

        trailers = {
          russian: findBestTrailer(ruData?.results || []),
          english: findBestTrailer(enData?.results || []),
        };
      } catch {
        // Оставляем пустыми при ошибке TMDB
      }
    }

    // 6. Получение пользовательского статуса
    let userShow = null;
    if (currentUserId) {
      userShow = await prisma.userShow.findUnique({
        where: {
          userId_showId: {
            userId: currentUserId,
            showId: show.id,
          },
        },
        include: {
          ratings: true,
          progress: true,
        },
      });
    }

    const serializedShow = {
      ...show,
      title: show.name,
      originalTitle: show.originalName,
      budget: show.budget ? Number(show.budget) : null,
      revenue: show.revenue ? Number(show.revenue) : null,
      trailers,
    };

    return NextResponse.json({
      show: serializedShow,
      userShow,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch show', details: message },
      { status: 500 }
    );
  }
}