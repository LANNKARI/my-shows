"use client";

import { useState } from "react";

export default function RatingModal({
  userShowId,
  episodeId,
  initialScore,
  onClose,
  onSaved,
}: {
  userShowId: number;
  episodeId?: number | null;
  initialScore?: number | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [score, setScore] = useState(initialScore ?? 8);
  const [hovered, setHovered] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/user-shows/${userShowId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, episodeId: episodeId || null }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error || "Ошибка сохранения");
        return;
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const display = hovered ?? score;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-md bg-neutral-900 border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-1 text-center">
          {episodeId ? "Оцените серию" : "Оцените тайтл"}
        </h3>
        <p className="text-center text-neutral-500 text-sm mb-6">
          Поставьте оценку от 1 до 10
        </p>

        <div className="text-center mb-6">
          <div className="text-6xl font-extrabold text-red-500 leading-none">
            {display}
          </div>
          <div className="text-xs text-neutral-600 mt-1">/ 10</div>
        </div>

        <div
          className="flex justify-center gap-1 mb-6"
          onMouseLeave={() => setHovered(null)}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHovered(n)}
              onClick={() => setScore(n)}
              className={`w-9 h-9 rounded-lg text-lg font-bold transition-all ${
                n <= display
                  ? "bg-gradient-to-b from-yellow-400 to-yellow-600 text-black scale-110 shadow-lg shadow-yellow-900/40"
                  : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-center">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Отмена
          </button>
          <button
            className="btn btn-primary min-w-[120px] justify-center"
            onClick={save}
            disabled={saving}
            type="button"
          >
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}