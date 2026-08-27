import { http, HttpResponse, delay } from 'msw';
import { seedUsers } from '@/data/users';
import type { SeedUser } from '@/data/users';
import { createFakeToken, decodeFakeToken } from '@/utils/fakeJwt';
import type { User } from '@/types/auth';

const AUTH_DELAY_MS = 450;

// Session-scoped mutable "database" — resets on page reload, same as any
// other MSW mock. Newly registered users are added here so the email-
// uniqueness check also catches accounts created earlier in the session.
const users: SeedUser[] = [...seedUsers];
const resetTokens = new Map<string, string>(); // token -> email

function toPublicUser(user: SeedUser): User {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email };
}

function resolveUserFromAuthHeader(request: Request): SeedUser | undefined {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const payload = token ? decodeFakeToken(token) : null;
  return payload ? users.find((u) => u.id === payload.sub) : undefined;
}

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface UpdateProfileBody {
  firstName: string;
  lastName: string;
  email: string;
}

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(AUTH_DELAY_MS);
    const body = (await request.json()) as LoginBody;
    const user = users.find((u) => u.email.toLowerCase() === body.email.toLowerCase());

    if (!user || user.password !== body.password) {
      return HttpResponse.json({ message: 'Incorrect email or password.' }, { status: 401 });
    }

    const publicUser = toPublicUser(user);
    return HttpResponse.json({ user: publicUser, token: createFakeToken(publicUser) });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    await delay(AUTH_DELAY_MS);
    const body = (await request.json()) as RegisterBody;
    const exists = users.some((u) => u.email.toLowerCase() === body.email.toLowerCase());

    if (exists) {
      return HttpResponse.json({ message: 'An account with that email already exists.' }, { status: 409 });
    }

    const newUser: SeedUser = {
      id: `u${users.length + 1}`,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password,
    };
    users.push(newUser);

    const publicUser = toPublicUser(newUser);
    return HttpResponse.json({ user: publicUser, token: createFakeToken(publicUser) }, { status: 201 });
  }),

  http.post('/api/auth/logout', async () => {
    await delay(150);
    return HttpResponse.json({ ok: true });
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(200);
    const user = resolveUserFromAuthHeader(request);

    if (!user) {
      return HttpResponse.json({ message: 'Not authenticated.' }, { status: 401 });
    }
    return HttpResponse.json(toPublicUser(user));
  }),

  // Deliberately returns the same success response whether or not the email
  // is registered — real APIs shouldn't leak which emails have accounts.
  http.post('/api/auth/forgot-password', async ({ request }) => {
    await delay(AUTH_DELAY_MS);
    const body = (await request.json()) as ForgotPasswordBody;
    const user = users.find((u) => u.email.toLowerCase() === body.email.toLowerCase());

    if (user) {
      const token = `reset-${Math.random().toString(36).slice(2)}`;
      resetTokens.set(token, user.email);
      // No real email delivery exists in this mock — the token is returned
      // directly so the UI can offer a demo continuation link. A real
      // backend would only ever email this, never return it in the response.
      return HttpResponse.json({ ok: true, devToken: token });
    }
    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/auth/reset-password', async ({ request }) => {
    await delay(AUTH_DELAY_MS);
    const body = (await request.json()) as ResetPasswordBody;
    const email = resetTokens.get(body.token);

    if (!email) {
      return HttpResponse.json({ message: 'This reset link is invalid or has expired.' }, { status: 400 });
    }

    const user = users.find((u) => u.email === email);
    if (user) user.password = body.password;
    resetTokens.delete(body.token);

    return HttpResponse.json({ ok: true });
  }),

  // Distinct from /reset-password: this requires an active session (Bearer
  // token) and the person's current password, rather than a mailed token —
  // a materially different flow, not a duplicate of the same endpoint.
  http.post('/api/auth/change-password', async ({ request }) => {
    await delay(AUTH_DELAY_MS);
    const user = resolveUserFromAuthHeader(request);
    if (!user) {
      return HttpResponse.json({ message: 'Not authenticated.' }, { status: 401 });
    }

    const body = (await request.json()) as ChangePasswordBody;
    if (user.password !== body.currentPassword) {
      return HttpResponse.json({ message: 'Current password is incorrect.' }, { status: 401 });
    }

    user.password = body.newPassword;
    return HttpResponse.json({ ok: true });
  }),

  http.put('/api/auth/me', async ({ request }) => {
    await delay(AUTH_DELAY_MS);
    const user = resolveUserFromAuthHeader(request);
    if (!user) {
      return HttpResponse.json({ message: 'Not authenticated.' }, { status: 401 });
    }

    const body = (await request.json()) as UpdateProfileBody;
    const emailTaken = users.some((u) => u.id !== user.id && u.email.toLowerCase() === body.email.toLowerCase());
    if (emailTaken) {
      return HttpResponse.json({ message: 'Another account already uses that email.' }, { status: 409 });
    }

    user.firstName = body.firstName;
    user.lastName = body.lastName;
    user.email = body.email;

    return HttpResponse.json(toPublicUser(user));
  }),
];
