"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/users/me")
      .then((r) => r.json())
      .then((u) => {
        setUsername(u.username);
        setEmail(u.email);
        setName(u.name || "");
        setBio(u.bio || "");
        setAvatarUrl(u.avatarUrl);
      })
      .finally(() => setLoading(false));
  }, [status, router]);

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) {
        setError("Ошибка загрузки аватарки");
        return;
      }
      const { url } = await r.json();
      setAvatarUrl(url);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const r = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bio, avatarUrl }),
    });

    if (!r.ok) {
      const data = await r.json();
      setError(data.error || "Ошибка сохранения");
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    router.refresh();
  }

  if (loading) return <p className="text-neutral-500">Загрузка...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Настройки профиля</h1>

      <form onSubmit={submit} className="space-y-6">
        {/* Аватарка */}
        <div className="card p-5">
          <label className="label">Аватарка</label>
          <div className="flex items-center gap-4 mt-2">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="w-20 h-20 rounded-2xl object-cover border border-white/5"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-2xl font-bold text-white">
                {(name || username || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                className="input"
              />
              {uploading && (
                <p className="text-xs text-neutral-500 mt-2">Загрузка...</p>
              )}
            </div>
          </div>
        </div>

        {/* Основное */}
        <div className="card p-5 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input opacity-60 cursor-not-allowed"
              value={email}
              disabled
              title="Email изменить нельзя"
            />
          </div>

          <div>
            <label className="label">Username</label>
            <input
              className="input opacity-60 cursor-not-allowed"
              value={username}
              disabled
              title="Username изменить нельзя"
            />
          </div>

          <div>
            <label className="label">Имя</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              maxLength={60}
            />
          </div>

          <div>
            <label className="label">О себе</label>
            <textarea
              className="input min-h-[100px] resize-y"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Пара слов о себе, любимых жанрах, любимых сериалах..."
              maxLength={300}
            />
            <p className="text-xs text-neutral-500 mt-1">
              {bio.length} / 300 символов
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {saved && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-400">
            ✓ Сохранено
          </div>
        )}

        <div className="flex gap-2">
          <button disabled={saving} className="btn btn-primary" type="submit">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push(`/u/${username}`)}
          >
            Посмотреть профиль
          </button>
        </div>
      </form>
    </div>
  );
}