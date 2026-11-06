"use client";
import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PremiumBadge from "@/components/PremiumBadge";
import { useAccount } from "@/components/AccountAccess";
import { PREMIUM_PLANS } from "@/lib/premium-plans";
import styles from "./premium.module.css";
const benefits = [
  [
    "×2",
    "Награды в мини-играх",
    "Вместо 1 🍿 — 2 🍿. Игровая награда удваивается, без накопления дробных бонусов.",
  ],
  [
    "▥",
    "Расширенная статистика",
    "Часы, жанры, страны, оценки, активность и стрики ваших просмотров.",
  ],
  [
    "▧",
    "Своя шапка профиля",
    "Загрузите своё изображение и посмотрите результат перед сохранением.",
  ],
  [
    "✦",
    "Значок Premium",
    "Особый значок и выделение строки в топе пользователей.",
  ],
  ["◈", "Темы и рамки", "Эксклюзивное оформление на время активной подписки."],
  [
    "🏆",
    "Особые достижения",
    "Открывайте коллекционные достижения Premium. Полученное остаётся в истории.",
  ],
];
export default function PremiumPage() {
  const { data: session, status } = useSession(),
    { account, loading, error, refresh } = useAccount();
  const premium = account?.premium;
  const [quote, setQuote] = useState<{
      requestKey: string;
      expectedUntil: string | null;
      plan: (typeof PREMIUM_PLANS)[number];
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
      const response = await fetch("/api/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: quote.requestKey,
          expectedUntil: quote.expectedUntil,
          expectedPrice: quote.plan.price,
          days: quote.plan.days,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не удалось подключить Premium");
      setQuote(null);
      await refresh();
      window.dispatchEvent(new Event("account-updated"));
      setMessage("Premium подключён. Срок и бонусы обновлены.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Не удалось подключить Premium",
      );
      await refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={`account-ui ${styles.page}`}>
      <header className={styles.header}>
        <PremiumBadge size={48} />
        <div>
          <h1>EpisyHub Premium</h1>
          <p>
            Больше наград, личное оформление и полная история ваших просмотров.
          </p>
        </div>
      </header>
      {premium?.active && (
        <p className={styles.active}>
          ✦ Premium активен до{" "}
          {premium.until ? new Date(premium.until).toLocaleString("ru-RU") : ""}
        </p>
      )}
      {session?.user && premium && (
        <p className="account-muted">Баланс: {premium.balance} 🍿</p>
      )}
      <div className={styles.plans}>
        {PREMIUM_PLANS.map((plan) => (
          <section
            className={styles.plan}
            key={plan.days}
            aria-label={`Premium на ${plan.days} дней`}
          >
            <h2>{plan.days} дней</h2>
            <p>
              {plan.days === 7 ? "Короткий период Premium" : "Выгоднее за день"}
            </p>
            <strong className={styles.price}>{plan.price} 🍿</strong>
            <span className={styles.bonus}>+{plan.bonus} 🍿 при активации</span>
            {status === "loading" || loading ? (
              <p role="status">Проверяем аккаунт…</p>
            ) : !session?.user ? (
              <Link className="account-button primary" href="/login">
                Войти для покупки
              </Link>
            ) : !premium ? (
              <button className="account-button" onClick={() => void refresh()}>
                Повторить загрузку
              </button>
            ) : (
              <>
                <button
                  className={`account-button ${plan.days === 7 ? "primary" : "gold"}`}
                  disabled={busy || premium.balance < plan.price}
                  onClick={() => {
                    setMessage("");
                    setQuote({
                      requestKey: crypto.randomUUID(),
                      expectedUntil: premium.until,
                      plan,
                    });
                  }}
                >
                  {premium.active ? "Продлить" : "Подключить"} на {plan.days}{" "}
                  дней
                </button>
                {premium.balance < plan.price && (
                  <small>Не хватает {plan.price - premium.balance} 🍿</small>
                )}
              </>
            )}
          </section>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {quote && (
        <section className="account-panel" aria-label="Подтверждение покупки">
          <h2>Подтвердите покупку</h2>
          <p>
            Списать {quote.plan.price} 🍿 за {quote.plan.days} дней Premium?{" "}
            {premium?.active ? "Новый период начнётся после текущего. " : ""}
            {quote.plan.bonus} 🍿 начислятся в начале нового периода.
          </p>
          <div className="account-actions">
            <button
              className="account-button primary"
              disabled={busy}
              onClick={() => void buy()}
            >
              {busy ? "Подключаем…" : `Подтвердить за ${quote.plan.price} 🍿`}
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
      <div className={styles.benefits}>
        {benefits.map(([icon, title, description]) => (
          <article className="account-panel" key={title}>
            <h2>
              <span aria-hidden="true">{icon}</span> {title}
            </h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
      <section className={styles.info}>
        <strong>Продление вручную, без автоматических списаний.</strong>
        <p>
          Новый срок добавляется к действующему. Бонус 150 или 500 🍿
          начисляется один раз в начале соответствующего периода.
        </p>
        <p>
          После окончания подписки отключаются значок, игровое удвоение,
          расширенная статистика, личная шапка и эксклюзивные темы и рамки. Ваши
          настройки сохраняются и восстанавливаются при продлении. Обычные
          покупки за попкорны остаются доступны.
        </p>
      </section>
      <p className={styles.ai}>
        AI-подбор — в разработке. После запуска Premium получит 30 AI-запросов в
        день.
      </p>
      {premium?.active && (
        <div className="account-actions">
          <Link href="/statistics" className="account-button">
            Статистика просмотров →
          </Link>
          <Link href="/cosmetics" className="account-button">
            Оформление профиля →
          </Link>
          {session?.user?.username && (
            <Link
              href={`/u/${session.user.username}`}
              className="account-button"
            >
              Изменить шапку профиля →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
