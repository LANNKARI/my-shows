import { NextResponse } from "next/server";
import { gameMoviePool } from "@/lib/game-movies";
export const maxDuration = 30;
export async function GET() {
  try {
    const pool = await gameMoviePool({ minimum: 6 });
    return NextResponse.json(
      {
        frames: [
          ...new Set(
            pool.map(
              (m) => `https://image.tmdb.org/t/p/w780${m.backdrop_path}`,
            ),
          ),
        ].slice(0, 6),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { frames: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
