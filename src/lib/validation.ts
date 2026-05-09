import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consent is required to sign up." })
  }),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  utmContent: z.string().max(120).optional(),
  referralCode: z.string().max(120).optional()
});

export type SignupInput = z.infer<typeof signupSchema>;

export const preferencesSchema = z.object({
  preferredChannel: z.enum(["EMAIL", "WHATSAPP", "BOTH", "OTHER"]),
  whatsappNumber: z.string().max(40).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  whatsappConsent: z.boolean().optional(),
  emailConsent: z.boolean().optional()
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  timezone: z.string().default("Europe/Dublin"),
  location: z.string().trim().min(1).max(500),
  onlineUrl: z.string().url().optional().or(z.literal("")).nullable(),
  heroImageUrl: z.string().url().optional().or(z.literal("")).nullable(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  rsvpEnabled: z.boolean().default(true),
  reminderOffsets: z.array(z.number().int().nonnegative()).default([10080, 1440, 120]),
  tags: z.array(z.string()).default([])
});

export type EventInput = z.infer<typeof eventSchema>;

export const actionSchema = z.object({
  type: z.enum(["TASK", "SPEAKER_PROSPECT", "CONTRIBUTOR_PROSPECT", "THEME"]).default("TASK"),
  title: z.string().trim().min(1).max(200),
  notes: z.string().optional().nullable(),
  status: z.enum(["NEW", "CONTACTED", "CONFIRMED", "SCHEDULED", "COMPLETED", "CANCELLED"]).default("NEW"),
  dueAt: z.coerce.date().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  eventId: z.string().optional().nullable()
});

export type ActionInput = z.infer<typeof actionSchema>;
