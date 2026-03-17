import { test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type E2EContext = {
  csrfToken: string;
  eventId: string;
  activityId: string;
  sessionCookie: string;
  apiBase: string;
};

type AuthFixtures = {
  csrfToken: string;
  eventId: string;
  activityId: string;
  sessionCookie: string;
  apiBase: string;
};

/**
 * Extends Playwright's `test` with auth fixtures sourced from e2e-context.json,
 * which is written by global-setup.ts.
 */
export const test = base.extend<AuthFixtures>({
  csrfToken: async ({}, use) => {
    const ctx = readContext();
    await use(ctx.csrfToken);
  },
  eventId: async ({}, use) => {
    const ctx = readContext();
    await use(ctx.eventId);
  },
  activityId: async ({}, use) => {
    const ctx = readContext();
    await use(ctx.activityId);
  },
  sessionCookie: async ({}, use) => {
    const ctx = readContext();
    await use(ctx.sessionCookie);
  },
  apiBase: async ({}, use) => {
    const ctx = readContext();
    await use(ctx.apiBase);
  },
});

export { expect } from '@playwright/test';

function readContext(): E2EContext {
  const p = resolve(__dirname, '../e2e-context.json');
  return JSON.parse(readFileSync(p, 'utf8')) as E2EContext;
}
