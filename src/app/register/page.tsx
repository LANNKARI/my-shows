"use client";

import { useState } from "react";
import EmailVerificationForm from "@/components/EmailVerificationForm";
import PasswordInput from "@/components/PasswordInput";

import Link from "next/link";

export default function RegisterPage() {
  const [sentEmail, setSentEmail] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [sentError, setSentError] = useState("");
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();

      if (!r.ok && !data.verificationRequired) {
        setError(data.error || "Ошибка регистрации");
        return;
      }
      setSentEmail(form.email);
      setSentMessage(r.ok ? data.message : "");
      setSentError(r.ok ? "" : data.error);
      setForm((previous) => ({ ...previous, password: "" }));
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  if (sentEmail)
    return (
      <div className="max-w-md mx-auto mt-10 card p-6 sm:p-8 space-y-5">
        <h1 className="text-2xl font-bold">Подтвердите почту</h1>
        <EmailVerificationForm
          initialEmail={sentEmail}
          initialMessage={sentMessage}
          initialError={sentError}
        />
        <Link className="text-rose-400 text-sm" href="/login">
          Перейти ко входу
        </Link>
      </div>
    );
  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card p-8">
        <h1 className="text-2xl font-bold mb-1">Регистрация</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Создайте аккаунт, чтобы вести свою библиотеку
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              maxLength={254}
              autoComplete="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="register-username">
              Username
            </label>
            <input
              className="input"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              id="register-username"
              maxLength={20}
              autoComplete="username"
              placeholder="например: lannkari"
            />
            <p className="text-xs text-neutral-500 mt-1">
              3–20 символов: a–z, 0–9, _
            </p>
          </div>

          <div>
            <label className="label" htmlFor="register-name">
              Имя (необязательно)
            </label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              id="register-name"
              maxLength={80}
              autoComplete="name"
              placeholder="Как вас зовут"
            />
          </div>

          <div>
            <label className="label" htmlFor="register-password">
              Пароль
            </label>
            <PasswordInput
              id="register-password"
              minLength={8}
              autoComplete="new-password"
              className="input"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Минимум 8 символов"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center"
          >
            {loading ? "Регистрирую..." : "Создать аккаунт"}
          </button>
        </form>

        <p className="text-sm text-neutral-500 mt-6 text-center">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-red-500 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
