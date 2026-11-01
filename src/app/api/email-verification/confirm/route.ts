import {
  sameOrigin,
  registrationIpLimit,
  confirmRegistration,
} from "@/lib/email-verification";
import {
  verificationJson,
  verificationFailure,
} from "@/lib/verification-response";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await registrationIpLimit(request, "verification-confirm", 30);
    const body = await request.json().catch(() => null);
    await confirmRegistration(body?.token);
    return verificationJson({ success: true });
  } catch (error) {
    return verificationFailure(error);
  }
}
