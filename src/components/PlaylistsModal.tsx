import React, { useState } from 'react';
import { 
  X, Heart, Plus, Trash2, Play, FolderHeart, ListMusic, 
  ChevronRight, ChevronDown, Sparkles, Check, Search, 
  Clock, Download, User, Compass, Disc, RotateCcw, Upload, GripVertical
} from 'lucide-react';
import { Song, Playlist } from '../types';
import { LocalMusicImporter } from './LocalMusicImporter';

interface PlaylistsModalProps {
  isOpen: boolean;
  onClose: () => void;
  songsList: Song[];
  likedSongIds: string[];
  onToggleLike: (songId: string) => void;
  playlists: Playlist[];
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRenamePlaylist: (playlistId: string, newName: string) => void;
  onAddSongToPlaylist: (playlistId: string, songId: string) => void;
  onRemoveSongFromPlaylist: (playlistId: string, songId: string) => void;
  onPlaySong: (song: Song) => void;
  onReplaceSongsList: (songs: Song[]) => void;
  onImportLocalSongs: (songs: Song[]) => void;
  
  // High fidelity state support
  currentSong?: Song | null;
  isPlaying?: boolean;

  // Recently played songs
  recentPlays?: Song[];
}

export const PlaylistsModal: React.FC<PlaylistsModalProps> = ({
  isOpen,
  onClose,
  songsList,
  likedSongIds,
  onToggleLike,
  playlists,
  onCreatePlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  onAddSongToPlaylist,
  onRemoveSongFromPlaylist,
  onPlaySong,
  onReplaceSongsList,
  onImportLocalSongs,
  currentSong = null,
  isPlaying = false,
  recentPlays = [],
}) => {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [isLocalImportOpen, setIsLocalImportOpen] = useState(false);

  // Playlist inline rename state
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editPlaylistNameInput, setEditPlaylistNameInput] = useState('');
  
  // Sidebar navigation selection
  const [activeNav, setActiveNav] = useState<{
    type: 'favorites' | 'history' | 'local' | 'playlist' | 'search-add' | 'all-added';
    playlistId?: string;
  }>({ type: 'favorites' });

  // Sub-tabs in the active area
  const [favoritesSubTab, setFavoritesSubTab] = useState<'songs' | 'playlists'>('songs');

  // Drag and drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Search keyword filters
  const [rightPanelSearchQuery, setRightPanelSearchQuery] = useState('');

  // Quality badges helper
  const getQualityBadges = (songId: string, index: number) => {
    const isPrimeMaster = index % 3 === 0;
    const isAtmo = index % 3 === 1;
    const isHQ = index % 3 === 2;

    if (isPrimeMaster) {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black tracking-tight flex-shrink-0 scale-90 origin-left">
          臻品母带
        </span>
      );
    } else if (isAtmo) {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-black tracking-tight flex-shrink-0 scale-90 origin-left">
          全景声
        </span>
      );
    } else {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/15 font-black tracking-tight flex-shrink-0 scale-90 origin-left">
          HQ
        </span>
      );
    }
  };

  if (!isOpen) return null;

  const likedSongs = songsList.filter(s => likedSongIds.includes(s.id));
  const handleInlineCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsCreatingInline(false);
  };

  const playEntireCollection = (songsToPlay: Song[]) => {
    if (songsToPlay.length === 0) return;
    onReplaceSongsList(songsToPlay);
    onPlaySong(songsToPlay[0]);
  };

  // Delete song from the all-added queue
  const handleDeleteSong = (song: Song) => {
    const updated = songsList.filter(s => s.id !== song.id);
    onReplaceSongsList(updated);
  };

  // Export song: JSON metadata + audio file
  const handleExportSong = async (song: Song) => {
    const safeName = `${song.title.replace(/[/\\?%*:|"<>]/g, '_')} - ${song.artist.replace(/[/\\?%*:|"<>]/g, '_')}`;

    // 1) Export JSON metadata
    const jsonBlob = new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const aJson = document.createElement('a');
    aJson.href = jsonUrl;
    aJson.download = `${safeName}.json`;
    document.body.appendChild(aJson);
    aJson.click();
    document.body.removeChild(aJson);
    URL.revokeObjectURL(jsonUrl);

    // 2) Export audio file
    try {
      let audioBuffer: ArrayBuffer | null = null;
      let ext = 'mp3';

      // Try primary audioUrl first (blob URL or remote URL)
      if (song.audioUrl) {
        try {
          const resp = await fetch(song.audioUrl);
          if (resp.ok) {
            audioBuffer = await resp.arrayBuffer();
            const urlMatch = song.audioUrl.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
            if (urlMatch) ext = urlMatch[1].toLowerCase();
          }
        } catch (_) {}
      }

      // Fallback: remote fileUrl (NetEase songs)
      if (!audioBuffer && song.fileUrl) {
        try {
          const resp = await fetch(song.fileUrl);
          if (resp.ok) {
            audioBuffer = await resp.arrayBuffer();
            const urlMatch = song.fileUrl.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
            if (urlMatch) ext = urlMatch[1].toLowerCase();
          }
        } catch (_) {}
      }

      // Fallback: IndexedDB for local songs
      if (!audioBuffer && song.source === 'local') {
        try {
          const idb = await import('idb-keyval');
          const buf: ArrayBuffer | undefined = await idb.get(`local_audio_${song.id}`);
          if (buf && buf.byteLength > 0) {
            audioBuffer = buf;
            // Try to get original extension from stored metadata
            try {
              const meta = await idb.get(`local_audio_meta_${song.id}`);
              if (meta?.ext) ext = meta.ext;
            } catch (_) {}
          }
        } catch (_) {}
      }

      if (audioBuffer && audioBuffer.byteLength > 0) {
        const mimeTypes: Record<string, string> = {
          mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
          ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
          wma: 'audio/x-ms-wma', webm: 'audio/webm',
        };
        const mime = mimeTypes[ext] || `audio/${ext}`;
        const audioBlob = new Blob([audioBuffer], { type: mime });
        const audioUrl = URL.createObjectURL(audioBlob);
        const aAudio = document.createElement('a');
        aAudio.href = audioUrl;
        aAudio.download = `${safeName}.${ext}`;
        document.body.appendChild(aAudio);
        aAudio.click();
        document.body.removeChild(aAudio);
        URL.revokeObjectURL(audioUrl);
      }
    } catch (_) {}
  };

  // Drag and drop handlers
  const handleDragStart = (idx: number) => {
    setDragIndex(idx);
    setDropTargetIndex(idx);
  };

  const handleDragEnter = (idx: number) => {
    setDropTargetIndex(idx);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dropTargetIndex !== null && dragIndex !== dropTargetIndex) {
      const updated = [...songsList];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(dropTargetIndex, 0, removed);
      onReplaceSongsList(updated);
    }
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      id="playlists-management-overlay"
    >
      {/* Complete Widescreen Music Hall Container - styled as professional PC music client */}
      <div 
        className="w-full max-w-5xl bg-slate-950/98 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_30px_70px_rgba(0,0,0,0.85)] flex flex-row h-[85vh] min-h-[580px] max-h-[750px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        id="playlists-modal"
      >
        
        {/* ==================== LEFT SIDEBAR ==================== */}
        <div className="w-72 bg-slate-950/30 border-r border-white/5 flex flex-col justify-between py-5 select-none text-left">
          <div className="flex flex-col h-full overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-white/10">
            
            {/* 1. Mock Profile Card (wyx37596 @ QQ Music Theme) */}
            <div className="mb-6 bg-white/[0.02] border border-white/5 rounded-2xl p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00c58a] to-emerald-500 flex items-center justify-center text-slate-950 font-black text-sm shadow-md">
                  W
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-black text-white/95 truncate">Binix</span>
                    <span className="text-[8.5px] px-1 bg-amber-500/20 text-amber-400 font-extrabold rounded">LV.999</span>
                  </div>
                  <span className="text-[9.5px] text-white/40 mt-0.5 truncate uppercase tracking-widest font-mono">黑钻核心会员</span>
                </div>
              </div>
            </div>

            {/* 2. Primary Navigation Section */}
            <div className="flex flex-col gap-1 mb-5">
              <span className="px-2.5 text-[10px] text-white/30 font-bold uppercase tracking-widest font-mono select-none block mb-1">
                我的音乐
              </span>
              
              {/* NAV: FAVORITES */}
              <button
                onClick={() => {
                  setActiveNav({ type: 'favorites' });
                  setRightPanelSearchQuery('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all outline-none ${
                  activeNav.type === 'favorites'
                    ? 'bg-white/[0.06] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Heart size={14} className={activeNav.type === 'favorites' ? 'text-rose-500 fill-rose-500' : 'text-white/50'} />
                  <span>喜欢</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 font-mono text-white/50 font-bold">
                  {likedSongs.length}
                </span>
              </button>

              {/* NAV: ALL ADDED */}
              <button
                onClick={() => {
                  setActiveNav({ type: 'all-added' });
                  setRightPanelSearchQuery('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all outline-none ${
                  activeNav.type === 'all-added'
                    ? 'bg-white/[0.06] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ListMusic size={14} className={activeNav.type === 'all-added' ? 'text-[#00c58a]' : 'text-white/50'} />
                  <span>全部已添加</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 font-mono text-white/50 font-bold">
                  {songsList.length}
                </span>
              </button>

              {/* NAV: HISTORY */}
              <button
                onClick={() => {
                  setActiveNav({ type: 'history' });
                  setRightPanelSearchQuery('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all outline-none ${
                  activeNav.type === 'history'
                    ? 'bg-white/[0.06] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock size={14} className={activeNav.type === 'history' ? 'text-[#00c58a]' : 'text-white/50'} />
                  <span>最近播放</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 font-mono text-white/50 font-bold">
                  {recentPlays.length}
                </span>
              </button>

              {/* NAV: LOCAL */}
              <button
                onClick={() => {
                  setActiveNav({ type: 'local' });
                  setRightPanelSearchQuery('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all outline-none ${
                  activeNav.type === 'local'
                    ? 'bg-white/[0.06] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Download size={14} className={activeNav.type === 'local' ? 'text-cyan-400' : 'text-white/50'} />
                  <span>本地和下载</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 font-mono text-white/50 font-bold">
                  {songsList.filter(s => s.source === 'local').length}
                </span>
              </button>
            </div>

            {/* 3. Custom Playlists Header with Add Button */}
            <div className="flex flex-col gap-1.5 mb-5 mt-2">
              <div className="flex items-center justify-between px-2.5 mb-1">
                <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest font-mono">
                  自建歌单 | 收藏歌单
                </span>
                <button 
                  onClick={() => setIsCreatingInline(!isCreatingInline)}
                  className="p-1 rounded bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="新建歌单"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Inline Playlist Creator Input Field */}
              {isCreatingInline && (
                <form onSubmit={handleInlineCreateSubmit} className="flex gap-1 px-1 py-1 bg-white/5 rounded-xl border border-white/5 mb-2">
                  <input 
                    type="text"
                    required
                    placeholder="请输入歌单名称.."
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none"
                  />
                  <button 
                    type="submit" 
                    className="p-1.5 bg-[#00c58a] text-slate-950 rounded-lg hover:scale-105 active:scale-95 transition-all text-xs font-black"
                  >
                    创建
                  </button>
                </form>
              )}

              {/* Loop Custom Playlists */}
              {playlists.length === 0 ? (
                <div className="p-3 text-center border border-dashed border-white/5 rounded-xl text-[10px] text-white/30 leading-relaxed font-sans">
                  暂无自建歌单，点击上方 <Plus size={8} className="inline font-bold" /> 号快速归类你的黑胶。
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto pr-0.5">
                  {playlists.map((playlist) => {
                    const active = activeNav.type === 'playlist' && activeNav.playlistId === playlist.id;
                    const isEditing = editingPlaylistId === playlist.id;
                    return isEditing ? (
                      <div key={playlist.id} className="flex items-center gap-1 px-1">
                        <input
                          type="text"
                          value={editPlaylistNameInput}
                          onChange={(e) => setEditPlaylistNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const trimmed = editPlaylistNameInput.trim();
                              if (trimmed && trimmed !== playlist.name) {
                                onRenamePlaylist(playlist.id, trimmed);
                              }
                              setEditingPlaylistId(null);
                              setEditPlaylistNameInput('');
                            } else if (e.key === 'Escape') {
                              setEditingPlaylistId(null);
                              setEditPlaylistNameInput('');
                            }
                          }}
                          onBlur={() => {
                            const trimmed = editPlaylistNameInput.trim();
                            if (trimmed && trimmed !== playlist.name) {
                              onRenamePlaylist(playlist.id, trimmed);
                            }
                            setEditingPlaylistId(null);
                            setEditPlaylistNameInput('');
                          }}
                          className="flex-1 bg-white/10 border border-[#00c58a]/40 rounded px-2 py-1 text-xs text-white outline-none"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        key={playlist.id}
                        onClick={() => {
                          setActiveNav({ type: 'playlist', playlistId: playlist.id });
                          setRightPanelSearchQuery('');
                        }}
                        onDoubleClick={() => {
                          setEditingPlaylistId(playlist.id);
                          setEditPlaylistNameInput(playlist.name);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold tracking-wide text-left transition-all outline-none ${
                          active
                            ? 'bg-[#00c288]/10 text-[#00c288]'
                            : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2 max-w-[80%]">
                          <ListMusic size={13} className={active ? 'text-[#00c288]' : 'text-white/40'} />
                          <span className="truncate">{playlist.name}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-50 bg-white/5 px-1.5 py-0.5 rounded">
                          {playlist.songIds.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Global Search & Catalog center */}
            <div className="flex flex-col gap-1 mt-auto pt-3 border-t border-white/5">
              <button
                onClick={() => {
                  setActiveNav({ type: 'search-add' });
                  setRightPanelSearchQuery('');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all outline-none ${
                  activeNav.type === 'search-add'
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Compass size={14} className={activeNav.type === 'search-add' ? 'text-teal-400' : 'text-white/40'} />
                <span>检索中心 &bull; 曲库添加</span>
              </button>
            </div>

          </div>
          
          {/* Sidebar bottom indicator */}
          <div className="px-6 pt-3 flex items-center justify-between text-[9px] font-mono text-white/20 select-none">
            <span>CM_BiniX Playroom</span>
            <span className="animate-pulse text-[#00c58a]/40 font-extrabold">&bull; HQ ACTIVE</span>
          </div>
        </div>

        {/* ==================== RIGHT PANEL (MAIN VIEWS) ==================== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/10 p-6 md:p-8 relative text-left">
          
          {/* Close button inside the main frame */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all z-15 cursor-pointer"
            aria-label="关闭窗口"
          >
            <X size={18} />
          </button>

          {/* Dynamic Content Switching Layer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* ================ VIEW 1: FAVORITES (喜欢) ================ */}
            {activeNav.type === 'favorites' && (
              <div className="flex-1 flex flex-col overflow-hidden animate-fade-in gap-5">
                
                {/* Upper Details Panel resembling Image 1 */}
                <div className="flex flex-col">
                  <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    喜欢
                  </h1>
                  
                  {/* Segmented active tabs rows under title: 歌曲8, 歌单0, 专辑0... */}
                  <div className="flex gap-6 mt-4 border-b border-white/5 pb-2 text-xs font-bold">
                    {[
                      { id: 'songs', text: `歌曲 ${likedSongs.length}` },
                      { id: 'playlists', text: '歌单 0' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFavoritesSubTab(tab.id as any)}
                        className={`pb-1 transition-all relative ${
                          favoritesSubTab === tab.id 
                            ? 'text-[#00c58a] font-extrabold' 
                            : 'text-white/45 hover:text-white/80'
                        }`}
                      >
                        <span>{tab.text}</span>
                        {favoritesSubTab === tab.id && (
                          <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-[#00c58a] rounded" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub Tab Viewports */}
                {favoritesSubTab === 'songs' ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Actions and Filtering Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 select-none">
                      <div className="flex items-center gap-2">
                        {/* Play all button with green accent */}
                        <button
                          onClick={() => playEntireCollection(likedSongs)}
                          disabled={likedSongs.length === 0}
                          className="px-5 py-2 bg-[#00c58a] hover:bg-[#00db9a] text-slate-950 font-black rounded-full text-xs flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,197,138,0.25)] transition-all active:scale-95 duration-200 cursor-pointer disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                        >
                          <Play size={11} fill="currentColor" />
                          <span>播放 ({likedSongs.length})</span>
                        </button>
                        
                        <button
                          onClick={() => {}}
                          className="px-4 py-2 border border-white/10 hover:border-white/20 bg-white/5 text-white/80 rounded-full text-xs flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Download size={11} />
                          <span>下载</span>
                        </button>

                        <button
                          onClick={() => {}}
                          className="px-4 py-2 border border-white/10 hover:border-white/20 bg-white/5 text-white/45 hover:text-white/80 rounded-full text-xs flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <ListMusic size={11} />
                          <span>批量管理</span>
                        </button>
                      </div>

                      {/* Right contextual Search Bar inside table view */}
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3.5 py-1.5 text-xs text-white w-44 hover:border-white/25 focus-within:w-56 focus-within:border-[#00c58a]/40 transition-all duration-300">
                        <Search size={12} className="opacity-40" />
                        <input 
                          type="text"
                          placeholder="搜索喜欢的歌曲.."
                          value={rightPanelSearchQuery}
                          onChange={(e) => setRightPanelSearchQuery(e.target.value)}
                          className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-white/35"
                        />
                        {rightPanelSearchQuery && (
                          <button onClick={() => setRightPanelSearchQuery('')} className="text-white/35 hover:text-white">
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* LIKED SONGS DATA TABLE CONTAINER */}
                    {likedSongs.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-white/45">
                        <Heart size={48} className="stroke-[1.5] mb-3 text-white/20 animate-pulse" />
                        <h3 className="text-base font-bold text-white/70">还没有喜爱的歌曲</h3>
                        <p className="text-xs text-white/40 mt-1 max-w-sm leading-relaxed">
                          在音乐播放时，点击主界面控制面板的心形按钮，即可随时将它们追加保存在这个高品质流体盒中。
                        </p>
                      </div>
                    ) : (() => {
                      const filteredSongs = likedSongs.filter(song => 
                        song.title.toLowerCase().includes(rightPanelSearchQuery.toLowerCase()) || 
                        song.artist.toLowerCase().includes(rightPanelSearchQuery.toLowerCase()) || 
                        song.album.toLowerCase().includes(rightPanelSearchQuery.toLowerCase())
                      );

                      if (filteredSongs.length === 0) {
                        return (
                          <div className="flex-1 flex flex-col items-center justify-center py-10 text-white/40 text-xs">
                            未能筛选出包含“{rightPanelSearchQuery}”的歌曲，请尝试其他关键词
                          </div>
                        );
                      }

                      return (
                        <div className="flex-1 flex flex-col overflow-hidden border border-white/5 rounded-2xl bg-white/[0.01]">
                          {/* Heading Labels */}
                          <div className="text-[10px] text-white/35 px-4 py-2 bg-white/[0.02] border-b border-white/5 grid grid-cols-12 gap-4 uppercase font-mono font-black select-none">
                            <div className="col-span-6 md:col-span-7">歌名/歌手</div>
                            <div className="col-span-3">专辑</div>
                            <div className="col-span-3 md:col-span-2 text-right">时间</div>
                          </div>
                          
                          {/* List Row Scroller */}
                          <div className="flex-1 overflow-y-auto pr-0.5 divide-y divide-white/[0.03] scrollbar-thin scrollbar-thumb-white/10">
                            {filteredSongs.map((song, idx) => {
                              const isCurrent = currentSong?.id === song.id;
                              
                              return (
                                <div 
                                  key={song.id}
                                  className="group grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-white/[0.04] transition-all duration-200 border-l-2 border-transparent hover:border-[#00c58a]/40"
                                >
                                  {/* Col 1: Song Information + Cover + Badges */}
                                  <div className="col-span-6 md:col-span-7 flex items-center gap-3 min-w-0">
                                    <div 
                                      onClick={() => onPlaySong(song)}
                                      className="relative w-10 h-10 object-cover rounded-xl shadow border border-white/10 overflow-hidden flex-shrink-0 cursor-pointer group-hover:scale-105 transition-all"
                                    >
                                      <img 
                                        src={song.coverUrl} 
                                        alt="" 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      {/* Play Hover overlay */}
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Play size={12} fill="white" className="text-white" />
                                      </div>
                                      
                                      {/* Playing animated indicator */}
                                      {isCurrent && isPlaying && (
                                        <div className="absolute inset-x-0 bottom-0 top-0 bg-black/50 flex items-center justify-center gap-0.5">
                                          <div className="w-0.5 h-3 bg-[#00c58a] animate-bounce" style={{ animationDelay: '0.1s' }} />
                                          <div className="w-0.5 h-4 bg-[#00c58a] animate-bounce" style={{ animationDelay: '0.3s' }} />
                                          <div className="w-0.5 h-2.5 bg-[#00c58a] animate-bounce" style={{ animationDelay: '0.5s' }} />
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col text-left min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span 
                                          onClick={() => onPlaySong(song)}
                                          className={`text-xs font-bold truncate cursor-pointer transition-colors hover:text-[#00c58a] ${
                                            isCurrent ? 'text-[#00c58a] font-black' : 'text-white/95'
                                          }`}
                                        >
                                          {song.title}
                                        </span>
                                        {/* Golden Quality Badge */}
                                        {getQualityBadges(song.id, idx)}
                                      </div>
                                      <span className="text-[10px] text-white/50 truncate mt-0.5">
                                        {song.artist}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Col 2: Album Name */}
                                  <div className="col-span-3 text-[11px] text-white/45 truncate font-medium">
                                    {song.album}
                                  </div>

                                  {/* Col 3: Duration string with Action Controls Group */}
                                  <div className="col-span-3 md:col-span-2 flex items-center justify-end text-[11px] text-white/40 font-mono select-none">
                                    {/* Action items hidden statically but revealed on hover */}
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2.5 pointer-events-auto transition-opacity mr-3">
                                      <button
                                        onClick={() => onPlaySong(song)}
                                        className="p-1 rounded text-[#00c58a] hover:scale-115 active:scale-95 transition-all"
                                        title="立即播放"
                                      >
                                        <Play size={13} fill="currentColor" />
                                      </button>
                                      <button
                                        onClick={() => onToggleLike(song.id)}
                                        className="p-1 rounded text-rose-500 hover:scale-115 active:scale-95 transition-all"
                                        title="取消喜欢"
                                      >
                                        <Heart size={13} fill="currentColor" />
                                      </button>
                                      {playlists.length > 0 && (
                                        <button
                                          onClick={() => {
                                            // Open the list plus / add songs navigation
                                            setActiveNav({ type: 'search-add' });
                                            setRightPanelSearchQuery(song.title);
                                          }}
                                          className="p-1 rounded text-teal-400 hover:scale-115 active:scale-95 transition-all"
                                          title="归档至歌单"
                                        >
                                          <Plus size={13} />
                                        </button>
                                      )}
                                    </div>
                                    <span className="group-hover:opacity-0 transition-opacity whitespace-nowrap">
                                      {song.duration}
                                    </span>
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                ) : (
                  /* Secondary Empty Views corresponding to other sub tabs */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 border border-white/5 bg-white/[0.01] rounded-2xl">
                    <Sparkles size={34} className="text-[#00c58a]/30 animate-pulse mb-2" />
                    <h3 className="text-sm font-bold text-white/70">暂无精选收藏</h3>
                    <p className="text-[11px] text-white/40 mt-1">此分区数据仍在同步中，黑胶音乐馆让一切皆有可能！</p>
                  </div>
                )}

              </div>
            )}

            {/* ================ VIEW 2: RECENT HISTORY (最近播放) ================ */}
            {activeNav.type === 'history' && (
              <div className="flex-1 flex flex-col overflow-hidden animate-fade-in gap-5">
                <div className="flex flex-col">
                  <h1 className="text-3xl font-black text-white tracking-tight">
                    最近播放
                  </h1>
                  
                  {/* Category internal tabs */}
                  <div className="flex gap-6 mt-4 border-b border-white/5 pb-2 text-xs font-bold">
                    <span className="pb-1 text-emerald-400 font-extrabold relative">
                      歌曲 {recentPlays.length}
                      <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-emerald-400 rounded" />
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] text-white/30 font-bold font-mono tracking-widest uppercase">
                        RECENT PLAYBACK TIMELINE ({recentPlays.length} RECORDS)
                      </span>
                      <button 
                        onClick={() => playEntireCollection(recentPlays)}
                        className="px-3.5 py-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full transition-all hover:bg-emerald-500/20 active:scale-95"
                      >
                        顺序循环播放最近历史页
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden border border-white/5 rounded-2xl bg-white/[0.01]">
                      {/* Songs history grid */}
                      <div className="text-[10px] text-white/35 px-4 py-2 bg-white/[0.02] border-b border-white/5 grid grid-cols-12 gap-4 uppercase font-mono font-black select-none">
                        <div className="col-span-8">歌曲/唱片</div>
                        <div className="col-span-4 text-right">时长</div>
                      </div>

                      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02] scrollbar-thin scrollbar-thumb-white/10">
                        {recentPlays.map((song, idx) => {
                          const isCurrent = currentSong?.id === song.id;
                          return (
                            <div 
                              key={`${song.id}-history-${idx}`}
                              className="group grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-white/[0.03] transition-all duration-200"
                            >
                              <div className="col-span-8 flex items-center gap-3 min-w-0">
                                <img 
                                  src={song.coverUrl} 
                                  alt="" 
                                  className="w-9 h-9 object-cover rounded-lg border border-white/5 relative flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="text-left min-w-0">
                                  <span 
                                    onClick={() => onPlaySong(song)}
                                    className={`text-xs font-bold block truncate cursor-pointer hover:text-emerald-400 ${
                                      isCurrent ? 'text-emerald-400 font-extrabold' : 'text-white'
                                    }`}
                                  >
                                    {song.title}
                                  </span>
                                  <span className="text-[10px] text-white/45 truncate mt-0.5">{song.artist}</span>
                                </div>
                              </div>
                              <div className="col-span-4 flex justify-end items-center gap-3 text-xs font-mono text-white/40">
                                <button 
                                  onClick={() => onPlaySong(song)}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all text-emerald-400"
                                >
                                  <Play size={13} fill="currentColor" />
                                </button>
                                <span>{song.duration}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
              </div>
            )}

            {/* ================ VIEW 2.5: ALL ADDED (全部已添加) ================ */}
            {activeNav.type === 'all-added' && (
              <div className="flex-1 flex flex-col overflow-hidden animate-fade-in gap-5">
                <div className="flex flex-col">
                  <h1 className="text-3xl font-black text-white tracking-tight">
                    全部已添加
                  </h1>
                  
                  <div className="flex gap-6 mt-4 border-b border-white/5 pb-2 text-xs font-bold">
                    <span className="pb-1 text-[#00c58a] font-extrabold relative">
                      歌曲 {songsList.length}
                      <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-[#00c58a] rounded" />
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] text-white/30 font-bold font-mono tracking-widest uppercase">
                        PLAYING QUEUE ({songsList.length} SONGS)
                      </span>
                      <button 
                        onClick={() => playEntireCollection(songsList)}
                        className="px-3.5 py-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full transition-all hover:bg-emerald-500/20 active:scale-95"
                      >
                        播放全部
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden border border-white/5 rounded-2xl bg-white/[0.01]">
                      <div className="text-[10px] text-white/35 px-4 py-2 bg-white/[0.02] border-b border-white/5 grid grid-cols-12 gap-4 uppercase font-mono font-black select-none">
                        <div className="col-span-5">歌曲/唱片</div>
                        <div className="col-span-3">操作</div>
                        <div className="col-span-2 text-right">时长</div>
                        <div className="col-span-2 text-center">排序</div>
                      </div>

                      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02] scrollbar-thin scrollbar-thumb-white/10">
                        {songsList.length === 0 ? (
                          <div className="flex flex-col items-center justify-center text-center py-16 text-white/45">
                            <ListMusic size={48} className="stroke-[1.5] mb-3 text-white/20" />
                            <h3 className="text-base font-bold text-white/70">播放队列为空</h3>
                            <p className="text-xs text-white/40 mt-1 max-w-sm leading-relaxed">
                              暂无已添加的歌曲，请先从本地或搜索中添加音乐到播放队列。
                            </p>
                          </div>
                        ) : (
                          songsList.map((song, idx) => {
                            const isCurrent = currentSong?.id === song.id;
                            const isDragging = dragIndex === idx;
                            const isDropTarget = dropTargetIndex === idx && dragIndex !== idx;
                            return (
                              <div 
                                key={`${song.id}-alladded-${idx}`}
                                draggable
                                onDragStart={() => handleDragStart(idx)}
                                onDragEnter={() => handleDragEnter(idx)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                className={`group grid grid-cols-12 gap-4 items-center px-4 py-3 transition-all duration-200 cursor-default ${
                                  isDragging ? 'opacity-40 scale-95 bg-white/[0.04]' : 
                                  isDropTarget ? 'border-t-2 border-emerald-400/60 bg-white/[0.02]' :
                                  'hover:bg-white/[0.03]'
                                }`}
                              >
                                <div className="col-span-5 flex items-center gap-3 min-w-0">
                                  <img 
                                    src={song.coverUrl} 
                                    alt="" 
                                    className="w-9 h-9 object-cover rounded-lg border border-white/5 relative flex-shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="text-left min-w-0">
                                    <span 
                                      onClick={() => onPlaySong(song)}
                                      className={`text-xs font-bold block truncate cursor-pointer hover:text-emerald-400 ${
                                        isCurrent ? 'text-emerald-400 font-extrabold' : 'text-white'
                                      }`}
                                    >
                                      {song.title}
                                    </span>
                                    <span className="text-[10px] text-white/45 truncate mt-0.5">{song.artist}</span>
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="col-span-3 flex items-center gap-1">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSong(song); }}
                                    title="从队列移除"
                                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400 active:scale-95 transition-all text-white/35"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleExportSong(song); }}
                                    title="导出歌曲信息"
                                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-emerald-500/15 hover:text-emerald-400 active:scale-95 transition-all text-white/35"
                                  >
                                    <Download size={13} />
                                  </button>
                                </div>

                                <div className="col-span-2 flex justify-end items-center text-xs font-mono text-white/40">
                                  <span>{song.duration}</span>
                                </div>

                                {/* Drag handle */}
                                <div className="col-span-2 flex justify-center items-center">
                                  <GripVertical 
                                    size={14} 
                                    className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-white/50 transition-all cursor-grab active:cursor-grabbing" 
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            )}

            {/* ================ VIEW 3: LOCAL DOWNLOADS (本地和下载) ================ */}
            {activeNav.type === 'local' && (() => {
              const localSongs = songsList.filter(s => s.source === 'local');
              
              if (localSongs.length === 0) {
                return (
                  <div className="flex-1 flex flex-col justify-center items-center text-center py-10 animate-fade-in">
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full mb-4">
                      <Download size={36} className="animate-bounce" />
                    </div>
                    <h2 className="text-lg font-black text-white/95">本地和下载中心</h2>
                    <p className="text-xs text-white/50 mt-1 max-w-sm leading-relaxed mx-auto">
                      暂未检测到下载音乐包，或是外部存储配比已被卸载。已完美支持歌曲离线缓冲状态！
                    </p>
                    <div className="mt-5 flex gap-2">
                      <button 
                        onClick={() => setActiveNav({ type: 'search-add' })}
                        className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black rounded-full text-xs hover:opacity-90 active:scale-95 transition-all"
                      >
                        前往曲库添加
                      </button>
                      <button 
                        onClick={() => setIsLocalImportOpen(true)}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-full text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
                      >
                        <Upload size={12} className="stroke-[2.5px]" />
                        导入本地音乐
                      </button>
                      <button 
                        onClick={() => setActiveNav({ type: 'favorites' })}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full text-xs transition-all"
                      >
                        返回我的最爱
                      </button>
                    </div>
                  </div>
                );
              }
              
              return (
                <div className="flex-1 flex flex-col overflow-hidden animate-fade-in gap-5">
                  <div className="flex flex-col">
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                      本地和下载
                    </h1>
                    <p className="text-xs text-white/50 mt-1">
                      共 {localSongs.length} 首本地音乐，无需网络即可播放
                    </p>
                  </div>

                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-white/30 font-bold font-mono tracking-widest uppercase">
                        LOCAL AUDIO FILES ({localSongs.length} TRACKS)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsLocalImportOpen(true)}
                          className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all"
                        >
                          <Upload size={10} className="stroke-[2.5px]" />
                          导入本地
                        </button>
                        <button
                          onClick={() => playEntireCollection(localSongs)}
                          className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-full text-[10px] flex items-center gap-1.5 transition-all"
                        >
                          <Play size={10} fill="currentColor" />
                          <span>播放全部</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden border border-white/5 rounded-2xl bg-white/[0.01]">
                      <div className="text-[10px] text-white/35 px-4 py-2 bg-white/[0.02] border-b border-white/5 grid grid-cols-12 gap-4 uppercase font-mono font-black select-none">
                        <div className="col-span-6 md:col-span-7">本地曲目</div>
                        <div className="col-span-3">专辑</div>
                        <div className="col-span-3 md:col-span-2 text-right">时长</div>
                      </div>

                      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02] scrollbar-thin scrollbar-thumb-white/10">
                        {localSongs.map((song) => {
                          const isCurrent = currentSong?.id === song.id;
                          return (
                            <div
                              key={song.id}
                              className="group grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-white/[0.04] transition-all duration-200"
                            >
                              <div className="col-span-6 md:col-span-7 flex items-center gap-3 min-w-0">
                                <div
                                  onClick={() => onPlaySong(song)}
                                  className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer border border-white/10 shadow group-hover:scale-105 transition-all"
                                >
                                  <img
                                    src={song.coverUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Play size={12} fill="white" className="text-white" />
                                  </div>
                                  {isCurrent && isPlaying && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-0.5">
                                      <div className="w-0.5 h-3 bg-cyan-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
                                      <div className="w-0.5 h-4 bg-cyan-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                                      <div className="w-0.5 h-2.5 bg-cyan-400 animate-bounce" style={{ animationDelay: '0.5s' }} />
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col text-left min-w-0">
                                  <span
                                    onClick={() => onPlaySong(song)}
                                    className={`text-xs font-bold truncate cursor-pointer transition-colors hover:text-cyan-400 ${
                                      isCurrent ? 'text-cyan-400 font-black' : 'text-white/95'
                                    }`}
                                  >
                                    {song.title}
                                  </span>
                                  <span className="text-[10px] text-white/50 truncate mt-0.5">{song.artist}</span>
                                </div>
                              </div>

                              <div className="col-span-3 text-[11px] text-white/45 truncate font-medium">
                                {song.album}
                              </div>

                              <div className="col-span-3 md:col-span-2 flex items-center justify-end text-[11px] text-white/40 font-mono select-none gap-2">
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
                                  <button
                                    onClick={() => onPlaySong(song)}
                                    className="p-1 rounded text-cyan-400 hover:scale-115 active:scale-95 transition-all"
                                    title="立即播放"
                                  >
                                    <Play size={13} fill="currentColor" />
                                  </button>
                                </div>
                                <span>{song.duration}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ================ VIEW 4: CUSTOM SELECTIVE PLAYLISTS (自建歌单详情页) ================ */}
            {activeNav.type === 'playlist' && (() => {
              const playlist = playlists.find(p => p.id === activeNav.playlistId);
              if (!playlist) {
                // If playlist deleted, fall back
                return (
                  <div className="py-12 text-center text-white/40 text-xs">
                    歌单似乎已被隐藏或卸载。
                    <button onClick={() => setActiveNav({ type: 'favorites' })} className="block mx-auto mt-2 text-[#00c58a] font-bold">
                      返回收藏夹 ➔
                    </button>
                  </div>
                );
              }

              const playlistSongs = songsList.filter(s => playlist.songIds.includes(s.id));

              return (
                <div className="flex-1 flex flex-col overflow-hidden animate-fade-in gap-5">
                  
                  {/* Dynamic Header details */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <FolderHeart size={16} className="text-[#00c288]" />
                        <span className="text-[10px] font-mono tracking-widest text-[#00c288] uppercase font-bold">
                          USER CUSTOM PLAYLIST
                        </span>
                      </div>
                      <h1 className="text-2.5xl font-black text-white tracking-tight mt-0.5 truncate max-w-md">
                        {playlist.name}
                      </h1>
                      <p className="text-[10.5px] text-white/45 mt-1 font-mono uppercase">
                        共 {playlistSongs.length} 首高品质自选黑胶唱片 &bull; 磁性记录
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        onDeletePlaylist(playlist.id);
                        setActiveNav({ type: 'favorites' });
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                      title="删除这起歌单"
                    >
                      <Trash2 size={11} />
                      <span>销毁歌单</span>
                    </button>
                  </div>

                  {/* Playlist detail contents view */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Control rows */}
                    <div className="flex items-center justify-between gap-3 mb-4 select-none">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => playEntireCollection(playlistSongs)}
                          disabled={playlistSongs.length === 0}
                          className="px-4.5 py-2 bg-[#00c58a] hover:bg-[#00db9a] text-slate-950 font-black rounded-full text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Play size={11} fill="currentColor" />
                          <span>一键开启播放 ({playlistSongs.length})</span>
                        </button>
                        
                        {/* Option to append directly */}
                        <button
                          onClick={() => {
                            setActiveNav({ type: 'search-add' });
                          }}
                          className="px-3.5 py-2 text-[10px] font-black border border-[#00c58a]/30 text-[#00c58a] bg-[#00c58a]/10 hover:bg-[#00c58a]/20 rounded-full transition-all flex items-center gap-1"
                        >
                          <Plus size={11} />
                          <span>在检索中心扩充此歌单</span>
                        </button>
                      </div>

                      {/* Filter list input */}
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3.5 py-1.5 text-xs text-white placeholder-white/30 focus-within:border-[#00c58a]/30 transition-all duration-200">
                        <Search size={12} className="opacity-40" />
                        <input 
                          type="text"
                          placeholder="过滤当前歌单.."
                          value={rightPanelSearchQuery}
                          onChange={(e) => setRightPanelSearchQuery(e.target.value)}
                          className="bg-transparent border-none outline-none text-xs w-28 focus:w-36 text-white transition-all"
                        />
                      </div>
                    </div>

                    {/* PLAYLIST SONGS TABLE GRID */}
                    {playlistSongs.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-white/5 border-dashed bg-white/[0.01] rounded-2xl select-none">
                        <ListMusic size={32} className="text-white/20 mb-2" />
                        <span className="text-xs font-bold text-white/50">歌单中目前没有任何音轨</span>
                        <p className="text-[10px] text-white/40 mt-1 max-w-xs leading-relaxed">
                          可在下方搜索曲库列表，点击音轨右侧的相应加号按钮一键追加存储在这个歌单里。
                        </p>
                        <button 
                          onClick={() => setActiveNav({ type: 'search-add' })}
                          className="mt-3 px-3 py-1 bg-[#00c58a]/10 hover:bg-[#00c58a]/20 text-[#00c58a] text-[10.5px] font-bold rounded-lg border border-[#00c58a]/20 transition-all"
                        >
                          立即搜歌 ➔
                        </button>
                      </div>
                    ) : (() => {
                      const filteredInPlaylist = playlistSongs.filter(song => 
                        song.title.toLowerCase().includes(rightPanelSearchQuery.toLowerCase()) || 
                        song.artist.toLowerCase().includes(rightPanelSearchQuery.toLowerCase())
                      );

                      if (filteredInPlaylist.length === 0) {
                        return (
                          <div className="py-8 text-center text-white/40 text-xs">
                            没有查找到符合条件的黑胶记录
                          </div>
                        );
                      }

                      return (
                        <div className="flex-1 flex flex-col overflow-hidden border border-white/5 rounded-2xl bg-white/[0.01]">
                          <div className="text-[10px] text-white/35 px-4 py-2 bg-white/[0.02] border-b border-white/5 grid grid-cols-12 gap-4 uppercase font-mono font-black select-none">
                            <div className="col-span-8">单曲和音乐家</div>
                            <div className="col-span-4 text-right">控制</div>
                          </div>

                          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02] scrollbar-thin scrollbar-thumb-white/10">
                            {filteredInPlaylist.map((song) => {
                              const isCurrent = currentSong?.id === song.id;
                              return (
                                <div 
                                  key={song.id}
                                  className="group grid grid-cols-12 gap-4 items-center px-4 py-2.5 hover:bg-white/[0.03] transition-all"
                                >
                                  <div className="col-span-8 flex items-center gap-3 min-w-0">
                                    <div 
                                      onClick={() => onPlaySong(song)}
                                      className="relative w-8.5 h-8.5 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                                    >
                                      <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                                      {isCurrent && isPlaying && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-0.5">
                                          <div className="w-0.5 h-2.5 bg-[#00c288] animate-bounce" style={{ animationDelay: '0.1s' }} />
                                          <div className="w-0.5 h-3 bg-[#00c288] animate-bounce" style={{ animationDelay: '0.3s' }} />
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-left min-w-0">
                                      <span 
                                        onClick={() => onPlaySong(song)}
                                        className={`text-xs font-bold block truncate hover:text-[#00c288] cursor-pointer ${
                                          isCurrent ? 'text-[#00c288] font-black' : 'text-white'
                                        }`}
                                      >
                                        {song.title}
                                      </span>
                                      <span className="text-[10.5px] text-white/50 truncate block mt-0.5">{song.artist}</span>
                                    </div>
                                  </div>

                                  <div className="col-span-4 flex justify-end items-center gap-2.5 text-xs font-mono text-white/40">
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                                      <button 
                                        onClick={() => onPlaySong(song)}
                                        className="p-1 rounded text-[#00c288] hover:scale-110"
                                        title="播放中"
                                      >
                                        <Play size={12} fill="currentColor" />
                                      </button>
                                      <button 
                                        onClick={() => onRemoveSongFromPlaylist(playlist.id, song.id)}
                                        className="p-1 rounded text-rose-400 hover:text-red-500 hover:scale-110 active:scale-95 transition-all"
                                        title="移出此歌单"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                    <span>{song.duration}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>
              );
            })()}

            {/* ================ VIEW 5: SEARCH ADD INTEGRATION (曲库检索中心) ================ */}
            {activeNav.type === 'search-add' && (
              <div className="flex-1 flex flex-col overflow-hidden animate-fade-in gap-4">
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-teal-400 animate-pulse" />
                    <span className="text-[10px] text-teal-400 font-extrabold tracking-widest font-mono uppercase">
                      CATALOG SEARCH & QUICK BIND INDEX
                    </span>
                  </div>
                  <h1 className="text-2.5xl font-black text-white tracking-tight mt-0.5">
                    曲库检索中心
                  </h1>
                  <p className="text-xs text-white/50 mt-1">
                    系统内置所有 3D 胶片音频源，支持关键字关联，您可以在此一键加码分配至您的各个主题胶片里。
                  </p>
                </div>

                {/* Sub filter input panel */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2.5xl p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3 w-full">
                    <div className="flex-1 flex items-center gap-2.5 bg-slate-950/70 border border-white/10 rounded-xl px-4 py-2 text-xs text-white">
                      <Search size={14} className="opacity-40" />
                      <input 
                        type="text"
                        placeholder="请输入歌名、歌手、或所属专辑进行复合检索.."
                        value={rightPanelSearchQuery}
                        onChange={(e) => setRightPanelSearchQuery(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-white/25"
                      />
                      {rightPanelSearchQuery && (
                        <button onClick={() => setRightPanelSearchQuery('')} className="text-white/40 hover:text-white">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Songs list results table */}
                  {playlists.length === 0 ? (
                    <div className="text-center p-6 border border-dashed border-white/5 text-white/40 text-xs rounded-xl bg-slate-950/25 select-none">
                      ⚠️ 请先在左侧栏“自建歌单”创建一个新的播放列表分类，再回来绑定歌曲哦！
                    </div>
                  ) : (() => {
                    const matchedCatalog = songsList.filter(song => 
                      song.title.toLowerCase().includes(rightPanelSearchQuery.toLowerCase()) || 
                      song.artist.toLowerCase().includes(rightPanelSearchQuery.toLowerCase()) ||
                      song.album.toLowerCase().includes(rightPanelSearchQuery.toLowerCase())
                    );

                    return (
                      <div className="flex flex-col overflow-hidden max-h-[300px]">
                        <div className="text-[10px] text-white/35 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-t-xl grid grid-cols-12 gap-4 uppercase font-mono font-black select-none text-left">
                          <div className="col-span-6 md:col-span-7">唱片曲目</div>
                          <div className="col-span-6 md:col-span-5 text-right">加码归档至相应专属歌单</div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-950/20 border-x border-b border-white/5 rounded-b-xl divide-y divide-white/[0.02] scrollbar-thin scrollbar-thumb-white/10">
                          {matchedCatalog.length === 0 ? (
                            <div className="py-8 text-center text-white/30 text-xs">
                              未找到匹配该搜索关键词的歌曲资源
                            </div>
                          ) : (
                            matchedCatalog.map((song) => (
                              <div 
                                key={song.id}
                                className="grid grid-cols-12 gap-4 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                              >
                                <div className="col-span-6 md:col-span-7 flex items-center gap-2.5 min-w-0 text-left">
                                  <img src={song.coverUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold block truncate text-white/95">{song.title}</span>
                                    <span className="text-[10px] text-white/45 truncate block mt-0.5">{song.artist} &bull; {song.album}</span>
                                  </div>
                                </div>

                                <div className="col-span-6 md:col-span-5 flex flex-wrap items-center justify-end gap-1.5">
                                  {playlists.map((playlist) => {
                                    const exists = playlist.songIds.includes(song.id);
                                    return (
                                      <button
                                        key={playlist.id}
                                        onClick={() => {
                                          if (exists) {
                                            onRemoveSongFromPlaylist(playlist.id, song.id);
                                          } else {
                                            onAddSongToPlaylist(playlist.id, song.id);
                                          }
                                        }}
                                        className={`px-2 py-1 rounded-lg text-[9px] font-black tracking-tight transition-all duration-200 border flex items-center gap-1 cursor-pointer ${
                                          exists 
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                            : 'bg-white/5 text-white/50 border-white/10 hover:bg-teal-500/10 hover:text-teal-300 hover:border-teal-500/20'
                                        }`}
                                        title={exists ? `已添加，点击从 ${playlist.name} 移除` : `添加至 ${playlist.name}`}
                                      >
                                        {exists ? <Check size={8} className="stroke-[3]" /> : <Plus size={8} />}
                                        <span>{playlist.name.length > 5 ? playlist.name.slice(0, 5) + '..' : playlist.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Foot tip */}
                <p className="text-[10px] text-white/30 text-center select-none block mt-1 leading-relaxed">
                  💡 <span className="font-semibold text-teal-400">贴心保障:</span> 喜欢一首歌曲时，除了可以加码分类，还能在歌单页执行随时快速反选，随时保持您的黑胶收藏轻简自然。
                </p>
              </div>
            )}

          </div>

        </div>

      </div>

      <LocalMusicImporter
        isOpen={isLocalImportOpen}
        onClose={() => setIsLocalImportOpen(false)}
        onSongsImported={(songs) => {
          onImportLocalSongs(songs);
          setIsLocalImportOpen(false);
        }}
      />
    </div>
  );
};
