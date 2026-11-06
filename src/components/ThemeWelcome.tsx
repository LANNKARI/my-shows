"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./ThemeWelcome.module.css";

const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
const slideNames = ["Приветствие", "Группа ВК"];
export default function ThemeWelcome() {
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
  const playing = visible && !reduced && !paused && !hovered && !focused;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % 2), 8000);
    return () => clearInterval(timer);
  }, [playing]);
  return (
    <section
      className={styles.carousel}
      aria-label="Новости и приветствие EpisyHub"
      aria-roledescription="карусель"
      data-slide={index}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      {[0, 1].map((slide) => (
        <div
          key={slide}
          className={`${styles.slide} ${index === slide ? styles.active : ""}`}
          inert={index !== slide}
          aria-hidden={index !== slide}
          role="group"
          aria-roledescription="слайд"
          aria-label={`${slide + 1} из 2: ${slideNames[slide]}`}
        >
          <div className={styles.copy}>
            <p className={styles.eyebrow}>
              {slide ? "Сообщество EpisyHub" : "Твоя история в мире кино"}
            </p>
            <h1>
              {slide ? (
                <>
                  Теперь мы
                  <br />
                  ВКонтакте
                </>
              ) : (
                <>
                  Хорошие истории.
                  <br />В твоём ритме.
                </>
              )}
            </h1>
            <p className={styles.description}>
              {slide
                ? "Премьеры, новости EpisyHub, подборки и общение — в нашей группе."
                : "Фильмы, сериалы и маленькие открытия. Сохраняй, отмечай просмотренное и делись впечатлениями."}
            </p>
            {slide ? (
              <a
                className={styles.cta}
                href="https://vk.ru/episyhub"
                target="_blank"
                rel="noopener noreferrer"
              >
                Перейти в группу <Arrow />
              </a>
            ) : (
              <Link href="/watching" className={styles.cta}>
                В мою библиотеку <Arrow />
              </Link>
            )}
          </div>
          {slide ? (
            <div className={styles.art} aria-hidden="true">
              <span className={styles.spark}>✦</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- Existing small transparent brand asset. */}
              <img
                src="/branding/episyhub-icon.webp"
                alt=""
                className={styles.logo}
                width={300}
                height={220}
              />
              <div className={styles.communityCard}>
                <svg viewBox="0 0 24 24" width="44" height="44">
                  <rect width="24" height="24" rx="6" fill="#0077ff" />
                  <path
                    fill="white"
                    d="M5 7h2.3c.2 4.1 1.9 5.8 3.2 6.2V7h2.2v3.5c1.3-.2 2.6-1.8 3.1-3.5H18c-.4 2-1.8 3.6-2.8 4.3 1.1.6 2.7 2 3.3 4.7H16c-.6-1.8-1.9-3.1-3.3-3.3V16h-.3C7.7 16 5.3 12.8 5 7z"
                  />
                </svg>
                <div>
                  <strong>Смотри · Отмечай · Делись</strong>
                  <small>vk.ru/episyhub</small>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.art} aria-hidden="true">
              <div className={styles.planet} />
              <div className={styles.orbit} />
              <div className={styles.ticket}>
                <strong>Ещё одна серия?</strong>
                <small>Твоё кино всегда рядом &nbsp; ✦</small>
              </div>
            </div>
          )}
        </div>
      ))}
      <div className={styles.controls}>
        <div className={styles.dots} role="group" aria-label="Слайды баннера">
          {slideNames.map((name, i) => (
            <button
              key={name}
              type="button"
              aria-label={`Показать слайд: ${name}`}
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
            >
              <span />
            </button>
          ))}
        </div>
        {!reduced && (
          <button
            type="button"
            className={styles.pause}
            aria-label={
              paused
                ? "Продолжить смену баннеров"
                : "Приостановить смену баннеров"
            }
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              aria-hidden="true"
            >
              {paused ? (
                <path d="m3 1 8 5-8 5z" />
              ) : (
                <path d="M2 1h3v10H2zM7 1h3v10H7z" />
              )}
            </svg>
            {paused ? "Продолжить" : "Пауза"}
          </button>
        )}
      </div>
    </section>
  );
}
function Arrow() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
