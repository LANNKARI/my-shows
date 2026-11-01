export class EmailError extends Error {}
export function emailConfiguration() {
  const apiKey = process.env.UNISENDER_GO_API_KEY?.trim();
  const from = process.env.EMAIL_FROM;
  const name = process.env.EMAIL_FROM_NAME || "EpisyHub";
  const app = new URL(process.env.APP_URL || "https://episyhub.space");
  if (
    !apiKey ||
    !from ||
    !/^\S+@\S+\.\S+$/.test(from) ||
    app.username ||
    app.password ||
    (app.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["127.0.0.1", "localhost"].includes(app.hostname)
      ))
  )
    throw new EmailError("Отправка писем ещё не настроена");
  const endpoint = new URL(
    process.env.UNISENDER_GO_API_URL ||
      "https://go2.unisender.ru/ru/transactional/api/v1/email/send.json",
  );
  const testLocal =
    process.env.NODE_ENV !== "production" &&
    ["127.0.0.1", "localhost"].includes(endpoint.hostname) &&
    endpoint.protocol === "http:";
  if (
    !testLocal &&
    (endpoint.protocol !== "https:" ||
      !["go1.unisender.ru", "go2.unisender.ru"].includes(endpoint.hostname) ||
      endpoint.pathname !== "/ru/transactional/api/v1/email/send.json" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search)
  )
    throw new EmailError("Некорректный адрес сервера отправки");
  return {
    apiKey,
    from,
    name,
    origin: app.origin,
    endpoint: endpoint.toString(),
  };
}
export async function sendVerificationEmail(
  email: string,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  const config = emailConfiguration();
  const link = `${config.origin}/verify-email#token=${token}`;
  let response: Response;
  try {
    response = await fetcher(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": config.apiKey,
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        message: {
          recipients: [{ email }],
          from_email: config.from,
          from_name: config.name,
          subject: "Подтвердите почту для EpisyHub",
          body: {
            plaintext: `Вы начали регистрацию в EpisyHub. Подтвердите почту: ${link}\nСсылка действует 24 часа. Если вы не регистрировались, просто проигнорируйте письмо.`,
          },
          track_links: 0,
          track_read: 0,
        },
      }),
    });
  } catch {
    throw new EmailError(
      "Не удалось подтвердить отправку письма. Попробуйте повторную отправку позже.",
    );
  }
  const result: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !result ||
    typeof result !== "object" ||
    !("status" in result) ||
    result.status !== "success"
  )
    throw new EmailError(
      "Почтовый сервис временно не принял письмо. Попробуйте позже.",
    );
}
