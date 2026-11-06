"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "@/components/AccountAccess";
import Link from "next/link";
type Role = {
  id: string;
  name: string;
  color: string;
  icon: string;
  permissions: string[];
};
type Row = {
  id: string | number;
  username?: string;
  name?: string;
  siteOwner?: { id: number } | null;
  roles?: { role: Role; expiresAt: string | null }[];
  premiumPeriods?: { endsAt: string }[];
  code?: string;
  reward?: number;
  active?: boolean;
  redeemedCount?: number;
  maxActivations?: number | null;
  expiresAt?: string | null;
  startsAt?: string | null;
  text?: string;
  user?: { username: string };
  show?: { id: number; name: string };
  action?: string;
  target?: string;
  createdAt?: string;
};
const labels = {
  users: "Пользователи",
  promos: "Промокоды",
  comments: "Комментарии",
  audit: "Журнал действий",
};
const actionNames: Record<string, string> = {
  ownerBootstrap: "Закрепление владельца сайта",
  roleSave: "Настройка роли",
  roleDelete: "Удаление роли",
  roleGrant: "Выдача роли",
  roleRevoke: "Отзыв роли",
  premiumGrant: "Подарок Premium",
  premiumRevoke: "Отключение Premium",
  promoCreate: "Создание промокода",
  promoToggle: "Изменение промокода",
  commentDelete: "Удаление комментария",
  pickCreate: "Создание подборки",
  pickUpdate: "Обновление подборки",
};
const permissions = {
  moderate_comments: "Удаление комментариев",
  curate: "Куратор подборок",
  beta: "Тестовые функции",
};
export default function AdminPage() {
  const { account, loading } = useAccount();
  const [tab, setTab] = useState<keyof typeof labels>("users"),
    [query, setQuery] = useState(""),
    [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [data, setData] = useState<{
      items: Row[];
      roles: Role[];
      hasMore: boolean;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [fetching, setFetching] = useState(false),
    [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null),
    [roleId, setRoleId] = useState(""),
    [expiry, setExpiry] = useState(""),
    [periods, setPeriods] = useState(1),
    [role, setRole] = useState<Role | null>(null),
    [roleForm, setRoleForm] = useState(false);
  const lock = useRef(false),
    retry = useRef<{ signature: string; key: string } | null>(null);
  const visibleTab = account?.owner ? tab : "comments",
    allowed = !!(account?.owner || account?.moderate);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!allowed) return;
      setFetching(true);
      try {
        const r = await fetch(
          `/api/admin?tab=${visibleTab}&q=${encodeURIComponent(q)}&offset=${offset}`,
          { cache: "no-store", signal },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Не удалось загрузить");
        if (!signal?.aborted) setData(d);
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : "Ошибка соединения");
      } finally {
        if (!signal?.aborted) setFetching(false);
      }
    },
    [allowed, visibleTab, q, offset],
  );
  useEffect(() => {
    const abort = new AbortController();
    const t = setTimeout(() => void load(abort.signal), 0);
    return () => {
      clearTimeout(t);
      abort.abort();
    };
  }, [load, revision]);
  async function mutate(body: Record<string, unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const signature = JSON.stringify(body);
    if (retry.current?.signature !== signature)
      retry.current = { signature, key: crypto.randomUUID() };
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestKey: retry.current.key }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось сохранить");
      retry.current = null;
      setNotice("Изменения сохранены");
      setRoleForm(false);
      setSelected(null);
      setRevision((v) => v + 1);
      window.dispatchEvent(new Event("account-updated"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось подтвердить сохранение. Повторите действие.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function removeComment(id: string | number) {
    if (busy || !confirm("Удалить комментарий?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось удалить");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Проверяем доступ…</p>;
  if (!allowed)
    return (
      <div className="account-ui">
        <h1>Управление сайтом</h1>
        <p>Доступ только для администратора или модератора.</p>
        <Link className="account-button" href="/">
          На главную
        </Link>
      </div>
    );
  return (
    <div className="account-ui">
      <h1>Управление сайтом</h1>
      <p className="account-muted">
        {account?.owner
          ? "Роли пользователей, промокоды и модерация"
          : "Модерация комментариев"}
      </p>
      <div className="account-tabs">
        {(Object.keys(labels) as (keyof typeof labels)[])
          .filter((k) => account?.owner || k === "comments")
          .map((k) => (
            <button
              key={k}
              className={visibleTab === k ? "active" : ""}
              onClick={() => {
                setTab(k);
                setOffset(0);
                setData(null);
                setSelected(null);
                setError("");
              }}
            >
              {labels[k]}
            </button>
          ))}
      </div>
      <form
        className="account-actions"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(query.trim());
          setOffset(0);
        }}
      >
        <input
          aria-label="Поиск"
          placeholder={
            visibleTab === "users" ? "Поиск по нику или имени" : "Поиск"
          }
          maxLength={100}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="account-button">Найти</button>
        {visibleTab === "users" && (
          <button
            type="button"
            className="account-button"
            onClick={() => {
              setRole(null);
              setRoleForm(true);
            }}
          >
            + Создать роль
          </button>
        )}
      </form>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            className="account-button"
            onClick={() => setRevision((v) => v + 1)}
          >
            Обновить
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {fetching && <p role="status">Загрузка…</p>}
      {roleForm && (
        <form
          className="account-panel account-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void mutate({
              action: "roleSave",
              roleId: role?.id ?? null,
              name: f.get("name"),
              color: f.get("color"),
              icon: f.get("icon"),
              permissions: f.getAll("permissions"),
            });
          }}
        >
          <h2>{role ? "Редактировать роль" : "Новая роль"}</h2>
          <label>
            Название
            <input
              required
              maxLength={40}
              name="name"
              defaultValue={role?.name}
            />
          </label>
          <label>
            Значок
            <input
              required
              maxLength={8}
              name="icon"
              defaultValue={role?.icon || "✦"}
            />
          </label>
          <label>
            Цвет
            <input
              type="color"
              name="color"
              defaultValue={role?.color || "#9b76d1"}
            />
          </label>
          <fieldset>
            <legend>Разрешения</legend>
            {Object.entries(permissions).map(([k, v]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  name="permissions"
                  value={k}
                  defaultChecked={role?.permissions.includes(k)}
                />
                {v}
              </label>
            ))}
          </fieldset>
          <p className="account-muted">
            Выдача ролей и управление промокодами доступны только владельцу. У
            тестировщиков пока нет отдельных тестовых функций.
          </p>
          <div className="account-actions">
            <button className="account-button primary" disabled={busy}>
              Сохранить
            </button>
            <button
              type="button"
              className="account-button"
              onClick={() => setRoleForm(false)}
            >
              Отмена
            </button>
          </div>
        </form>
      )}
      {selected && (
        <section className="account-panel account-form">
          <h2>@{selected.username}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate({
                action: "roleGrant",
                userId: selected.id,
                roleId,
                expiresAt: expiry ? new Date(expiry).toISOString() : null,
              });
            }}
          >
            <label>
              Роль
              <select
                required
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">Выберите роль</option>
                {data?.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Срок роли (пусто — постоянно)
              <input
                type="datetime-local"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </label>
            <button className="account-button primary" disabled={busy}>
              Выдать роль
            </button>
          </form>
          <div className="account-actions">
            <label>
              Premium на
              <select
                value={periods}
                onChange={(e) => setPeriods(Number(e.target.value))}
              >
                {[1, 2, 3, 6, 12].map((n) => (
                  <option value={n} key={n}>
                    {n * 30} дней
                  </option>
                ))}
              </select>
            </label>
            <button
              className="account-button"
              disabled={busy}
              onClick={() =>
                void mutate({
                  action: "premiumGrant",
                  userId: selected.id,
                  periods,
                })
              }
            >
              Подарить Premium
            </button>
            <button
              className="account-button"
              disabled={busy}
              onClick={() => {
                if (confirm("Отключить активный и будущие периоды Premium?"))
                  void mutate({ action: "premiumRevoke", userId: selected.id });
              }}
            >
              Отключить Premium
            </button>
            <button
              className="account-button"
              onClick={() => setSelected(null)}
            >
              Закрыть
            </button>
          </div>
        </section>
      )}
      {visibleTab === "promos" && (
        <form
          className="account-panel account-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void mutate({
              action: "promoCreate",
              code: f.get("code"),
              reward: Number(f.get("reward")),
              maxActivations: f.get("limit") ? Number(f.get("limit")) : null,
              startsAt: f.get("start")
                ? new Date(String(f.get("start"))).toISOString()
                : null,
              expiresAt: f.get("end")
                ? new Date(String(f.get("end"))).toISOString()
                : null,
            });
          }}
        >
          <h2>Создать промокод</h2>
          <div className="account-fields">
            <label>
              Код
              <input
                name="code"
                required
                minLength={3}
                maxLength={64}
                pattern="[A-Za-z0-9_-]+"
              />
            </label>
            <label>
              Награда, 🍿
              <input
                name="reward"
                type="number"
                required
                min={1}
                max={1000000}
              />
            </label>
            <label>
              Лимит активаций
              <input
                name="limit"
                type="number"
                min={1}
                max={1000000}
                placeholder="Без ограничения"
              />
            </label>
            <label>
              Начало действия
              <input name="start" type="datetime-local" />
            </label>
            <label>
              Действует до
              <input name="end" type="datetime-local" />
            </label>
          </div>
          <p className="account-muted">
            Одна активация на аккаунт. Даты вводятся в часовом поясе вашего
            устройства.
          </p>
          <button className="account-button primary" disabled={busy}>
            Создать промокод
          </button>
        </form>
      )}
      <div className="account-list" aria-busy={fetching}>
        {data?.items.map((row) => (
          <article className="account-panel" key={row.id}>
            {visibleTab === "users" ? (
              <>
                <div className="account-line">
                  <Link href={`/u/${row.username}`}>
                    <strong>{row.name || row.username}</strong>{" "}
                    <small>@{row.username}</small>
                  </Link>
                  <button
                    className="account-button"
                    disabled={busy}
                    onClick={() => {
                      setSelected(row);
                      setRoleId("");
                      setExpiry("");
                    }}
                  >
                    Изменить роли
                  </button>
                </div>
                <div className="account-actions">
                  {row.siteOwner && (
                    <span className="account-role">
                      ⚑ Администратор · постоянно 🔒
                    </span>
                  )}
                  {row.roles?.map((r) => (
                    <span
                      key={r.role.id}
                      className="account-role"
                      style={{ color: r.role.color }}
                    >
                      {r.role.icon} {r.role.name}
                      {r.expiresAt &&
                        ` · до ${new Date(r.expiresAt).toLocaleDateString("ru-RU")}`}{" "}
                      <button
                        aria-label={`Снять роль ${r.role.name}`}
                        disabled={busy}
                        onClick={() =>
                          void mutate({
                            action: "roleRevoke",
                            userId: row.id,
                            roleId: r.role.id,
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {row.premiumPeriods?.[0] && (
                    <span className="premium-chip">
                      ✦ Premium до{" "}
                      {new Date(
                        row.premiumPeriods[0].endsAt,
                      ).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                </div>
              </>
            ) : visibleTab === "promos" ? (
              <>
                <div className="account-line">
                  <h3>
                    {row.code} · {row.reward} 🍿
                  </h3>
                  <button
                    className="account-button"
                    disabled={busy}
                    onClick={() =>
                      void mutate({
                        action: "promoToggle",
                        promoId: row.id,
                        active: !row.active,
                      })
                    }
                  >
                    {row.active ? "Отключить" : "Включить"}
                  </button>
                </div>
                <p>
                  {row.active ? "Активен" : "Отключён"} · Активаций:{" "}
                  {row.redeemedCount} / {row.maxActivations ?? "∞"}
                </p>
                {row.expiresAt && (
                  <small>
                    До {new Date(row.expiresAt).toLocaleString("ru-RU")}
                  </small>
                )}
              </>
            ) : visibleTab === "comments" ? (
              <>
                <div className="account-line">
                  <strong>@{row.user?.username}</strong>
                  <button
                    className="account-button"
                    disabled={busy}
                    onClick={() => void removeComment(row.id)}
                  >
                    Удалить комментарий
                  </button>
                </div>
                <p className="account-comment">{row.text}</p>
                <Link href={`/show/${row.show?.id}`}>{row.show?.name}</Link>
              </>
            ) : (
              <>
                <strong>{actionNames[row.action!] || row.action}</strong>
                <p>Объект: {row.target}</p>
                <time>{new Date(row.createdAt!).toLocaleString("ru-RU")}</time>
              </>
            )}
          </article>
        ))}
      </div>
      {!fetching && data?.items.length === 0 && <p>Ничего не найдено.</p>}
      <div className="account-actions">
        <button
          className="account-button"
          disabled={offset === 0 || fetching}
          onClick={() => setOffset((v) => Math.max(0, v - 30))}
        >
          ← Назад
        </button>
        <button
          className="account-button"
          disabled={!data?.hasMore || fetching}
          onClick={() => setOffset((v) => v + 30)}
        >
          Далее →
        </button>
      </div>
      {visibleTab === "users" && (
        <section className="account-panel">
          <h2>Настроенные роли</h2>
          <p className="account-muted">
            Администратор закреплён за владельцем и не выдаётся через эту форму.
          </p>
          {data?.roles.map((r) => (
            <div className="account-line" key={r.id}>
              <span>
                {r.icon} {r.name}
              </span>
              <div className="account-actions">
                <button
                  className="account-button"
                  onClick={() => {
                    setRole(r);
                    setRoleForm(true);
                  }}
                >
                  Редактировать
                </button>
                <button
                  className="account-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(`Удалить роль «${r.name}» у всех пользователей?`)
                    )
                      void mutate({ action: "roleDelete", roleId: r.id });
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
