"use client";
import { useRef, useState } from "react";
export default function EmailVerificationForm({
  initialEmail = "",
  initialMessage = "",
  initialError = "",
}: {
  initialEmail?: string;
  initialMessage?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState(initialEmail),
    [message, setMessage] = useState(initialMessage),
    [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false),
    [cooldown, setCooldown] = useState(false);
  const lock = useRef(false);
  async function resend(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || cooldown) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/email-verification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Не удалось отправить письмо");
      setMessage(data.message);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={resend} className="space-y-4">
      <p className="text-neutral-400 text-sm">
        Откройте письмо от EpisyHub и перейдите по ссылке. Проверьте также папку
        «Спам». Ссылка действует 24 часа.
      </p>
      <label className="label" htmlFor="verification-email">
        Email
      </label>
      <input
        id="verification-email"
        className="input"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {message && (
        <p role="status" className="text-sm text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}
      <button
        className="btn btn-secondary w-full justify-center"
        disabled={busy || cooldown}
      >
        {busy
          ? "Отправка…"
          : cooldown
            ? "Повторить можно через минуту"
            : "Отправить письмо повторно"}
      </button>
    </form>
  );
}
