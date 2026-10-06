import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

// TODO: переписать под новую схему Show/UserShow/EpisodeProgress
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Пока возвращаем пустой массив — блок «Сейчас смотрят друзья» не показывается
  return NextResponse.json([]);
}