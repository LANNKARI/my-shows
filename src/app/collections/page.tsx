"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type C = { id: number; name: string; items: { id: number }[] };

export default function CollectionsPage() {
  const [items, setItems] = useState<C[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const r = await fetch("/api/collections");
    setItems(await r.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Коллекции</h1>

      <div className="flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="Название коллекции"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary" onClick={create}>
          Создать
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-400">Пока нет коллекций.</p>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/collection/${c.id}`}
              className="card p-4 block hover:bg-neutral-800/60 transition"
            >
              <div className="text-lg font-medium">📁 {c.name}</div>
              <div className="text-sm text-neutral-400 mt-1">
                {c.items.length} тайтл(ов)
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}