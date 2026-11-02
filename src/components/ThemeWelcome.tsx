import Link from "next/link";

export default function ThemeWelcome() {
  return (
    <section className="theme-welcome" aria-labelledby="welcome-heading">
      <div className="theme-welcome-copy">
        <p className="theme-eyebrow">Твоя история в мире кино</p>
        <h1 id="welcome-heading">Хорошие истории.<br />В твоём ритме.</h1>
        <p className="theme-welcome-description">Фильмы, сериалы и маленькие открытия. Сохраняй, отмечай просмотренное и делись впечатлениями.</p>
        <Link href="/watching" className="btn btn-primary">В мою библиотеку <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 17 17 7M7 7h10v10" /></svg></Link>
      </div>
      <div className="theme-art" aria-hidden="true">
        <div className="theme-planet" /><div className="theme-orbit" />
        <div className="theme-ticket"><strong>Ещё одна серия?</strong><span>Твоё кино всегда рядом &nbsp; ✦</span></div>
      </div>
    </section>
  );
}
