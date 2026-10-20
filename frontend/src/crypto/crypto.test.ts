import { describe, it, expect } from 'vitest';
import { deriveKeyFromPassphrase } from './keyDerivation';
import { sliceFileIntoChunks, encryptChunk } from './chunkCipher';
import { decryptChunk, reassembleFile } from './chunkDecipher';
import { bufferToHex, generateRandomBytes } from './hexUtils';

describe('ShardSafe Web Crypto Core Tests', () => {
  const testPassphrase = 'MySuperSecretCollegeDemoPassphrase2026!';
  const wrongPassphrase = 'IncorrectPassphrase123!';
  const saltHex = bufferToHex(generateRandomBytes(16));

  it('1. Derives AES-256-GCM CryptoKey via PBKDF2', async () => {
    const key = await deriveKeyFromPassphrase(testPassphrase, {
      saltHex,
      iterations: 10000,
    });
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('2. Slices file into exact chunk sizes', () => {
    // 2.5 MB dummy content
    const totalBytes = 2.5 * 1024 * 1024;
    const dummyData = new Uint8Array(totalBytes);
    const blob = new Blob([dummyData]);
    const chunkSize = 1024 * 1024; // 1MB

    const chunks = sliceFileIntoChunks(blob, chunkSize);
    expect(chunks.length).toBe(3);
    expect(chunks[0].size).toBe(1024 * 1024);
    expect(chunks[1].size).toBe(1024 * 1024);
    expect(chunks[2].size).toBe(0.5 * 1024 * 1024);
  });

  it('3. Encrypts and decrypts file chunks with correct passphrase', async () => {
    const originalText = 'ShardSafe: Secure Cloud File Vault with Block-Level Encryption and AWS S3 Storage.';
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const originalBlob = new Blob([encoder.encode(originalText)]);

    // Derive key
    const encKey = await deriveKeyFromPassphrase(testPassphrase, { saltHex, iterations: 10000 });

    // Encrypt
    const encResult = await encryptChunk(originalBlob, 0, encKey);
    expect(encResult.encryptedSize).toBeGreaterThan(originalText.length);
    expect(encResult.encryptionIvHex.length).toBe(24); // 12 bytes = 24 hex chars
    expect(encResult.checksum).toBeDefined();

    // Decrypt
    const decKey = await deriveKeyFromPassphrase(testPassphrase, { saltHex, iterations: 10000 });
    const cipherBuffer = await encResult.encryptedBlob.arrayBuffer();

    const decryptedBuffer = await decryptChunk(
      {
        ciphertextBuffer: cipherBuffer,
        ivHex: encResult.encryptionIvHex,
        expectedChecksum: encResult.checksum,
        segmentNumber: 1,
      },
      decKey
    );

    const reassembledBlob = reassembleFile([decryptedBuffer], 'text/plain');
    const decryptedText = decoder.decode(await reassembledBlob.arrayBuffer());

    expect(decryptedText).toBe(originalText);
  });

  it('4. Rejects decryption when passphrase is wrong', async () => {
    const originalText = 'Highly confidential data for AWS RDS & S3 vault.';
    const encKey = await deriveKeyFromPassphrase(testPassphrase, { saltHex, iterations: 10000 });
    const encResult = await encryptChunk(new Blob([new TextEncoder().encode(originalText)]), 0, encKey);

    // Derive key with WRONG passphrase
    const wrongKey = await deriveKeyFromPassphrase(wrongPassphrase, { saltHex, iterations: 10000 });
    const cipherBuffer = await encResult.encryptedBlob.arrayBuffer();

    await expect(
      decryptChunk(
        {
          ciphertextBuffer: cipherBuffer,
          ivHex: encResult.encryptionIvHex,
          expectedChecksum: encResult.checksum,
          segmentNumber: 1,
        },
        wrongKey
      )
    ).rejects.toThrow(/Decryption Failed/i);
  });

  it('5. Detects tampered ciphertext blocks via checksum and GCM authentication tag', async () => {
    const encKey = await deriveKeyFromPassphrase(testPassphrase, { saltHex, iterations: 10000 });
    const encResult = await encryptChunk(new Blob([new TextEncoder().encode('Test Data')]), 0, encKey);

    const cipherBuffer = await encResult.encryptedBlob.arrayBuffer();
    // Tamper with first byte of ciphertext
    const tampered = new Uint8Array(cipherBuffer);
    tampered[0] ^= 0xff;

    await expect(
      decryptChunk(
        {
          ciphertextBuffer: tampered.buffer,
          ivHex: encResult.encryptionIvHex,
          expectedChecksum: encResult.checksum,
          segmentNumber: 1,
        },
        encKey
      )
    ).rejects.toThrow(/checksum mismatch|Decryption Failed/i);
  });
});
