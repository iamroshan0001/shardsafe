import React, { useState } from 'react';
import { Upload, Lock, Shield, Eye, EyeOff, AlertTriangle, CheckCircle2, RefreshCw, X, File, Cpu } from 'lucide-react';
import { BlockMatrix, BlockItem } from './BlockMatrix';
import { deriveKeyFromPassphrase } from '../crypto/keyDerivation';
import { sliceFileIntoChunks, encryptChunk } from '../crypto/chunkCipher';
import { bufferToHex, generateRandomBytes, formatBytes } from '../crypto/hexUtils';
import { api } from '../api/client';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [chunkSizeBytes, setChunkSizeBytes] = useState(1048576); // 1 MiB default
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    const maxMb = 50;
    if (file.size > maxMb * 1024 * 1024) {
      setErrorMessage(`File exceeds maximum permitted size of ${maxMb} MB.`);
      return;
    }
    if (file.size === 0) {
      setErrorMessage('Zero-byte files cannot be uploaded to vault.');
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');
    setUploadComplete(false);

    // Calculate preliminary blocks
    const totalParts = Math.ceil(file.size / chunkSizeBytes);
    const initialBlocks: BlockItem[] = [];
    for (let i = 1; i <= totalParts; i++) {
      initialBlocks.push({
        number: i,
        state: 'pending',
        plaintextSize: i === totalParts ? file.size - (totalParts - 1) * chunkSizeBytes : chunkSizeBytes,
      });
    }
    setBlocks(initialBlocks);
  };

  const handleChunkSizeChange = (bytes: number) => {
    setChunkSizeBytes(bytes);
    if (selectedFile) {
      const totalParts = Math.ceil(selectedFile.size / bytes);
      const initialBlocks: BlockItem[] = [];
      for (let i = 1; i <= totalParts; i++) {
        initialBlocks.push({
          number: i,
          state: 'pending',
          plaintextSize: i === totalParts ? selectedFile.size - (totalParts - 1) * bytes : bytes,
        });
      }
      setBlocks(initialBlocks);
    }
  };

  const startUploadPipeline = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a file to encrypt and upload.');
      return;
    }
    if (!passphrase || passphrase.length < 6) {
      setErrorMessage('Please enter an encryption passphrase with at least 6 characters.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('1/4 Creating encryption key from your passphrase...');

    try {
      // 1. Generate cryptographic salt (16 bytes = 128 bit)
      const saltBytes = generateRandomBytes(16);
      const saltHex = bufferToHex(saltBytes);

      // 2. Derive key locally
      const aesKey = await deriveKeyFromPassphrase(passphrase, {
        saltHex,
        iterations: 100000,
      });

      // 3. Slice file into chunks
      setStatusMessage('2/4 Slicing file into blocks...');
      const rawChunks = sliceFileIntoChunks(selectedFile, chunkSizeBytes);
      const segmentCount = rawChunks.length;

      // Update blocks to segmenting state
      setBlocks((prev) =>
        prev.map((b) => ({ ...b, state: 'segmenting' }))
      );

      // 4. Register file with backend & database
      setStatusMessage('3/4 Registering file blocks in cloud catalog...');
      const initRes = await api.initiateUpload({
        originalFilename: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        originalSize: selectedFile.size,
        segmentCount,
        segmentSize: chunkSizeBytes,
        encryptionSalt: saltHex,
        keyDerivationParameters: {
          algorithm: 'PBKDF2-HMAC-SHA-256',
          iterations: 100000,
          keyLengthBits: 256,
          cipher: 'AES-GCM-256',
        },
      });

      const fileId = initRes.file.id!;
      setActiveFileId(fileId);

      // 5. Encrypt and Upload chunks
      setStatusMessage('4/4 Encrypting blocks and uploading directly to cloud storage...');
      const concurrency = 2;
      let currentIndex = 0;

      const processChunk = async (index: number) => {
        const partNumber = index + 1;
        const chunkBlob = rawChunks[index];

        // Mark encrypting
        setBlocks((prev) =>
          prev.map((b) => (b.number === partNumber ? { ...b, state: 'encrypting' } : b))
        );

        // Client-side AES-256-GCM encryption
        const encResult = await encryptChunk(chunkBlob, index, aesKey);

        // Mark uploading
        setBlocks((prev) =>
          prev.map((b) =>
            b.number === partNumber
              ? {
                  ...b,
                  state: 'uploading',
                  encryptedSize: encResult.encryptedSize,
                  ivHex: encResult.encryptionIvHex,
                  checksum: encResult.checksum,
                }
              : b
          )
        );

        // Fetch presigned PUT URL from EC2 API
        const { uploadUrl, s3ObjectKey } = await api.getUploadPresignedUrl(fileId, partNumber);

        // Direct browser-to-S3 transfer
        await api.uploadChunkDirectToS3(uploadUrl, encResult.encryptedBlob);

        // Register uploaded segment in RDS
        await api.completePart(fileId, partNumber, {
          encryptedSize: encResult.encryptedSize,
          encryptionIv: encResult.encryptionIvHex,
          checksum: encResult.checksum,
        });

        // Mark uploaded
        setBlocks((prev) =>
          prev.map((b) =>
            b.number === partNumber
              ? {
                  ...b,
                  state: 'uploaded',
                  s3Key: s3ObjectKey,
                }
              : b
          )
        );
      };

      const workerPool = async () => {
        while (currentIndex < segmentCount) {
          const idx = currentIndex++;
          await processChunk(idx);
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, segmentCount) }, () => workerPool());
      await Promise.all(workers);

      // 6. Complete and verify file upload in RDS
      setStatusMessage('5/5 Verifying all encrypted segments in database...');
      await api.completeFile(fileId);

      setUploadComplete(true);
      setStatusMessage('File successfully segmented, encrypted, and vaulted in Amazon S3!');
      onUploadSuccess();
    } catch (err: any) {
      console.error('[Upload Pipeline] Error:', err);
      setErrorMessage(err.message || 'Upload pipeline failed');
      setBlocks((prev) =>
        prev.map((b) => (b.state !== 'uploaded' ? { ...b, state: 'failed', error: err.message } : b))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPassphrase('');
    setBlocks([]);
    setUploadComplete(false);
    setIsProcessing(false);
    setErrorMessage('');
    setStatusMessage('');
    setActiveFileId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-ink-900 border border-ink-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-ink-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono">Upload to Secure Vault</h2>
              <p className="text-xs text-ink-400">
                Files are encrypted block by block directly in your browser
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

        {/* Success View */}
        {uploadComplete ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white font-mono">Vault Storage Verified</h3>
            <p className="text-sm text-ink-300 max-w-lg mx-auto">
              Your file <span className="text-cyan-300 font-semibold">{selectedFile?.name}</span> has been cut into{' '}
              <span className="text-emerald-300 font-semibold">{blocks.length} encrypted blocks</span> and stored securely in Amazon S3.
            </p>

            <div className="max-w-2xl mx-auto my-6 p-4 rounded-xl bg-ink-950 border border-ink-800 text-left">
              <div className="text-xs font-mono text-ink-400 mb-2">STORED BLOCKS:</div>
              <BlockMatrix blocks={blocks} interactive={false} />
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-lg text-xs font-medium text-ink-300 hover:text-white bg-ink-800 hover:bg-ink-750 transition"
              >
                Upload Another File
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 transition shadow"
              >
                View in Vault
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Step 1: File Drop Zone */}
            {!selectedFile ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-ink-700 hover:border-cyan-500/60 rounded-xl p-8 bg-ink-950/50 hover:bg-ink-950/80 cursor-pointer transition group">
                <Upload className="w-10 h-10 text-ink-500 group-hover:text-cyan-400 transition mb-3" />
                <span className="text-sm font-medium text-white mb-1">
                  Click to browse or drop file here
                </span>
                <span className="text-xs text-ink-400">
                  Supports any file format up to 50 MiB (PDF, images, archives, docs)
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
              </label>
            ) : (
              <div className="p-4 rounded-xl bg-ink-950 border border-ink-800 flex items-center justify-between">
                <div className="flex items-center gap-3 truncate">
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <File className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-semibold text-white truncate">{selectedFile.name}</div>
                    <div className="text-xs text-ink-400 font-mono">
                      {formatBytes(selectedFile.size)} • {selectedFile.type || 'binary/stream'}
                    </div>
                  </div>
                </div>
                {!isProcessing && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1 text-ink-400 hover:text-rose-400 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Step 2: Passphrase & Chunk Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-300 mb-1.5 flex items-center justify-between">
                  <span>Secret Passphrase</span>
                  <span className="text-[10px] text-cyan-400 font-normal">Stays on your device</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    disabled={isProcessing}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter secret passphrase..."
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
                <p className="text-[10px] text-ink-500 mt-1">
                  Required to decrypt your file later. Never sent to the cloud.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-300 mb-1.5">
                  Block Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '512 KiB', bytes: 524288 },
                    { label: '1 MiB', bytes: 1048576 },
                    { label: '2 MiB', bytes: 2097152 },
                  ].map((opt) => (
                    <button
                      key={opt.bytes}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleChunkSizeChange(opt.bytes)}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-medium border transition ${
                        chunkSizeBytes === opt.bytes
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                          : 'bg-ink-950 border-ink-800 text-ink-400 hover:border-ink-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-ink-500 mt-1">
                  Divides file into separate blocks for reliable upload.
                </p>
              </div>
            </div>

            {/* Block Matrix Preview during / before upload */}
            {blocks.length > 0 && (
              <div className="p-4 rounded-xl bg-ink-950/70 border border-ink-800/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-white font-mono">
                      BLOCK ENCRYPTION PROGRESS
                    </span>
                  </div>
                  {isProcessing && (
                    <span className="text-xs text-cyan-400 animate-pulse font-mono">{statusMessage}</span>
                  )}
                </div>
                <BlockMatrix blocks={blocks} interactive={!isProcessing} />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-ink-800">
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
                onClick={startUploadPipeline}
                disabled={isProcessing || !selectedFile || passphrase.length < 6}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 transition shadow-lg shadow-cyan-950 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Blocks...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Encrypt & Vault File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
