import { Resend } from 'resend';
import { env } from '@/lib/env';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Escape HTML entities to prevent XSS in email templates
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const FROM_EMAIL = 'EnCave <noreply@encave.ch>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping email:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return false;
  }
}

export async function sendWineryApprovedEmail(
  email: string,
  wineryName: string
): Promise<boolean> {
  const safeWineryName = escapeHtml(wineryName);
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your winery has been verified!</title>
      </head>
      <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c2d12; margin-bottom: 10px;">Welcome to EnCave!</h1>
        </div>

        <p>Dear Winemaker,</p>

        <p>Great news! Your winery <strong>${safeWineryName}</strong> has been verified and is now active on the EnCave platform.</p>

        <p>You can now:</p>
        <ul>
          <li>Complete your winery profile with photos and descriptions</li>
          <li>Create wine tasting experiences for guests to book</li>
          <li>Manage your availability calendar</li>
          <li>Receive and manage bookings</li>
        </ul>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://encave.ch/dashboard"
             style="background-color: #7c2d12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>

        <p>If you have any questions, please don't hesitate to reach out to our support team.</p>

        <p>
          Best regards,<br>
          The EnCave Team
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          EnCave - Book unique wine tasting experiences directly with Swiss winemakers
        </p>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Your winery has been verified!',
    html,
  });
}

export async function sendWineryRejectedEmail(
  email: string,
  wineryName: string,
  reason: string
): Promise<boolean> {
  const safeWineryName = escapeHtml(wineryName);
  const safeReason = escapeHtml(reason);
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Winery Registration Update</title>
      </head>
      <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c2d12; margin-bottom: 10px;">EnCave</h1>
        </div>

        <p>Dear Winemaker,</p>

        <p>Thank you for your interest in joining the EnCave platform. After reviewing your registration for <strong>${safeWineryName}</strong>, we regret to inform you that we are unable to approve it at this time.</p>

        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-weight: 600; color: #991b1b;">Reason:</p>
          <p style="margin: 10px 0 0 0; color: #7f1d1d;">${safeReason}</p>
        </div>

        <p>If you believe this decision was made in error or if you would like to provide additional information, please contact our support team.</p>

        <p>You are welcome to submit a new registration once you have addressed the concerns mentioned above.</p>

        <p>
          Best regards,<br>
          The EnCave Team
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          EnCave - Book unique wine tasting experiences directly with Swiss winemakers
        </p>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Winery Registration Update',
    html,
  });
}
