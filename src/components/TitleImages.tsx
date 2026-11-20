"use client";
/* eslint-disable @next/next/no-img-element -- Local uploads and TMDB images use the existing image delivery helper. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tmdbImageUrl, originalImageUrl } from "@/lib/tmdb-image";
import type { TitleImage } from "@/lib/title-images";
import "./title-images.css";

type Photo = { src: string; alt: string };
function FullImage({ photo }: { photo: Photo }) {
  const [state, setState] = useState("loading");
  return (
    <>
      {state === "loading" && (
        <p className="ti-status" role="status">
          Загружаем изображение…
        </p>
      )}
      {state === "error" && (
        <p className="ti-status" role="alert">
          Изображение недоступно. Попробуйте открыть его позже.
        </p>
      )}
      <img
        src={tmdbImageUrl(photo.src)}
        alt={photo.alt}
        draggable={false}
        className="ti-full-image"
        style={{ opacity: state === "ready" ? 1 : 0 }}
        onLoad={() => setState("ready")}
        onError={() => setState("error")}
      />
    </>
  );
}
function ImageViewer({
  photos,
  initial,
  onClose,
}: {
  photos: Photo[];
  initial: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initial);
  const dialog = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const step = (direction: number) =>
    setIndex((value) => (value + direction + photos.length) % photos.length);
  useEffect(() => {
    const element = dialog.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="ti-viewer"
      aria-label="Просмотр изображений"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (
          photos.length > 1 &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ) {
          event.preventDefault();
          step(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <header className="ti-viewer-head">
        <span>{photos[index].alt}</span>
        <button
          type="button"
          className="ti-close"
          aria-label="Закрыть изображение"
          autoFocus
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div
        className="ti-stage"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={(event) => {
          const p = event.touches[0];
          touch.current = { x: p.clientX, y: p.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          touch.current = null;
          const p = event.changedTouches[0];
          if (
            start &&
            photos.length > 1 &&
            Math.abs(p.clientX - start.x) > 50 &&
            Math.abs(p.clientX - start.x) > Math.abs(p.clientY - start.y) * 1.2
          )
            step(p.clientX < start.x ? 1 : -1);
        }}
      >
        <FullImage key={photos[index].src} photo={photos[index]} />
      </div>
      {photos.length > 1 && (
        <footer className="ti-viewer-controls">
          <button
            type="button"
            aria-label="Предыдущий кадр"
            onClick={() => step(-1)}
          >
            ←
          </button>
          <span aria-live="polite">
            {index + 1} / {photos.length}
          </span>
          <button
            type="button"
            aria-label="Следующий кадр"
            onClick={() => step(1)}
          >
            →
          </button>
        </footer>
      )}
    </dialog>,
    document.body,
  );
}
export function PosterImage({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="ti-poster"
        aria-label={`Открыть постер: ${title}`}
        onClick={() => setOpen(true)}
      >
        <img
          className="td-poster"
          src={tmdbImageUrl(src)}
          alt={`Постер: ${title}`}
        />
        <span className="ti-expand" aria-hidden="true">
          ⤢
        </span>
      </button>
      {open && (
        <ImageViewer
          photos={[{ src: originalImageUrl(src), alt: `Постер: ${title}` }]}
          initial={0}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
export default function TitleImages({
  showId,
  title,
}: {
  showId: number;
  title: string;
}) {
  const [images, setImages] = useState<TitleImage[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/shows/${showId}/images`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.images))
          throw Error("Не удалось загрузить кадры");
        return data.images;
      })
      .then((data) => {
        if (!controller.signal.aborted) setImages(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Не удалось загрузить кадры.");
      });
    return () => controller.abort();
  }, [showId, attempt]);
  if (images?.length === 0) return null;
  return (
    <section className="ti-gallery" aria-label="Кадры из фильма или сериала">
      <div className="ti-heading">
        <h2>Кадры</h2>
        {!!images?.length && <span>{images.length}</span>}
      </div>
      {!images && !error && (
        <p className="td-muted" role="status">
          Загружаем кадры…
        </p>
      )}
      {error && (
        <p className="td-muted" role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => {
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Повторить
          </button>
        </p>
      )}
      <div className="ti-grid">
        {images?.map((image, index) => (
          <button
            type="button"
            key={image.original}
            aria-label={`Открыть кадр ${index + 1}: ${title}`}
            onClick={() => setActive(index)}
          >
            <img
              src={tmdbImageUrl(image.thumbnail)}
              alt={`Кадр ${index + 1} из «${title}»`}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className="ti-expand" aria-hidden="true">
              ⤢
            </span>
          </button>
        ))}
      </div>
      {active !== null && images && (
        <ImageViewer
          photos={images.map((image, index) => ({
            src: image.original,
            alt: `${title} · Кадр ${index + 1}`,
          }))}
          initial={active}
          onClose={() => setActive(null)}
        />
      )}
    </section>
  );
}
