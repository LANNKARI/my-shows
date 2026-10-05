"use client";

import { useEffect, useState } from "react";

type Collection = {
  id: number;
  name: string;
  items: { titleId: number }[];
};

export default function CollectionPicker({ titleId }: { titleId: number }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newName, setNewName] = useState("");

  async function load() {
    const r = await fetch("/api/collections");
    const data = await r.json();
    setCollections(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(col: Collection) {
    const has = col.items.some((i) => i.titleId === titleId);
    if (has) {
      await fetch(`/api/collections/${col.id}/items?titleId=${titleId}`, {
        method: "DELETE",
      });
    } else {
      await fetch(`/api/collections/${col.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId }),
      });
    }
    load();
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    const r = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const c = await r.json();
    await fetch(`/api/collections/${c.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleId }),
    });
    setNewName("");
    load();
  }

  return (
    <div className="card p-5 space-y-4 bg-neutral-900/40">
      <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
        Коллекции
      </h3>

      {collections.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Пока нет коллекций. Создайте первую ниже.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {collections.map((c) => {
            const checked = c.items.some((i) => i.titleId === titleId);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  checked
                    ? "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-lg shadow-red-900/30"
                    : "bg-neutral-800/60 border border-white/5 text-neutral-300 hover:border-white/20"
                }`}
              >
                <span>{checked ? "✓" : "○"}</span>
                <span>📁 {c.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Новая коллекция"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createAndAdd();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={createAndAdd}
        >
          Создать
        </button>
      </div>
    </div>
  );
}