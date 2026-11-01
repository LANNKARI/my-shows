"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import EmailVerificationForm from "@/components/EmailVerificationForm";
export default function VerifyEmailPage() {
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get(
        "token",
      );
      if (value) {
        setToken(value);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  async function confirm() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/email-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Не удалось подтвердить почту");
      setSuccess(true);
      setToken("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Ошибка соединения. Повторите проверку или попробуйте войти, если почта уже подтверждена.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="max-w-md mx-auto mt-10 card p-6 sm:p-8 space-y-5">
      <h1 className="text-2xl font-bold">
        {success ? "Почта подтверждена" : "Подтверждение почты"}
      </h1>
      {success ? (
        <>
          <p role="status">
            Аккаунт создан. Теперь можно войти и открыть свою библиотеку.
          </p>
          <Link className="btn btn-primary" href="/login">
            Войти
          </Link>
        </>
      ) : (
        <>
          {token && (
            <>
              <p className="text-sm text-neutral-400">
                Нажмите кнопку, чтобы завершить регистрацию в EpisyHub. Если вы
                не регистрировались, не подтверждайте адрес.
              </p>
              <button
                className="btn btn-primary w-full justify-center"
                onClick={confirm}
                disabled={busy}
              >
                {busy ? "Подтверждение…" : "Подтвердить почту"}
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="text-rose-400 text-sm">
              {error}
            </p>
          )}
          {(!token || error) && <EmailVerificationForm />}
          <Link className="block text-sm text-rose-400" href="/login">
            Перейти ко входу
          </Link>
        </>
      )}
    </div>
  );
}
