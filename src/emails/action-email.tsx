import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type ActionEmailProps = {
  locale: "tr" | "en";
  heading: string;
  body: string;
  buttonLabel: string;
  url: string;
  footnote: string;
};

const brand = { turquoise: "#0E9AA7", coral: "#FF6B5B", text: "#1F2933", grey: "#F5F7F8" };

/** Single-call-to-action email (verify, magic link, reset). Bilingual via props. */
export function ActionEmail({ locale, heading, body, buttonLabel, url, footnote }: ActionEmailProps) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{heading}</Preview>
      <Body style={{ backgroundColor: brand.grey, fontFamily: "Inter, Arial, sans-serif", color: brand.text }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 32, margin: "32px auto", maxWidth: 520 }}>
          <Text style={{ color: brand.turquoise, fontWeight: 700, fontSize: 20, margin: 0 }}>Bizim Event</Text>
          <Heading as="h1" style={{ fontSize: 22, margin: "24px 0 12px" }}>
            {heading}
          </Heading>
          <Text style={{ fontSize: 15, lineHeight: "24px" }}>{body}</Text>
          <Section style={{ margin: "24px 0" }}>
            <Button
              href={url}
              style={{ backgroundColor: brand.coral, color: "#ffffff", padding: "12px 20px", borderRadius: 10, fontWeight: 600 }}
            >
              {buttonLabel}
            </Button>
          </Section>
          <Hr />
          <Text style={{ fontSize: 12, color: "#52606D" }}>{footnote}</Text>
        </Container>
      </Body>
    </Html>
  );
}
