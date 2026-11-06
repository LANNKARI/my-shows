import { NextRequest } from "next/server";
import {
  calendarUser,
  calendarFailure,
  privateJson,
} from "@/lib/calendar-server";
import {
  hasPermission,
  isSiteOwner,
  publicAccountBadges,
} from "@/lib/account-access";
import { premiumSnapshot } from "@/lib/premium";
export async function GET(req: NextRequest) {
  try {
    const id = await calendarUser(req);
    const [owner, moderate, curate, beta, badges, premium] = await Promise.all([
      isSiteOwner(id),
      hasPermission(id, "moderate_comments"),
      hasPermission(id, "curate"),
      hasPermission(id, "beta"),
      publicAccountBadges([id]),
      premiumSnapshot(id),
    ]);
    return privateJson({
      owner,
      moderate,
      curate,
      beta,
      badges: badges[id],
      premium,
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
