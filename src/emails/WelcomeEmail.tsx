import { Link, Section, Text } from "@react-email/components";
import { Layout } from "./Layout";

export interface WelcomeEmailProps {
  brand: string;
  name: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
  whatsappBroadcastUrl?: string;
  whatsappDiscussionUrl?: string;
}

export function WelcomeEmail(props: WelcomeEmailProps) {
  return (
    <Layout
      brand={props.brand}
      preview={`Welcome to ${props.brand}`}
      preferencesUrl={props.preferencesUrl}
      unsubscribeUrl={props.unsubscribeUrl}
    >
      <Text>Hi {props.name},</Text>
      <Text>
        It takes effort to get people&rsquo;s attention these days, so know this — we really
        appreciate and value you taking the time to be part of <strong>{props.brand}</strong>.
        We&rsquo;ll make every effort to be efficient and effective with our communication.
      </Text>
      <Text>
        By default you will receive an email every time an event is announced (and a reminder or two
        as the event approaches).
      </Text>
      {props.whatsappBroadcastUrl && (
        <Text>
          If you would like a WhatsApp notification announcing any upcoming event, please join this{" "}
          <Link href={props.whatsappBroadcastUrl}>broadcast-only WhatsApp group</Link> (zero spam).
        </Text>
      )}
      {props.whatsappDiscussionUrl && (
        <Text>
          If you want to get stuck into sharing and discussing the latest trends, you can{" "}
          <Link href={props.whatsappDiscussionUrl}>join the members discussion group</Link>.
        </Text>
      )}
      <Section>
        <Text>
          You can <Link href={props.preferencesUrl}>manage your communication preferences</Link> at
          any time.
        </Text>
      </Section>
      <Text>
        Looking forward to meeting in person at the next event.
        <br />
        Kind regards,
        <br />
        The {props.brand} team
      </Text>
    </Layout>
  );
}

export default WelcomeEmail;
