import { describe, it, expect } from "vitest";
import { signupSchema, preferencesSchema, eventSchema, actionSchema } from "./validation";

describe("signupSchema", () => {
  it("accepts a minimal valid sign-up", () => {
    const r = signupSchema.safeParse({
      name: "Tom Moran",
      email: "tom@example.com",
      consent: true
    });
    expect(r.success).toBe(true);
  });

  it("normalises email to lowercase + trimmed", () => {
    const r = signupSchema.parse({
      name: "Tom",
      email: "  TOM@EXAMPLE.COM  ",
      consent: true
    });
    expect(r.email).toBe("tom@example.com");
  });

  it("rejects without consent", () => {
    const r = signupSchema.safeParse({
      name: "Tom",
      email: "tom@example.com",
      consent: false
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty name", () => {
    const r = signupSchema.safeParse({ name: "  ", email: "t@e.com", consent: true });
    expect(r.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const r = signupSchema.safeParse({ name: "Tom", email: "not-an-email", consent: true });
    expect(r.success).toBe(false);
  });

  it("rejects honeypot when filled", () => {
    const r = signupSchema.safeParse({
      name: "Tom",
      email: "tom@example.com",
      consent: true,
      website: "http://spam.example"
    });
    expect(r.success).toBe(false);
  });

  it("captures UTM params when supplied", () => {
    const r = signupSchema.parse({
      name: "Tom",
      email: "tom@example.com",
      consent: true,
      utmSource: "linkedin",
      utmCampaign: "march26",
      referralCode: "ABC123"
    });
    expect(r.utmSource).toBe("linkedin");
    expect(r.referralCode).toBe("ABC123");
  });
});

describe("preferencesSchema", () => {
  it("accepts EMAIL channel without phone", () => {
    const r = preferencesSchema.safeParse({ preferredChannel: "EMAIL" });
    expect(r.success).toBe(true);
  });

  it("requires a known channel value", () => {
    const r = preferencesSchema.safeParse({ preferredChannel: "FAX" });
    expect(r.success).toBe(false);
  });
});

describe("eventSchema", () => {
  it("defaults reminderOffsets and timezone", () => {
    const r = eventSchema.parse({
      title: "Demo",
      description: "Hi",
      startsAt: "2026-04-01T18:00:00Z",
      location: "Sligo"
    });
    expect(r.timezone).toBe("Europe/Dublin");
    expect(r.reminderOffsets).toEqual([10080, 1440, 120]);
    expect(r.reminderAudience).toBe("all");
  });

  it("accepts custom reminderAudience and offsets", () => {
    const r = eventSchema.parse({
      title: "Demo",
      description: "Hi",
      startsAt: "2026-04-01T18:00:00Z",
      location: "Sligo",
      reminderOffsets: [60, 1440],
      reminderAudience: "rsvp_yes"
    });
    expect(r.reminderAudience).toBe("rsvp_yes");
    expect(r.reminderOffsets).toEqual([60, 1440]);
  });

  it("rejects negative reminderOffsets", () => {
    const r = eventSchema.safeParse({
      title: "Demo",
      description: "Hi",
      startsAt: "2026-04-01T18:00:00Z",
      location: "Sligo",
      reminderOffsets: [-5]
    });
    expect(r.success).toBe(false);
  });
});

describe("actionSchema", () => {
  it("defaults to TASK type and NEW status", () => {
    const r = actionSchema.parse({ title: "Find a speaker" });
    expect(r.type).toBe("TASK");
    expect(r.status).toBe("NEW");
  });
});
