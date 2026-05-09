// End-to-end-ish integration test for the member sign-up + tokenised flows.
// Requires DATABASE_URL pointing at a Postgres instance with the schema applied
// (`npx prisma migrate deploy` before running).

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { signupMember } from "@/server/members";
import { issueToken, consumeToken, lookupToken } from "@/lib/tokens";

beforeAll(async () => {
  // Ensure connection.
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Wipe the tables this test touches, in dependency order.
  await prisma.token.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.zohoSyncFailure.deleteMany();
  await prisma.member.deleteMany();
});

describe("signupMember (integration)", () => {
  it("creates a member, issues preference + unsubscribe tokens, and audits", async () => {
    const result = await signupMember({
      name: "Tom Test",
      email: "tom.test@example.com",
      consent: true,
      website: "",
      utmSource: "linkedin",
      utmCampaign: "march26",
      referralCode: "ABC123"
    });
    expect(result.created).toBe(true);
    expect(result.memberId).toBeTruthy();

    const member = await prisma.member.findUniqueOrThrow({ where: { id: result.memberId } });
    expect(member.email).toBe("tom.test@example.com");
    expect(member.utmSource).toBe("linkedin");
    expect(member.referralCode).toBe("ABC123");
    expect(member.emailConsent).toBe(true);
    expect(member.emailConsentAt).not.toBeNull();

    const tokens = await prisma.token.findMany({ where: { memberId: member.id } });
    const purposes = tokens.map((t) => t.purpose).sort();
    expect(purposes).toEqual(["PREFERENCES", "UNSUBSCRIBE"]);

    const auditEntries = await prisma.auditLog.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "asc" }
    });
    const actions = auditEntries.map((a) => a.action);
    expect(actions).toContain("member.signup");
    expect(actions).toContain("email.welcome.sent");
  });

  it("idempotent on duplicate email — does not resend welcome", async () => {
    await signupMember({ name: "Tom", email: "dup@example.com", consent: true, website: "" });
    await signupMember({
      name: "Tom (again)",
      email: "dup@example.com",
      consent: true,
      website: ""
    });

    const members = await prisma.member.findMany({ where: { email: "dup@example.com" } });
    expect(members).toHaveLength(1);

    const sends = await prisma.auditLog.count({
      where: { memberId: members[0]!.id, action: "email.welcome.sent" }
    });
    expect(sends).toBe(1);

    const dupAudits = await prisma.auditLog.count({
      where: { memberId: members[0]!.id, action: "member.signup.duplicate" }
    });
    expect(dupAudits).toBe(1);
  });
});

describe("token round-trip (integration)", () => {
  it("issued PREFERENCES token verifies and is reusable", async () => {
    const m = await prisma.member.create({
      data: { name: "T", email: "tok-pref@example.com", emailConsent: true }
    });
    const token = await issueToken({ memberId: m.id, purpose: "PREFERENCES" });

    const lookup1 = await lookupToken(token, "PREFERENCES");
    expect(lookup1?.memberId).toBe(m.id);
    const consumed1 = await consumeToken(token, "PREFERENCES");
    expect(consumed1?.memberId).toBe(m.id);
    // Reusable
    const consumed2 = await consumeToken(token, "PREFERENCES");
    expect(consumed2?.memberId).toBe(m.id);
  });

  it("UNSUBSCRIBE token is single-use", async () => {
    const m = await prisma.member.create({
      data: { name: "T", email: "tok-unsub@example.com", emailConsent: true }
    });
    const token = await issueToken({ memberId: m.id, purpose: "UNSUBSCRIBE" });

    const first = await consumeToken(token, "UNSUBSCRIBE");
    expect(first?.memberId).toBe(m.id);

    const second = await consumeToken(token, "UNSUBSCRIBE");
    expect(second).toBeNull();
  });

  it("rejects tokens that don't match the requested purpose", async () => {
    const m = await prisma.member.create({
      data: { name: "T", email: "tok-mismatch@example.com", emailConsent: true }
    });
    const token = await issueToken({ memberId: m.id, purpose: "PREFERENCES" });
    expect(await lookupToken(token, "RSVP")).toBeNull();
  });
});
