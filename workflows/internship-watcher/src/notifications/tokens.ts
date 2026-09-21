import * as crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

export interface ActionTokenPair {
  plaintext: string;
  hash: string;
}

/**
 * Generates a cryptographically random capability token.
 * Returns the plaintext token (to be embedded in the webhook URL)
 * and the SHA-256 hash (to be stored in the database).
 */
export function generateActionToken(): ActionTokenPair {
  // Generate 32 bytes of secure random data
  const plaintext = crypto.randomBytes(32).toString('hex');
  
  // Hash it using SHA-256 for secure database storage
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  
  return { plaintext, hash };
}

/**
 * Verifies if a provided plaintext token matches a stored hash.
 */
export function verifyActionToken(plaintext: string, storedHash: string): boolean {
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  
  // Prevent timing attacks when comparing hashes
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  } catch {
    return false; // Will throw if lengths don't match, etc.
  }
}
