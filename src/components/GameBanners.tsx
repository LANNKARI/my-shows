"use client";
import { tmdbImageUrl } from "@/lib/tmdb-image";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAccount } from "./AccountAccess";
import styles from "./GameBanners.module.css";
export const GAME_BANNER_INTERVAL_MS = 4000;
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const motionSnapshot = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
export default function GameBanners() {
  const [frames, setFrames] = useState<string[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/game-banners", {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = await r.json();
        if (!abort.signal.aborted)
          setFrames(
            Array.isArray(data.frames)
              ? data.frames
                  .filter(
                    (f: unknown) =>
                      typeof f === "string" &&
                      /^https:\/\/image\.tmdb\.org\/t\/p\/w780\/[a-zA-Z0-9._-]+$/.test(
                        f,
                      ),
                  )
                  .slice(0, 6)
              : [],
          );
      })
      .catch(() => {});
    return () => abort.abort();
  }, []);
  return (
    <section className={styles.grid} aria-label="Мини-игры">
      <GameBanner frames={frames} offset={0} type="quiz" />
      <GameBanner frames={frames} offset={3} type="duel" />
    </section>
  );
}
function GameBanner({
  frames,
  offset,
  type,
}: {
  frames: string[];
  offset: number;
  type: "quiz" | "duel";
}) {
  const { account } = useAccount();
  const reduced = useSyncExternalStore(
    subscribeMotion,
    motionSnapshot,
    () => true,
  );
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [focused, setFocused] = useState(false);
  const playing =
    frames.length > 1 && !reduced && visible && !paused && !hover && !focused;
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      GAME_BANNER_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [playing, frames.length]);
  const active = frames.length ? (index + offset) % frames.length : 0,
    quiz = type === "quiz";
  return (
    <article
      className={`${styles.card} ${quiz ? "" : styles.duel}`}
      data-frame-index={active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={(e) =>
        setFocused(e.target instanceof Element && !!e.target.closest("a"))
      }
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div className={styles.frames} aria-hidden="true">
        {frames.map((frame, i) => (
          <div
            key={frame}
            className={`${styles.frame} ${active === i ? styles.active : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tmdbImageUrl(frame)}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          </div>
        ))}
      </div>
      <div className={styles.shade} />
      <Link
        href={quiz ? "/rewards/quiz" : "/rewards/higher-lower"}
        className={styles.content}
        aria-labelledby={`game-${type}-title`}
      >
        <span className={styles.tag}>
          {quiz ? "10 кадров в день" : "5 раундов"}
        </span>
        <span className={styles.eyebrow}>
          {quiz ? "Проверь память" : "Доверься интуиции"}
        </span>
        <h2 id={`game-${type}-title`}>
          {quiz ? (
            <>
              Угадай фильм
              <br />
              по кадру
            </>
          ) : (
            <>
              Больше
              <br />
              или меньше
            </>
          )}
        </h2>
        <p className={styles.description}>
          {quiz ? (
            <>
              Новые загадки каждый день.
              <br />
              Без аниме и повторов за неделю.
            </>
          ) : (
            <>
              У кого выше рейтинг и какой фильм старше?
              <br />
              Забери банк или рискни ещё раз.
            </>
          )}
        </p>
        <span className={styles.bottom}>
          <span className={styles.play}>
            {quiz ? "Угадать фильм" : "Начать сравнение"}
            <span aria-hidden="true">→</span>
          </span>
          <span className={styles.reward}>
            +{account?.premium.active ? 2 : 1} 🍿
            <br />
            {quiz ? "за верный ответ" : "в банк за ответ"}
          </span>
        </span>
      </Link>
      {frames.length > 1 && (
        <button
          className={styles.pause}
          type="button"
          disabled={reduced}
          aria-label={
            reduced
              ? "Анимация отключена в настройках устройства"
              : paused
                ? "Возобновить смену кадров"
                : "Приостановить смену кадров"
          }
          aria-pressed={paused || reduced}
          onClick={() => setPaused((v) => !v)}
        >
          {reduced ? "Без анимации" : paused ? "Продолжить" : "Пауза"}
        </button>
      )}
      <div className={styles.dots} aria-hidden="true">
        {frames.map((frame, i) => (
          <i key={frame} className={active === i ? styles.currentDot : ""} />
        ))}
      </div>
    </article>
  );
}
