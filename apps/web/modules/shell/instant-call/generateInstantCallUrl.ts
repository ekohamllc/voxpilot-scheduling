const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_LENGTH = 8;

/**
 * Generates a random, unguessable slug for a one-off Jitsi Meet room.
 * Prefers the Web Crypto API (available in all supported browsers) and
 * falls back to Math.random only if crypto is unavailable.
 */
function randomSlug(length = SLUG_LENGTH): string {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : undefined;

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint32Array(length);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length]).join("");
  }

  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

/** Builds a fresh https://meet.jit.si/voxpilot-<random-slug> room URL. */
export function generateInstantCallUrl(): string {
  return `https://meet.jit.si/voxpilot-${randomSlug()}`;
}
