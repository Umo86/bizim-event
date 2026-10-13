import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type NoticeEmailProps = {
  locale: "tr" | "en";
  heading: string;
  paragraphs: string[];
  quote?: string | null; // admin note / rejection reason, shown as a quote block
  buttonLabel?: string | null;
  url?: string | null;
  footer: string;
};

const brand = { turquoise: "#0B7D87", coral: "#CC3F31", text: "#1F2933", grey: "#F5F7F8", muted: "#52606D" };

/** General-purpose transactional notice in the brand style. */
export function NoticeEmail({ locale, heading, paragraphs, quote, buttonLabel, url, footer }: NoticeEmailProps) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{heading}</Preview>
      <Body style={{ backgroundColor: brand.grey, fontFamily: "Inter, Arial, sans-serif", color: brand.text }}>
        <Container
          style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 32, margin: "32px auto", maxWidth: 560 }}
        >
          <Text style={{ color: brand.turquoise, fontWeight: 700, fontSize: 20, margin: 0 }}>Bizim Event</Text>
          <Heading as="h1" style={{ fontSize: 22, margin: "24px 0 12px" }}>
            {heading}
          </Heading>
          {paragraphs.map((p, i) => (
            <Text key={i} style={{ fontSize: 15, lineHeight: "24px" }}>
              {p}
            </Text>
          ))}
          {quote ? (
            <Section
              style={{
                borderLeft: `4px solid ${brand.turquoise}`,
                backgroundColor: brand.grey,
                padding: "8px 16px",
                margin: "16px 0",
              }}
            >
              <Text style={{ fontSize: 15, lineHeight: "24px", whiteSpace: "pre-wrap", margin: 0 }}>{quote}</Text>
            </Section>
          ) : null}
          {buttonLabel && url ? (
            <Section style={{ margin: "24px 0" }}>
              <Button
                href={url}
                style={{
                  backgroundColor: brand.coral,
                  color: "#ffffff",
                  padding: "12px 20px",
                  borderRadius: 10,
                  fontWeight: 600,
                }}
              >
                {buttonLabel}
              </Button>
            </Section>
          ) : null}
          <Hr />
          <Text style={{ fontSize: 12, color: brand.muted }}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
