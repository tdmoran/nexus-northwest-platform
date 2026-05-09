import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text
} from "@react-email/components";

export function Layout({
  brand,
  preview,
  preferencesUrl,
  unsubscribeUrl,
  children
}: {
  brand: string;
  preview: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          backgroundColor: "#fafafa",
          margin: 0,
          padding: 24,
          color: "#0f1b46"
        }}
      >
        <Container style={{ maxWidth: 640, margin: "0 auto" }}>
          <Section
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 24
            }}
          >
            <Text
              as="h1"
              style={{ fontSize: 20, color: "#1f3585", margin: "0 0 16px 0" }}
            >
              {brand}
            </Text>
            {children}
          </Section>
          <Hr style={{ borderColor: "transparent", margin: "16px 0 0 0" }} />
          <Text
            style={{
              fontSize: 12,
              color: "#64748b",
              textAlign: "center",
              margin: "8px 0 0 0"
            }}
          >
            <Link href={preferencesUrl} style={{ color: "#2a46ac" }}>
              Manage preferences
            </Link>
            {" · "}
            <Link href={unsubscribeUrl} style={{ color: "#2a46ac" }}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
