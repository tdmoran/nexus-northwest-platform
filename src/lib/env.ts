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
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  AZURE_AD_CLIENT_ID: z.string().optional().default(""),
  AZURE_AD_CLIENT_SECRET: z.string().optional().default(""),
  AZURE_AD_TENANT_ID: z.string().optional().default("common"),
  EMAIL_FROM: z.string().email().default("hello@nexusnorthwest.example"),
  EMAIL_PROVIDER: z.enum(["stub", "sendgrid", "resend"]).default("stub"),
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
  WHATSAPP_DISCUSSION_GROUP_URL: z.string().url().optional().or(z.literal("")).default("")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // env validation runs at module load so we can't use the logger yet (circular).
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed. See .env.example.");
}

export const env = {
  ...parsed.data,
  ZOHO_ENABLED: parsed.data.ZOHO_ENABLED === "true"
} as const;
