"use client";
/* eslint-disable @next/next/no-img-element -- Local blob preview is encoded before upload. */
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountAccess";
import FilePicker from "./FilePicker";
import styles from "./ProfileBannerEditor.module.css";
export default function ProfileBannerEditor({
  username,
  onSaved,
}: {
  username: string;
  onSaved: (url: string | null) => void;
}) {
  const { account } = useAccount();
  const [open, setOpen] = useState(false),
    [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  if (!account?.premium.active) return null;
  async function choose(file: File) {
    const ticket = ++generation.current;
    if (lock.current) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Максимальный размер — 10 МБ");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("Выберите JPEG, PNG или WebP");
      const image = await createImageBitmap(file);
      if (image.width * image.height > 40000000) {
        image.close();
        throw new Error("Изображение слишком большое по разрешению");
      }
      const ratio = 3;
      const cropW = Math.min(image.width, image.height * ratio),
        cropH = cropW / ratio;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(1920, cropW);
      canvas.height = Math.round(canvas.width / ratio);
      canvas
        .getContext("2d")!
        .drawImage(
          image,
          (image.width - cropW) / 2,
          (image.height - cropH) / 2,
          cropW,
          cropH,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      image.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error("Не удалось подготовить изображение")),
          "image/webp",
          0.86,
        ),
      );
      if (blob.size > 3500000)
        throw new Error("Выберите менее детализированное изображение");
      if (ticket === generation.current)
        setPreview({ url: URL.createObjectURL(blob), blob });
    } catch (e) {
      if (ticket === generation.current)
        setError(
          e instanceof Error ? e.message : "Не удалось открыть изображение",
        );
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  async function save(reset = false) {
    if (lock.current || (!reset && !preview)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let body: FormData | string;
      if (reset) body = JSON.stringify({ action: "reset" });
      else {
        body = new FormData();
        body.append("file", preview!.blob, "banner.webp");
      }
      const r = await fetch(
        `/api/users/${encodeURIComponent(username)}/banner`,
        {
          method: "POST",
          headers: reset ? { "Content-Type": "application/json" } : undefined,
          body,
          signal: AbortSignal.timeout(30000),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Не удалось сохранить шапку");
      onSaved(d.bannerUrl);
      setPreview(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить шапку");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          setOpen((v) => !v);
          setError("");
        }}
      >
        ▧ Изменить шапку
      </button>
      {open && (
        <section className={styles.editor} aria-label="Изменение шапки профиля">
          <h2>Ваша шапка профиля</h2>
          <p>
            JPEG, PNG или WebP · до 10 МБ. Центр изображения будет обрезан до
            формата 3:1.
          </p>
          {preview && (
            <img
              className={styles.preview}
              src={preview.url}
              alt="Предпросмотр шапки"
            />
          )}
          <FilePicker
            accept="image/jpeg,image/png,image/webp"
            label="Выбрать изображение"
            disabled={busy}
            onFile={choose}
          />
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy || !preview}
              onClick={() => void save()}
            >
              {busy ? "Подготовка…" : "Сохранить шапку"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
            >
              Вернуть стандартную
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                generation.current++;
                setOpen(false);
                setPreview(null);
                setError("");
              }}
            >
              Отмена
            </button>
          </div>
          <small>
            Шапка видна, пока активен Premium. После продления она восстановится
            автоматически.
          </small>
        </section>
      )}
    </div>
  );
}
