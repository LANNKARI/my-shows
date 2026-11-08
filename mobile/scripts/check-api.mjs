import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';

// Fail before spending a cloud build on an APK that cannot reach mobile login.
async function check() {
  const value = process.env.EXPO_PUBLIC_API_URL;
  if (!value) throw new Error('Задайте EXPO_PUBLIC_API_URL в профиле или окружении EAS.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Для APK нужен публичный HTTPS-origin API без пути и параметров доступа.');
  }
  const response = await globalThis.fetch(new URL('/api/mobile/session', url), {
    redirect: 'manual', cache: 'no-store', signal: globalThis.AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null);
  if (response.status !== 401 || body?.error !== 'Войдите в аккаунт') {
    throw new Error(`Мобильный API на ${url.origin} недоступен (HTTP ${response.status}). Разверните /api/mobile/session на публичном сервере; защищённый Preview не подходит для обычного APK.`);
  }
  console.log(`Mobile API ready: ${url.origin} (expected JSON 401 without session)`);
}
check().catch(error => { console.error(error.message); process.exitCode = 1; });
