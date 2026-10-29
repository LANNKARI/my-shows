"use client";

import styles from "./DailyBonus.module.css";

const rewardsDefault: Record<number, number> = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
  6: 40,
  7: 50,
};
export default function DailyBonus({
  dailyStreak,
  nextStreak,
  canClaimDaily,
  streakRewards,
  busy,
  onClaim,
}: {
  dailyStreak: number;
  nextStreak: number;
  canClaimDaily: boolean;
  streakRewards?: Record<number, number>;
  busy: boolean;
  onClaim: () => void;
}) {
  const rewards = streakRewards ?? rewardsDefault;
  // nextStreak is calculated by the server: a gap or a new cycle returns day 1.
  const current = canClaimDaily ? nextStreak : dailyStreak;
  const collected = canClaimDaily ? current - 1 : current;
  const upcoming = canClaimDaily ? current : (current % 7) + 1;
  return (
    <section className={styles.panel} aria-labelledby="daily-bonus-title">
      <div className={styles.header}>
        <div>
          <h2 id="daily-bonus-title">🍿 Ежедневный бонус</h2>
          <p>Заходите каждый день — награда растёт вместе с серией</p>
        </div>
        <strong className={styles.streak}>
          🔥 Серия: {collected} из 7 дней
        </strong>
      </div>
      <ol className={styles.days} aria-label="Награды за семь дней">
        {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
          const today = day === current;
          const received = day <= collected;
          const available = today && canClaimDaily;
          const label = today
            ? available
              ? "Забрать сегодня"
              : "✓ Сегодня получено"
            : received
              ? "✓ Получено"
              : day === current + 1
                ? "Завтра"
                : "Впереди";
          const content = (
            <>
              <span className={styles.dayLabel}>День {day}</span>
              <span className={styles.icon} aria-hidden="true">
                🍿
              </span>
              <strong className={styles.amount}>
                +{rewards[day] ?? rewardsDefault[day]}
              </strong>
              <span className={styles.state}>{label}</span>
            </>
          );
          return (
            <li
              key={day}
              className={styles.day}
              data-state={today ? "today" : received ? "received" : "future"}
              aria-current={today ? "step" : undefined}
            >
              {available ? (
                <button
                  className={styles.dayContent}
                  disabled={busy}
                  onClick={onClaim}
                  aria-label={`Получить бонус за день ${day}`}
                  aria-busy={busy}
                >
                  {content}
                </button>
              ) : (
                <div className={styles.dayContent}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      <div className={styles.footer}>
        {canClaimDaily ? (
          <button
            disabled={busy}
            aria-busy={busy}
            className={styles.claim}
            onClick={onClaim}
          >
            {busy
              ? "Получаем бонус…"
              : `Забрать +${rewards[current] ?? rewardsDefault[current]} 🍿`}
          </button>
        ) : (
          <p className={styles.claimed}>✓ Сегодня бонус уже получен</p>
        )}
        <p className={styles.next}>
          {canClaimDaily ? "Сегодня доступно" : "Следующая награда"}: +
          {rewards[upcoming] ?? rewardsDefault[upcoming]} 🍿
        </p>
      </div>
    </section>
  );
}
