export function readBackupJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error();
    return value;
  } catch {
    throw Error(
      "Не удалось прочитать файл. Выберите JSON-файл экспорта EpisyHub.",
    );
  }
}
