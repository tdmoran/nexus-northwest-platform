import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/session";
import { audit } from "@/lib/audit";
import { eventSchema } from "@/lib/validation";
import { EventForm, readEventFormData } from "../../_components/EventForm";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  await requireCapability("events.edit");
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

  async function updateEvent(formData: FormData) {
    "use server";
    const user = await requireCapability("events.edit");
    const { raw } = readEventFormData(formData);

    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("Validation failed: " + JSON.stringify(parsed.error.flatten().fieldErrors));
    }

    await prisma.event.update({
      where: { id: params.id },
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
        tags: parsed.data.tags
      }
    });

    await audit({
      action: "event.updated",
      actorId: user.id,
      meta: { eventId: params.id, title: parsed.data.title }
    });

    redirect(`/dashboard/events/${params.id}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Edit event</h1>
      <EventForm
        action={updateEvent}
        initial={{
          title: event.title,
          description: event.description,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          timezone: event.timezone,
          location: event.location,
          onlineUrl: event.onlineUrl,
          heroImageUrl: event.heroImageUrl,
          capacity: event.capacity,
          rsvpEnabled: event.rsvpEnabled,
          tags: event.tags
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
