"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewTitle() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    originalName: "",
    dubbing: "",
    watchSite: "",
    totalSeasons: 1,
    totalEpisodes: 0,
    kind: "series" as "series" | "movie",
  });

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await r.json();
    setPosterUrl(data.url);
  }

  async function submit(e: React.FormEvent) {
  e.preventDefault();
  setSaving(true);
  try {
    const payload = { ...form, posterUrl };
    console.log("ОТПРАВЛЯЮ:", payload);

    const r = await fetch("/api/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    console.log("СТАТУС:", r.status, "ОТВЕТ:", text);

    if (!r.ok) {
      alert(`Ошибка ${r.status}: ${text}`);
      return;
    }

    const t = JSON.parse(text);
    if (!t.id) {
      alert(`Нет ID в ответе: ${text}`);
      return;
    }
    router.push(`/title/${t.id}`);
  } catch (err) {
    alert(`Ошибка: ${err}`);
  } finally {
    setSaving(false);
  }
}

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Добавить</h1>

      <div>
        <label className="label">Тип</label>
        <div className="flex gap-2">
          {(["series", "movie"] as const).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setForm({ ...form, kind: k })}
              className={`btn ${form.kind === k ? "btn-primary" : "btn-secondary"}`}
            >
              {k === "series" ? "Сериал" : "Фильм"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Название</label>
        <input
          className="input"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div>
        <label className="label">Оригинальное название</label>
        <input
          className="input"
          value={form.originalName}
          onChange={(e) => setForm({ ...form, originalName: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Озвучка</label>
          <input
            className="input"
            value={form.dubbing}
            onChange={(e) => setForm({ ...form, dubbing: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Сайт просмотра</label>
          <input
            className="input"
            value={form.watchSite}
            onChange={(e) => setForm({ ...form, watchSite: e.target.value })}
          />
        </div>
      </div>

      {form.kind === "series" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Сезонов</label>
            <input
              type="number"
              min={1}
              className="input"
              value={form.totalSeasons}
              onChange={(e) => setForm({ ...form, totalSeasons: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Всего серий</label>
            <input
              type="number"
              min={0}
              className="input"
              value={form.totalEpisodes}
              onChange={(e) => setForm({ ...form, totalEpisodes: Number(e.target.value) })}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Распределятся равномерно по сезонам.
            </p>
          </div>
        </div>
      )}

      <div>
        <label className="label">Постер</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="input"
        />
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="" className="mt-2 h-48 rounded-lg object-cover" />
        )}
      </div>

      <div className="flex gap-2">
        <button disabled={saving} className="btn-primary" type="submit">
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Отмена
        </button>
      </div>
    </form>
  );
}