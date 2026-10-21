export const LIBRARY_STATUSES = ['watching', 'planned', 'completed', 'dropped'] as const;

export function validateLibraryInput(body: Record<string, unknown>): string | null {
  if (body.status !== undefined && !LIBRARY_STATUSES.includes(body.status as typeof LIBRARY_STATUSES[number])) {
    return 'Некорректный статус просмотра';
  }
  if (body.score !== undefined && body.score !== null &&
      (typeof body.score !== 'number' || !Number.isInteger(body.score) || body.score < 1 || body.score > 10)) {
    return 'Оценка должна быть целым числом от 1 до 10';
  }
  return null;
}
