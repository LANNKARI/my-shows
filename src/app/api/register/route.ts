import {
  sameOrigin,
  registrationIpLimit,
  startRegistration,
} from "@/lib/email-verification";
import {
  verificationJson,
  verificationFailure,
} from "@/lib/verification-response";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await registrationIpLimit(request, "register", 8);
    await startRegistration(await request.json().catch(() => null));
    return verificationJson(
      {
        verificationRequired: true,
        message:
          "Проверьте почту и подтвердите регистрацию. Ссылка действует 24 часа.",
      },
      202,
    );
  } catch (error) {
    return verificationFailure(error);
  }
}
