import { NextResponse } from "next/server";
import { VerificationError } from "./email-verification";
import { EmailError } from "./email-sender";
export const verificationJson = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
export function verificationFailure(error: unknown) {
  if (error instanceof VerificationError)
    return verificationJson(
      { error: error.message, verificationRequired: error.pending },
      error.status,
    );
  if (error instanceof EmailError)
    return verificationJson({ error: error.message }, 503);
  // Never log request bodies, raw tokens, passwords or provider responses.
  console.error("Email verification operation failed");
  return verificationJson(
    { error: "Не удалось завершить операцию. Попробуйте позже." },
    503,
  );
}
