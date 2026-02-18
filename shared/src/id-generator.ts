/**
 * Shared ID generator for deterministic event and activity IDs.
 * Works in both browser and Node.js using SubtleCrypto for SHA-256.
 */

export const EVENT_DUPLICATE_THRESHOLD_MS = 100;

export async function generateEventID(userID: string, startDate: Date): Promise<string> {
  const time = startDate.getTime();
  const bucketedTime = Math.floor(time / EVENT_DUPLICATE_THRESHOLD_MS) * EVENT_DUPLICATE_THRESHOLD_MS;
  const parts = [userID, bucketedTime.toString()];
  return generateIDFromParts(parts);
}

export async function generateActivityID(eventID: string, index: number): Promise<string> {
  const parts = [eventID, index.toString()];
  return generateIDFromParts(parts);
}

export async function generateIDFromParts(parts: string[]): Promise<string> {
  const msgUint8 = new TextEncoder().encode(parts.join(':'));
  const cryptoSubtle = globalThis.crypto?.subtle;
  if (!cryptoSubtle) {
    throw new Error('Crypto Subtle API is not available in this environment.');
  }
  const hashBuffer = await cryptoSubtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
