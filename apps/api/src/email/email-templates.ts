export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const FERN = '#4b7259'; // Folia's real --color-fern (apps/web/src/index.css) — same color already used in the Razorpay checkout modal, kept consistent here.
const INK_SOFT = '#6b6b63';

/**
 * One shared layout for every transactional email — a plain, readable
 * card with a single call-to-action button, deliberately not a full
 * marketing template (no images, no multi-column layout): every email
 * this system sends is a real transactional notice (reset your password,
 * your order shipped), not a campaign, and plain HTML email renders
 * reliably everywhere a heavier template can silently break.
 */
function renderLayout(input: {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const button = input.ctaUrl
    ? `<a href="${input.ctaUrl}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:${FERN};color:#ffffff;text-decoration:none;border-radius:6px;font-family:sans-serif;font-size:14px;font-weight:600;">${input.ctaLabel ?? 'View details'}</a>`
    : '';
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f2ee;font-family:sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;">
            <tr>
              <td style="font-family:sans-serif;color:#2a2a26;font-size:20px;font-weight:700;padding-bottom:16px;">Folia</td>
            </tr>
            <tr>
              <td style="font-family:sans-serif;color:#2a2a26;font-size:18px;font-weight:600;padding-bottom:12px;">${input.heading}</td>
            </tr>
            <tr>
              <td style="font-family:sans-serif;color:${INK_SOFT};font-size:14px;line-height:1.6;">${input.bodyHtml}</td>
            </tr>
            ${button ? `<tr><td>${button}</td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmail(resetUrl: string): RenderedEmail {
  return {
    subject: 'Reset your Folia password',
    html: renderLayout({
      heading: 'Reset your password',
      bodyHtml:
        "We received a request to reset your Folia password. This link expires in 30 minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.",
      ctaLabel: 'Reset password',
      ctaUrl: resetUrl,
    }),
    text: `Reset your Folia password\n\nWe received a request to reset your Folia password. This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.\n\n${resetUrl}`,
  };
}

export function emailVerificationEmail(verifyUrl: string): RenderedEmail {
  return {
    subject: 'Verify your email for Folia',
    html: renderLayout({
      heading: 'Verify your email',
      bodyHtml:
        'Confirm this is your email address to finish setting up your Folia account.',
      ctaLabel: 'Verify email',
      ctaUrl: verifyUrl,
    }),
    text: `Verify your email\n\nConfirm this is your email address to finish setting up your Folia account.\n\n${verifyUrl}`,
  };
}

export function orderPlacedEmail(
  orderId: string,
  orderUrl: string,
): RenderedEmail {
  return {
    subject: `Order ${orderId} confirmed`,
    html: renderLayout({
      heading: 'Your order is confirmed',
      bodyHtml: `Order <strong>${orderId}</strong> was placed successfully. We'll email you again once it ships.`,
      ctaLabel: 'View order',
      ctaUrl: orderUrl,
    }),
    text: `Your order is confirmed\n\nOrder ${orderId} was placed successfully. We'll email you again once it ships.\n\n${orderUrl}`,
  };
}

export function orderCancelledEmail(
  orderId: string,
  orderUrl: string,
): RenderedEmail {
  return {
    subject: `Order ${orderId} cancelled`,
    html: renderLayout({
      heading: 'Your order was cancelled',
      bodyHtml: `Order <strong>${orderId}</strong> has been cancelled. If a refund is due, it will be processed to your original payment method.`,
      ctaLabel: 'View order',
      ctaUrl: orderUrl,
    }),
    text: `Your order was cancelled\n\nOrder ${orderId} has been cancelled. If a refund is due, it will be processed to your original payment method.\n\n${orderUrl}`,
  };
}

export function orderReturnRequestedEmail(
  orderId: string,
  orderUrl: string,
): RenderedEmail {
  return {
    subject: `Return requested for order ${orderId}`,
    html: renderLayout({
      heading: 'Return request received',
      bodyHtml: `We've received your return request for order <strong>${orderId}</strong>. We'll follow up with next steps shortly.`,
      ctaLabel: 'View order',
      ctaUrl: orderUrl,
    }),
    text: `Return request received\n\nWe've received your return request for order ${orderId}. We'll follow up with next steps shortly.\n\n${orderUrl}`,
  };
}

const STATUS_COPY: Record<string, string> = {
  CONFIRMED: 'has been confirmed and is being prepared',
  SHIPPED: 'is on its way',
  DELIVERED: 'has been delivered',
};

export function orderStatusChangedEmail(
  orderId: string,
  status: 'CONFIRMED' | 'SHIPPED' | 'DELIVERED',
  orderUrl: string,
): RenderedEmail {
  const statusLabel = status.charAt(0) + status.slice(1).toLowerCase();
  return {
    subject: `Order ${orderId}: ${statusLabel}`,
    html: renderLayout({
      heading: `Your order ${statusLabel.toLowerCase()}`,
      bodyHtml: `Order <strong>${orderId}</strong> ${STATUS_COPY[status]}.`,
      ctaLabel: 'Track order',
      ctaUrl: orderUrl,
    }),
    text: `Order ${orderId} ${STATUS_COPY[status]}.\n\n${orderUrl}`,
  };
}

export function paymentFailedEmail(
  retryUrl: string,
  errorDescription?: string,
): RenderedEmail {
  return {
    subject: "We couldn't process your payment",
    html: renderLayout({
      heading: 'Payment unsuccessful',
      bodyHtml: `Your payment didn't go through${errorDescription ? ` (${errorDescription})` : ''}. No charge was made. You can try again from your cart.`,
      ctaLabel: 'Try again',
      ctaUrl: retryUrl,
    }),
    text: `Payment unsuccessful\n\nYour payment didn't go through${errorDescription ? ` (${errorDescription})` : ''}. No charge was made. You can try again from your cart.\n\n${retryUrl}`,
  };
}
