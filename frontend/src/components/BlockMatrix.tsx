import React from 'react';
import { Lock, Check, Loader2, AlertCircle, CloudUpload, Key } from 'lucide-react';
import { formatBytes } from '../crypto/hexUtils';

export type BlockState = 'pending' | 'segmenting' | 'encrypting' | 'uploading' | 'uploaded' | 'downloading' | 'decrypting' | 'failed';

export interface BlockItem {
  number: number;
  state: BlockState;
  plaintextSize?: number;
  encryptedSize?: number;
  ivHex?: string;
  checksum?: string;
  s3Key?: string;
  progressPercent?: number;
  error?: string;
}

interface BlockMatrixProps {
  blocks: BlockItem[];
  interactive?: boolean;
  onBlockClick?: (block: BlockItem) => void;
  selectedBlockNumber?: number | null;
}

export const BlockMatrix: React.FC<BlockMatrixProps> = ({
  blocks,
  interactive = true,
  onBlockClick,
  selectedBlockNumber,
}) => {
  const getStateConfig = (state: BlockState) => {
    switch (state) {
      case 'uploaded':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:border-emerald-400',
          dot: 'bg-emerald-500',
          icon: Check,
          label: 'Stored in S3',
        };
      case 'uploading':
        return {
          bg: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 animate-pulse-subtle',
          dot: 'bg-cyan-400 animate-ping',
          icon: CloudUpload,
          label: 'Uploading to S3',
        };
      case 'encrypting':
        return {
          bg: 'bg-purple-500/15 border-purple-500/50 text-purple-300 animate-pulse-subtle',
          dot: 'bg-purple-400 animate-ping',
          icon: Lock,
          label: 'Encrypting Block',
        };
      case 'segmenting':
        return {
          bg: 'bg-amber-500/15 border-amber-500/50 text-amber-300',
          dot: 'bg-amber-400',
          icon: Loader2,
          label: 'Segmenting Block',
        };
      case 'downloading':
        return {
          bg: 'bg-sky-500/15 border-sky-500/50 text-sky-300 animate-pulse-subtle',
          dot: 'bg-sky-400 animate-ping',
          icon: CloudUpload,
          label: 'Downloading from S3',
        };
      case 'decrypting':
        return {
          bg: 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300 animate-pulse-subtle',
          dot: 'bg-indigo-400',
          icon: Key,
          label: 'Decrypting Block',
        };
      case 'failed':
        return {
          bg: 'bg-rose-500/15 border-rose-500/50 text-rose-400',
          dot: 'bg-rose-500',
          icon: AlertCircle,
          label: 'Error',
        };
      case 'pending':
      default:
        return {
          bg: 'bg-ink-900/60 border-ink-800 text-ink-400 hover:border-ink-700',
          dot: 'bg-ink-600',
          icon: Lock,
          label: 'Pending',
        };
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
        <span className="text-ink-400 font-mono">
          {blocks.length} {blocks.length === 1 ? 'BLOCK' : 'BLOCKS'} ALLOCATED
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ink-600"></span>
            <span className="text-ink-400">Queued</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            <span className="text-ink-300">Encrypting</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-ink-300">S3 Transit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-ink-300">Vault Stored</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
        {blocks.map((block) => {
          const config = getStateConfig(block.state);
          const Icon = config.icon;
          const isSelected = selectedBlockNumber === block.number;

          return (
            <button
              key={block.number}
              type="button"
              disabled={!interactive}
              onClick={() => onBlockClick && onBlockClick(block)}
              className={`relative group p-3 rounded-lg border text-left transition-all duration-200 ${
                config.bg
              } ${
                isSelected
                  ? 'ring-2 ring-vault-cyan shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-[1.02]'
                  : ''
              } ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-semibold tracking-wider">
                  #{String(block.number).padStart(3, '0')}
                </span>
                <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
              </div>

              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon
                  className={`w-3.5 h-3.5 ${
                    ['segmenting', 'encrypting', 'uploading', 'downloading', 'decrypting'].includes(block.state)
                      ? 'animate-spin'
                      : ''
                  }`}
                />
                <span className="text-[11px] font-medium truncate">{config.label}</span>
              </div>

              <div className="text-[10px] text-ink-400 font-mono truncate">
                {block.encryptedSize
                  ? formatBytes(block.encryptedSize)
                  : block.plaintextSize
                  ? formatBytes(block.plaintextSize)
                  : '--'}
              </div>

              {/* Tooltip on Hover */}
              <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-48 p-2 rounded bg-ink-900 border border-ink-700 shadow-xl text-[11px] text-ink-200 leading-tight">
                <div className="font-semibold text-white mb-1">Block #{block.number}</div>
                <div>Status: <span className="text-vault-cyan">{config.label}</span></div>
                {block.ivHex && (
                  <div className="truncate font-mono text-[10px] text-ink-400 mt-1">
                    IV: {block.ivHex.slice(0, 12)}...
                  </div>
                )}
                {block.checksum && (
                  <div className="truncate font-mono text-[10px] text-ink-400">
                    SHA: {block.checksum.slice(0, 10)}...
                  </div>
                )}
                {block.s3Key && (
                  <div className="truncate font-mono text-[9px] text-ink-500 mt-0.5">
                    {block.s3Key}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
