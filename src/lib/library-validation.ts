export const LIBRARY_STATUSES = [
  "watching",
  "planned",
  "completed",
  "dropped",
] as const;

export function validateLibraryInput(
  body: Record<string, unknown>,
): string | null {
  if (
    body.status !== undefined &&
    !LIBRARY_STATUSES.includes(body.status as (typeof LIBRARY_STATUSES)[number])
  ) {
    return "Некорректный статус просмотра";
  }
  if (
    body.score !== undefined &&
    body.score !== null &&
    (typeof body.score !== "number" ||
      !Number.isInteger(body.score) ||
      body.score < 1 ||
      body.score > 10)
  ) {
    return "Оценка должна быть целым числом от 1 до 10";
  }
  if (body.isFavorite !== undefined && typeof body.isFavorite !== "boolean")
    return "Некорректное значение избранного";
  for (const key of ["dubbing", "watchSite"]) {
    if (
      body[key] !== undefined &&
      body[key] !== null &&
      (typeof body[key] !== "string" || (body[key] as string).length > 500)
    )
      return "Заметка должна быть строкой до 500 символов";
  }
  return null;
}
