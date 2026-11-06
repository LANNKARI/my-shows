"use client";
import { AccountName, useAccount } from "./AccountAccess";
import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import CosmeticAvatar from "./CosmeticAvatar";
export type CommentRecord = {
  id: number;
  text: string;
  createdAt?: string;
  user?: {
    id?: string;
    name?: string | null;
    username?: string;
    avatarUrl?: string | null;
    avatarFrame?: string | null;
  };
};
export interface CommentSectionProps {
  showId?: number;
  titleId?: number;
  initialComments?: CommentRecord[];
}
export default function CommentSection({
  showId,
  titleId,
  initialComments = [],
}: CommentSectionProps) {
  const { data: session } = useSession();
  const {account}=useAccount();
  const [deleting,setDeleting]=useState<number|null>(null);
  const [comments, setComments] = useState(initialComments),
    [text, setText] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const target = showId ?? titleId;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !text.trim() || !target || !session?.user) return;
    lock.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/shows/${target}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Не удалось отправить комментарий");
      const comment: CommentRecord = data.comment || data;
      if (!comment.id)
        throw new Error(
          "Не удалось подтвердить публикацию. Обновите страницу.",
        );
      setComments((previous) => [comment, ...previous]);
      setText("");
    } catch (error) {
      setError(
        error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось подтвердить публикацию. Обновите страницу перед повтором.",
      );
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }
  async function remove(id:number){
    if(deleting!==null||!window.confirm('Удалить комментарий?'))return;
    setDeleting(id);setError('');try{const r=await fetch(`/api/comments/${id}`,{method:'DELETE'});const d=await r.json();if(!r.ok)throw Error(d.error||'Не удалось удалить');setComments(previous=>previous.filter(c=>c.id!==id));}catch(e){setError(e instanceof Error?e.message:'Ошибка соединения')}finally{setDeleting(null)}
  }
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">
        Отзывы и обсуждения{" "}
        <span className="text-xs font-normal text-neutral-500">
          ({comments.length})
        </span>
      </h2>
      {session?.user ? (
        <form onSubmit={submit} className="space-y-3">
          <textarea
            disabled={submitting}
            aria-label="Комментарий"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Поделитесь впечатлениями о фильме или сериале (без спойлеров)..."
            maxLength={1000}
            rows={3}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-3 text-sm focus:outline-2 focus:outline-rose-400"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-4 py-3 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              {submitting ? "Отправка…" : "Опубликовать"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-neutral-400">
          Войдите, чтобы оставить комментарий.
        </p>
      )}
      {!comments.length ? (
        <p className="text-sm text-neutral-500">
          Пока нет отзывов. Будьте первым!
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const author = comment.user || {},
              name = author.name || author.username || "Пользователь";
            return (
              <article
                key={comment.id}
                className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <CosmeticAvatar
                      name={name}
                      src={author.avatarUrl}
                      frame={author.avatarFrame}
                      userId={author.id}
                      size={28}
                    />
                    <span className="text-xs font-semibold"><AccountName userId={author.id}>{name}</AccountName></span>
                  </div>
                  <time className="text-neutral-500 text-xs">
                    {comment.createdAt
                      ? new Date(comment.createdAt).toLocaleDateString(
                          "ru-RU",
                          { day: "numeric", month: "short", year: "numeric" },
                        )
                      : ""}
                  </time>
                </div>
                {(account?.moderate||(session?.user?.id&&session.user.id===author.id))&&<button className="action-button" disabled={deleting!==null} onClick={()=>void remove(comment.id)}>{deleting===comment.id?"Удаление…":"Удалить комментарий"}</button>}
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line break-words">
                  {comment.text}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
