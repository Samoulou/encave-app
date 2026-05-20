interface MailtoInput {
  to?: string;
  bcc?: string[];
  subject?: string;
  body?: string;
}

export function buildMailtoLink({
  to = '',
  bcc = [],
  subject = '',
  body = '',
}: MailtoInput): string {
  const params = new URLSearchParams();

  if (bcc.length > 0) {
    params.set('bcc', bcc.join(','));
  }
  if (subject) {
    params.set('subject', subject);
  }
  if (body) {
    params.set('body', body);
  }

  const query = params.toString();
  return `mailto:${encodeURIComponent(to)}${query ? `?${query}` : ''}`;
}

export function isSafeMailtoLength(mailto: string): boolean {
  return mailto.length <= 1800;
}
