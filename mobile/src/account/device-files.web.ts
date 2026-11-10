import { readBackupJson } from "./backup-json";
function choose(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.onchange = () => finish(input.files?.[0] || null);
    input.addEventListener("cancel", () => finish(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
export async function pickBackup() {
  const file = await choose(".json,application/json,text/plain");
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024)
    throw Error("Максимальный размер файла — 2 МБ.");
  return { name: file.name, backup: readBackupJson(await file.text()) };
}
export async function pickAvatar() {
  const file = await choose("image/*");
  if (!file) return null;
  if (file.size > 10 * 1024 * 1024)
    throw Error("Максимальный размер фото — 10 МБ.");
  const form = new FormData();
  form.append("file", file);
  return form;
}
export async function saveBackup(data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "episyhub-library.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
