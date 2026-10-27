// Best-effort per-instance limit. Deployments with multiple instances should also
// enforce a shared rate limit at their edge; this map is not a global counter.
const attempts = new Map<string, { count: number; until: number }>();
export function passwordAttempt(userId: string, now = Date.now()) {
  for (const [id, value] of attempts)
    if (value.until <= now) attempts.delete(id);
  const current = attempts.get(userId);
  if (current && current.count >= 5)
    return Math.ceil((current.until - now) / 1000);
  if (current) current.count++;
  else {
    if (attempts.size >= 10000) return 60;
    attempts.set(userId, { count: 1, until: now + 15 * 60 * 1000 });
  }
  return 0;
}
