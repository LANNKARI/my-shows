export class EmailError extends Error {}
const providerReasons: Record<number, string> = {
  101: "API key missing",
  102: "Invalid API key or wrong data center",
  105: "API access disabled",
  106: "Account inactive",
  114: "Account not found",
  118: "Domain TXT missing",
  122: "DKIM missing",
  123: "Invalid DKIM",
  124: "DKIM mismatch",
  201: "Message body missing",
  202: "Sender missing",
  203: "Subject missing",
  204: "Invalid recipients",
  205: "Invalid sender",
  206: "Unverified sender domain",
  215: "Account cannot send",
  901: "Daily sending limit",
  902: "Free plan daily limit",
  903: "Free plan allows only owned domains or confirmed recipients",
  904: "Payment failed",
  905: "Plan quota exceeded",
  1003: "Sender not confirmed",
  1007: "Sender domain not confirmed",
};
export function emailRejection(httpStatus: number, result: unknown) {
  const raw =
    result && typeof result === "object" && "code" in result
      ? result.code
      : undefined;
  const code =
    (typeof raw === "number" ||
      (typeof raw === "string" && /^\d{3,4}$/.test(raw))) &&
    Number.isInteger(Number(raw)) &&
    Number(raw) >= 100 &&
    Number(raw) <= 9999
      ? Number(raw)
      : null;
  const reference = code ? `MAIL-${code}` : `MAIL-HTTP-${httpStatus}`;
  console.error("Unisender Go rejected email", {
    httpStatus,
    code,
    reason: code
      ? providerReasons[code] || "Unknown API code"
      : "Unexpected response",
  });
  return new EmailError(
    `Не удалось отправить письмо. Код поддержки: ${reference}.`,
  );
}
export function emailConfiguration() {
  const provider = (process.env.EMAIL_PROVIDER || "unisender")
    .trim()
    .toLowerCase();
  if (!["unisender", "smtpbz"].includes(provider))
    throw new EmailError("Неизвестный сервис отправки писем");
  const apiKey = (
    provider === "smtpbz"
      ? process.env.SMTPBZ_API_KEY
      : process.env.UNISENDER_GO_API_KEY
  )?.trim();
  const from = process.env.EMAIL_FROM?.trim();
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
    provider === "smtpbz"
      ? process.env.SMTPBZ_API_URL || "https://api.smtp.bz/v1/smtp/send"
      : process.env.UNISENDER_GO_API_URL ||
        "https://go2.unisender.ru/ru/transactional/api/v1/email/send.json",
  );
  const testLocal =
    process.env.NODE_ENV !== "production" &&
    ["127.0.0.1", "localhost"].includes(endpoint.hostname) &&
    endpoint.protocol === "http:";
  const permitted =
    provider === "smtpbz"
      ? endpoint.hostname === "api.smtp.bz" &&
        endpoint.pathname === "/v1/smtp/send"
      : ["go1.unisender.ru", "go2.unisender.ru"].includes(endpoint.hostname) &&
        endpoint.pathname === "/ru/transactional/api/v1/email/send.json";
  if (
    !testLocal &&
    (endpoint.protocol !== "https:" ||
      !permitted ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.port)
  )
    throw new EmailError("Некорректный адрес сервера отправки");
  return {
    provider,
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
  const plaintext = `Вы начали регистрацию в EpisyHub. Подтвердите почту: ${link}\nСсылка действует 24 часа. Если вы не регистрировались, просто проигнорируйте письмо.`;
  const escapedLink = link.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
  const payload =
    config.provider === "smtpbz"
      ? {
          name: config.name,
          from: config.from,
          to: email,
          subject: "Подтвердите почту для EpisyHub",
          html: `<!doctype html><html lang="ru"><body><h1>Подтвердите почту</h1><p>Вы начали регистрацию в EpisyHub.</p><p><a href="${escapedLink}">Подтвердить почту</a></p><p>Ссылка действует 24 часа. Если вы не регистрировались, проигнорируйте письмо.</p></body></html>`,
          text: plaintext,
        }
      : {
          message: {
            recipients: [{ email }],
            from_email: config.from,
            from_name: config.name,
            subject: "Подтвердите почту для EpisyHub",
            body: { plaintext },
            track_links: 0,
            track_read: 0,
          },
        };
  let response: Response;
  try {
    response = await fetcher(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(config.provider === "smtpbz"
          ? { Authorization: config.apiKey }
          : { "X-API-KEY": config.apiKey }),
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify(payload),
    });
  } catch {
    throw new EmailError(
      "Не удалось связаться с почтовым сервисом. Код поддержки: MAIL-NETWORK. Попробуйте позже.",
    );
  }
  const result: unknown = await response.json().catch(() => null);
  if (config.provider === "smtpbz") {
    // The official Swagger documents HTTP 200 as success, without a response body schema.
    const rejected =
      result &&
      typeof result === "object" &&
      (("error" in result && !!result.error) ||
        ("success" in result && result.success === false) ||
        ("status" in result &&
          (result.status === false ||
            result.status === "error" ||
            result.status === "failed")) ||
        ("result" in result && result.result === false));
    if (response.status !== 200 || rejected) {
      console.error("SMTP.bz rejected email", {
        httpStatus: response.status,
        explicitFailure: !!rejected,
      });
      throw new EmailError(
        `Не удалось отправить письмо. Код поддержки: MAIL-SMTPBZ-HTTP-${response.status}.`,
      );
    }
    return;
  }
  if (
    !response.ok ||
    !result ||
    typeof result !== "object" ||
    !("status" in result) ||
    result.status !== "success"
  )
    throw emailRejection(response.status, result);
}
