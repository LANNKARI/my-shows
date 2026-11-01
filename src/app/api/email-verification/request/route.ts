import {
  sameOrigin,
  registrationIpLimit,
  resendVerification,
  normalizedEmail,
} from "@/lib/email-verification";
import {
  verificationJson,
  verificationFailure,
} from "@/lib/verification-response";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await registrationIpLimit(request, "verification-resend", 15);
    const body = await request.json().catch(() => null);
    await resendVerification(normalizedEmail(body?.email));
    return verificationJson({
      message:
        "Если регистрация ожидает подтверждения, письмо будет отправлено. Проверьте почту и папку «Спам». Между отправками — не менее минуты.",
    });
  } catch (error) {
    return verificationFailure(error);
  }
}
