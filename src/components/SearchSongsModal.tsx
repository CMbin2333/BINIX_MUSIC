import React, { useState, useRef } from 'react';
import { Search, X, ListPlus, Check, Loader2, Music, Link, ExternalLink } from 'lucide-react';
import { Song } from '../types';
import {
  parseNeteaseLink,
  searchSongsOnCloud,
  searchQQSongs,
  fetchPlaylistTracks,
  fetchSongDetail,
  fetchQQSongUrl,
  mapNeteaseSongToAppSong,
  mapQQSongToAppSong,
  resolveMetingAudioUrl,
  getProceduralPaletteForSong,
  parseLrcRaw,
  mergeLyrics,
} from '../utils/musicApi';

interface SearchSongsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTrack: (song: Song) => void;
  playlist: Song[];
}

const generateProceduralLyrics = (trackName?: string, artistName?: string): Array<{ time: number; en: string; cn: string }> => {
  const safeTrackName = trackName || '未知歌名';
  const safeArtistName = artistName || '未知歌手';
  return [
    { time: 0, en: `${safeTrackName}`, cn: `《${safeTrackName}》` },
    { time: 2, en: `Performed by ${safeArtistName}`, cn: `演唱者：${safeArtistName}` },
    { time: 5, en: 'Dynamic silk wave lines dancing across your view panel', cn: '流动的柔光，在你的显示面板上纵情摇曳' },
    { time: 10, en: `The colorful liquid reacts in real-time to ${safeTrackName}`, cn: `绚丽的流光液相，正在实时响应着《${safeTrackName}》的音频输入` },
    { time: 15, en: 'Colors are extracted based on the highest saturation values', cn: '环境光色调由封面中饱和度最高的三组阶位所调和' },
    { time: 20, en: 'Speed is directly mapped to frequencies of the dynamic rhythm', cn: '流光运行的瞬时速度，也完美映射于低音打击的跃动频率' },
    { time: 25, en: 'Perfect lighting calculations are executed at 60 frames per second', cn: '高级渐变色温在每秒 60 帧的高刷渲染器下完美输出' },
    { time: 30, en: 'Your full-network music experience is compiled successfully', cn: '全网音乐智能重构检索匹配大功告成，正在纵情沉浸...' },
  ];
};

