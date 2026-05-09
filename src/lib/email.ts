import { promises as fs } from "fs";
import { join } from "path";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<{ id: string }>;
}

class StubEmailProvider implements EmailProvider {
  async send(msg: EmailMessage): Promise<{ id: string }> {
    const dir = join(process.cwd(), ".mail");
    await fs.mkdir(dir, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = join(dir, `${id}.eml`);
    const headers = Object.entries(msg.headers ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const body =
      `From: ${env.EMAIL_FROM}\nTo: ${msg.to}\nSubject: ${msg.subject}\n` +
      (headers ? `${headers}\n` : "") +
      `Content-Type: text/html; charset=utf-8\n\n${msg.html}`;
    await fs.writeFile(path, body, "utf8");
    log.info("email.stub.wrote", { path, to: msg.to });
    return { id };
  }
}

class SendgridProvider implements EmailProvider {
  async send(msg: EmailMessage): Promise<{ id: string }> {
    if (!env.EMAIL_API_KEY) throw new Error("EMAIL_API_KEY not set");
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: msg.to }] }],
        from: { email: env.EMAIL_FROM },
        subject: msg.subject,
        content: [
          { type: "text/plain", value: msg.text ?? stripHtml(msg.html) },
          { type: "text/html", value: msg.html }
        ]
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`sendgrid: ${res.status} ${text}`);
    }
    return { id: res.headers.get("x-message-id") ?? "sendgrid" };
  }
}

class ResendProvider implements EmailProvider {
  async send(msg: EmailMessage): Promise<{ id: string }> {
    if (!env.EMAIL_API_KEY) throw new Error("EMAIL_API_KEY not set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? stripHtml(msg.html)
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`resend: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { id?: string };
    return { id: data.id ?? "resend" };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

let cached: EmailProvider | null = null;
function provider(): EmailProvider {
  if (cached) return cached;
  if (env.EMAIL_PROVIDER === "sendgrid") cached = new SendgridProvider();
  else if (env.EMAIL_PROVIDER === "resend") cached = new ResendProvider();
  else cached = new StubEmailProvider();
  return cached;
}

export async function sendEmail(msg: EmailMessage): Promise<{ id: string }> {
  return provider().send(msg);
}
