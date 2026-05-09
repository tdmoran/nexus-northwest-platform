import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/session";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { eventSchema } from "@/lib/validation";
import { EventForm, readEventFormData } from "../_components/EventForm";

async function createEvent(formData: FormData) {
  "use server";
  const user = await requireCapability("events.edit");
  const { raw } = readEventFormData(formData);

  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Validation failed: " + JSON.stringify(parsed.error.flatten().fieldErrors));
  }

  const event = await prisma.event.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt ?? null,
      timezone: parsed.data.timezone,
      location: parsed.data.location,
      onlineUrl: parsed.data.onlineUrl || null,
      heroImageUrl: parsed.data.heroImageUrl || null,
      capacity: parsed.data.capacity ?? null,
      rsvpEnabled: parsed.data.rsvpEnabled,
      reminderOffsets: parsed.data.reminderOffsets,
      reminderAudience: parsed.data.reminderAudience,
      tags: parsed.data.tags,
      createdById: user.id
    }
  });

  await audit({
    action: "event.created",
    actorId: user.id,
    meta: { eventId: event.id, title: event.title }
  });

  redirect(`/dashboard/events/${event.id}`);
}

export default async function NewEventPage() {
  await requireCapability("events.edit");
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New event</h1>
      <EventForm action={createEvent} submitLabel="Create event" />
    </div>
  );
}
