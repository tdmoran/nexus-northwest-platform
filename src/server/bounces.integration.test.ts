import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { recordBounces } from "@/server/bounces";

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.token.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.zohoSyncFailure.deleteMany();
  await prisma.whatsAppMessage.deleteMany();
  await prisma.member.deleteMany();
});

describe("recordBounces (integration)", () => {
  it("flips emailBouncedAt and clears consent on a hard bounce", async () => {
    const m = await prisma.member.create({
      data: {
        email: "bounce@example.com",
        name: "Bounce",
        emailConsent: true,
        emailConsentAt: new Date()
      }
    });

    const result = await recordBounces([
      { email: "bounce@example.com", kind: "bounce", provider: "sendgrid", reason: "550 mailbox full" }
    ]);
    expect(result.updated).toBe(1);

    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.emailBouncedAt).not.toBeNull();
    expect(after.emailConsent).toBe(false);
    expect(after.emailOptOutAt).not.toBeNull();

    const audits = await prisma.auditLog.findMany({ where: { memberId: m.id } });
    expect(audits.find((a) => a.action === "email.bounce")).toBeTruthy();
  });

  it("clears email consent on a complaint without setting emailBouncedAt", async () => {
    const m = await prisma.member.create({
      data: {
        email: "complaint@example.com",
        name: "Complaint",
        emailConsent: true,
        emailConsentAt: new Date()
      }
    });

    await recordBounces([
      { email: "complaint@example.com", kind: "complaint", provider: "sendgrid" }
    ]);

    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.emailBouncedAt).toBeNull();
    expect(after.emailConsent).toBe(false);
    expect(after.emailOptOutAt).not.toBeNull();
  });

  it("ignores events for unknown emails without throwing", async () => {
    const result = await recordBounces([
      { email: "nobody@example.com", kind: "bounce", provider: "resend" }
    ]);
    expect(result.updated).toBe(0);
  });

  it("normalises email casing", async () => {
    const m = await prisma.member.create({
      data: {
        email: "case@example.com",
        name: "Case",
        emailConsent: true,
        emailConsentAt: new Date()
      }
    });
    await recordBounces([{ email: "  CASE@Example.COM  ", kind: "bounce", provider: "sendgrid" }]);
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.emailBouncedAt).not.toBeNull();
  });
});
