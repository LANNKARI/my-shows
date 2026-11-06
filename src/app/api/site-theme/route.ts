import { NextRequest } from "next/server";
import { calendarUser, calendarFailure, privateJson } from "@/lib/calendar-server";
import { prisma } from "@/lib/prisma";
import { premiumActive } from "@/lib/premium";
import { cosmeticItem } from "@/lib/cosmetics";
export async function GET(request: NextRequest) {
  try {
    const userId = await calendarUser(request);
    const [user, purchase] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { siteTheme: true } }),
      prisma.cosmeticPurchase.findUnique({ where: { userId_itemId: { userId, itemId: "theme-autumn-2026" } }, select: { id: true } }),
    ]);
    const item = cosmeticItem(user.siteTheme);
    return privateJson({ theme: item?.kind === "theme" && (item.premium?await premiumActive(userId):!item.price || purchase) ? item.id : null, ownsAutumn: !!purchase });
  } catch (error) { return calendarFailure(error); }
}
