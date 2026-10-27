"use client";
import { useEffect, useState, useRef } from "react";
type Preview = {
  jobId: string;
  rows: {
    index: number;
    title: string;
    state: string;
    reason: string;
    showId: number | null;
    candidates: { id: number; name: string }[];
  }[];
  warnings: string[];
  cursor: number;
  total: number;
  completed: boolean;
  result: {
    added: number;
    skipped: number;
    collections: number;
    messages: string[];
  };
};
export default function LibraryImport() {
  const [backup, setBackup] = useState<unknown>(null),
    [filename, setFilename] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [legacyStatus, setLegacyStatus] = useState(""),
    [mapping, setMapping] = useState<Record<string, number | "new">>({}),
    [planDirty, setPlanDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    running = useRef(false);
  useEffect(
    () => () => {
      running.current = false;
    },
    [],
  );
  async function request(body: object) {
    const r = await fetch("/api/library-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "Ошибка импорта");
    return data;
  }
  async function choose(file: File) {
    setBackup(null);
    setPreview(null);
    if (file.size > 1.9 * 1024 * 1024) {
      setError("Максимум 1,9 МБ на файл");
      return;
    }
    try {
      const json = JSON.parse(await file.text());
      setBackup(json);
      setFilename(file.name);
      setPreview(null);
      setMapping({});
      setError("");
    } catch {
      setError("Не удалось прочитать JSON-файл");
    }
  }
  async function inspect(newRun = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      setPreview(
        await request({
          action: "preview",
          backup,
          legacyStatus,
          mapping,
          newRun,
        }),
      );
      setPlanDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function commit() {
    if (!preview || lock.current) return;
    lock.current = true;
    running.current = true;
    setBusy(true);
    setError("");
    let current = preview;
    try {
      while (!current.completed && running.current) {
        const next = await request({
          action: "commit",
          jobId: current.jobId,
          cursor: current.cursor,
        });
        current = { ...current, ...next };
        setPreview(current);
      }
      window.dispatchEvent(new Event("user-shows-updated"));
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Ошибка соединения") +
          " Уже обработанные пакеты сохранены. Нажмите «Продолжить импорт», чтобы проверить результат и продолжить.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
      running.current = false;
    }
  }
  return (
    <section
      className="card p-5 mt-8 space-y-4"
      aria-labelledby="import-heading"
    >
      <h2 id="import-heading" className="text-lg font-semibold">
        Импорт библиотеки
      </h2>
      <p className="text-sm text-neutral-400">
        JSON-бэкап EpisyHub. Добавляем недостающее, существующие тайтлы и их
        данные сохраняем. До 500 тайтлов и 20 000 эпизодов.
      </p>
      <label className="block text-sm">
        Файл резервной копии
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.[0]) void choose(e.target.files[0]);
          }}
          className="input mt-2"
        />
      </label>
      {backup !== null && (
        <>
          <p className="text-xs text-neutral-400 break-all">{filename}</p>
          <label className="block text-sm">
            Статус отсутствует в старом бэкапе
            <select
              value={legacyStatus}
              disabled={busy}
              className="input mt-2"
              onChange={(e) => {
                setLegacyStatus(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Пропустить записи без статуса</option>
              <option value="watching">Смотрю</option>
              <option value="planned">В планах</option>
              <option value="completed">Просмотрено</option>
              <option value="dropped">Брошено</option>
            </select>
          </label>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void inspect()}
          >
            {busy ? "Обработка…" : "Проверить файл"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}
      {preview && (
        <>
          <h3 className="font-semibold">Предпросмотр</h3>
          {preview.warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-300">
              {w}
            </p>
          ))}
          <p className="text-sm">
            Готово к добавлению:{" "}
            {preview.rows.filter((r) => r.state === "new").length} · Уже есть:{" "}
            {preview.rows.filter((r) => r.state === "skip").length} · Требуют
            внимания:{" "}
            {preview.rows.filter((r) => r.state === "attention").length}
          </p>
          <div className="max-h-72 overflow-auto space-y-3">
            {preview.rows.map((row) => (
              <div
                key={row.index}
                className="border border-neutral-800 rounded-xl p-3 text-sm"
              >
                <strong>{row.title}</strong>
                <p className="text-neutral-400 text-xs">{row.reason}</p>
                {row.state === "attention" &&
                  row.reason.startsWith("Нет внешнего") && (
                    <label>
                      Сопоставление
                      <select
                        className="input mt-2"
                        disabled={busy || preview.cursor > 0}
                        value={mapping[String(row.index)] ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setMapping((v) => {
                            const next = { ...v };
                            if (!value) delete next[String(row.index)];
                            else
                              next[String(row.index)] =
                                value === "new" ? "new" : Number(value);
                            return next;
                          });
                          setPlanDirty(true);
                        }}
                      >
                        <option value="">Пропустить</option>
                        {row.candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · #{c.id}
                          </option>
                        ))}
                        {!row.candidates.length && (
                          <option value="new">Создать новую карточку</option>
                        )}
                      </select>
                    </label>
                  )}
              </div>
            ))}
          </div>
          {preview.rows.some(
            (r) =>
              r.state === "attention" && r.reason.startsWith("Нет внешнего"),
          ) && (
            <p className="text-xs text-neutral-400">
              После выбора сопоставлений нажмите «Проверить файл» заново, чтобы
              обновить план.
            </p>
          )}
          <p className="text-xs text-neutral-400">
            Импорт не начисляет попкорн и не публикует комментарии. Профиль,
            друзья и покупки не изменяются.
          </p>
          {preview.completed ? (
            <div>
              <button
                type="button"
                className="btn btn-secondary mb-3"
                disabled={busy}
                onClick={() => void inspect(true)}
              >
                Проверить файл для нового импорта
              </button>
              <div role="status" className="text-emerald-400">
                Импорт завершён: добавлено {preview.result.added}, пропущено{" "}
                {preview.result.skipped}, коллекций обработано{" "}
                {preview.result.collections}.
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                className="btn btn-primary"
                disabled={
                  busy ||
                  planDirty ||
                  preview.rows.every((r) => r.state === "attention")
                }
                onClick={commit}
              >
                {preview.cursor ? "Продолжить импорт" : "Подтвердить импорт"}
              </button>
              {busy && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    running.current = false;
                  }}
                >
                  Остановить после пакета
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-neutral-400">
            Обработано {preview.cursor} из {preview.total}
          </p>
          {preview.result.messages.map((m, i) => (
            <p key={i} className="text-xs text-neutral-400">
              {m}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
