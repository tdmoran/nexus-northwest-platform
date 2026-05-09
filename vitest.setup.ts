// Set deterministic env vars before any module loads. These satisfy the
// Zod schema in src/lib/env.ts so tests can import modules transitively.

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "test-nextauth-secret-32bytes-min";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Nexus Northwest";
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "test-token-secret-32bytes-min-please";
process.env.CRON_SECRET = process.env.CRON_SECRET ?? "test-cron-secret-32bytes-min-please";
process.env.EMAIL_FROM = process.env.EMAIL_FROM ?? "test@example.com";
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? "stub";
process.env.EMAIL_API_KEY = process.env.EMAIL_API_KEY ?? "";
process.env.EMAIL_WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET ?? "test-webhook-secret";
process.env.ZOHO_ENABLED = process.env.ZOHO_ENABLED ?? "false";
process.env.WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED ?? "false";
process.env.WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "test-whatsapp-verify";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
