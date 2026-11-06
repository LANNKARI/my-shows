export type ReleaseEvent = {
  id: number;
  showId: number;
  userShowId: number;
  title: string;
  posterUrl: string | null;
  season: number;
  episode: number;
  date: string;
  notifyReleases: boolean;
  watched: boolean;
};
export type CalendarData = {
  events: ReleaseEvent[];
  truncated: boolean;
  series: {
    userShowId: number;
    showId: number;
    title: string;
    notifyReleases: boolean;
    hasSource: boolean;
    syncedAt: string | null;
    needsSync: boolean;
  }[];
  syncIds: number[];
};
export type ReleasePreferences = {
  releaseNotificationsEnabled: boolean;
  notifyNewShows: boolean;
  notificationTimeZone: string;
};
export type ReleaseNotice = {
  id: number;
  showId: number;
  title: string;
  posterUrl: string | null;
  season: number;
  episode: number;
  date: string;
  read: boolean;
};
export type FriendNotice = {
  id: number;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  read: boolean;
};
export type ReleaseInbox = {
  friendRequests?: FriendNotice[];
  latestFriendId?: number;
  friendRequestsTruncated?: boolean;
  items: ReleaseNotice[];
  unreadCount: number;
  latestId: number;
  nextCursor: number | null;
  preferences: ReleasePreferences;
};
export const browserZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
