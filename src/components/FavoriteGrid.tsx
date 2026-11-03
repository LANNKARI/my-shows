import Link from "next/link";
import { tmdbImageUrl } from "@/lib/tmdb-image";
import type { FavoriteTitle } from "@/lib/favorites";
import "./favorites.css";
export default function FavoriteGrid({ items }: { items: FavoriteTitle[] }) {
  return <div className="favorites-grid">{items.map(item => <article className="favorite-card" key={item.id} aria-label={item.name}>
    <Link href={`/show/${item.showId}?type=${item.kind === "movie" ? "movie" : "tv"}`} className="favorite-poster" aria-label={`Открыть карточку: ${item.name}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Existing external posters. */}
      {item.posterUrl ? <img loading="lazy" src={tmdbImageUrl(item.posterUrl)} alt={item.name} /> : <span className="favorite-no-poster">Нет постера</span>}
      <span className="favorite-rank">#{item.rank}</span>{!!item.rating && <span className="favorite-rating">★ {item.rating}</span>}
    </Link>
    <div className="favorite-info"><span>{item.year}</span><Link href={`/show/${item.showId}?type=${item.kind === "movie" ? "movie" : "tv"}`}>{item.name}</Link></div>
  </article>)}</div>;
}
