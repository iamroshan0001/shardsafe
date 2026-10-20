import { bufferToHex } from './hexUtils';

/**
 * Computes SHA-256 checksum of an ArrayBuffer using Web Crypto API
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer as unknown as BufferSource);
  return bufferToHex(digestBuffer);
}
