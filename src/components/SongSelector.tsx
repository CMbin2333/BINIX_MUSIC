import React from 'react';
import { X, Music, FolderHeart } from 'lucide-react';
import { Song } from '../types';
import { SONGS } from '../songs';

interface SongSelectorProps {
  currentSong: Song;
  onSelectSong: (song: Song) => void;
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  playlist?: Song[];
  onOpenPlaylists?: () => void;
}

export const SongSelector: React.FC<SongSelectorProps> = ({
  currentSong,
  onSelectSong,
  isOpen,
  onClose,
  isPlaying,
  playlist = SONGS,
  onOpenPlaylists
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      id="song-selector-overlay"
    >
      <div 
        className="w-full max-w-md bg-white/10 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        id="song-selector-modal"
      >
        {/* Header rail */}
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-white/5 gap-2">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2 truncate">
            <Music size={18} />
            <span>音乐播放队列</span>
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onOpenPlaylists && (
              <button
                onClick={() => {
                  onOpenPlaylists();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500 hover:bg-rose-400 text-slate-950 rounded-full text-[10px] font-black uppercase transition-all duration-300"
                title="打开我的歌单 & 喜爱音乐"
              >
                <FolderHeart size={12} fill="currentColor" />
                <span>歌单</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all duration-300"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* List representation */}
        <div className="flex flex-col gap-3">
          {playlist.map((song) => {
            const isCurrent = song.id === currentSong.id;
            return (
              <div
                key={song.id}
                onClick={() => {
                  onSelectSong(song);
                  onClose();
                }}
                className={`
                  flex items-center justify-between p-3 rounded-2xl cursor-pointer select-none
                  transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]
                  ${isCurrent 
                    ? 'bg-white/15 border border-white/15 shadow-md translate-x-1.5' 
                    : 'bg-white/0 border border-transparent hover:bg-white/5 hover:translate-x-1'
                  }
                `}
                id={`song-item-${song.id}`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Thumbnail art */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-inner relative flex-shrink-0">
                    <img 
                      src={song.coverUrl} 
                      alt={song.title} 
                      className="w-full h-full object-cover select-none pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/10" />
                  </div>

                  {/* Title & Artist names */}
                  <div className="flex flex-col text-left">
                    <span 
                      className={`text-sm tracking-tight transition-colors ${isCurrent ? 'font-extrabold text-white' : 'font-medium text-white/75'}`}
                      style={{ color: isCurrent ? song.accentColor : undefined }}
                    >
                      {song.title}
                    </span>
                    <span className="text-[11px] text-white/50 font-bold">{song.artist} — {song.album}</span>
                  </div>
                </div>

                {/* Animated status equalizer */}
                <div className="flex items-center gap-3">
                  {isCurrent && (
                    <div className="flex items-center gap-[2px] h-3.5" id="mini-equalizer">
                      {[1, 2, 3].map((bar) => (
                        <div 
                          key={bar}
                          className="w-[2px] bg-white rounded-full origin-bottom"
                          style={{
                            height: '100%',
                            animation: isPlaying ? 'wave 0.6s ease-in-out infinite alternate' : 'none',
                            animationDelay: `-${bar * 0.15}s`,
                            transform: isPlaying ? 'scaleY(1)' : 'scaleY(0.3)'
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="text-[11px] text-white/40 font-bold">{song.duration}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
