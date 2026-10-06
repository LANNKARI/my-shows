"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import TmdbSearch, { TmdbResult } from "@/components/TmdbSearch";

export default function NewTitle() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    originalName: "",
    dubbing: "",
    watchSite: "",
    kind: "series" as "series" | "movie",
  });

  // Сезоны: массив, где seasons[s] = количество серий в сезоне s+1
  const [seasons, setSeasons] = useState<number[]>([10]);

  function addSeason() {
    setSeasons((prev) => [...prev, 10]);
  }

  function removeSeason(idx: number) {
    setSeasons((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSeason(idx: number, value: number) {
    setSeasons((prev) => prev.map((v, i) => (i === idx ? Math.max(0, value) : v)));
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await r.json();
    setPosterUrl(data.url);
  }
  function handleTmdbPick(r: TmdbResult) {
  setForm({
    name: r.name,
    originalName: r.originalName || "",
    dubbing: form.dubbing,
    watchSite: form.watchSite,
    kind: r.kind,
  });

  // Автозаполнение сезонов и серий
  if (r.kind === "series" && r.episodesPerSeason && r.episodesPerSeason.length > 0) {
    setSeasons(r.episodesPerSeason);
  } else if (r.kind === "series" && r.numberOfSeasons) {
    // Если массив не пришёл — заполняем равномерно
    const base = Math.floor((r.numberOfEpisodes || 0) / r.numberOfSeasons);
    const arr = Array.from({ length: r.numberOfSeasons }, () => base);
    setSeasons(arr);
  }

  if (r.posterPath) {
    setPosterUrl(r.posterPath);
  }
}

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const totalEpisodes = seasons.reduce((s, n) => s + n, 0);

      const r = await fetch("/api/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          posterUrl,
          totalSeasons: seasons.length,
          totalEpisodes,
          episodesPerSeason: seasons,
        }),
      });

      if (!r.ok) {
        const text = await r.text();
        alert(`Ошибка ${r.status}: ${text}`);
        return;
      }

      const t = await r.json();
      router.push(`/title/${t.id}`);
    } finally {
      setSaving(false);
    }
  }

  const totalEpisodes = seasons.reduce((s, n) => s + n, 0);

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

      <div className="rounded-xl bg-neutral-900/40 border border-white/5 p-3">
  <p className="text-xs text-neutral-500 mb-2">
    ✨ Автозаполнение из TMDB
  </p>
  <TmdbSearch onPick={handleTmdbPick} />
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Сезоны и серии</label>
            <div className="text-xs text-neutral-500">
              Всего серий: <span className="text-white font-semibold">{totalEpisodes}</span>
            </div>
          </div>

          <div className="space-y-2">
            {seasons.map((count, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-24 text-sm text-neutral-400 shrink-0">
                  Сезон {idx + 1}
                </div>
                <input
                  type="number"
                  min={0}
                  className="input flex-1"
                  value={count}
                  onChange={(e) => updateSeason(idx, Number(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() => removeSeason(idx)}
                  disabled={seasons.length === 1}
                  className="btn btn-danger shrink-0 disabled:opacity-30"
                  title={seasons.length === 1 ? "Минимум один сезон" : "Удалить сезон"}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addSeason}
            className="btn btn-secondary w-full justify-center"
          >
            + Добавить сезон
          </button>
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
        <button disabled={saving} className="btn btn-primary" type="submit">
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
          Отмена
        </button>
      </div>
    </form>
  );
}