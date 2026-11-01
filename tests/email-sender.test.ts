import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sendVerificationEmail,
  emailConfiguration,
  EmailError,
  emailRejection,
} from "../src/lib/email-sender";
test("Unisender Go receives only the intended recipient and an untracked verification link", async () => {
  const keys = [
    "UNISENDER_GO_API_KEY",
    "EMAIL_FROM",
    "EMAIL_FROM_NAME",
    "APP_URL",
    "UNISENDER_GO_API_URL",
  ] as const;
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.UNISENDER_GO_API_KEY = "fixture";
    process.env.EMAIL_FROM = "noreply@episyhub.space";
    process.env.EMAIL_FROM_NAME = "EpisyHub";
    process.env.APP_URL = "https://episyhub.space";
    delete process.env.UNISENDER_GO_API_URL;
    const token = "a".repeat(64);
    let calls = 0;
    await sendVerificationEmail(
      "test@example.test",
      token,
      async (url, init) => {
        calls++;
        assert.equal(
          String(url),
          "https://go2.unisender.ru/ru/transactional/api/v1/email/send.json",
        );
        assert.equal(init?.method, "POST");
        assert.ok(init?.signal);
        const body = JSON.parse(String(init?.body));
        assert.equal(new Headers(init?.headers).get("X-API-KEY"), "fixture");
        assert.equal(
          new Headers(init?.headers).get("Accept"),
          "application/json",
        );
        assert.equal("api_key" in body, false);
        assert.deepEqual(body.message.recipients, [
          { email: "test@example.test" },
        ]);
        assert.equal(body.message.track_links, 0);
        assert.equal(body.message.track_read, 0);
        assert.match(
          body.message.body.plaintext,
          new RegExp(`/verify-email#token=${token}`),
        );
        return Response.json({ status: "success" });
      },
    );
    assert.equal(calls, 1);
    await assert.rejects(
      sendVerificationEmail("test@example.test", token, async () =>
        Response.json({ status: "error", message: "provider details" }),
      ),
      EmailError,
    );
    await assert.rejects(
      sendVerificationEmail("test@example.test", token, async () => {
        throw Error("timeout");
      }),
      EmailError,
    );
    process.env.UNISENDER_GO_API_URL = "https://attacker.example/send";
    assert.throws(emailConfiguration, EmailError);
    delete process.env.UNISENDER_GO_API_URL;
    process.env.APP_URL = "https://user:secret@example.test";
    assert.throws(emailConfiguration, EmailError);
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
});

test("provider diagnostics expose only numeric codes and never raw messages or addresses", () => {
  const original = console.error;
  const entries: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    entries.push(args);
  };
  try {
    const error = emailRejection(403, {
      status: "error",
      code: 903,
      message: "PRIVATE KEY secret-token recipient@example.test",
    });
    assert.match(error.message, /MAIL-903/);
    assert.equal(JSON.stringify(entries).includes("secret-token"), false);
    assert.equal(JSON.stringify(entries).includes("recipient@"), false);
    assert.match(emailRejection(401, { code: "102" }).message, /MAIL-102/);
    assert.match(
      emailRejection(403, { code: "secret-token" }).message,
      /MAIL-HTTP-403/,
    );
  } finally {
    console.error = original;
  }
});