export const SearchSongsModal: React.FC<SearchSongsModalProps> = ({
  isOpen,
  onClose,
  onSaveTrack,
  playlist,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [showLinkImport, setShowLinkImport] = useState(false);
  const [source, setSource] = useState<'netease' | 'qq'>('netease');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // URL 导入状态
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // ============ 搜索 ============
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setShowLinkImport(false);

    try {
      const songs = source === 'qq'
        ? await searchQQSongs(query)
        : await searchSongsOnCloud(query);
      if (songs && songs.length > 0) {
        setResults(songs);
      } else {
        setError('未找到匹配歌曲，请尝试其他关键词或切换到另一个曲库。');
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('搜索失败，网络可能暂时不可用。请稍后重试或切换曲库。');
    } finally {
      setLoading(false);
    }
  };

  // ============ 添加到播放列表 ============
  const handleAddTrack = async (track: any) => {
    const appSong = source === 'qq'
      ? mapQQSongToAppSong(track)
      : mapNeteaseSongToAppSong(track);

    // 去重
    if (playlist.some(s => s.id === appSong.id)) {
      setAddedIds(prev => ({ ...prev, [appSong.id]: true }));
      return;
    }

    setLoading(true);
    try {
      // 网易云：二阶段解析音频直链
      if (source === 'netease' && appSong.neteaseId) {
        try {
          const realUrl = await resolveMetingAudioUrl(appSong.neteaseId);
          appSong.audioUrl = realUrl;
          appSong.fileUrl = realUrl;
        } catch (audioErr) {
          console.warn('Failed to resolve audio URL, keeping meting URL as fallback:', audioErr);
        }
      }

      // QQ音乐：通过歌名动态获取播放URL
      if (source === 'qq') {
        try {
          const qqSongName = (appSong as any).qqSongName || appSong.title;
          const qqMid = (appSong as any).qqMid;
          const qqUrlData = await fetchQQSongUrl(qqSongName, qqMid);
          if (qqUrlData?.url) {
            appSong.audioUrl = qqUrlData.url;
            appSong.fileUrl = qqUrlData.url;
          }
        } catch (audioErr) {
          console.warn('Failed to fetch QQ song URL:', audioErr);
        }
      }

      onSaveTrack(appSong);
      setAddedIds(prev => ({ ...prev, [appSong.id]: true }));
    } catch (e) {
      console.error('Failed to add track:', e);
    } finally {
      setLoading(false);
    }
  };

  // ============ 链接导入 ============
  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setImporting(true);
    setError(null);
    setImportSuccess(null);

    try {
      const { type, id } = parseNeteaseLink(importUrl);
      if (!type || !id) {
        throw new Error('未识别出有效的网易云歌曲或歌单 ID。请输入 music.163.com/song?id=xxx 或 music.163.com/playlist?id=xxx 格式的链接。');
      }

      if (type === 'song') {
        const songData = await fetchSongDetail(id);
        if (!songData) throw new Error('未找到该歌曲，可能 ID 无效或已下架。');

        const appSong = mapNeteaseSongToAppSong(songData);

        // 解析音频直链
        try {
          const realUrl = await resolveMetingAudioUrl(appSong.neteaseId!);
          appSong.audioUrl = realUrl;
          appSong.fileUrl = realUrl;
        } catch (_) {}

        onSaveTrack(appSong);
        setImportSuccess(`已导入并开始播放：《${appSong.title}》`);
        setImportUrl('');
      } else if (type === 'playlist') {
        const tracks = await fetchPlaylistTracks(id);
        if (!tracks || tracks.length === 0) {
          throw new Error('该歌单无可用歌曲或为私密歌单。');
        }

        let importCount = 0;
        for (const track of tracks) {
          const appSong = mapNeteaseSongToAppSong(track);
          if (!playlist.some(s => s.id === appSong.id)) {
            // 解析音频直链
            try {
              const realUrl = await resolveMetingAudioUrl(appSong.neteaseId!);
              appSong.audioUrl = realUrl;
              appSong.fileUrl = realUrl;
            } catch (_) {}
            onSaveTrack(appSong);
            importCount++;
          }
        }
        setImportSuccess(`成功导入歌单 ${importCount} 首歌曲！`);
        setImportUrl('');
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err.message || '导入失败，请检查链接或稍后重试。');
    } finally {
      setImporting(false);
    }
  };

  // ============ UI ============
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-slate-900/40 border border-white/10 rounded-[28px] p-6 md:p-8 backdrop-blur-2xl shadow-3xl relative max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-2 border-b border-white/10">
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Music className="text-emerald-400" size={22} />
            <span>全网搜歌</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="flex gap-1 mb-4 bg-white/[0.03] rounded-2xl p-1 border border-white/5">
          <button
            onClick={() => { setSource('netease'); setResults([]); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              source === 'netease'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            网易云音乐
          </button>
          <button
            onClick={() => { setSource('qq'); setResults([]); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              source === 'qq'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            QQ音乐
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="输入歌曲名、歌手名搜索..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/15 focus:border-emerald-400 focus:bg-slate-950/40 focus:ring-1 focus:ring-emerald-400 rounded-2xl py-3 px-4 pl-11 text-sm outline-none text-white placeholder-white/40 transition"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45" size={16} />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 text-slate-950 disabled:text-white/30 font-bold text-sm uppercase rounded-2xl cursor-pointer transition flex items-center justify-center gap-1"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <span>搜索</span>}
          </button>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto pr-1 gap-2.5 flex flex-col scrollbar-thin scrollbar-thumb-white/10">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-white/60 gap-3">
              <Loader2 className="animate-spin text-emerald-400" size={36} />
              <p className="text-xs font-mono tracking-widest text-emerald-400 uppercase">正在同步云端数据...</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="py-8 px-4 text-center text-rose-300/80 font-medium text-sm border border-dashed border-rose-500/20 bg-rose-500/5 rounded-2xl">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-white/40 border border-dashed border-white/5 rounded-2xl">
              <Search size={32} className="opacity-30 mb-2.5" />
              <p className="text-xs font-semibold">输入关键词即可在线搜索歌曲</p>
              <p className="text-[10px] text-emerald-400/60 font-mono mt-1">
                {source === 'qq' ? 'Powered by api.52vmy.cn' : 'Powered by api.qijieya.cn'}
              </p>
            </div>
          )}

          {/* Result count */}
          {!loading && results.length > 0 && (
            <div className="text-[11px] font-mono font-bold tracking-wider text-emerald-400/70 mb-1 uppercase select-none">
              找到 {results.length} 首歌曲:
            </div>
          )}

          {/* Result items */}
          {!loading &&
            results.map((track, i) => {
              if (!track) return null;
              const songId = source === 'qq' ? track.id : `netease-${track.id}`;
              const title = track.name || track.title || '未知歌名';
              const artist = Array.isArray(track.ar) ? track.ar.map((a: any) => a.name).join(' / ') : track.artist || '未知歌手';
              const album = track.al?.name || track.album || '单曲';
              const cover = track.al?.picUrl || track.pic || track.cover ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80';
              const hasAdded = addedIds[songId] || playlist.some(s => s.id === songId);

              return (
                <div
                  key={songId || i}
                  className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/5 hover:border-white/10 rounded-2xl transition group animate-fade-in"
                >
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0 relative">
                      <img
                        src={cover}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/10" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold text-white tracking-tight truncate">{title}</span>
                      <span className="text-[11px] font-medium text-white/50 truncate">
                        {artist} · <span className="font-semibold">{album}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddTrack(track)}
                    disabled={hasAdded}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs tracking-wider transition border cursor-pointer ${
                      hasAdded
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80 cursor-default'
                        : 'bg-white text-slate-950 border-white hover:bg-emerald-500 hover:text-slate-950 hover:border-emerald-500 hover:shadow-lg'
                    }`}
                  >
                    {hasAdded ? (
                      <>
                        <Check size={13} />
                        <span>已添加</span>
                      </>
                    ) : (
                      <>
                        <ListPlus size={13} />
                        <span>添加</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
        </div>

        {/* Divider + Link Import Toggle */}
        <div className="mt-3 pt-3 border-t border-white/5">
          {!showLinkImport ? (
            <button
              onClick={() => {
                setShowLinkImport(true);
                setResults([]);
                setImportSuccess(null);
              }}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-white/50 hover:text-emerald-400 hover:bg-white/5 rounded-xl transition cursor-pointer"
            >
              <Link size={14} />
              <span>通过网易云链接导入</span>
              <ExternalLink size={11} />
            </button>
          ) : (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Link size={12} />
                  链接导入
                </span>
                <button
                  onClick={() => setShowLinkImport(false)}
                  className="text-[10px] text-white/40 hover:text-white/70 font-bold transition cursor-pointer"
                >
                  返回搜索
                </button>
              </div>

              <form onSubmit={handleUrlImport} className="flex flex-col gap-3">
                <p className="text-[11px] text-white/50 leading-relaxed">
                  粘贴网易云歌曲/歌单链接或纯数字 ID，自动解析并加入播放队列。
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="https://music.163.com/song?id=1813735158"
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 focus:border-teal-400 rounded-2xl py-3 px-4 text-sm text-white outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={importing || !importUrl.trim()}
                    className="px-6 bg-teal-500 hover:bg-teal-400 disabled:bg-white/10 text-slate-950 disabled:text-white/30 font-bold text-sm rounded-2xl transition flex items-center cursor-pointer"
                  >
                    {importing ? <Loader2 className="animate-spin" size={16} /> : <span>导入</span>}
                  </button>
                </div>
              </form>

              {/* Import status */}
              <div className="mt-3">
                {importing && (
                  <div className="flex flex-col items-center py-6 text-white/50 gap-2">
                    <Loader2 className="animate-spin text-teal-400" size={24} />
                    <p className="text-xs font-mono">正在解析网易云数据...</p>
                  </div>
                )}

                {importSuccess && (
                  <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold leading-relaxed">
                    {importSuccess}
                  </div>
                )}

                {!importing && !importSuccess && (
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-white/40 text-[10px] leading-relaxed flex flex-col gap-1.5">
                    <div>支持格式:</div>
                    <ul className="list-disc pl-4 space-y-1 text-white/50 font-mono">
                      <li>单曲: music.163.com/song?id=1813735158</li>
                      <li>歌单: music.163.com/playlist?id=5124151245</li>
                      <li>纯数字 ID: 1813735158</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
