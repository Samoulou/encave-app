'use server';

import { headers } from 'next/headers';
import { Locale } from '@prisma/client';
import type { ActionResult } from '@/types/actions';
import {
  checkRateLimit,
  getClientIp,
  CONTACT_RATE_LIMIT,
} from '@/server/services/rate-limit.service';
import { contactSchema } from '@/lib/validators/contact';
import { sendContactMessageEmail } from '@/server/services/email.service';
import { logError, logInfo } from '@/lib/logger';

function toPrismaLocale(locale: string | undefined): Locale {
  switch (locale) {
    case 'de':
      return Locale.DE;
    case 'en':
      return Locale.EN;
    default:
      return Locale.FR;
  }
}

/**
 * Public contact form (P-12 / L-114). Unauthenticated write → rate-limited per
 * IP + safeParsed. A filled honeypot is silently accepted (no email). Sends the
 * team notification (reply-to the sender) + a client accusé. Never throws.
 */
export async function sendContactMessageAction(
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  try {
    const ip = getClientIp(await headers());
    const rateLimit = await checkRateLimit(`contact:${ip}`, CONTACT_RATE_LIMIT);
    if (!rateLimit.success) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again later.',
        },
      };
    }

    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid contact data' },
      };
    }
    const data = parsed.data;

    // Honeypot: pretend success without sending — never tip off the bot.
    if (data.website && data.website.trim().length > 0) {
      logInfo('contact.honeypot_triggered', {
        action: 'sendContactMessageAction',
      });
      return { success: true, data: { ok: true } };
    }

    const ok = await sendContactMessageEmail(
      {
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      },
      toPrismaLocale(data.locale)
    );
    if (!ok) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send your message',
        },
      };
    }

    logInfo('contact.message_sent', { action: 'sendContactMessageAction' });
    return { success: true, data: { ok: true } };
  } catch (error) {
    logError('sendContactMessageAction error', error, {
      action: 'sendContactMessageAction',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send your message' },
    };
  }
}
