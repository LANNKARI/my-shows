// Only for idempotent reads. Never retry a purchase, claim, or progress mutation.
export async function privateFetch(
  url: string,
  signal?: AbortSignal,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(8000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (response.status < 500 || attempt === 1) return response;
    } catch (error) {
      if (signal?.aborted || attempt === 1) throw error;
    }
    if (signal?.aborted) throw signal.reason;
  }
}
