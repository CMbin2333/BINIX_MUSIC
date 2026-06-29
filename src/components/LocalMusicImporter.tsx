import React, { useRef, useState } from 'react';
import { X, Upload, Music, Check, Loader } from 'lucide-react';
import { parseBlob } from 'music-metadata';
import { buildLocalSongEntry, generateLocalSongId, DEFAULT_COVER_SVG } from '../utils/localMusicDb';
import { Song } from '../types';

const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/vorbis',
  'audio/opus',
  'audio/aac',
  'audio/webm',
  'audio/x-ms-wma',
];

const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.opus', '.aac', '.wma', '.webm'];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface LocalMusicImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onSongsImported: (songs: Song[]) => void;
}

interface ImportTask {
  file: File;
  status: 'pending' | 'loading' | 'done' | 'error';
  message?: string;
  song?: Song;
}

export const LocalMusicImporter: React.FC<LocalMusicImporterProps> = ({
  isOpen,
  onClose,
  onSongsImported,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<ImportTask[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const validFiles = files.filter((f) => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return (
        SUPPORTED_AUDIO_TYPES.includes(f.type) ||
        SUPPORTED_EXTENSIONS.includes(ext)
      );
    });

    if (validFiles.length === 0) return;

    const newTasks: ImportTask[] = validFiles.map((file) => ({
      file,
      status: 'pending' as const,
    }));

    setTasks((prev) => [...prev, ...newTasks]);
  };

  const processImport = async () => {
    if (tasks.length === 0) return;
    setIsImporting(true);

    const importedSongs: Song[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.status === 'done') continue;

      setTasks((prev) =>
        prev.map((t, idx) => (idx === i ? { ...t, status: 'loading' as const } : t))
      );

      try {
        const arrayBuffer = await task.file.arrayBuffer();

        // Parse metadata
        const metadata = await parseBlob(
          new Blob([arrayBuffer], { type: task.file.type || 'audio/mpeg' })
        );

        const common = metadata.common;
        const format = metadata.format;

        const title = common.title || task.file.name.replace(/\.[^.]+$/, '');
        const artist = common.artist || '未知艺术家';
        const album = common.album || '未知专辑';
        const durationSeconds = format.duration ? Math.round(format.duration) : 0;
        const duration = format.duration ? formatDuration(format.duration) : '0:00';

        // Extract cover art
        let coverBuffer: ArrayBuffer | undefined;
        if (common.picture && common.picture.length > 0) {
          coverBuffer = common.picture[0].data.buffer.slice(
            common.picture[0].data.byteOffset,
            common.picture[0].data.byteOffset + common.picture[0].data.byteLength
          );
        }

        const songId = generateLocalSongId();
        const song = await buildLocalSongEntry(
          songId,
          arrayBuffer,
          { title, artist, album, durationSeconds, duration },
          coverBuffer
        );

        importedSongs.push(song);

        setTasks((prev) =>
          prev.map((t, idx) =>
            idx === i
              ? { ...t, status: 'done' as const, message: '导入成功', song }
              : t
          )
        );
      } catch (err: any) {
        console.error(`Failed to import ${task.file.name}:`, err);
        setTasks((prev) =>
          prev.map((t, idx) =>
            idx === i
              ? { ...t, status: 'error' as const, message: err.message || '导入失败' }
              : t
          )
        );
      }
    }

    setIsImporting(false);

    if (importedSongs.length > 0) {
      onSongsImported(importedSongs);
    }
  };

  const clearDoneTasks = () => {
    setTasks((prev) => prev.filter((t) => t.status !== 'done'));
  };

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const errorCount = tasks.filter((t) => t.status === 'error').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white/10 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-2 border-b border-white/5">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Upload size={18} className="text-cyan-400" />
            <span>导入本地音乐</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Supported formats hint */}
        <p className="text-[11px] text-white/40 mb-4 -mt-2">
          支持 MP3 / FLAC / WAV / M4A / OGG / Opus / AAC / WMA / WebM 格式
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Select files area */}
        {tasks.length === 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-10 cursor-pointer hover:border-cyan-400/40 hover:bg-white/[0.02] transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <Music size={48} className="text-white/20 mb-3" />
            <span className="text-sm font-bold text-white/60">点击选择音频文件</span>
            <span className="text-[11px] text-white/35 mt-1">或拖拽文件到此处</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Task list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4 max-h-[320px]">
              {tasks.map((task, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    task.status === 'done'
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : task.status === 'error'
                      ? 'bg-red-500/10 border-red-500/20'
                      : task.status === 'loading'
                      ? 'bg-cyan-500/10 border-cyan-500/20'
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {task.status === 'loading' ? (
                      <Loader size={16} className="text-cyan-400 animate-spin flex-shrink-0" />
                    ) : task.status === 'done' ? (
                      <Check size={16} className="text-emerald-400 flex-shrink-0" />
                    ) : task.status === 'error' ? (
                      <X size={16} className="text-red-400 flex-shrink-0" />
                    ) : (
                      <Music size={16} className="text-white/40 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white/90 truncate block">
                        {task.file.name}
                      </span>
                      {task.message && (
                        <span className="text-[10px] text-white/50">{task.message}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-white/30 font-mono flex-shrink-0 ml-2">
                    {task.status === 'pending'
                      ? '等待中'
                      : task.status === 'loading'
                      ? '导入中...'
                      : task.status === 'done'
                      ? '完成'
                      : '失败'}
                  </span>
                </div>
              ))}
            </div>

            {/* Add more files */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[11px] text-white/40 hover:text-white/60 hover:border-white/20 transition-all mb-3 disabled:opacity-30"
            >
              + 添加更多文件
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 mt-2">
          {tasks.length > 0 && (
            <>
              <button
                onClick={processImport}
                disabled={isImporting || pendingCount === 0 || doneCount === tasks.length}
                className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-full text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader size={13} className="animate-spin" />
                    <span>导入中...</span>
                  </>
                ) : (
                  <>
                    <Upload size={13} />
                    <span>导入全部 ({pendingCount} 首)</span>
                  </>
                )}
              </button>
              {doneCount > 0 && (
                <button
                  onClick={() => {
                    clearDoneTasks();
                    if (tasks.filter((t) => t.status !== 'done').length === 0) {
                      onClose();
                    }
                  }}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full text-xs transition-all"
                >
                  清除已完成
                </button>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 border border-white/5 rounded-full text-xs transition-all"
          >
            关闭
          </button>
        </div>

        {/* Status summary */}
        {tasks.length > 0 && (
          <p className="text-[10px] text-white/30 text-center mt-2">
            {doneCount > 0 && `${doneCount} 首已完成 `}
            {errorCount > 0 && `${errorCount} 首失败 `}
            {pendingCount > 0 && `${pendingCount} 首待处理`}
          </p>
        )}
      </div>
    </div>
  );
};
