import React, { useState } from 'react';
import { Download, Key, Shield, Eye, EyeOff, AlertTriangle, CheckCircle2, RefreshCw, X, File, Cpu } from 'lucide-react';
import { BlockMatrix, BlockItem } from './BlockMatrix';
import { deriveKeyFromPassphrase } from '../crypto/keyDerivation';
import { decryptChunk, reassembleFile } from '../crypto/chunkDecipher';
import { formatBytes } from '../crypto/hexUtils';
import { api, VaultFile, FileSegmentMetadata } from '../api/client';

interface DownloadModalProps {
  file: VaultFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ file, isOpen, onClose }) => {
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [blocks, setBlocks] = useState<BlockItem[]>([]);

  if (!isOpen || !file) return null;

  // Initialize blocks from segment count if empty
  const initBlocks = () => {
    const list: BlockItem[] = [];
    for (let i = 1; i <= file.segment_count; i++) {
      list.push({
        number: i,
        state: 'pending',
      });
    }
    return list;
  };

  const startDownloadPipeline = async () => {
    if (!passphrase) {
      setErrorMessage('Please enter the file encryption passphrase.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setDownloadComplete(false);

    // Initialize block matrix states
    const blockList = initBlocks();
    setBlocks(blockList);

    try {
      // 1. Fetch file details and segments from RDS
      setStatusMessage('1/4 Retrieving file blocks from cloud...');
      const details = await api.getFileDetails(file.id);
      const segments: FileSegmentMetadata[] = details.segments;

      if (segments.length !== file.segment_count) {
        throw new Error(`Integrity error: Expected ${file.segment_count} segments, but catalog returned ${segments.length}`);
      }

      // 2. Derive Key locally from passphrase and stored salt
      setStatusMessage('2/4 Deriving private key from passphrase...');
      const aesKey = await deriveKeyFromPassphrase(passphrase, {
        saltHex: file.encryption_salt,
        iterations: file.key_derivation_parameters?.iterations || 100000,
      });

      // 3. Download encrypted ciphertext segments and decrypt
      setStatusMessage('3/4 Downloading and decrypting blocks in browser...');
      const decryptedChunks: ArrayBuffer[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const partNumber = seg.segment_number;

        // Mark downloading
        setBlocks((prev) =>
          prev.map((b) => (b.number === partNumber ? { ...b, state: 'downloading', s3Key: seg.s3_object_key } : b))
        );

        // Fetch short-lived presigned GET URL
        const { downloadUrl } = await api.getDownloadPresignedUrl(file.id, partNumber);

        // Fetch raw ciphertext from S3
        const ciphertextBuffer = await api.downloadChunkDirectFromS3(downloadUrl);

        // Mark decrypting
        setBlocks((prev) =>
          prev.map((b) => (b.number === partNumber ? { ...b, state: 'decrypting' } : b))
        );

        // Decrypt with Web Crypto
        const plaintextBuffer = await decryptChunk(
          {
            ciphertextBuffer,
            ivHex: seg.encryption_iv,
            expectedChecksum: seg.checksum,
            segmentNumber: partNumber,
          },
          aesKey
        );

        decryptedChunks.push(plaintextBuffer);

        // Mark verified and decrypted
        setBlocks((prev) =>
          prev.map((b) =>
            b.number === partNumber
              ? {
                  ...b,
                  state: 'uploaded', // shown as verified/safe in green
                  plaintextSize: plaintextBuffer.byteLength,
                }
              : b
          )
        );
      }

      // 4. Reconstruct file and trigger browser download
      setStatusMessage('4/4 Reassembling original file in browser...');
      const reassembledBlob = reassembleFile(decryptedChunks, file.mime_type || 'application/octet-stream');

      // Trigger standard browser download
      const downloadUrl = URL.createObjectURL(reassembledBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setDownloadComplete(true);
      setStatusMessage('File successfully decrypted and reconstructed in browser!');
    } catch (err: any) {
      console.error('[Download Pipeline] Error:', err);
      setErrorMessage(err.message || 'Decryption failed. Please verify your passphrase.');
      setBlocks((prev) =>
        prev.map((b) => ({ ...b, state: 'failed', error: err.message }))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-ink-900 border border-ink-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-ink-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono">Decrypt & Download Vault File</h2>
              <p className="text-xs text-ink-400">
                Blocks are retrieved from S3 and decrypted in your browser
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* File Metadata Overview */}
        <div className="mt-6 p-4 rounded-xl bg-ink-950 border border-ink-800 flex items-center justify-between">
          <div className="flex items-center gap-3 truncate">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <File className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="text-sm font-semibold text-white truncate">{file.original_filename}</div>
              <div className="text-xs text-ink-400 font-mono">
                {formatBytes(file.original_size)} • {file.segment_count} Encrypted S3 Segments
              </div>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-md bg-ink-900 border border-ink-700 text-[11px] font-mono text-cyan-400">
            Encrypted
          </div>
        </div>

        {/* Passphrase Entry */}
        <div className="mt-5 space-y-2">
          <label className="block text-xs font-semibold text-ink-300 flex items-center justify-between">
            <span>Enter Secret Passphrase</span>
            <span className="text-[10px] text-cyan-400 font-normal">Decrypted locally on your device</span>
          </label>
          <div className="relative">
            <input
              type={showPassphrase ? 'text' : 'password'}
              value={passphrase}
              disabled={isProcessing}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase used when uploading..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-ink-700 focus:border-cyan-500 focus:outline-none text-white text-xs placeholder:text-ink-600 pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassphrase(!showPassphrase)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
            >
              {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-ink-500">
            If the passphrase is incorrect, decryption will be rejected immediately to prevent corrupted data.
          </p>
        </div>

        {/* Live Block Matrix Reconstruction */}
        {blocks.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-ink-950/70 border border-ink-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white font-mono">
                  BLOCK RECONSTRUCTION PROGRESS
                </span>
              </div>
              <span className="text-xs text-cyan-400 font-mono">{statusMessage}</span>
            </div>
            <BlockMatrix blocks={blocks} interactive={false} />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-ink-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-medium text-ink-400 hover:text-white bg-ink-800/50 hover:bg-ink-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={startDownloadPipeline}
            disabled={isProcessing || !passphrase}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 transition shadow-lg shadow-cyan-950 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Decrypting Blocks...</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>Decrypt & Reconstruct File</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
