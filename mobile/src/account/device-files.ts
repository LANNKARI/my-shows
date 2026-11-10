import { readBackupJson } from "./backup-json";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
export async function pickBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > 2 * 1024 * 1024)
      throw Error("Максимальный размер файла — 2 МБ.");
    return {
      name: asset.name,
      backup: readBackupJson(await file.text()),
    };
  } finally {
    try {
      if (file.exists) await file.delete();
    } catch {
      /* The OS also clears temporary cache files. */
    }
  }
}
export async function pickAvatar() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.fileSize || 0) > 10 * 1024 * 1024)
    throw Error("Максимальный размер фото — 10 МБ.");
  const form = new FormData();
  form.append("file", {
    uri: asset.uri,
    name: asset.fileName || "avatar.jpg",
    type: asset.mimeType || "image/jpeg",
  } as unknown as Blob);
  return form;
}
export async function saveBackup(data: unknown) {
  if (!(await Sharing.isAvailableAsync()))
    throw Error(
      "Сохранение файлов через меню «Поделиться» недоступно на устройстве.",
    );
  const file = new File(
    Paths.cache,
    `episyhub-library-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
  await file.write(JSON.stringify(data, null, 2));
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Сохранить библиотеку EpisyHub",
    UTI: "public.json",
  });
}
