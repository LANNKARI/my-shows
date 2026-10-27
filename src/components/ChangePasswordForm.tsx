"use client";
import { useRef, useState } from "react";
import PasswordInput from "./PasswordInput";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmation) {
      setError("Новые пароли не совпадают");
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("Новый пароль слишком длинный: максимум 72 байта UTF-8.");
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Не удалось изменить пароль");
        return;
      }
      setCurrent("");
      setNew("");
      setConfirmation("");
      setSuccess(true);
    } catch {
      setError(
        "Не удалось получить подтверждение. Попробуйте войти с новым паролем, прежде чем повторять смену.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="card p-5 mt-8" aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-lg font-semibold">
        Безопасность
      </h2>
      <p className="text-sm text-neutral-400 mt-2 mb-5">
        Для смены пароля подтвердите текущий. Новый пароль — от 8 символов.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="current-password">
            Текущий пароль
          </label>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            required
            maxLength={1024}
            disabled={busy}
            value={currentPassword}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-password">
            Новый пароль
          </label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
            value={newPassword}
            onChange={(event) => setNew(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">
            Повторите новый пароль
          </label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-emerald-400">
            Пароль изменён. При следующем входе используйте новый пароль.
          </p>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Меняю пароль…" : "Изменить пароль"}
        </button>
      </form>
    </section>
  );
}
