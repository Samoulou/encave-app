import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { checkRateLimit, type RateLimitConfig } from '@/server/services/rate-limit.service';
import { logError } from '@/lib/logger';

const newsletterSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  source: z.string().optional().default('coming-soon'),
});

// Rate limit: 5 subscriptions per IP per hour
const NEWSLETTER_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
};

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Check rate limit
    const rateLimitResult = await checkRateLimit(`newsletter:${ip}`, NEWSLETTER_RATE_LIMIT);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Veuillez réessayer plus tard.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
          },
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const result = newsletterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Données invalides' },
        { status: 400 }
      );
    }

    const { email, source } = result.data;

    // Check if email already exists
    const existing = await db.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      // Return success even if already subscribed (don't reveal if email exists)
      return NextResponse.json(
        { success: true, message: 'Inscription réussie' },
        { status: 200 }
      );
    }

    // Create subscription
    await db.newsletterSubscription.create({
      data: {
        email: email.toLowerCase(),
        source,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Inscription réussie' },
      { status: 201 }
    );
  } catch (error) {
    logError('Newsletter subscription error', error, { action: 'newsletter' });
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}
