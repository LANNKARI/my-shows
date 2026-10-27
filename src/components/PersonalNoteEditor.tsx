"use client";
import { useEffect, useState, useRef } from "react";
import { privateFetch } from "@/lib/private-fetch";
export default function PersonalNoteEditor({ showId }: { showId: number }) {
  return <Editor key={showId} showId={showId} />;
}
function Editor({ showId }: { showId: number }) {
  const [text, setText] = useState(""),
    [saved, setSaved] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const dirty = saved !== null && text !== saved;
  useEffect(() => {
    const c = new AbortController();
    privateFetch(`/api/user-shows/${showId}/note`, c.signal)
      .then(async (r) => {
        if (!r.ok) throw Error("Не удалось загрузить заметку");
        return r.json();
      })
      .then((v) => {
        if (!c.signal.aborted) {
          setText(v.text);
          setSaved(v.text);
          setError("");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [showId, attempt]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a[href]");
      if (a && !window.confirm("Заметка не сохранена. Покинуть страницу?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/user-shows/${showId}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok)
        throw Error("Не удалось сохранить. Ваш черновик остался в поле.");
      const data = await r.json();
      setSaved(data.text);
      setNotice("Заметка сохранена");
      window.dispatchEvent(new Event("user-shows-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  return (
    <section
      className="td-panel space-y-3"
      aria-labelledby="private-note-heading"
    >
      <h2 id="private-note-heading">Личная заметка</h2>
      <p className="text-sm text-neutral-400">
        Только для вас. Не публикуется в комментариях и профиле.
      </p>
      {saved === null ? (
        error ? (
          <p role="alert">
            {error}{" "}
            <button onClick={() => setAttempt((v) => v + 1)}>
              Повторить загрузку
            </button>
          </p>
        ) : (
          <p>Загрузка заметки…</p>
        )
      ) : (
        <>
          <label className="sr-only" htmlFor="personal-note">
            Личная заметка к тайтлу
          </label>
          <textarea
            id="personal-note"
            className="input min-h-36"
            maxLength={2000}
            disabled={busy}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setNotice("");
            }}
          />
          <div className="flex justify-between gap-3 text-xs text-neutral-400">
            <span>{text.length} / 2000</span>
            <span>{dirty ? "Есть несохранённые изменения" : ""}</span>
          </div>
          {error && (
            <p role="alert" className="text-rose-400 text-sm">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-emerald-400 text-sm">
              {notice}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={busy || !dirty}
              className="btn btn-primary"
            >
              {busy ? "Сохраняю…" : "Сохранить заметку"}
            </button>
            <button
              onClick={() => setText("")}
              disabled={busy || !text}
              className="btn btn-secondary"
            >
              Очистить текст
            </button>
          </div>
        </>
      )}
    </section>
  );
}
