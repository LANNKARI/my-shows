import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Button } from "../components";
import { useDataCache, useProgressQueue } from "../data-context";
import { useResource, useSocialApi, useTask } from "../social/hooks";
import { Feedback } from "../social/components";
import { colors, styles as s } from "../theme";
import { LibraryItem } from "../domain";
export type Rating = { id: number; episodeId: number | null; score: number };
export function RatingPicker({
  item,
  episodeId,
  ratings,
  refresh,
}: {
  item: LibraryItem;
  episodeId?: number;
  ratings: Rating[];
  refresh: () => Promise<void>;
}) {
  const api = useSocialApi(),
    task = useTask(),
    cache = useDataCache(),
    queue = useProgressQueue();
  const [open, setOpen] = useState(false);
  const current = ratings.find((r) => r.episodeId === (episodeId ?? null));
  const title = episodeId
    ? `Оценить серию ${item.show.episodes.find((e) => e.id === episodeId)?.episode}`
    : "Моя оценка";
  async function save(score: number | null) {
    if (cache.libraryWrite.busy || queue.saving)
      throw Error("Дождитесь сохранения отметок.");
    cache.libraryWrite.busy = true;
    cache.notify();
    try {
      if (score === null && current)
        await api(
          `/api/user-shows/${item.userShowId}/ratings?ratingId=${current.id}`,
          { method: "DELETE" },
        );
      else if (score !== null)
        await api(`/api/user-shows/${item.userShowId}/ratings`, {
          method: "POST",
          body: JSON.stringify({ score, episodeId }),
        });
      await refresh();
      setOpen(false);
    } finally {
      // Ratings advance the server revision too; reconcile before another quick mark.
      cache.libraryWrite.needsRefresh = true;
      try {
        await cache.load<LibraryItem[]>("/api/user-shows?status=library", true);
        cache.libraryWrite.needsRefresh = false;
      } catch {
        /* Explicit refresh remains available. */
      }
      cache.libraryWrite.busy = false;
      cache.notify();
    }
  }
  return (
    <>
      <Button
        title={`${title}${current ? ` · ${current.score}/10` : ""}`}
        secondary
        disabled={cache.libraryWrite.busy || cache.libraryWrite.needsRefresh}
        onPress={() => setOpen(true)}
      />
      {open && (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!task.busy) setOpen(false);
          }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              padding: 24,
              backgroundColor: "#000a",
            }}
          >
            <View accessibilityViewIsModal style={s.panel}>
              <Text style={s.heading}>{title} от 1 до 10</Text>
              <Feedback error={task.error} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
                  <Pressable
                    key={score}
                    accessibilityRole="button"
                    accessibilityLabel={`Оценка ${score}`}
                    disabled={!!task.busy}
                    onPress={() => void task.run("score", () => save(score))}
                    style={[
                      s.button,
                      { width: "17%", minWidth: 44, minHeight: 48, padding: 7 },
                      current?.score !== score && s.outline,
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          current?.score === score
                            ? colors.onAccent
                            : colors.text,
                      }}
                    >
                      {score}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {current && (
                <Button
                  title="Убрать оценку"
                  secondary
                  busy={!!task.busy}
                  onPress={() => void task.run("remove", () => save(null))}
                />
              )}
              <Button
                title="Закрыть"
                secondary
                disabled={!!task.busy}
                onPress={() => setOpen(false)}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
export function useRatings(id: number | null) {
  return useResource<Rating[]>(id ? `/api/user-shows/${id}/ratings` : null);
}
