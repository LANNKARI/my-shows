"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { CosmeticItem, CosmeticUser } from "@/lib/cosmetics";
import CosmeticAvatar from "./CosmeticAvatar";
import CosmeticCover from "./CosmeticCover";
export default function CosmeticConfirmation({
  item,
  user,
  busy,
  error,
  confirm,
  cancel,
  refresh,
}: {
  item: CosmeticItem;
  user: CosmeticUser;
  busy: boolean;
  error: string;
  confirm: () => void;
  cancel: () => void;
  refresh: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null),
    close = useRef(cancel),
    pending = useRef(busy);
  useEffect(() => {
    close.current = cancel;
    pending.current = busy;
  }, [cancel, busy]);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("[data-cancel]")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending.current) close.current();
      if (event.key !== "Tab") return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href]",
      );
      if (!controls?.length) {
        event.preventDefault();
        dialog.current?.focus();
        return;
      }
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
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keyboard);
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="cosmetics-ui cx-modal-backdrop"
      onClick={() => {
        if (!busy) cancel();
      }}
    >
      <div
        ref={dialog}
        className="cx-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cosmetic-confirm-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cosmetic-confirm-title">
          Купить {item.kind === "frame" ? "рамку" : "оформление"} «{item.name}»?
        </h2>
        <div className="cx-confirm-preview">
          {item.kind === "frame" ? (
            <CosmeticAvatar
              name={user.name || user.username}
              src={user.avatarUrl}
              frame={item.id}
              size={100}
            />
          ) : (
            <div className="cx-style-swatch">
              <CosmeticCover styleId={item.id} bannerUrl={user.bannerUrl} />
              <CosmeticAvatar
                name={user.name || user.username}
                src={user.avatarUrl}
                frame={user.avatarFrame}
                size={80}
              />
            </div>
          )}
        </div>
        <p className="cx-muted">
          Предмет останется в вашей коллекции. Применить его можно после
          покупки.
        </p>
        <div className="cx-price-rows">
          <div>
            <span>Стоимость</span>
            <strong>🍿 {item.price}</strong>
          </div>
          <div>
            <span>Сейчас</span>
            <span>{user.popcorn}</span>
          </div>
          <div>
            <span>После покупки</span>
            <strong>{Math.max(0, user.popcorn - item.price)}</strong>
          </div>
        </div>
        <p className="cx-muted">Попкорн спишется после подтверждения.</p>
        {error && (
          <div className="cx-error" role="alert">
            {error}
            <button className="cx-link" disabled={busy} onClick={refresh}>
              Обновить магазин
            </button>
          </div>
        )}
        <button
          className="cx-button cx-primary"
          disabled={busy || user.popcorn < item.price}
          aria-busy={busy}
          onClick={confirm}
        >
          {busy ? "Покупка…" : "Подтвердить покупку"}
        </button>
        <button
          data-cancel
          className="cx-button"
          disabled={busy}
          onClick={cancel}
        >
          Отмена
        </button>
      </div>
    </div>,
    document.body,
  );
}
