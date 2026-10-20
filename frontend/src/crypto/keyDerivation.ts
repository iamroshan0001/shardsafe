import { hexToBuffer } from './hexUtils';

export interface KeyDerivationOptions {
  iterations?: number;
  saltHex: string;
}

export const DEFAULT_PBKDF2_ITERATIONS = 100000;

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user passphrase and a per-file salt
 * using PBKDF2-HMAC-SHA-256.
 * All operations take place strictly within the browser's SubtleCrypto sandbox.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  options: KeyDerivationOptions
): Promise<CryptoKey> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Encryption passphrase cannot be empty');
  }

  const iterations = options.iterations || DEFAULT_PBKDF2_ITERATIONS;
  const salt = hexToBuffer(options.saltHex);

  // 1. Encode the plaintext passphrase into a Uint8Array
  const enc = new TextEncoder();
  const passphraseBytes = enc.encode(passphrase);

  // 2. Import raw passphrase as a key suitable for PBKDF2
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 3. Derive 256-bit AES-GCM encryption key
  const aesKey = await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // Non-extractable for maximum security in memory
    ['encrypt', 'decrypt']
  );

  return aesKey;
}
