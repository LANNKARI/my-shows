import { NextResponse } from "next/server";
import { upcomingDigital } from "@/lib/upcoming-digital";
export const maxDuration = 30;
export async function GET() {
  try {
    return NextResponse.json(await upcomingDigital(), { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "Список цифровых премьер временно недоступен." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
