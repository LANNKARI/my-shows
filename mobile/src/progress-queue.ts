import { DataCache } from "./data-cache";
import { LibraryItem, ProgressPatch } from "./domain";
import { ApiError } from "./api-error";
export const libraryPath = "/api/user-shows?status=library";
type Intent = { watched: boolean; quick: boolean };
type TitleState = { saved: LibraryItem; desired: Map<number, Intent> };
export type ProgressUndo = { token: string; expiresAt: number; id: number };
type Reply = {
  item: ProgressPatch & { id?: number };
  undoToken?: string;
  undoExpiresAt?: number;
  message?: string;
};
// One writer per title; desired states stay visible while earlier writes are acknowledged.
// The queue belongs to the login, so navigation cannot abandon an in-flight write.
export class ProgressQueue {
  private titles = new Map<number, TitleState>();
  private active = 0;
  notice = "";
  error: unknown = null;
  undo: ProgressUndo | null = null;
  constructor(private cache: DataCache) {}
  get saving() {
    return this.active > 0;
  }
  pending(id: number, episodeId?: number) {
    const title = this.titles.get(id);
    return episodeId === undefined ? !!title : !!title?.desired.has(episodeId);
  }
  enqueue(
    item: LibraryItem,
    episodeId: number,
    watched: boolean,
    quick = false,
  ) {
    if (
      this.cache.libraryWrite.needsRefresh ||
      (this.cache.libraryWrite.busy && this.active === 0)
    )
      return;
    let title = this.titles.get(item.userShowId);
    if (!title) {
      title = { saved: item, desired: new Map() };
      this.titles.set(item.userShowId, title);
    }
    title.desired.set(episodeId, { watched, quick });
    this.error = null;
    this.undo = null;
    this.notice = "Сохраняем отметки…";
    this.publish(title);
    // Start once per title; further taps only change its desired states.
    if (title.desired.size === 1 && !this.running.has(item.userShowId))
      void this.drain(title);
  }
  private running = new Set<number>();
  private publish(title: TitleState) {
    const desired = title.desired;
    const preview = {
      ...title.saved,
      progress: [
        ...title.saved.progress.filter((p) => !desired.has(p.episodeId)),
        ...[...desired].map(([episodeId, intent]) => ({
          episodeId,
          watched: intent.watched,
          stoppedAt: null,
        })),
      ],
    };
    this.cache.set(
      libraryPath,
      (this.cache.get<LibraryItem[]>(libraryPath) || []).map((item) =>
        item.userShowId === preview.userShowId ? preview : item,
      ),
    );
  }
  private async drain(title: TitleState) {
    const id = title.saved.userShowId;
    this.running.add(id);
    this.active++;
    this.cache.libraryWrite.busy = true;
    this.cache.notify();
    try {
      while (title.desired.size && !this.cache.libraryWrite.needsRefresh) {
        const [episodeId, intent] = title.desired.entries().next().value!;
        const path = intent.quick
          ? `/api/user-shows/${id}/quick-progress`
          : `/api/user-shows/${title.saved.showId}`;
        const reply = await this.cache.request<Reply>(path, {
          method: "POST",
          body: JSON.stringify(
            intent.quick
              ? {
                  action: "mark",
                  expectedUpdatedAt: title.saved.updatedAt,
                  expectedEpisodeId: episodeId,
                }
              : { episodeId, watched: intent.watched },
          ),
        });
        const patch = {
          userShowId: id,
          status: reply.item.status,
          updatedAt: reply.item.updatedAt,
          progress: reply.item.progress,
        };
        title.saved = { ...title.saved, ...patch };
        const latest = title.desired.get(episodeId);
        if (latest?.watched === intent.watched) title.desired.delete(episodeId);
        // A later explicit reversal remains queued; never roll it back with this response.
        this.publish(title);
        this.undo =
          reply.undoToken && reply.undoExpiresAt
            ? { token: reply.undoToken, expiresAt: reply.undoExpiresAt, id }
            : null;
        this.notice = title.desired.size
          ? "Сохраняем отметки…"
          : intent.watched
            ? "Серия отмечена"
            : "Отметка снята";
      }
    } catch (error) {
      this.error = error;
      this.undo = null;
      this.notice = "";
      this.cache.libraryWrite.needsRefresh = true;
      for (const state of this.titles.values()) {
        state.desired.clear();
        this.publish(state);
      }
      this.cache.invalidate((path) => path === libraryPath);
    } finally {
      this.running.delete(id);
      this.titles.delete(id);
      this.active--;
      if (this.active === 0) {
        // A missing response may have committed. Reconcile, never replay a write.
        if (
          this.cache.libraryWrite.needsRefresh &&
          !(this.error instanceof ApiError && this.error.status === 401)
        ) {
          try {
            await this.cache.load<LibraryItem[]>(libraryPath, true);
            this.cache.libraryWrite.needsRefresh = false;
          } catch {
            /* The next explicit refresh must succeed before accepting more writes. */
          }
        }
        this.cache.libraryWrite.busy = false;
      }
      if (this.active) this.notice = "Сохраняем отметки…";
      this.cache.notify();
    }
  }
}
