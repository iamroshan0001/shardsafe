import { hexToBuffer } from './hexUtils';
import { computeSha256 } from './checksum';

export interface DecryptChunkOptions {
  ciphertextBuffer: ArrayBuffer;
  ivHex: string;
  expectedChecksum?: string;
  segmentNumber: number;
}

/**
 * Decrypts an individual ciphertext segment with AES-256-GCM.
 * Validates integrity tag and checksum. Throws on incorrect passphrase or tampered ciphertext.
 */
export async function decryptChunk(
  options: DecryptChunkOptions,
  aesKey: CryptoKey
): Promise<ArrayBuffer> {
  const { ciphertextBuffer, ivHex, expectedChecksum, segmentNumber } = options;

  // 1. Verify ciphertext checksum if provided
  if (expectedChecksum) {
    const actualChecksum = await computeSha256(ciphertextBuffer);
    if (actualChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
      throw new Error(
        `Integrity Check Failed: Segment #${segmentNumber} checksum mismatch. Expected ${expectedChecksum.slice(0, 8)}..., got ${actualChecksum.slice(0, 8)}...`
      );
    }
  }

  // 2. Parse 96-bit IV
  const iv = hexToBuffer(ivHex);

  // 3. Decrypt with AES-GCM
  try {
    const plaintext = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        tagLength: 128,
      },
      aesKey,
      ciphertextBuffer
    );

    return plaintext;
  } catch (err: any) {
    // SubtleCrypto throws OperationError when authentication tag fails
    throw new Error(
      `Decryption Failed for Segment #${segmentNumber}: Incorrect encryption passphrase or data has been tampered with.`
    );
  }
}

/**
 * Reassembles an array of decrypted ArrayBuffers into a complete Blob with original MIME type
 */
export function reassembleFile(chunks: ArrayBuffer[], mimeType: string): Blob {
  return new Blob(chunks, { type: mimeType });
}
