"use client";
import { useRef, useState } from "react";
export default function PromoCodeForm({ onRedeemed }: { onRedeemed: () => void }) {
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const lock = useRef(false);
  return <section className="promo-code-panel" aria-labelledby="promo-heading">
    <div><h2 id="promo-heading">Есть промокод?</h2><p>Активируйте код и получите дополнительный попкорн</p></div>
    <form aria-label="Активация промокода" onSubmit={async event => {
      event.preventDefault(); if (lock.current || !code.trim()) return;
      lock.current = true; setBusy(true); setError(""); setMessage("");
      try {
        const response = await fetch("/api/promo-codes/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }), signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось активировать промокод");
        setMessage(`Промокод активирован: +${result.amount} 🍿. Баланс: ${result.balance} 🍿.`); setCode("");
        window.dispatchEvent(new Event("popcorn-updated")); onRedeemed();
      } catch (error) { setError(error instanceof Error && error.name === "Error" ? error.message : "Не удалось подтвердить активацию. Проверьте баланс перед повторной попыткой."); }
      finally { lock.current = false; setBusy(false); }
    }}>
      <label className="sr-only" htmlFor="promo-code">Промокод</label>
      <input id="promo-code" value={code} onChange={event => setCode(event.target.value)} placeholder="Введите промокод" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64} disabled={busy} />
      <button type="submit" disabled={busy || !code.trim()}>{busy ? "Проверяем…" : "Активировать"}</button>
    </form>
    {error && <p className="promo-code-feedback" role="alert">{error}</p>}
    {message && <p className="promo-code-feedback" role="status">{message}</p>}
  </section>;
}
