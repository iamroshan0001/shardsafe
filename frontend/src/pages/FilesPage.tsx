import React, { useState, useEffect } from 'react';
import { HardDrive, Search, Download, Trash2, Eye, RefreshCw, AlertTriangle, Shield, Layers, File, X } from 'lucide-react';
import { api, VaultFile, FileSegmentMetadata } from '../api/client';
import { formatBytes } from '../crypto/hexUtils';
import { BlockMatrix, BlockItem } from '../components/BlockMatrix';

interface FilesPageProps {
  onSelectFileForDownload: (file: VaultFile) => void;
  onOpenUpload: () => void;
}

export const FilesPage: React.FC<FilesPageProps> = ({ onSelectFileForDownload, onOpenUpload }) => {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFileForInspection, setSelectedFileForInspection] = useState<VaultFile | null>(null);
  const [inspectedSegments, setInspectedSegments] = useState<FileSegmentMetadata[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await api.listFiles(search);
      setFiles(data.files);
    } catch (err) {
      console.error('[Files] Error loading files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [search]);

  const inspectFile = async (file: VaultFile) => {
    setSelectedFileForInspection(file);
    setLoadingSegments(true);
    try {
      const details = await api.getFileDetails(file.id);
      setInspectedSegments(details.segments);
    } catch (err) {
      console.error('[Files] Error inspecting file segments:', err);
    } finally {
      setLoadingSegments(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await api.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (selectedFileForInspection?.id === fileId) {
        setSelectedFileForInspection(null);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-mono tracking-tight">Encrypted File Vault</h1>
          <p className="text-xs text-ink-400">
            Catalog of segmented, encrypted files stored in Amazon S3 and indexed in Amazon RDS.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vaulted files..."
              className="w-full px-3.5 py-2 rounded-xl bg-ink-900 border border-ink-800 focus:border-cyan-500 focus:outline-none text-xs text-white placeholder:text-ink-600 pl-9 font-mono"
            />
            <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <button
            onClick={onOpenUpload}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 transition shadow shrink-0"
          >
            Upload File
          </button>
        </div>
      </div>

      {/* Files List Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono text-ink-400">Querying RDS database...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-ink-800 rounded-2xl bg-ink-950/40">
          <HardDrive className="w-10 h-10 text-ink-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white font-mono mb-1">No Files Found</h3>
          <p className="text-xs text-ink-400 max-w-sm mx-auto mb-4">
            {search ? 'No files match your search query.' : 'Your vault is currently empty. Upload a file to see block segmentation and S3 storage in action.'}
          </p>
          <button
            onClick={onOpenUpload}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition"
          >
            Upload File Now
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-800 bg-ink-900/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-950/80 border-b border-ink-800 text-ink-400 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Filename</th>
                <th className="py-3 px-4">Original Size</th>
                <th className="py-3 px-4">S3 Segments</th>
                <th className="py-3 px-4">Security</th>
                <th className="py-3 px-4">Vault Status</th>
                <th className="py-3 px-4">Uploaded</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/80 font-mono">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-ink-850/50 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5 font-semibold text-white truncate max-w-xs">
                      <File className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="truncate" title={file.original_filename}>
                        {file.original_filename}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-ink-300">{formatBytes(file.original_size)}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-ink-950 border border-ink-800 text-cyan-300 font-bold">
                      {file.segment_count} {file.segment_count === 1 ? 'part' : 'parts'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[11px] text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-800/60">
                      Encrypted
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        file.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {file.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-ink-400 text-[11px]">
                    {new Date(file.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => inspectFile(file)}
                        className="p-1.5 rounded-lg bg-ink-950 hover:bg-ink-800 text-ink-300 hover:text-white border border-ink-800 transition"
                        title="Inspect S3 Blocks and Metadata"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectFileForDownload(file)}
                        className="p-1.5 rounded-lg bg-ink-950 hover:bg-cyan-500/10 text-cyan-400 hover:text-cyan-300 border border-ink-800 hover:border-cyan-500/40 transition"
                        title="Decrypt and Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {deleteConfirmId === file.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(file.id)}
                            disabled={deletingId === file.id}
                            className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-500 transition"
                          >
                            {deletingId === file.id ? '...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 rounded bg-ink-800 text-ink-300 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(file.id)}
                          className="p-1.5 rounded-lg bg-ink-950 hover:bg-rose-500/10 text-ink-400 hover:text-rose-400 border border-ink-800 hover:border-rose-500/40 transition"
                          title="Permanently Delete from S3 and RDS"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* File Details & Segment Inspection Modal */}
      {selectedFileForInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-ink-900 border border-ink-700 rounded-2xl shadow-2xl p-6 sm:p-8 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-ink-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white font-mono">
                    File Block Catalog & S3 Mapping
                  </h2>
                  <p className="text-xs text-ink-400 font-mono truncate max-w-md">
                    {selectedFileForInspection.original_filename} ({selectedFileForInspection.id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFileForInspection(null)}
                className="p-1.5 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cryptographic Parameters Stored in RDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-5 text-xs font-mono">
              <div className="p-3 rounded-xl bg-ink-950 border border-ink-800">
                <div className="text-[10px] text-ink-500 uppercase">File Salt</div>
                <div className="text-ink-200 truncate mt-1">{selectedFileForInspection.encryption_salt}</div>
              </div>
              <div className="p-3 rounded-xl bg-ink-950 border border-ink-800">
                <div className="text-[10px] text-ink-500 uppercase">Protection</div>
                <div className="text-cyan-300 truncate mt-1">Secret Passphrase Key</div>
              </div>
              <div className="p-3 rounded-xl bg-ink-950 border border-ink-800">
                <div className="text-[10px] text-ink-500 uppercase">Storage Path</div>
                <div className="text-emerald-300 truncate mt-1">vault/user/file/part-XXXX.bin</div>
              </div>
            </div>

            {/* Visual Blocks representation */}
            {loadingSegments ? (
              <div className="py-12 text-center text-xs font-mono text-ink-400">
                Loading segment objects from RDS...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-ink-950 border border-ink-800">
                  <div className="text-xs font-bold text-white font-mono mb-3">BLOCK ALLOCATION MATRIX</div>
                  <BlockMatrix
                    blocks={inspectedSegments.map((s) => ({
                      number: s.segment_number,
                      state: s.upload_status === 'uploaded' ? 'uploaded' : 'pending',
                      encryptedSize: s.encrypted_size,
                      ivHex: s.encryption_iv,
                      checksum: s.checksum,
                      s3Key: s.s3_object_key,
                    }))}
                    interactive={false}
                  />
                </div>

                {/* Segments Detail Table */}
                <div className="max-h-64 overflow-y-auto border border-ink-800 rounded-xl bg-ink-950">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-ink-900 border-b border-ink-800 text-ink-400 sticky top-0">
                      <tr>
                        <th className="p-2.5">Part #</th>
                        <th className="p-2.5">S3 Object Key</th>
                        <th className="p-2.5">Ciphertext Size</th>
                        <th className="p-2.5">Unique 96-bit IV</th>
                        <th className="p-2.5">SHA-256 Checksum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-850 text-ink-300">
                      {inspectedSegments.map((s) => (
                        <tr key={s.id} className="hover:bg-ink-900/50">
                          <td className="p-2.5 font-bold text-white">#{s.segment_number}</td>
                          <td className="p-2.5 text-cyan-300 truncate max-w-[200px]" title={s.s3_object_key}>
                            {s.s3_object_key}
                          </td>
                          <td className="p-2.5">{formatBytes(s.encrypted_size)}</td>
                          <td className="p-2.5 text-purple-300 truncate max-w-[120px]" title={s.encryption_iv}>
                            {s.encryption_iv || '--'}
                          </td>
                          <td className="p-2.5 text-ink-400 truncate max-w-[120px]" title={s.checksum}>
                            {s.checksum ? s.checksum.slice(0, 16) + '...' : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-ink-800">
              <button
                onClick={() => setSelectedFileForInspection(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-ink-300 hover:text-white bg-ink-800 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const f = selectedFileForInspection;
                  setSelectedFileForInspection(null);
                  onSelectFileForDownload(f);
                }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Decrypt & Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
