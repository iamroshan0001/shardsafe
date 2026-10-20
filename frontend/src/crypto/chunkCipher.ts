import { bufferToHex, generateRandomBytes } from './hexUtils';
import { computeSha256 } from './checksum';

export interface EncryptedChunkResult {
  chunkIndex: number;
  encryptedBlob: Blob;
  encryptedSize: number;
  encryptionIvHex: string;
  checksum: string;
  plaintextSize: number;
}

/**
 * Splits a File or Blob into chunks of specified byte size
 */
export function sliceFileIntoChunks(file: Blob, chunkSizeBytes: number): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + chunkSizeBytes, file.size);
    chunks.push(file.slice(offset, end));
    offset = end;
  }
  return chunks;
}

/**
 * Encrypts an individual binary chunk using AES-256-GCM with a unique 96-bit IV
 */
export async function encryptChunk(
  chunkBlob: Blob,
  chunkIndex: number,
  aesKey: CryptoKey
): Promise<EncryptedChunkResult> {
  const plaintextBuffer = await chunkBlob.arrayBuffer();

  // 1. Generate unique 96-bit (12 bytes) IV for this chunk
  // Nonce reuse in GCM mode is catastrophic, so every block gets a freshly generated IV
  const iv = generateRandomBytes(12);

  // 2. Encrypt with AES-GCM (128-bit authentication tag appended automatically)
  const ciphertextBuffer = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    },
    aesKey,
    plaintextBuffer
  );

  // 3. Compute SHA-256 checksum of the ciphertext block for S3 transit verification
  const checksum = await computeSha256(ciphertextBuffer);

  const encryptedBlob = new Blob([ciphertextBuffer], { type: 'application/octet-stream' });

  return {
    chunkIndex,
    encryptedBlob,
    encryptedSize: ciphertextBuffer.byteLength,
    encryptionIvHex: bufferToHex(iv),
    checksum,
    plaintextSize: plaintextBuffer.byteLength,
  };
}
