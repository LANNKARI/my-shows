"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CosmeticAvatar from "@/components/CosmeticAvatar";
import CosmeticCover from "@/components/CosmeticCover";
import CosmeticConfirmation from "@/components/CosmeticConfirmation";
import {
  type CosmeticItem,
  type CosmeticKind,
  type CosmeticsData,
} from "@/lib/cosmetics";
import "@/components/cosmetics.css";
export default function CosmeticsPage() {
  const { data: session, status, update } = useSession();
  const userId = session?.user?.id;
  if (status === "loading" && !userId)
    return <p role="status">Загрузка магазина…</p>;
  return userId ? (
    <Shop
      key={userId}
      refreshSession={async () => {
        await update();
      }}
    />
  ) : (
    <div className="cosmetics-ui">
      <h1>Оформление</h1>
      <p className="cx-muted my-4">
        Войдите, чтобы примерять и сохранять оформление за попкорн.
      </p>
      <Link className="cx-button cx-primary" href="/login">
        Войти
      </Link>
    </div>
  );
}
function Shop({ refreshSession }: { refreshSession: () => Promise<void> }) {
  const [data, setData] = useState<CosmeticsData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"shop" | "collection">("shop"),
    [category, setCategory] = useState<CosmeticKind>("frame");
  const [preview, setPreview] = useState<string | null>(null),
    [tryFrame, setTryFrame] = useState<string | null>(null),
    [tryProfile, setTryProfile] = useState<string | null>(null),
    [quote, setQuote] = useState<CosmeticItem | null>(null),
    [reload, setReload] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/cosmetics", { signal: abort.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Не удалось загрузить магазин");
        return result;
      })
      .then((result) => {
        if (!abort.signal.aborted) setData(result);
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить магазин",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [reload]);
  function refresh() {
    if (lock.current) return;
    setQuote(null);
    setLoading(true);
    setError("");
    setReload((value) => value + 1);
  }
  function stopPreview() {
    if (lock.current) return;
    setPreview(null);
    setTryFrame(null);
    setTryProfile(null);
    setQuote(null);
    setError("");
  }
  function startPreview(item: CosmeticItem) {
    if (lock.current) return;
    setError("");
    setNotice("");
    setPreview(item.id);
    if (item.kind === "frame") setTryFrame(item.id);
    else setTryProfile(item.id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function mutate(action: "purchase" | "equip", item: CosmeticItem) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          itemId: item.id,
          ...(action === "purchase" ? { expectedPrice: item.price } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не удалось сохранить изменение");
      setData((previous) =>
        previous
          ? {
              ...previous,
              user: result.user,
              purchases:
                result.purchase &&
                !previous.purchases.some(
                  (old) => old.itemId === result.purchase.itemId,
                )
                  ? [result.purchase, ...previous.purchases]
                  : previous.purchases,
            }
          : previous,
      );
      setQuote(null);
      if (action === "purchase") {
        setNotice(
          result.alreadyOwned
            ? "Предмет уже в коллекции. Повторного списания нет."
            : "Покупка сохранена в коллекции. Теперь можно применить предмет.",
        );
        window.dispatchEvent(new Event("popcorn-updated"));
      } else {
        setNotice(
          "Оформление применено. Его видно в профиле; рамку — также в комментариях.",
        );
        setPreview(null);
        setTryFrame(null);
        setTryProfile(null);
        window.dispatchEvent(new Event("cosmetics-updated"));
        await refreshSession().catch(() => undefined);
      }
    } catch (error) {
      setError(
        error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось подтвердить сохранение. Обновите магазин: завершённая покупка не оплачивается повторно.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (loading && !data) return <p role="status">Загрузка магазина…</p>;
  if (!data)
    return (
      <div className="cosmetics-ui">
        <h1>Магазин недоступен</h1>
        <p className="cx-error" role="alert">
          {error}
        </p>
        <button className="cx-button" onClick={refresh}>
          Повторить загрузку
        </button>
      </div>
    );
  const { user, catalog, purchases, stats } = data;
  const active = catalog.find((item) => item.id === preview),
    owned = new Set(purchases.map((item) => item.itemId));
  const selectedId = (kind: CosmeticKind) =>
    kind === "frame" ? user.avatarFrame : user.profileStyle;
  const isOwned = (item: CosmeticItem) =>
    item.price === 0 || owned.has(item.id);
  const shown = catalog.filter(
    (item) => item.kind === category && (tab === "shop" || isOwned(item)),
  );
  const avatar = tryFrame || user.avatarFrame,
    style = tryProfile || user.profileStyle;
  return (
    <div className="cosmetics-ui">
      <Link
        className="cx-link"
        href={`/u/${encodeURIComponent(user.username)}`}
      >
        ← Назад в профиль
      </Link>
      <div className="cx-heading">
        <div>
          <h1>Оформление</h1>
          <p className="cx-muted">
            Выберите свой стиль за заработанный попкорн
          </p>
        </div>
        <p
          className="cx-balance"
          aria-label={`Баланс: ${user.popcorn} попкорна`}
        >
          🍿 {user.popcorn}
        </p>
      </div>
      {notice && (
        <p className="cx-notice" role="status">
          {notice}
        </p>
      )}
      {!quote && error && (
        <div className="cx-error" role="alert">
          {error}
          <button
            className="cx-link"
            disabled={busy || loading}
            onClick={refresh}
          >
            Обновить магазин
          </button>
        </div>
      )}
      {loading && (
        <p className="cx-muted" role="status">
          Обновление магазина…
        </p>
      )}
      {active ? (
        <>
          <section className="cx-preview-banner">
            <div>
              <h2>Режим примерки</h2>
              <p className="cx-muted">
                Изменения видны только вам до применения.
              </p>
            </div>
            <button className="cx-button" disabled={busy} onClick={stopPreview}>
              Отменить примерку
            </button>
          </section>
          <div className="cx-preview-layout">
            <div>
              <section
                className="cx-profile-preview"
                aria-label="Предпросмотр профиля"
              >
                <CosmeticCover styleId={style} bannerUrl={user.bannerUrl} />
                <div className="cx-profile-content">
                  <div className="cx-profile-identity">
                    <CosmeticAvatar
                      name={user.name || user.username}
                      src={user.avatarUrl}
                      frame={avatar}
                      size={112}
                    />
                    <div>
                      <h2>{user.name || user.username}</h2>
                      <p className="cx-muted">@{user.username}</p>
                      {user.bio && <p className="cx-muted mt-3">{user.bio}</p>}
                    </div>
                  </div>
                  <div className="cx-profile-stats">
                    <span>
                      Фильмы <strong>{stats.moviesCount}</strong>
                    </span>
                    <span>
                      Сериалы <strong>{stats.seriesCount}</strong>
                    </span>
                    <span>
                      Оценки <strong>{stats.ratingsCount}</strong>
                    </span>
                    <span>
                      Часы ≈ <strong>{stats.hoursWatched}</strong>
                    </span>
                  </div>
                  <p className="cx-profile-cover-note">
                    Рамка и оформление приобретаются и применяются отдельно.
                    Личная обложка доступна в стандартном оформлении.
                  </p>
                </div>
              </section>
              <section
                className="cx-comment-preview"
                aria-label="Предпросмотр рамки в комментарии"
              >
                <h2>Так рамка выглядит в комментариях</h2>
                <div>
                  <CosmeticAvatar
                    name={user.name || user.username}
                    src={user.avatarUrl}
                    frame={avatar}
                    size={32}
                  />
                  <p>
                    <strong>{user.name || user.username}</strong>
                    <span className="block cx-muted">
                      Это пример комментария, он не публикуется.
                    </span>
                  </p>
                </div>
              </section>
            </div>
            <aside className="cx-preview-panel">
              <p className="cx-muted">
                {active.kind === "frame"
                  ? "Рамка аватара"
                  : "Оформление профиля"}
              </p>
              <h2>{active.name}</h2>
              <p className="cx-muted">{active.description}</p>
              <div className="cx-price-rows">
                <div>
                  <span>{isOwned(active) ? "В коллекции" : "Стоимость"}</span>
                  <strong>
                    {active.price === 0
                      ? "Бесплатно"
                      : isOwned(active)
                        ? "Куплено"
                        : `🍿 ${active.price}`}
                  </strong>
                </div>
                <div>
                  <span>Ваш баланс</span>
                  <strong>{user.popcorn}</strong>
                </div>
                {!isOwned(active) && (
                  <div>
                    <span>После покупки</span>
                    <strong>{Math.max(0, user.popcorn - active.price)}</strong>
                  </div>
                )}
              </div>
              {isOwned(active) ? (
                <button
                  className="cx-button cx-primary"
                  disabled={busy || selectedId(active.kind) === active.id}
                  onClick={() => void mutate("equip", active)}
                >
                  {selectedId(active.kind) === active.id
                    ? "Уже выбрано"
                    : active.kind === "frame"
                      ? "Надеть рамку"
                      : "Применить оформление"}
                </button>
              ) : (
                <button
                  className="cx-button cx-primary"
                  disabled={busy || user.popcorn < active.price}
                  onClick={() => {
                    setError("");
                    setQuote({ ...active });
                  }}
                >
                  Купить за {active.price} 🍿
                </button>
              )}
              {!isOwned(active) && user.popcorn < active.price && (
                <p className="cx-muted mt-3">
                  Не хватает {active.price - user.popcorn} попкорна. Можно
                  примерить бесплатно и вернуться позже.
                </p>
              )}
              <button
                className="cx-button"
                disabled={busy}
                onClick={stopPreview}
              >
                Вернуться в магазин
              </button>
              <div className="mt-6">
                <h2>Оформление профиля</h2>
                <div className="cx-swatches">
                  {catalog
                    .filter((item) => item.kind === "profile")
                    .map((item) => (
                      <button
                        key={item.id}
                        className="cx-swatch-button"
                        disabled={busy}
                        aria-pressed={style === item.id}
                        onClick={() => startPreview(item)}
                      >
                        <span className="cx-swatch-tile">
                          <CosmeticCover
                            styleId={item.id}
                            bannerUrl={user.bannerUrl}
                          />
                        </span>
                        <span>{item.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="cx-toolbar">
            <div className="cx-tabs" aria-label="Раздел оформления">
              <button
                aria-pressed={tab === "shop"}
                onClick={() => setTab("shop")}
              >
                Магазин
              </button>
              <button
                aria-pressed={tab === "collection"}
                onClick={() => setTab("collection")}
              >
                Моя коллекция
              </button>
            </div>
            <p className="cx-muted">Покупки остаются в вашей коллекции</p>
          </div>
          <div className="cx-tabs" aria-label="Категория оформления">
            <button
              aria-pressed={category === "frame"}
              onClick={() => setCategory("frame")}
            >
              Рамки
            </button>
            <button
              aria-pressed={category === "profile"}
              onClick={() => setCategory("profile")}
            >
              Профиль
            </button>
            <button disabled>Темы · Позже</button>
          </div>
          <div className="cx-grid">
            {shown.map((item) => {
              const selected = selectedId(item.kind) === item.id;
              return (
                <article
                  className="cx-card"
                  key={item.id}
                  aria-label={item.name}
                >
                  <h2>{item.name}</h2>
                  <div className="cx-card-preview">
                    {item.kind === "frame" ? (
                      <CosmeticAvatar
                        name={user.name || user.username}
                        src={user.avatarUrl}
                        frame={item.id}
                        size={120}
                      />
                    ) : (
                      <div className="cx-style-swatch">
                        <CosmeticCover
                          styleId={item.id}
                          bannerUrl={user.bannerUrl}
                        />
                        <CosmeticAvatar
                          name={user.name || user.username}
                          src={user.avatarUrl}
                          frame={user.avatarFrame}
                          size={64}
                        />
                      </div>
                    )}
                  </div>
                  <p
                    className={
                      selected ? "cx-selected" : isOwned(item) ? "cx-owned" : ""
                    }
                  >
                    {item.price === 0
                      ? "Бесплатно"
                      : isOwned(item)
                        ? "Куплено"
                        : `🍿 ${item.price}`}
                  </p>
                  <button
                    className={`cx-button ${selected ? "" : "cx-primary"}`}
                    disabled={busy || selected}
                    onClick={() => {
                      if (isOwned(item)) void mutate("equip", item);
                      else startPreview(item);
                    }}
                  >
                    {selected
                      ? "Выбрано"
                      : isOwned(item)
                        ? item.kind === "frame"
                          ? "Надеть"
                          : "Применить"
                        : "Примерить"}
                  </button>
                  {isOwned(item) && !selected && (
                    <button
                      className="cx-link justify-center"
                      disabled={busy}
                      onClick={() => startPreview(item)}
                    >
                      Примерить
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
      <section className="cx-earn">
        <div>
          <h2>Как получить попкорн</h2>
          <p className="cx-muted">Ежедневный бонус и игры</p>
        </div>
        <Link className="cx-link" href="/rewards">
          Перейти к наградам и играм →
        </Link>
      </section>
      {quote && (
        <CosmeticConfirmation
          item={quote}
          user={user}
          busy={busy}
          error={error}
          confirm={() => void mutate("purchase", quote)}
          cancel={() => {
            if (!busy) {
              setQuote(null);
              setError("");
            }
          }}
          refresh={refresh}
        />
      )}
    </div>
  );
}
