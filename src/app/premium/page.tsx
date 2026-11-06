"use client";
import PremiumBadge from "@/components/PremiumBadge";
import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAccount } from "@/components/AccountAccess";
const benefits = [
  [
    "✦",
    "Особый профиль",
    "Значок Premium и выделенный ник в списках и комментариях.",
  ],
  [
    "▥",
    "Расширенная статистика",
    "Динамика просмотров, жанры и время за выбранный период.",
  ],
  [
    "◈",
    "Эксклюзивное оформление",
    "Особые темы и рамки на время активной подписки.",
  ],
  [
    "🍿",
    "500 🍿 за период",
    "Начисление в начале каждого оплаченного периода на 30 дней.",
  ],
  [
    "+10%",
    "Бонус в мини-играх",
    "Дробный бонус накапливается: каждые 10 наград по 1 🍿 дают ещё 1 🍿.",
  ],
  [
    "🏆",
    "Особые достижения",
    "Коллекционные достижения сохраняются после окончания подписки.",
  ],
];
export default function PremiumPage() {
  const { data: session, status } = useSession(),
    { account, loading, error, refresh } = useAccount();
  const [quote, setQuote] = useState<{
      requestKey: string;
      expectedUntil: string | null;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  async function buy() {
    if (!quote || lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quote, expectedPrice: 2000 }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось подтвердить покупку");
      setQuote(null);
      setMessage("Premium подключён. Спасибо за поддержку EpisyHub!");
      await refresh();
      window.dispatchEvent(new Event("popcorn-updated"));
      window.dispatchEvent(new Event("account-updated"));
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Ошибка соединения. Можно повторить подтверждение без повторного списания.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const premium = account?.premium;
  return (
    <div className="account-ui">
      <h1>EpisyHub Premium</h1>
      <p className="account-muted">Больше возможностей для ваших киноисторий</p>
      <section className="premium-hero">
        <div>
          <span className="premium-chip"><PremiumBadge decorative/> PREMIUM</span>
          <h2>Ваш профиль — с характером</h2>
          <p>
            Особый значок, расширенная статистика и эксклюзивное оформление.
          </p>
          {premium?.active && (
            <p>
              Подписка активна до{" "}
              <strong>
                {new Date(premium.until!).toLocaleString("ru-RU")}
              </strong>
            </p>
          )}
          {premium?.bonusTenths !== undefined && premium.active && (
            <small>
              Накопленный игровой бонус: {premium.bonusTenths}/10 до следующего
              🍿
            </small>
          )}
        </div>
        <div className="premium-price">
          <p>30 дней Premium</p>
          <strong>2000 🍿</strong>
          <p className="account-muted">
            Продление вручную.
            <br />
            Без автоматических списаний.
          </p>
          {status === "loading" || loading ? (
            <p role="status">Проверяем аккаунт…</p>
          ) : !session?.user ? (
            <Link className="account-button primary" href="/login">
              Войти для покупки
            </Link>
          ) : !account ? (
            <button className="account-button" onClick={() => void refresh()}>
              Повторить загрузку
            </button>
          ) : (
            <>
              <p>Баланс: {premium?.balance} 🍿</p>
              <button
                className="account-button gold"
                disabled={busy || premium!.balance < 2000}
                onClick={() => {
                  setMessage("");
                  setQuote({
                    requestKey: crypto.randomUUID(),
                    expectedUntil: premium!.until,
                  });
                }}
              >
                {premium?.active ? "Продлить на 30 дней" : "Подключить Premium"}
              </button>
              {premium!.balance < 2000 && (
                <small>Не хватает {2000 - premium!.balance} 🍿</small>
              )}
            </>
          )}
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {quote && (
        <section className="account-panel" aria-label="Подтверждение покупки">
          <h2>Подтвердите покупку</h2>
          <p>
            Списать 2000 🍿 за 30 дней Premium?
            {premium?.active
              ? " Новый период начнётся после текущего."
              : " 500 🍿 начислятся при активации."}
          </p>
          <div className="account-actions">
            <button
              className="account-button primary"
              disabled={busy}
              onClick={() => void buy()}
            >
              {busy ? "Подключаем…" : "Подтвердить за 2000 🍿"}
            </button>
            <button
              className="account-button"
              disabled={busy}
              onClick={() => setQuote(null)}
            >
              Отмена
            </button>
          </div>
        </section>
      )}
      <div className="premium-benefits">
        {benefits.map(([icon, title, text]) => (
          <section className="account-panel" key={title}>
            <span className="premium-icon">{icon === "✦" ? <PremiumBadge size={32} decorative/> : icon}</span>
            <h3>{title}</h3>
            <p className="account-muted">{text}</p>
          </section>
        ))}
      </div>
      <p className="account-muted">
        ✧ 30 AI-запросов в день — в разработке. Сейчас эта возможность
        недоступна.
      </p>
      <div className="account-actions">
        <Link className="account-button" href="/statistics">
          Моя статистика →
        </Link>
        <Link className="account-button" href="/cosmetics">
          Темы и рамки →
        </Link>
        <Link className="account-button" href="/rewards">
          Получить попкорн →
        </Link>
      </div>
      <p className="account-muted">
        По окончании подписки достижения сохраняются, Premium-оформление и
        бонусы отключаются. Обычные покупки остаются доступными.
      </p>
    </div>
  );
}
