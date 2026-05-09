import { Button, Img, Section, Text } from "@react-email/components";
import { Layout } from "./Layout";

export interface AnnouncementEmailProps {
  brand: string;
  memberName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  description: string;
  rsvpYesUrl: string;
  rsvpNoUrl: string;
  rsvpMaybeUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
  heroImageUrl?: string | null;
}

export function AnnouncementEmail(props: AnnouncementEmailProps) {
  return (
    <Layout
      brand={props.brand}
      preview={props.eventTitle}
      preferencesUrl={props.preferencesUrl}
      unsubscribeUrl={props.unsubscribeUrl}
    >
      <Text>Hi {props.memberName},</Text>
      {props.heroImageUrl && (
        <Img
          src={props.heroImageUrl}
          alt=""
          style={{ width: "100%", borderRadius: 8, margin: "8px 0" }}
        />
      )}
      <Text style={{ fontSize: 18, fontWeight: 600, margin: "8px 0 4px 0" }}>
        {props.eventTitle}
      </Text>
      <Text style={{ margin: "4px 0" }}>
        <strong>When:</strong> {props.eventDate}
      </Text>
      <Text style={{ margin: "4px 0" }}>
        <strong>Where:</strong> {props.eventLocation}
      </Text>
      <Section style={{ margin: "12px 0", lineHeight: 1.5 }}>
        <Text>{props.description}</Text>
      </Section>
      <Section style={{ margin: "16px 0" }}>
        <Button
          href={props.rsvpYesUrl}
          style={btn("#16a34a")}
        >
          RSVP Yes
        </Button>
        <span>&nbsp;</span>
        <Button href={props.rsvpMaybeUrl} style={btn("#ca8a04")}>
          Maybe
        </Button>
        <span>&nbsp;</span>
        <Button href={props.rsvpNoUrl} style={btn("#dc2626")}>
          No
        </Button>
      </Section>
      <Text style={{ fontSize: 12, color: "#64748b" }}>
        One click is all it takes — no login required.
      </Text>
    </Layout>
  );
}

function btn(bg: string) {
  return {
    display: "inline-block",
    padding: "12px 18px",
    borderRadius: 8,
    backgroundColor: bg,
    color: "#fff",
    textDecoration: "none",
    fontWeight: 600
  } as const;
}

export default AnnouncementEmail;
