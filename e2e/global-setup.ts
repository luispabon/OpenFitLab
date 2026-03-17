import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API_PORT = process.env.E2E_API_PORT ?? '3098';
const API_BASE = `http://localhost:${API_PORT}`;

// Compose project and service identifiers — must match compose.e2e.yaml / Makefile
const COMPOSE_PROJECT = process.env.E2E_COMPOSE_PROJECT ?? 'openfitlab-e2e';
const API_SERVICE = 'api';

async function globalSetup() {
  // 1. Run e2e-seed.mjs inside the api container to create the test user + session
  const seedOutput = execSync(
    `docker compose -p ${COMPOSE_PROJECT} exec -T ${API_SERVICE} node scripts/e2e-seed.mjs`,
    { env: process.env, encoding: 'utf8' },
  );

  const cookieLine = seedOutput
    .split('\n')
    .find((l) => l.startsWith('SESSION_COOKIE='));

  if (!cookieLine) {
    throw new Error(`e2e-seed.mjs did not emit SESSION_COOKIE. Output:\n${seedOutput}`);
  }

  const sessionCookie = cookieLine.replace('SESSION_COOKIE=', '').trim();

  // 2. Fetch CSRF token from /api/auth/me
  const meRes = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Cookie: `ofl.sid=${sessionCookie}` },
  });

  if (!meRes.ok) {
    throw new Error(`GET /api/auth/me failed: ${meRes.status} ${await meRes.text()}`);
  }

  const me = (await meRes.json()) as { csrfToken: string };
  const csrfToken = me.csrfToken;

  // 3. Upload minimal.tcx to create a pre-seeded event
  const fixturePath = resolve(__dirname, '../backend/test/fixtures/minimal.tcx');
  const tcxBytes = readFileSync(fixturePath);
  const formData = new FormData();
  formData.append('files', new Blob([tcxBytes], { type: 'application/octet-stream' }), 'minimal.tcx');

  const uploadRes = await fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: {
      Cookie: `ofl.sid=${sessionCookie}`,
      'CSRF-Token': csrfToken,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`POST /api/events failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const uploadBody = (await uploadRes.json()) as {
    results: Array<{ success: boolean; id?: string; event?: { id: string } }>;
  };

  const successResult = uploadBody.results.find((r) => r.success && r.event);
  if (!successResult?.event) {
    throw new Error(`Upload did not return a successful event. Body: ${JSON.stringify(uploadBody)}`);
  }

  const eventId = successResult.event.id;

  // Fetch the created event to get activity IDs (upload response does not include DB-assigned IDs)
  const eventRes = await fetch(`${API_BASE}/api/events/${eventId}`, {
    headers: { Cookie: `ofl.sid=${sessionCookie}` },
  });

  if (!eventRes.ok) {
    throw new Error(`GET /api/events/${eventId} failed: ${eventRes.status} ${await eventRes.text()}`);
  }

  const eventBody = (await eventRes.json()) as {
    event: { id: string };
    activities: Array<{ id: string }>;
  };
  const activityId = eventBody.activities[0]?.id;

  if (!activityId) {
    throw new Error(`Uploaded event has no activities. Event: ${JSON.stringify(eventBody)}`);
  }

  // 4. Write storageState.json so Playwright reuses the session cookie
  const FRONT_PORT = process.env.E2E_FRONT_PORT ?? '4201';
  const storageState = {
    cookies: [
      {
        name: 'ofl.sid',
        value: sessionCookie,
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [
      {
        origin: `http://localhost:${FRONT_PORT}`,
        localStorage: [],
      },
    ],
  };

  writeFileSync(resolve(__dirname, 'storageState.json'), JSON.stringify(storageState, null, 2));

  // 5. Write e2e-context.json with IDs and tokens for tests to consume
  const context = { csrfToken, eventId, activityId, sessionCookie, apiBase: API_BASE };
  writeFileSync(resolve(__dirname, 'e2e-context.json'), JSON.stringify(context, null, 2));

  console.log(`[global-setup] Seed complete. eventId=${eventId} activityId=${activityId}`);
}

export default globalSetup;
