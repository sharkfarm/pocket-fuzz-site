import { createHash } from "node:crypto";
import { after } from "next/server";
import { Resend } from "resend";

// Server-only: never import this route into a client component.
export const runtime = "nodejs";

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return reply({ error: "Please submit the form from the Pocket Fuzz website." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return reply({ error: "Expected a JSON request." }, 415);
  }

  let body: Record<string, unknown>;
  try {
    // Bound actual bytes, including requests without a Content-Length header.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Please complete the signup form." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return reply({ error: "Signup request is too large." }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "Please complete the signup form." }, 400);
  }
  if (typeof body.website === "string" && body.website.trim()) {
    return reply({ error: "Could not submit this signup." }, 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    return reply({ error: "Please enter your name (up to 120 characters)." }, 400);
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) {
    return reply({ error: "Please enter a valid email address." }, 400);
  }
  if (body.subscribe !== true) {
    return reply({ error: "Please check the box to consent to Pocket Fuzz emails." }, 400);
  }

  const endpoint = process.env.PFCOM_PURCHASE_CONTACT_URL;
  const secret = process.env.PFCOM_PURCHASE_CONTACT_SECRET;
  try {
    if (!endpoint || !secret) throw new Error("Missing configuration");
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid endpoint");
  } catch {
    return reply({ error: "Signup is temporarily unavailable. Please try again later." }, 503);
  }
  try {
    const response = await fetch(endpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pocket-fuzz-secret": secret! },
      body: JSON.stringify({ name, email, subscribe: true }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Upstream rejected signup");
    const result = await response.json();
    if (result?.ok !== true || result?.subscribed !== true) throw new Error("Subscription not confirmed");
    after(() => sendSignupEmails(name, email));
    return reply({ ok: true });
  } catch {
    // Never relay PF-Com errors, contact IDs, credentials, or subscriber data.
    return reply({ error: "Could not confirm your signup. Please try again shortly." }, 502);
  }
}


async function sendSignupEmails(name: string, email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[Mailing list] RESEND_API_KEY is missing; signup emails were not sent.");
    return;
  }
  const resend = new Resend(apiKey);
  // Separate recipients and messages; subscribers never see notification recipients.
  const messages = [
    {
      kind: "welcome",
      to: email,
      subject: "Welcome to the Pocket Fuzz mailing list!",
      text: [
        "Hey " + name + ",",
        "",
        "Thanks for joining the Pocket Fuzz mailing list! You're signed up for upcoming shows, new music, and band news.",
        "",
        "Find upcoming shows at https://pocket-fuzz.com/shows",
        "",
        "See you at a show!",
        "Pocket Fuzz",
        "",
        "You received this confirmation because this email address was used to join our mailing list at pocket-fuzz.com. If that wasn't you, reply to info@pocket-fuzz.com and we'll help.",
      ].join("\n"),
    },
    {
      kind: "notification",
      to: "info@pocket-fuzz.com",
      subject: "New Pocket Fuzz mailing list signup",
      text: [
        "A mailing list signup was confirmed by PF-Com.",
        "",
        "Name: " + name,
        "Email: " + email,
        "Consent: Explicit opt-in to Pocket Fuzz shows, music, and band news.",
        "Source: Homepage mailing list form",
      ].join("\n"),
    },
  ];
  const subscriberKey = createHash("sha256").update(email).digest("hex");
  await Promise.all(messages.map(async ({ kind, ...message }) => {
    try {
      const { data, error } = await resend.emails.send({
        from: "Pocket Fuzz <info@pocket-fuzz.com>",
        replyTo: "info@pocket-fuzz.com",
        ...message,
      }, { idempotencyKey: "mailing-list-" + kind + "/" + subscriberKey });
      if (error || !data?.id) throw new Error("Email was not accepted");
    } catch {
      // Do not log subscriber data or raw provider errors, which can contain secrets.
      console.error("[Mailing list] " + kind + " email failed; subscription remains confirmed.");
    }
  }));
}
