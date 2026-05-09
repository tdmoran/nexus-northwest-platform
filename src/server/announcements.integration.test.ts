import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Channel, RSVPStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEventAnnouncement } from "@/server/announcements";
import { lookupToken, consumeToken } from "@/lib/tokens";

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Wipe in dependency order.
  await prisma.token.deleteMany();
  await prisma.rSVP.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.zohoSyncFailure.deleteMany();
  await prisma.whatsAppMessage.deleteMany();
  await prisma.event.deleteMany();
  await prisma.member.deleteMany();
  await prisma.organiserUser.deleteMany();
});

async function createOrganiser(email = "test-manager@example.com") {
  return prisma.organiserUser.create({
    data: {
      email,
      name: "Test Manager",
      passwordHash: "stub",
      role: "MANAGER",
      active: true
    }
  });
}

async function createEvent(actorId: string, overrides: Record<string, unknown> = {}) {
  return prisma.event.create({
    data: {
      title: "Test Meetup",
      description: "Some details",
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      location: "Sligo",
      createdById: actorId,
      ...overrides
    }
  });
}

async function createMember(email: string, overrides: Record<string, unknown> = {}) {
  return prisma.member.create({
    data: {
      email,
      name: email.split("@")[0]!,
      emailConsent: true,
      emailConsentAt: new Date(),
      ...overrides
    }
  });
}

describe("sendEventAnnouncement (integration)", () => {
  it("sends to email-consenting members and skips opted-out / bounced", async () => {
    const actor = await createOrganiser();
    const event = await createEvent(actor.id);

    await createMember("a@example.com");
    await createMember("b@example.com");
    await createMember("c@example.com", { emailConsent: false, emailOptOutAt: new Date() });
    await createMember("d@example.com", { emailBouncedAt: new Date() });

    const result = await sendEventAnnouncement({
      eventId: event.id,
      audience: "all",
      channel: Channel.EMAIL,
      actorId: actor.id
    });

    expect(result.recipientCount).toBe(2);
    expect(result.failedCount).toBe(0);

    const announcement = await prisma.announcement.findUniqueOrThrow({
      where: { id: result.announcementId }
    });
    expect(announcement.status).toBe("SENT");
    expect(announcement.recipientCount).toBe(2);

    const tokens = await prisma.token.findMany();
    const purposeCounts = tokens.reduce<Record<string, number>>((acc, t) => {
      acc[t.purpose] = (acc[t.purpose] ?? 0) + 1;
      return acc;
    }, {});
    // Each recipient gets RSVP + PREFERENCES + UNSUBSCRIBE → 6 tokens.
    expect(purposeCounts.RSVP).toBe(2);
    expect(purposeCounts.PREFERENCES).toBe(2);
    expect(purposeCounts.UNSUBSCRIBE).toBe(2);
  });

  it("RSVP token from a sent announcement records an RSVP", async () => {
    const actor = await createOrganiser();
    const event = await createEvent(actor.id);
    const member = await createMember("rsvper@example.com");

    await sendEventAnnouncement({
      eventId: event.id,
      audience: "all",
      channel: Channel.EMAIL,
      actorId: actor.id
    });

    const rsvpToken = await prisma.token.findFirstOrThrow({
      where: { memberId: member.id, purpose: "RSVP", eventId: event.id }
    });

    const lookup = await lookupToken(rsvpToken.token, "RSVP");
    expect(lookup?.memberId).toBe(member.id);
    expect(lookup?.eventId).toBe(event.id);

    // Simulate the page consuming the token + recording the RSVP.
    await consumeToken(rsvpToken.token, "RSVP");
    await prisma.rSVP.upsert({
      where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
      update: { status: RSVPStatus.YES, channel: "email" },
      create: { eventId: event.id, memberId: member.id, status: RSVPStatus.YES, channel: "email" }
    });

    const stored = await prisma.rSVP.findFirstOrThrow({
      where: { memberId: member.id, eventId: event.id }
    });
    expect(stored.status).toBe(RSVPStatus.YES);
  });

  it("RSVP-Yes-only audience filters to attending members only", async () => {
    const actor = await createOrganiser();
    const event = await createEvent(actor.id);
    const yes = await createMember("yes@example.com");
    await createMember("no-rsvp@example.com");
    await createMember("maybe@example.com");

    await prisma.rSVP.create({
      data: { eventId: event.id, memberId: yes.id, status: RSVPStatus.YES, channel: "email" }
    });

    const result = await sendEventAnnouncement({
      eventId: event.id,
      audience: "rsvp_yes",
      channel: Channel.EMAIL,
      actorId: actor.id
    });
    expect(result.recipientCount).toBe(1);
  });

  it("WhatsApp send with WHATSAPP_ENABLED=false logs a queued message", async () => {
    const actor = await createOrganiser();
    const event = await createEvent(actor.id);
    await createMember("wa@example.com", {
      whatsappConsent: true,
      whatsappConsentAt: new Date(),
      whatsappNumber: "+353871234567"
    });

    const result = await sendEventAnnouncement({
      eventId: event.id,
      audience: "all",
      channel: Channel.WHATSAPP,
      actorId: actor.id
    });
    expect(result.recipientCount).toBe(1);

    const messages = await prisma.whatsAppMessage.findMany();
    expect(messages).toHaveLength(1);
    // Stub mode: message is recorded but not actually sent.
    expect(messages[0]!.status).toBe("QUEUED");
    expect(messages[0]!.providerId).toBeNull();
  });

  it("WhatsApp send only targets members with consent + a number", async () => {
    const actor = await createOrganiser();
    const event = await createEvent(actor.id);
    await createMember("a@example.com", {
      whatsappConsent: true,
      whatsappConsentAt: new Date(),
      whatsappNumber: "+353871234567"
    });
    await createMember("b@example.com", {
      whatsappConsent: false // not opted in
    });
    await createMember("c@example.com", {
      whatsappConsent: true,
      whatsappConsentAt: new Date()
      // no phone or whatsappNumber
    });

    const result = await sendEventAnnouncement({
      eventId: event.id,
      audience: "all",
      channel: Channel.WHATSAPP,
      actorId: actor.id
    });
    expect(result.recipientCount).toBe(1);
  });
});
