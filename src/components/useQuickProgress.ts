"use client";

import { useEffect, useRef, useState } from "react";
import { libraryProgress, type LibraryItem } from "@/lib/library";

export type ProgressPatch = Pick<
  LibraryItem,
  "userShowId" | "status" | "updatedAt" | "progress"
>;
type Undo = {
  userId: string;
  id: number;
  title: string;
  token: string;
  expiresAt: number;
  message: string;
  focus: boolean;
};
type NoticeError = { userId: string; message: string };

export default function useQuickProgress(
  userId: string | undefined,
  apply: (patch: ProgressPatch) => void,
  optimistic = false,
) {
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState<{
    id: number;
    action: "mark" | "undo";
    userId: string;
  } | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [error, setError] = useState<NoticeError | null>(null);
  useEffect(() => () => controller.current?.abort(), [userId]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () =>
        setUndo((current) => (current?.token === undo.token ? null : current)),
      Math.max(0, undo.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);

  async function send(
    action: "mark" | "undo",
    id: number,
    body: object,
    item?: LibraryItem,
  ) {
    if (!userId || busy.current) return;
    busy.current = true;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 15000);
    setPending({ id, action, userId });
    setError(null);
    // Show the mark immediately, but keep the server revision until confirmed.
    if (optimistic && action === "mark" && item) {
      const next = libraryProgress(item).next;
      const progress = [...item.progress];
      if (next) {
        const index = progress.findIndex((p) => p.episodeId === next.id);
        const marked = { episodeId: next.id, watched: true, stoppedAt: null };
        if (index >= 0) progress[index] = { ...progress[index], ...marked };
        else progress.push(marked);
      }
      apply({
        userShowId: id,
        status: item.status,
        updatedAt: item.updatedAt,
        progress,
      });
    }
    try {
      const response = await fetch(`/api/user-shows/${id}/quick-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (item) apply(item);
        if ([400, 409].includes(response.status) && action === "undo")
          setUndo(null);
        setError({
          userId,
          message:
            data.error || "Не удалось сохранить изменение. Попробуйте ещё раз.",
        });
        return;
      }
      apply(data.item as ProgressPatch);
      if (action === "mark" && item) {
        setUndo({
          userId,
          id,
          title: item.title,
          token: data.undoToken,
          expiresAt: data.undoExpiresAt,
          message: data.message,
          focus: data.item.status !== item.status,
        });
      } else setUndo(null);
      window.dispatchEvent(
        new CustomEvent("user-shows-updated", {
          detail: { source: "quick-progress" },
        }),
      );
      window.dispatchEvent(new Event("popcorn-updated"));
    } catch {
      if (item) apply(item);
      setError({
        userId,
        message:
          "Не удалось подтвердить сохранение. Обновите библиотеку перед повтором.",
      });
    } finally {
      clearTimeout(timer);
      busy.current = false;
      setPending(null);
    }
  }

  return {
    pending: pending?.userId === userId ? pending : null,
    error: error && error.userId === userId ? error.message : null,
    undo: undo?.userId === userId ? undo : null,
    mark: (item: LibraryItem) =>
      send(
        "mark",
        item.userShowId,
        {
          expectedUpdatedAt: item.updatedAt,
          expectedEpisodeId: libraryProgress(item).next?.id,
        },
        item,
      ),
    undoLast: () =>
      undo && undo.userId === userId
        ? send("undo", undo.id, { token: undo.token })
        : undefined,
    dismiss: () => {
      setError(null);
      setUndo(null);
    },
  };
}
