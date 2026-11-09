// Only durations and operation names: no bearer tokens or personal progress in logs.
export function progressTiming(operation: string) {
  const started = performance.now();
  let authenticated = started;
  return {
    authenticated() {
      authenticated = performance.now();
    },
    headers() {
      const ended = performance.now();
      const authMs = Math.round(authenticated - started);
      const mutationMs = Math.round(ended - authenticated);
      const totalMs = Math.round(ended - started);
      if (totalMs >= 1000)
        console.info("progress-timing", {
          operation,
          authMs,
          mutationMs,
          totalMs,
        });
      return {
        "Cache-Control": "no-store",
        "Server-Timing": `auth;dur=${authMs}, mutation;dur=${mutationMs}, total;dur=${totalMs}`,
      };
    },
  };
}
