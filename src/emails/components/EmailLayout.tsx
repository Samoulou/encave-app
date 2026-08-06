import { Html, Head, Body, Container, Hr, Text } from '@react-email/components';
import type { ReactNode } from 'react';
import type { Locale } from '@prisma/client';

interface EmailLayoutProps {
  children: ReactNode;
  locale: Locale;
  preview?: string;
  /**
   * Tokenized opt-out link (P-07, client_email_preferences). Defaults to
   * the generic page for templates that predate the tokenized route.
   */
  unsubscribeUrl?: string;
}

const footerText: Record<Locale, { tagline: string; unsubscribe: string }> = {
  FR: {
    tagline:
      'EnCave - Reservez des experiences de degustation uniques directement aupres des vignerons suisses',
    unsubscribe: 'Se desinscrire des emails',
  },
  DE: {
    tagline:
      'EnCave - Buchen Sie einzigartige Weinverkostungserlebnisse direkt bei Schweizer Winzern',
    unsubscribe: 'Von E-Mails abmelden',
  },
  EN: {
    tagline:
      'EnCave - Book unique wine tasting experiences directly with Swiss winemakers',
    unsubscribe: 'Unsubscribe from emails',
  },
};

export function EmailLayout({
  children,
  locale,
  preview,
  unsubscribeUrl = 'https://encave.ch/unsubscribe',
}: EmailLayoutProps) {
  const footer = footerText[locale];

  return (
    <Html>
      <Head>
        {preview && <title>{preview}</title>}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          lineHeight: '1.6',
          color: '#333333',
          backgroundColor: '#f9fafb',
          margin: 0,
          padding: '20px',
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: '#7c2d12',
              padding: '24px',
              textAlign: 'center' as const,
            }}
          >
            <Text
              style={{
                color: '#ffffff',
                fontSize: '24px',
                fontWeight: 'bold',
                margin: 0,
              }}
            >
              EnCave
            </Text>
          </div>

          {/* Content */}
          <div style={{ padding: '32px' }}>{children}</div>

          {/* Footer */}
          <Hr
            style={{
              border: 'none',
              borderTop: '1px solid #e5e7eb',
              margin: '0',
            }}
          />
          <div
            style={{
              padding: '24px',
              backgroundColor: '#f9fafb',
              textAlign: 'center' as const,
            }}
          >
            <Text
              style={{
                fontSize: '12px',
                color: '#6b7280',
                margin: '0 0 8px 0',
              }}
            >
              {footer.tagline}
            </Text>
            <Text
              style={{
                fontSize: '11px',
                color: '#9ca3af',
                margin: 0,
              }}
            >
              <a
                href={unsubscribeUrl}
                style={{ color: '#9ca3af', textDecoration: 'underline' }}
              >
                {footer.unsubscribe}
              </a>
            </Text>
          </div>
        </Container>
      </Body>
    </Html>
  );
}
