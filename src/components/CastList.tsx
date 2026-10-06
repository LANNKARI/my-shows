"use client";

export type CastMember = {
  id: number;
  name: string;
  character: string | null;
  photoUrl: string | null;
};

export default function CastList({ cast }: { cast: CastMember[] | null }) {
  if (!cast || cast.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-widest text-neutral-500 font-semibold">
        👥 Актёры
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        {cast.map((a) => (
          <div key={a.id} className="shrink-0 w-28 text-center">
            {a.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.photoUrl}
                alt={a.name}
                loading="lazy"
                className="w-28 h-28 rounded-2xl object-cover border border-white/5"
              />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center text-3xl text-neutral-600">
                👤
              </div>
            )}
            <div className="text-xs font-medium mt-2 line-clamp-2 leading-tight">
              {a.name}
            </div>
            {a.character && (
              <div className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">
                {a.character}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}