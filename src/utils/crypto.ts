/**
 * Cryptographic helpers for secure PIN hashing using Web Crypto API (crypto.subtle)
 */

export function generateSalt(length = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function hashPinWithSalt(pin: string, salt: string): Promise<string> {
  const normalizedPin = pin.trim();
  const data = new TextEncoder().encode(salt + ':' + normalizedPin);

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure fallback if subtle not available
  let hash = 0;
  const str = salt + ':' + normalizedPin;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Verify a PIN against stored hash and salt (supports automatic migration)
 */
export async function verifyPin(
  inputPin: string,
  user: { pin: string; pinHash?: string; salt?: string }
): Promise<boolean> {
  const trimmed = inputPin.trim();

  // If already migrated to hashed PIN
  if (user.pinHash && user.salt) {
    const computedHash = await hashPinWithSalt(trimmed, user.salt);
    return computedHash === user.pinHash;
  }

  // Fallback to legacy plain-text match
  return user.pin === trimmed;
}
