import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_NAME: z.string().default("Nexus Northwest"),
  TOKEN_SECRET: z.string().min(16),
  CRON_SECRET: z.string().min(16).default("dev-cron-secret-change-me-please"),
  REDIS_URL: z.string().optional().default(""),
  INNGEST_EVENT_KEY: z.string().optional().default(""),
  INNGEST_SIGNING_KEY: z.string().optional().default(""),
  SENTRY_DSN: z.string().optional().default(""),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional().default(""),
  SENTRY_ENVIRONMENT: z.string().default("development"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  AZURE_AD_CLIENT_ID: z.string().optional().default(""),
  AZURE_AD_CLIENT_SECRET: z.string().optional().default(""),
  AZURE_AD_TENANT_ID: z.string().optional().default("common"),
  EMAIL_FROM: z.string().email().default("hello@nexusnorthwest.example"),
  EMAIL_PROVIDER: z.enum(["stub", "sendgrid", "resend", "mailgun"]).default("stub"),
  MAILGUN_DOMAIN: z.string().optional().default(""),
  MAILGUN_REGION: z.enum(["us", "eu"]).default("eu"),
  EMAIL_API_KEY: z.string().optional().default(""),
  EMAIL_WEBHOOK_SECRET: z.string().min(8).default("dev-email-webhook-secret"),
  SENDGRID_WEBHOOK_PUBLIC_KEY: z.string().optional().default(""),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(""),
  ZOHO_ENABLED: z.string().default("false"),
  ZOHO_CLIENT_ID: z.string().optional().default(""),
  ZOHO_CLIENT_SECRET: z.string().optional().default(""),
  ZOHO_REFRESH_TOKEN: z.string().optional().default(""),
  ZOHO_API_DOMAIN: z.string().url().default("https://www.zohoapis.eu"),
  ZOHO_MODULE: z.string().default("Leads"),
  WHATSAPP_BROADCAST_GROUP_URL: z.string().url().optional().or(z.literal("")).default(""),
  WHATSAPP_DISCUSSION_GROUP_URL: z.string().url().optional().or(z.literal("")).default(""),
  WHATSAPP_ENABLED: z.string().default("false"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().min(8).default("dev-whatsapp-verify-token"),
  WHATSAPP_TEMPLATE_NAME: z.string().default("event_announcement"),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default("en"),
  WHATSAPP_GRAPH_VERSION: z.string().default("v20.0")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // env validation runs at module load so we can't use the logger yet (circular).
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed. See .env.example.");
}

// Refuse to start in production with placeholder dev secrets baked in.
if (process.env.NODE_ENV === "production") {
  const violations: string[] = [];
  if (parsed.data.CRON_SECRET === "dev-cron-secret-change-me-please") violations.push("CRON_SECRET");
  if (parsed.data.EMAIL_WEBHOOK_SECRET === "dev-email-webhook-secret") violations.push("EMAIL_WEBHOOK_SECRET");
  if (parsed.data.WHATSAPP_VERIFY_TOKEN === "dev-whatsapp-verify-token") violations.push("WHATSAPP_VERIFY_TOKEN");
  if (parsed.data.NEXTAUTH_SECRET.length < 32) violations.push("NEXTAUTH_SECRET (must be ≥32 chars in prod)");
  if (parsed.data.TOKEN_SECRET.length < 32) violations.push("TOKEN_SECRET (must be ≥32 chars in prod)");
  if (violations.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      "REFUSING TO START — these env vars still hold development defaults or are too short for production:\n  - " +
        violations.join("\n  - ") +
        "\nGenerate strong values (e.g. `openssl rand -base64 32`) and redeploy."
    );
    throw new Error("Production env validation failed");
  }
}

export const env = {
  ...parsed.data,
  ZOHO_ENABLED: parsed.data.ZOHO_ENABLED === "true",
  WHATSAPP_ENABLED: parsed.data.WHATSAPP_ENABLED === "true"
} as const;
