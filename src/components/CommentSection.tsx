'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

export interface CommentSectionProps {
  showId?: number;
  titleId?: number;
  initialComments?: any[];
}

export default function CommentSection({
  showId,
  titleId,
  initialComments = [],
}: CommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<any[]>(initialComments);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetShowId = showId ?? titleId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !targetShowId) return;

    if (!session?.user) {
      alert('Пожалуйста, войдите в аккаунт, чтобы оставить отзыв.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/shows/${targetShowId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setComments((prev) => [data.comment, ...prev]);
        }
        setText('');
      } else {
        // Запасной путь через общий роут /api/comments
        const fallbackRes = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showId: showId || undefined,
            titleId: titleId || undefined,
            text: text.trim(),
          }),
        });

        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData.comment) {
            setComments((prev) => [fallbackData.comment, ...prev]);
          }
          setText('');
        }
      }
    } catch (err) {
      console.error('Ошибка отправки комментария:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>💬 Отзывы и обсуждения</span>
          <span className="text-xs font-normal text-neutral-500">({comments.length})</span>
        </h2>
      </div>

      {/* Форма добавления комментария */}
      {session?.user ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Поделитесь впечатлениями о фильме или сериале (без спойлеров)..."
            rows={3}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-colors shadow-sm"
            >
              {submitting ? 'Отправка...' : 'Опубликовать'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl p-4 text-center text-xs text-neutral-400">
          Только авторизованные пользователи могут оставлять комментарии.
        </div>
      )}

      {/* Список комментариев */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">Пока нет отзывов. Будьте первым!</p>
        ) : (
          comments.map((comment: any) => {
            const author = comment.user || {};
            const authorName = author.name || author.username || 'Пользователь';
            const dateStr = comment.createdAt
              ? new Date(comment.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '';

            return (
              <div
                key={comment.id}
                className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-neutral-300 text-[10px]">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-neutral-200">{authorName}</span>
                  </div>
                  <span className="text-neutral-500 text-[11px]">{dateStr}</span>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                  {comment.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}