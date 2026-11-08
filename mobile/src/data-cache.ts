// Private, bounded, in-memory cache owned by one mounted login session.
// Tokens and responses are never persisted or shared between accounts.
export class DataCache {
  private entries = new Map<string, { data: unknown; at: number }>();
  private pending = new Map<
    string,
    { epoch: number; promise: Promise<unknown> }
  >();
  private epochs = new Map<string, number>();
  private listeners = new Set<() => void>();
  private version = 0;
  getVersion = () => this.version;
  notify() {
    this.version++;
    this.listeners.forEach((listener) => listener());
  }
  readonly libraryWrite = { busy: false, needsRefresh: false };
  constructor(
    private fetcher: <T>(path: string, init?: RequestInit) => Promise<T>,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get<T>(path: string): T | null {
    return (this.entries.get(path)?.data as T) ?? null;
  }
  fresh(path: string) {
    return Date.now() - (this.entries.get(path)?.at || 0) < 30_000;
  }
  set<T>(path: string, data: T, fresh = true) {
    this.entries.delete(path);
    this.entries.set(path, { data, at: fresh ? Date.now() : 0 });
    if (this.entries.size > 60)
      this.entries.delete(this.entries.keys().next().value!);
    this.notify();
  }
  invalidate(matches: (path: string) => boolean) {
    for (const path of new Set([
      ...this.entries.keys(),
      ...this.pending.keys(),
    ])) {
      if (!matches(path)) continue;
      this.epochs.set(path, (this.epochs.get(path) || 0) + 1);
      const entry = this.entries.get(path);
      if (entry) entry.at = 0;
    }
  }
  async load<T>(path: string, force = false): Promise<T> {
    const cached = this.get<T>(path);
    if (!force && cached !== null && this.fresh(path)) return cached;
    const epoch = this.epochs.get(path) || 0;
    const pending = this.pending.get(path);
    if (pending?.epoch === epoch) return pending.promise as Promise<T>;
    const promise = this.fetcher<T>(path).then((data) => {
      // An older read must not overwrite a mutation or its authoritative response.
      if ((this.epochs.get(path) || 0) === epoch) this.set(path, data);
      return data;
    });
    this.pending.set(path, { epoch, promise });
    try {
      return await promise;
    } finally {
      if (this.pending.get(path)?.promise === promise)
        this.pending.delete(path);
    }
  }
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!init?.method || init.method === "GET")
      return this.fetcher<T>(path, init);
    const affected = (key: string) => {
      if (path.startsWith("/api/user-shows"))
        return /\/(user-shows|calendar|users|notifications)(\?|\/|$)/.test(key);
      if (path.startsWith("/api/users")) return key.startsWith("/api/users");
      if (
        path.startsWith("/api/friendships") ||
        path.startsWith("/api/notifications/friends")
      )
        return /\/(users|friendships|notifications)(\?|\/|$)/.test(key);
      return (
        key.startsWith("/api/notifications") ||
        key.startsWith("/api/release-preferences") ||
        key.startsWith("/api/users")
      );
    };
    this.invalidate(affected);
    try {
      return await this.fetcher<T>(path, init);
    } finally {
      this.invalidate(affected);
    }
  }
}
