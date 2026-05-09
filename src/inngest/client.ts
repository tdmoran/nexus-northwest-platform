import { Inngest, EventSchemas } from "inngest";
import { env } from "@/lib/env";

// Strongly-typed events. Adding a new event here gives you compile-time safety
// at every send + handler.

type Events = {
  "member/welcome.send": {
    data: { memberId: string };
  };
  "zoho/member.sync": {
    data: { memberId: string };
  };
  "announcement/dispatch": {
    data: {
      announcementId: string;
      eventId: string;
      memberIds: string[];
      channel: "EMAIL" | "WHATSAPP";
      actorId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "nexus-northwest",
  name: "Nexus Northwest Platform",
  schemas: new EventSchemas().fromRecord<Events>(),
  // The Inngest SDK reads INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from process.env
  // at request time. We pass them explicitly so env validation is the single source.
  eventKey: env.INNGEST_EVENT_KEY || undefined
});
