import { User } from "../api";
export type Person = User;
export type FriendshipStatus =
  "none" | "pending_sent" | "pending_received" | "friends";
export type SearchPerson = Person & { friendshipStatus: FriendshipStatus };
export type FriendRequest = {
  friendshipId: number;
  user: Person;
  createdAt: string;
};
export type FriendsData = {
  friends: Person[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
};
export type Profile = {
  user: Person & {
    bio: string | null;
    bannerUrl: string | null;
    createdAt: string;
  };
  isOwnProfile: boolean;
  friendshipStatus: FriendshipStatus;
  premiumActive: boolean;
  stats: {
    moviesCount: number;
    seriesCount: number;
    hoursWatched: number;
    ratingsCount: number;
    totalCompleted: number;
    addedSeriesCount: number;
  };
  favorites: {
    id: number;
    showId: number;
    title: string;
    posterUrl: string | null;
    kind: string;
  }[];
  achievements: {
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
    icon: string;
    progress: { current: number; target: number; percent: number };
  }[];
};
export type Preferences = {
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
  user: Person;
  createdAt: string;
  read: boolean;
};
export type Inbox = {
  items: ReleaseNotice[];
  friendRequests: FriendNotice[];
  unreadCount: number;
  latestId: number;
  latestFriendId: number;
  nextCursor: number | null;
  preferences: Preferences;
  friendRequestsTruncated?: boolean;
};
export type MyProfile = Person & { bio: string | null; email: string };
