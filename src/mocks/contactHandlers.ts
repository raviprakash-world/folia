import { http, HttpResponse, delay } from 'msw';

const CONTACT_DELAY_MS = 500;
const CONTACT_FAILURE_RATE = 0.1;
const NEWSLETTER_DELAY_MS = 400;

// Session-scoped seed of "already subscribed" addresses, so duplicate-
// subscription handling has something real to trigger against.
const subscribedEmails = new Set<string>(['subscribed@example.com']);

interface ContactBody {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

interface NewsletterBody {
  email: string;
}

export const contactHandlers = [
  http.post('/api/contact', async ({ request }) => {
    await delay(CONTACT_DELAY_MS);
    const body = (await request.json()) as ContactBody;

    if (!body.email || !body.message) {
      return HttpResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    // Intentional random failure — see README. Exercises the form's error
    // state on a normal pass instead of leaving it theoretical.
    if (Math.random() < CONTACT_FAILURE_RATE) {
      return HttpResponse.json(
        { message: 'Something went wrong on our end — try again in a moment.' },
        { status: 500 }
      );
    }

    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/newsletter/subscribe', async ({ request }) => {
    await delay(NEWSLETTER_DELAY_MS);
    const body = (await request.json()) as NewsletterBody;
    const normalized = body.email.toLowerCase().trim();

    if (subscribedEmails.has(normalized)) {
      return HttpResponse.json({ message: "You're already on the list." }, { status: 409 });
    }

    subscribedEmails.add(normalized);
    return HttpResponse.json({ ok: true });
  }),
];
