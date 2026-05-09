import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { dispatchDueReminders } from "@/server/reminders";

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
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

async function setupEventWithRecipients(opts: {
  startsInMinutes: number;
  reminderOffsets?: number[];
  reminderAudience?: string;
}) {
  const actor = await prisma.organiserUser.create({
    data: {
      email: "manager@example.com",
      name: "Manager",
      passwordHash: "stub",
      role: "MANAGER"
    }
  });
  const event = await prisma.event.create({
    data: {
      title: "Reminder test",
      description: "x",
      startsAt: new Date(Date.now() + opts.startsInMinutes * 60 * 1000),
      location: "Sligo",
      reminderOffsets: opts.reminderOffsets ?? [10080, 1440, 120],
      reminderAudience: opts.reminderAudience ?? "all",
      createdById: actor.id
    }
  });
  await prisma.member.create({
    data: {
      email: "m@example.com",
      name: "Member",
      emailConsent: true,
      emailConsentAt: new Date()
    }
  });
  return { actor, event };
}

describe("dispatchDueReminders (integration)", () => {
  it("fires the 24h reminder when within window and creates a Reminder row", async () => {
    const { event } = await setupEventWithRecipients({ startsInMinutes: 60 }); // 1 hour out

    const result = await dispatchDueReminders();
    expect(result.scanned).toBe(1);
    // Both 1440 (24h) and 120 (2h) windows are crossed at 60min remaining.
    const offsetsFired = result.fired.map((f) => f.offsetMinutes).sort((a, b) => a - b);
    expect(offsetsFired).toEqual([120, 1440]);

    const reminders = await prisma.reminder.findMany({ where: { eventId: event.id } });
    expect(reminders).toHaveLength(2);
  });

  it("does not refire on a second pass (idempotent per offset)", async () => {
    await setupEventWithRecipients({ startsInMinutes: 60 });
    const first = await dispatchDueReminders();
    const second = await dispatchDueReminders();
    expect(first.fired.length).toBe(2);
    expect(second.fired.length).toBe(0);
  });

  it("does not fire reminders that are still in the future", async () => {
    await setupEventWithRecipients({ startsInMinutes: 60 * 24 * 8 }); // 8 days out
    const result = await dispatchDueReminders();
    expect(result.fired.length).toBe(0);
  });

  it("ignores events without rsvpEnabled", async () => {
    const { event } = await setupEventWithRecipients({ startsInMinutes: 60 });
    await prisma.event.update({ where: { id: event.id }, data: { rsvpEnabled: false } });
    const result = await dispatchDueReminders();
    expect(result.scanned).toBe(0);
  });
});
