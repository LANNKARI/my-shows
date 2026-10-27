"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error || !res?.ok) {
        setError("Неверный email или пароль");
        return;
      }
      router.push(
        callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
          ? callbackUrl
          : "/",
      );
      router.refresh();
    } catch {
      setError("Не удалось войти. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          autoComplete="username"
          type="email"
          className="input"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="login-password">
          Пароль
        </label>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          className="input"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {loading ? "Вхожу..." : "Войти"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card p-8">
        <h1 className="text-2xl font-bold mb-1">Вход</h1>
        <p className="text-neutral-500 text-sm mb-6">Войдите в свой аккаунт</p>

        <Suspense
          fallback={<p className="text-sm text-neutral-500">Загрузка...</p>}
        >
          <LoginForm />
        </Suspense>

        <p className="text-sm text-neutral-500 mt-6 text-center">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-red-500 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
