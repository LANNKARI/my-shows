import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "../components";
import { Feedback, Screen } from "../social/components";
import { useSocialApi, useTask } from "../social/hooks";
import { pickBackup } from "./device-files";
import { statuses } from "../domain";
import { styles as s, colors } from "../theme";
type Preview = {
  jobId: string;
  total: number;
  cursor: number;
  completed: boolean;
  warnings: string[];
  rows: {
    index: number;
    title: string;
    state: string;
    reason: string;
    candidates: { id: number; name: string }[];
  }[];
  result: Result;
};
type Result = {
  added: number;
  skipped: number;
  collections: number;
  messages: string[];
};
type Commit = Pick<
  Preview,
  "jobId" | "total" | "cursor" | "completed" | "result"
>;
export default function ImportScreen() {
  const api = useSocialApi(),
    task = useTask();
  const [file, setFile] = useState<{ name: string; backup: unknown } | null>(
      null,
    ),
    [preview, setPreview] = useState<Preview | null>(null),
    [run, setRun] = useState<Commit | null>(null),
    [legacy, setLegacy] = useState(""),
    [mapping, setMapping] = useState<Record<string, number | string>>({}),
    [limit, setLimit] = useState(100);
  async function check(
    source = file,
    status = legacy,
    choices = mapping,
    newRun = true,
  ) {
    if (!source) return;
    setPreview(null);
    setRun(null);
    const data = await api<Preview>("/api/library-import", {
      method: "POST",
      body: JSON.stringify({
        action: "preview",
        backup: source.backup,
        legacyStatus: status || undefined,
        mapping: choices,
        newRun,
      }),
    });
    setPreview(data);
    setRun(data);
  }
  return (
    <Screen title="Импорт библиотеки" back>
      <Text style={s.muted}>
        Выберите JSON-файл EpisyHub. Сначала проверьте список: существующие
        записи не перезаписываются. Максимум 2 МБ.
      </Text>
      <Feedback error={task.error} notice={task.notice} />
      <Button
        title="Выбрать файл библиотеки"
        busy={task.busy === "pick"}
        disabled={!!task.busy}
        onPress={() =>
          void task.run("pick", async () => {
            const source = await pickBackup();
            if (!source) return;
            setFile(source);
            setMapping({});
            setLegacy("");
            await check(source, "", {}, true);
          })
        }
      />
      {file && (
        <>
          <Text style={s.text}>{file.name}</Text>
          <Text style={s.muted}>
            Если в старом файле нет статусов, выберите статус для таких записей:
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {statuses.map((value) => (
              <Button
                key={value.value}
                title={value.label}
                secondary={legacy !== value.value}
                disabled={!!task.busy || !!run?.completed}
                onPress={() => {
                  setLegacy(value.value);
                  setPreview(null);
                  setRun(null);
                }}
              />
            ))}
          </View>
          <Button
            title="Проверить файл"
            secondary
            busy={task.busy === "preview"}
            disabled={!!task.busy}
            onPress={() => void task.run("preview", () => check())}
          />
        </>
      )}
      {preview && (
        <>
          <Text style={s.heading}>Предварительный просмотр</Text>
          <Text style={s.text}>
            Всего: {preview.total} · Новых:{" "}
            {preview.rows.filter((r) => r.state === "new").length} · Уже есть:{" "}
            {preview.rows.filter((r) => r.state === "skip").length}
          </Text>
          {preview.warnings.map((w, i) => (
            <Text key={i} style={s.muted}>
              {w}
            </Text>
          ))}
          {preview.rows.slice(0, limit).map((row) => (
            <View key={row.index} style={s.panel}>
              <Text style={s.heading}>{row.title}</Text>
              <Text style={s.muted}>{row.reason}</Text>
              {row.state === "attention" && (
                <View style={{ gap: 8 }}>
                  {row.candidates.map((candidate) => (
                    <Button
                      key={candidate.id}
                      title={`Выбрать: ${candidate.name}`}
                      secondary={mapping[String(row.index)] !== candidate.id}
                      disabled={!!task.busy}
                      onPress={() => {
                        const next = { ...mapping, [row.index]: candidate.id };
                        setMapping(next);
                      }}
                    />
                  ))}
                  {!row.candidates.length && (
                    <Button
                      title={`Создать новую карточку: ${row.title}`}
                      secondary={mapping[String(row.index)] !== "new"}
                      disabled={!!task.busy}
                      onPress={() => {
                        const next = { ...mapping, [row.index]: "new" };
                        setMapping(next);
                      }}
                    />
                  )}
                  <Text style={s.muted}>
                    Выберите соответствие, затем нажмите «Проверить файл».
                  </Text>
                </View>
              )}
            </View>
          ))}
          {preview.rows.length > limit && (
            <Button
              title="Показать ещё записи импорта"
              secondary
              onPress={() => setLimit((value) => value + 100)}
            />
          )}
        </>
      )}
      {run && (
        <>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.accent }}
          >
            Обработано {run.cursor} из {run.total}
          </Text>
          {!run.completed && (
            <Button
              title={run.cursor ? "Продолжить импорт" : "Подтвердить импорт"}
              busy={task.busy === "commit"}
              disabled={
                !!task.busy ||
                !preview ||
                preview.rows.some((r) => r.state === "attention")
              }
              onPress={() =>
                void task.run("commit", async () => {
                  let current = run;
                  while (!current.completed) {
                    const next = await api<Commit>("/api/library-import", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "commit",
                        jobId: current.jobId,
                        cursor: current.cursor,
                      }),
                    });
                    if (!next.completed && next.cursor <= current.cursor)
                      throw Error("Импорт не продвинулся. Повторите позже.");
                    current = next;
                    setRun(next);
                  }
                  return "Импорт завершён";
                })
              }
            />
          )}
          <Text style={s.text}>
            Добавлено: {run.result.added} · Пропущено: {run.result.skipped}
          </Text>
          {run.result.messages.map((msg, i) => (
            <Text key={i} style={s.muted}>
              {msg}
            </Text>
          ))}
        </>
      )}
    </Screen>
  );
}
