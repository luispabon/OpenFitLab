import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

async function globalTeardown() {
  for (const file of ['storageState.json', 'e2e-context.json']) {
    const p = resolve(__dirname, file);
    if (existsSync(p)) {
      unlinkSync(p);
    }
  }
}

export default globalTeardown;
