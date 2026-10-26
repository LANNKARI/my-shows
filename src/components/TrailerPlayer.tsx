"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface TrailerItem {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

interface TrailerPlayerProps {
  compact?: boolean;
  trailers: {
    russian: TrailerItem | null;
    english: TrailerItem | null;
  };
}

export default function TrailerPlayer({
  trailers,
  compact = false,
}: TrailerPlayerProps) {
  const hasRussian = Boolean(trailers?.russian?.key);
  const hasEnglish = Boolean(trailers?.english?.key);

  const [activeLang, setActiveLang] = useState<"ru" | "en">(
    hasRussian ? "ru" : "en",
  );
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
      if (event.key !== "Tab") return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>(
        'button, iframe, [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previous?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!hasRussian && !hasEnglish) {
    return null;
  }

  const currentTrailer =
    activeLang === "ru" && hasRussian
      ? trailers.russian
      : trailers.english || trailers.russian;

  return (
    <>
      {/* Компактный виджет под постером */}
      <div className={compact ? undefined : "w-full mt-3"}>
        {compact ? (
          <button className="td-button" onClick={() => setIsOpen(true)}>
            ▷ Трейлер
          </button>
        ) : (
          <>
            <div
              onClick={() => setIsOpen(true)}
              className="relative w-full aspect-video rounded-2xl overflow-hidden border border-neutral-800 hover:border-neutral-600 group cursor-pointer shadow-lg bg-neutral-900 transition-all duration-300"
            >
              {currentTrailer?.key ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://img.youtube.com/vi/${currentTrailer.key}/hqdefault.jpg`}
                  alt="Трейлер"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-75 group-hover:opacity-90"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                  🎬 Нет превью
                </div>
              )}

              {/* Затемнение и кнопка Play */}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-rose-600/90 group-hover:bg-rose-600 text-white flex items-center justify-center text-xs pl-0.5 shadow-xl group-hover:scale-110 transition-transform">
                  ▶
                </div>
              </div>

              {/* Плашка с надписью и языком */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                  Трейлер
                </span>

                {hasRussian && hasEnglish ? (
                  <span className="px-1.5 py-0.5 rounded-md bg-blue-500/80 backdrop-blur-md text-[9px] font-bold text-white">
                    RU / EN
                  </span>
                ) : hasRussian ? (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/80 backdrop-blur-md text-[9px] font-bold text-white">
                    RU
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-md bg-neutral-800/90 backdrop-blur-md text-[9px] font-bold text-neutral-300">
                    EN
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Модальное окно просмотра */}
      {isOpen &&
        createPortal(
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          >
            <div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-label="Трейлер"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Шапка модалки */}
              <div className="p-4 sm:px-6 border-b border-neutral-800/80 flex items-center justify-between gap-3 bg-neutral-900/90">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base flex-shrink-0">🎬</span>
                  <span className="text-sm font-bold text-white truncate">
                    {currentTrailer?.name || "Официальный трейлер"}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {hasRussian && hasEnglish && (
                    <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveLang("ru")}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          activeLang === "ru"
                            ? "bg-rose-600 text-white"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        🇷🇺 RU
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveLang("en")}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          activeLang === "en"
                            ? "bg-rose-600 text-white"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        🇬🇧 EN
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                    title="Закрыть (Esc)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Плеер */}
              <div className="relative aspect-video w-full bg-black">
                {currentTrailer?.key ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${currentTrailer.key}?autoplay=1&rel=0&modestbranding=1`}
                    title={currentTrailer.name || "Трейлер"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">
                    Видео временно недоступно
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
