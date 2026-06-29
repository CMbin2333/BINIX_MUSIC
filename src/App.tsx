import { useState, useEffect, useRef } from 'react';
import { SONGS } from './songs';
import { Song, LyricLine, Playlist } from './types';
import { SilkBackground } from './components/SilkBackground';
import { LyricsPanel } from './components/LyricsPanel';
import { PlayerControls } from './components/PlayerControls';
import { SongSelector } from './components/SongSelector';
import { SearchSongsModal } from './components/SearchSongsModal';
import { PlaylistsModal } from './components/PlaylistsModal';
import { VinylSelectionStudio, RECORD_MATERIALS, ViscosityPresetType } from './components/VinylSelectionStudio';
import EQSonicPanel, { resumeAudioContext } from './components/EQSonicPanel';
import { Menu, Eye, EyeOff, Languages, Disc, Search, Sliders, Sparkles, Music, Maximize2, Minimize2, ChevronDown, Heart, VolumeX, Volume2, SkipBack, Play, SkipForward, FolderHeart, X, Upload } from 'lucide-react';
import { LocalMusicImporter } from './components/LocalMusicImporter';
import { loadLocalSongUrls } from './utils/localMusicDb';

const BUILT_IN_PRESETS = [
  { id: 'emerald-sea', name: '翡翠之海 🟢', colors: ['#064e3b', '#0d9488', '#10b981'] },
  { id: 'cyberpunk', name: '赛博霓虹 🟣', colors: ['#581c87', '#3b82f6', '#ec4899'] },
  { id: 'muted-dusk', name: '微醺落日 🌅', colors: ['#7c2d12', '#ea580c', '#fbbf24'] },
  { id: 'aurora-forest', name: '极光森林 🌌', colors: ['#1e3a8a', '#0f766e', '#4ade80'] },
  { id: 'deep-ocean', name: '深海静谧 🔵', colors: ['#172554', '#1d4ed8', '#0ea5e9'] },
];

export default function App() {
  const [songsList, setSongsList] = useState<Song[]>(SONGS);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  // Placeholder song to keep UI framework intact when playlist is empty
  const EMPTY_SONG: Song = {
    id: '__empty__',
    title: '暂无音乐',
    artist: '',
    album: '',
    coverUrl: '',
    audioUrl: '',
    duration: '0:00',
    durationSeconds: 0,
    lyrics: [],
    palette: {
      blob0: [30 / 255, 58 / 255, 138 / 255] as [number, number, number],
      blob1: [13 / 255, 148 / 255, 136 / 255] as [number, number, number],
      blob2: [59 / 255, 130 / 255, 246 / 255] as [number, number, number],
      blob3: [30 / 255, 58 / 255, 138 / 255] as [number, number, number],
      blob4: [13 / 255, 148 / 255, 136 / 255] as [number, number, number],
    },
    accentColor: '#1e3a8a',
  };
  const displaySong = currentSong ?? EMPTY_SONG;
  
  const pendingSeekRef = useRef<number | null>(null);
  const shouldAutoPlayRef = useRef(false);

  // Load persisted playlist and player state from IndexedDB on start
  useEffect(() => {
    import('idb-keyval').then(({ get }) => {
      get('user_playlist_v1').then(async (storedSongs) => {
        if (storedSongs && Array.isArray(storedSongs) && storedSongs.length > 0) {
          // Regenerate blob URLs for local songs
          let restoredSongs: Song[] = storedSongs as Song[];
          let hasLocalSongs = restoredSongs.some(s => s.source === 'local');
          if (hasLocalSongs) {
            const results = await Promise.all(
              restoredSongs.map(async (s) => {
                if (s.source !== 'local') return s;
                try {
                  return await loadLocalSongUrls(s);
                } catch (err) {
                  console.warn(`Failed to restore blob URL for local song ${s.id}:`, err);
                  return null;
                }
              })
            );
            restoredSongs = results.filter(Boolean) as Song[];
          }

          setSongsList(restoredSongs as Song[]);

          // Restore last playing song & playback progress
          get('player_state_v1').then((playerState: any) => {
            if (playerState && playerState.songId) {
              const lastSong = (restoredSongs as Song[]).find((s: Song) => s.id === playerState.songId);
              if (lastSong) {
                setCurrentSong(lastSong);
                pendingSeekRef.current = playerState.currentTime || 0;
                if (playerState.isPlaying) {
                  shouldAutoPlayRef.current = true;
                }
              } else {
                setCurrentSong(restoredSongs[0] as Song);
              }
            } else {
              setCurrentSong(restoredSongs[0] as Song);
            }
          }).catch(() => {
            setCurrentSong(restoredSongs[0] as Song);
          });
        }
      }).catch(err => {
        console.warn('Failed retrieving saved songs from IndexedDB:', err);
      });
    });
  }, []);

  // Save playlist changes back to IndexedDB
  useEffect(() => {
    if (songsList && songsList.length > 0) {
      import('idb-keyval').then(({ set }) => {
        set('user_playlist_v1', songsList).catch(err => {
          console.warn('Failed saving songs list changes to IndexedDB:', err);
        });
      });
    }
  }, [songsList]);

  // Persist player state when the active song changes
  useEffect(() => {
    if (currentSong && currentSong.id !== '__empty__') {
      import('idb-keyval').then(({ set }) => {
        set('player_state_v1', {
          songId: currentSong.id,
          currentTime: 0,
          isPlaying: false,
        }).catch(err => {
          console.warn('Failed saving player state to IndexedDB:', err);
        });
      });
    }
  }, [currentSong?.id]);

  // Load lyrics on-demand when playing a netease/remote song
  useEffect(() => {
    if (!currentSong || !currentSong.needsLyricsMatch) return;
      import('./utils/musicApi').then(({ fetchLyricsById, searchAndMatchLyrics, fetchQQLyrics }) => {
        const getLyricsPromise = currentSong.neteaseId
          ? fetchLyricsById(currentSong.neteaseId)
          : (currentSong as any).qqMid
            ? fetchQQLyrics((currentSong as any).qqMid).then(lyrics => {
                // QQ lyrics rarely have word timestamps — if missing, fall back to NetEase
                // which has TTML/YRC word-level data for precise word-by-word highlighting
                const hasWordTimestamps = lyrics.length > 0 && lyrics.some((l: any) => l.words && l.words.length > 0);
                if (hasWordTimestamps) return lyrics;
                console.log(`[On-Demand Lyrics] QQ lyrics lack word timestamps, trying NetEase match for: ${currentSong.title}`);
                return searchAndMatchLyrics(currentSong.title, currentSong.artist).then(neteaseLyrics =>
                  neteaseLyrics.length > 0 ? neteaseLyrics : lyrics
                );
              })
            : searchAndMatchLyrics(currentSong.title, currentSong.artist);

        getLyricsPromise
          .then((lyrics) => {
            if (lyrics && lyrics.length > 0) {
              console.log(`[On-Demand Lyrics] Matched ${lyrics.length} lines for: ${currentSong.title}`);
              
              setCurrentSong(prev => {
                if (prev.id === currentSong.id) {
                  return { ...prev, lyrics, needsLyricsMatch: false };
                }
                return prev;
              });

              setSongsList((prevList) =>
                prevList.map((song) =>
                  song.id === currentSong.id ? { ...song, lyrics, needsLyricsMatch: false } : song
                )
              );
            }
          })
          .catch((err) => {
            console.warn('[On-Demand Lyrics] Failed to fetch remote lyrics:', err);
          });
      });
  }, [currentSong?.id]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Persist playback progress periodically while playing
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    const interval = setInterval(() => {
      const ct = audioRef.current?.currentTime;
      if (ct !== undefined && currentSong.id !== '__empty__') {
        import('idb-keyval').then(({ set }) => {
          set('player_state_v1', {
            songId: currentSong.id,
            currentTime: ct,
            isPlaying: true,
          }).catch(() => {});
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, currentSong?.id]);

  // Persist playback progress on pause / stop
  useEffect(() => {
    if (currentSong && !isPlaying && currentSong.id !== '__empty__') {
      import('idb-keyval').then(({ set }) => {
        set('player_state_v1', {
          songId: currentSong.id,
          currentTime: currentTime,
          isPlaying: false,
        }).catch(() => {});
      });
    }
  }, [isPlaying]);

  const [audioError, setAudioError] = useState<string | null>(null);

  const handleAudioError = (e: any) => {
    const errCode = audioRef.current?.error?.code;
    const errMessage = audioRef.current?.error?.message;
    console.warn("Audio playback error event trigger:", { type: e?.type, code: errCode, message: errMessage });
    setIsPlaying(false);
    
    let errMsg = "音频加载失败：请试着在顶部搜索栏「全网搜歌」切换高可用线路或重试。";
    if (errCode === 1) errMsg = "播放失败：音频下载被终止。";
    if (errCode === 2) errMsg = "播放失败：网络加载超时，请检查您的网络连接或稍后重试。";
    if (errCode === 3) errMsg = "播放失败：音频解码受阻，请尝试切换一首歌。";
    if (errCode === 4) errMsg = "播放失败：当前音乐版权受限或线路暂时失效，推荐您点击顶部「全网搜歌」重新搜索播放。";
    
    setAudioError(errMsg);
    
    setTimeout(() => {
      setAudioError(null);
    }, 6000);
  };

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(currentSong?.durationSeconds ?? 0);
  const [volume, setVolume] = useState<number>(0.75);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playMode, setPlayMode] = useState<'list' | 'single' | 'shuffle'>(() => {
    return (localStorage.getItem('play_mode') as 'list' | 'single' | 'shuffle') || 'list';
  });
  const [isSongListOpen, setIsSongListOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Liked songs & Playlists support
  const [likedSongIds, setLikedSongIds] = useState<string[]>(() => {
    try {
      const val = localStorage.getItem('liked_songs_v1');
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  });

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const val = localStorage.getItem('user_playlists_v1');
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  });

  const [isPlaylistsOpen, setIsPlaylistsOpen] = useState<boolean>(false);
  const [isLocalImportOpen, setIsLocalImportOpen] = useState<boolean>(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Listen for fullscreenchange to sync state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Recently played songs — persisted to IndexedDB, newest first, max 50
  const [recentPlays, setRecentPlays] = useState<Song[]>([]);
  
  // Load recentPlays from IndexedDB on mount
  useEffect(() => {
    import('idb-keyval').then(({ get }) => {
      get('recent_plays_v1').then((val: any) => {
        if (val && Array.isArray(val) && val.length > 0) {
          setRecentPlays(val as Song[]);
        }
      }).catch(() => {});
    });
  }, []);

  // Filter deleted songs from recentPlays when songsList changes
  useEffect(() => {
    if (songsList.length === 0) return;
    setRecentPlays(prev => {
      const existingIds = new Set(songsList.map(s => s.id));
      const filtered = prev.filter(s => existingIds.has(s.id));
      if (filtered.length === prev.length) return prev;
      import('idb-keyval').then(({ set }) => {
        set('recent_plays_v1', filtered).catch(() => {});
      });
      return filtered;
    });
  }, [songsList]);

  // Update recentPlays whenever the current song changes
  useEffect(() => {
    if (!currentSong || currentSong.id === '__empty__') return;
    import('idb-keyval').then(({ set }) => {
      setRecentPlays(prev => {
        const filtered = prev.filter(s => s.id !== currentSong.id);
        const updated = [currentSong, ...filtered].slice(0, 50);
        set('recent_plays_v1', updated).catch(() => {});
        return updated;
      });
    });
  }, [currentSong?.id]);

  const handleToggleLike = (songId: string) => {
    setLikedSongIds((prev) => {
      const next = prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId];
      localStorage.setItem('liked_songs_v1', JSON.stringify(next));
      return next;
    });
  };

  const handleCreatePlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: 'pl_' + Date.now(),
      name,
      songIds: [],
    };
    setPlaylists((prev) => {
      const next = [...prev, newPlaylist];
      localStorage.setItem('user_playlists_v1', JSON.stringify(next));
      return next;
    });
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => {
      const next = prev.filter((p) => p.id !== playlistId);
      localStorage.setItem('user_playlists_v1', JSON.stringify(next));
      return next;
    });
  };

  const handleRenamePlaylist = (playlistId: string, newName: string) => {
    if (!newName.trim()) return;
    setPlaylists((prev) => {
      const next = prev.map((p) =>
        p.id === playlistId ? { ...p, name: newName.trim() } : p
      );
      localStorage.setItem('user_playlists_v1', JSON.stringify(next));
      return next;
    });
  };

  const handleAddSongToPlaylist = (playlistId: string, songId: string) => {
    setPlaylists((prev) => {
      const next = prev.map((p) => {
        if (p.id === playlistId) {
          if (!p.songIds.includes(songId)) {
            return { ...p, songIds: [...p.songIds, songId] };
          }
        }
        return p;
      });
      localStorage.setItem('user_playlists_v1', JSON.stringify(next));
      return next;
    });
  };

  const handleRemoveSongFromPlaylist = (playlistId: string, songId: string) => {
    setPlaylists((prev) => {
      const next = prev.map((p) => {
        if (p.id === playlistId) {
          return { ...p, songIds: p.songIds.filter((id) => id !== songId) };
        }
        return p;
      });
      localStorage.setItem('user_playlists_v1', JSON.stringify(next));
      return next;
    });
  };

  const handleImportLocalSongs = (newSongs: Song[]) => {
    setSongsList((prev) => [...prev, ...newSongs]);
    // Auto-play the first imported song if nothing is playing
    if (!currentSong || currentSong.id === '__empty__') {
      setCurrentSong(newSongs[0]);
      setIsPlaying(true);
    }
  };
  
  // Custom interactive parameters
  const [blurAmount, setBlurAmount] = useState<number>(10); // Background blur level (0px to 25px)
  const [langMode, setLangMode] = useState<'both' | 'en' | 'cn'>('both'); // Lyrics language modes
  const [isTopMenuOpen, setIsTopMenuOpen] = useState<boolean>(false); // Top expandable menu toggle
  const [playerScale, setPlayerScale] = useState<number>(1.0); // Visual sizing of album and controllers (0.75 to 1.25)
  const [flowSpeed, setFlowSpeed] = useState<number>(1.0); // Shader background flow speed (0.0 to 3.0)
  const [foldDepth, setFoldDepth] = useState<number>(0.52); // Folds three-dimensional depth (0.1 to 1.0)
  const [saturation, setSaturation] = useState<number>(1.4); // Color saturation (0.5 to 2.0)
  const [grainOpacity, setGrainOpacity] = useState<number>(0.16); // Vintage film grain opacity (0.0 to 0.4)

  const [bgDimness, setBgDimness] = useState<number>(() => {
    const val = localStorage.getItem('bg_dimness');
    return val !== null ? parseFloat(val) : 0.4;
  });
  const [bgContrast, setBgContrast] = useState<number>(() => {
    const val = localStorage.getItem('bg_contrast');
    return val !== null ? parseFloat(val) : 1.1;
  });
  const [bgBrightness, setBgBrightness] = useState<number>(() => {
    const val = localStorage.getItem('bg_brightness');
    return val !== null ? parseFloat(val) : 1.0;
  });
  const [bgHueRotate, setBgHueRotate] = useState<number>(() => {
    const val = localStorage.getItem('bg_hue_rotate');
    return val !== null ? parseFloat(val) : 0;
  });
  const [bgScale, setBgScale] = useState<number>(() => {
    const val = localStorage.getItem('bg_scale');
    return val !== null ? parseFloat(val) : 1.0;
  });

  const [useCustomBgColor, setUseCustomBgColor] = useState<boolean>(() => {
    const val = localStorage.getItem('use_custom_bg_color');
    return val === 'true';
  });

  const [customColors, setCustomColors] = useState<string[]>(() => {
    const val = localStorage.getItem('custom_bg_colors');
    return val !== null ? JSON.parse(val) : ['#1e3a8a', '#0d9488', '#3b82f6'];
  });

  const [localPresets, setLocalPresets] = useState<Array<{ id: string; name: string; colors: string[] }>>(() => {
    const val = localStorage.getItem('custom_bg_presets');
    if (val !== null) {
      try {
        return JSON.parse(val);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [dynamicPalette, setDynamicPalette] = useState(currentSong?.palette ?? {
    blob0: [30 / 255, 58 / 255, 138 / 255] as [number, number, number],
    blob1: [13 / 255, 148 / 255, 136 / 255] as [number, number, number],
    blob2: [59 / 255, 130 / 255, 246 / 255] as [number, number, number],
    blob3: [30 / 255, 58 / 255, 138 / 255] as [number, number, number],
    blob4: [13 / 255, 148 / 255, 136 / 255] as [number, number, number],
  });

  const [useRealSpectrum, setUseRealSpectrum] = useState<boolean>(() => {
    const val = localStorage.getItem('use_real_spectrum');
    return val !== 'false'; // Defaults to true to prioritize real music reactive jumping
  });

  const [useFlyAnimation, setUseFlyAnimation] = useState<boolean>(() => {
    const val = localStorage.getItem('use_fly_animation');
    return val === 'true'; // Defaults to false as requested (默认关闭)
  });

  const [syncBgToBass, setSyncBgToBass] = useState<boolean>(() => {
    const val = localStorage.getItem('sync_bg_to_bass');
    return val !== 'false'; // Defaults to true
  });

  const [vinylMaterial, setVinylMaterial] = useState<string>(() => {
    return localStorage.getItem('active_vinyl_material') || 'obsidian';
  });

  const [viscosityPreset, setViscosityPreset] = useState<ViscosityPresetType>(() => {
    return (localStorage.getItem('viscosity_preset') as ViscosityPresetType) || 'superfluid';
  });

  const handleUpdateViscosityPreset = (preset: ViscosityPresetType) => {
    setViscosityPreset(preset);
    localStorage.setItem('viscosity_preset', preset);
  };

  const [albumVinylPullDistance, setAlbumVinylPullDistance] = useState<number>(() => {
    const saved = localStorage.getItem('album_vinyl_pull_distance');
    return saved ? parseInt(saved, 10) : 95;
  });

  const handleUpdateVinylPullDistance = (val: number) => {
    setAlbumVinylPullDistance(val);
    localStorage.setItem('album_vinyl_pull_distance', String(val));
  };

  const handleSelectMaterial = (id: string) => {
    setVinylMaterial(id);
    localStorage.setItem('active_vinyl_material', id);
  };

  // Precision 3D mechanical spatial alignment & calibration states (for PlayerControls and integrated Control Center)
  const [armLength, setArmLengthState] = useState<number>(() => {
    const saved = localStorage.getItem('arm_length');
    return saved ? parseInt(saved, 10) : 115;
  });
  const handleArmLengthChange = (val: number) => {
    setArmLengthState(val);
    localStorage.setItem('arm_length', String(val));
  };

  const [cartridgeRotation, setCartridgeRotationState] = useState<number>(() => {
    const saved = localStorage.getItem('cartridge_rotation');
    return saved ? parseFloat(saved) : -12;
  });
  const handleCartridgeRotationChange = (val: number) => {
    setCartridgeRotationState(val);
    localStorage.setItem('cartridge_rotation', String(val));
  };

  const [cartridgeXOffset, setCartridgeXOffsetState] = useState<number>(() => {
    const saved = localStorage.getItem('cartridge_x_offset');
    return saved ? parseFloat(saved) : -2;
  });
  const handleCartridgeXOffsetChange = (val: number) => {
    setCartridgeXOffsetState(val);
    localStorage.setItem('cartridge_x_offset', String(val));
  };

  const [cartridgeYOffset, setCartridgeYOffsetState] = useState<number>(() => {
    const saved = localStorage.getItem('cartridge_y_offset');
    return saved ? parseFloat(saved) : -18;
  });
  const handleCartridgeYOffsetChange = (val: number) => {
    setCartridgeYOffsetState(val);
    localStorage.setItem('cartridge_y_offset', String(val));
  };

  const [tonearmOffsetX, setTonearmOffsetXState] = useState<number>(() => {
    const saved = localStorage.getItem('tonearm_offset_x');
    return saved ? parseFloat(saved) : 28;
  });
  const handleTonearmOffsetXChange = (val: number) => {
    setTonearmOffsetXState(val);
    localStorage.setItem('tonearm_offset_x', String(val));
  };

  const [tonearmOffsetY, setTonearmOffsetYState] = useState<number>(() => {
    const saved = localStorage.getItem('tonearm_offset_y');
    return saved ? parseFloat(saved) : 40;
  });
  const handleTonearmOffsetYChange = (val: number) => {
    setTonearmOffsetYState(val);
    localStorage.setItem('tonearm_offset_y', String(val));
  };

  const [customRestAngle, setCustomRestAngleState] = useState<number>(() => {
    const saved = localStorage.getItem('custom_rest_angle');
    return saved ? parseFloat(saved) : -18;
  });
  const handleCustomRestAngleChange = (val: number) => {
    setCustomRestAngleState(val);
    localStorage.setItem('custom_rest_angle', String(val));
  };

  const [customPlayMinAngle, setCustomPlayMinAngleState] = useState<number>(() => {
    const saved = localStorage.getItem('custom_play_min_angle');
    return saved ? parseFloat(saved) : 8;
  });
  const handleCustomPlayMinAngleChange = (val: number) => {
    setCustomPlayMinAngleState(val);
    localStorage.setItem('custom_play_min_angle', String(val));
  };

  // Lyric display settings (persisted to localStorage)
  const [lyricFontSize, setLyricFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('lyric_font_size');
    return saved ? parseInt(saved, 10) : 32;
  });
  const handleLyricFontSizeChange = (val: number) => {
    setLyricFontSize(val);
    localStorage.setItem('lyric_font_size', String(val));
  };

  const [lyricPanelHeight, setLyricPanelHeight] = useState<number>(() => {
    const saved = localStorage.getItem('lyric_panel_height');
    return saved ? parseInt(saved, 10) : 50;
  });
  const handleLyricPanelHeightChange = (val: number) => {
    setLyricPanelHeight(val);
    localStorage.setItem('lyric_panel_height', String(val));
  };

  const [lyricPanelWidth, setLyricPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('lyric_panel_width');
    return saved ? parseInt(saved, 10) : 90;
  });
  const handleLyricPanelWidthChange = (val: number) => {
    setLyricPanelWidth(val);
    localStorage.setItem('lyric_panel_width', String(val));
  };

  const [wordByWord, setWordByWord] = useState<boolean>(() => {
    const saved = localStorage.getItem('lyric_word_by_word');
    return saved === 'true';
  });
  const handleWordByWordToggle = () => {
    const next = !wordByWord;
    setWordByWord(next);
    localStorage.setItem('lyric_word_by_word', String(next));
  };

  const [lyricColumnRatio, setLyricColumnRatio] = useState<number>(() => {
    const saved = localStorage.getItem('lyric_column_ratio');
    return saved ? parseInt(saved, 10) : 67;
  });
  const handleLyricColumnRatioChange = (val: number) => {
    setLyricColumnRatio(val);
    localStorage.setItem('lyric_column_ratio', String(val));
  };

  const [lyricPlayerGap, setLyricPlayerGap] = useState<number>(() => {
    const saved = localStorage.getItem('lyric_player_gap');
    return saved ? parseInt(saved, 10) : 32;
  });
  const handleLyricPlayerGapChange = (val: number) => {
    setLyricPlayerGap(val);
    localStorage.setItem('lyric_player_gap', String(val));
  };

  const [playerOffsetX, setPlayerOffsetX] = useState<number>(() => {
    const saved = localStorage.getItem('player_offset_x');
    return saved ? parseInt(saved, 10) : 0;
  });
  const handlePlayerOffsetXChange = (val: number) => {
    setPlayerOffsetX(val);
    localStorage.setItem('player_offset_x', String(val));
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<boolean>(false);
  const flyFadeTimeoutRef = useRef<any>(null);
  const flyFinishTimeoutRef = useRef<any>(null);
  const flyRafRef = useRef<any>(null);

  const [activeSection, setActiveSection] = useState<'player' | 'studio'>('player');
  const [flyingOverlay, setFlyingOverlay] = useState<{
    active: boolean;
    coverUrl: string;
    vinylGradient: string;
    currentLeft: number;
    currentTop: number;
    currentWidth: number;
    currentHeight: number;
    currentMorph: number; // 0 for player style, 1 for studio style
    type: 'to-studio' | 'to-player';
  } | null>(null);

  // Helper to safely clean up any style overriding left by fly transitions
  const cleanupFlyTransitionStyles = () => {
    const deck = document.getElementById('interactive-vinyl-3d-deck');
    if (deck) {
      deck.style.opacity = '';
      deck.style.transition = '';
    }
    const studios = document.querySelectorAll('.studio-album-jacket-card');
    studios.forEach((el: any) => {
      el.style.opacity = '';
      el.style.transition = '';
    });
  };

  // Flight animation trigger using high-precision spring math and real-time element tracking
  const triggerFlyAnimation = (from: 'player' | 'studio', to: 'player' | 'studio', currentScrollTop: number) => {
    if (!useFlyAnimation) return;

    // Clear any previous queued timeouts or loops to prevent overlay/clash on rapid page switches
    if (flyFadeTimeoutRef.current) clearTimeout(flyFadeTimeoutRef.current);
    if (flyFinishTimeoutRef.current) clearTimeout(flyFinishTimeoutRef.current);
    if (flyRafRef.current) cancelAnimationFrame(flyRafRef.current);

    // Call cleanup first so we restore any previously modified elements in general
    cleanupFlyTransitionStyles();

    const deckEl = document.getElementById('interactive-vinyl-3d-deck');
    const studioEl = document.getElementById('focused-studio-album-jacket');
    const scrollWrapper = document.getElementById('root-scroll-wrapper');
    
    if (!deckEl || !studioEl || !scrollWrapper) {
      setFlyingOverlay(null);
      return;
    }
    
    const deckRect = deckEl.getBoundingClientRect();
    const studioRect = studioEl.getBoundingClientRect();
    const wrapperRect = scrollWrapper.getBoundingClientRect();
    
    const scrollTop = scrollWrapper.scrollTop;
    const scrollLeft = scrollWrapper.scrollLeft;
    
    // Calculate precise start positions inside absolute scroll space
    const startX = from === 'player'
      ? deckRect.left - wrapperRect.left + scrollLeft
      : studioRect.left - wrapperRect.left + scrollLeft;
    const startY = from === 'player'
      ? deckRect.top - wrapperRect.top + scrollTop
      : studioRect.top - wrapperRect.top + scrollTop;
    const startWidth = from === 'player' ? deckRect.width : studioRect.width;
    const startHeight = from === 'player' ? deckRect.height : studioRect.height;

    // Calculate precise target positions inside absolute scroll space ONCE here (no layout thrashing inside RAF loop)
    const targetX = to === 'studio'
      ? studioRect.left - wrapperRect.left + scrollLeft
      : deckRect.left - wrapperRect.left + scrollLeft;
    const targetY = to === 'studio'
      ? studioRect.top - wrapperRect.top + scrollTop
      : deckRect.top - wrapperRect.top + scrollTop;
    const targetW = to === 'studio' ? studioRect.width : deckRect.width;
    const targetH = to === 'studio' ? studioRect.height : deckRect.height;
    const targetMorph = to === 'studio' ? 1 : 0;

    const activeMat = RECORD_MATERIALS.find(m => m.id === vinylMaterial) || RECORD_MATERIALS[0];

    // Set immediate opacity to hide original components during active flying transition
    deckEl.style.transition = 'none';
    studioEl.style.transition = 'none';
    deckEl.style.opacity = '0';
    studioEl.style.opacity = '0';

    // Tracking state variables for the spring engine
    let posX = startX;
    let velX = 0;
    
    let posY = startY;
    let velY = 0;
    
    let posW = startWidth;
    let velW = 0;
    
    let posH = startHeight;
    let velH = 0;
    
    let posMorph = from === 'player' ? 0 : 1;
    let velMorph = 0;

    const isBack = from === 'studio' && to === 'player';
    
    // Fine-tuned spring constants for an ultra-smooth, responsive, zero-lag flight tracking (perfectly critical-to-overdamped)
    const kPos = isBack ? 54 : 96;      // stiffness (tension) - higher tension for tight tracking
    const cPos = isBack ? 19.5 : 24.5;  // damping (friction) - perfectly dampens overshoot with luxurious viscosity
    
    const kMorph = isBack ? 42 : 78;    // stiffness for the vinyl extraction morph
    const cMorph = isBack ? 16.0 : 21.5;
    
    const mass = isBack ? 1.15 : 0.95;  // optimized mass for high-dimensional track switches to ensure zero residual oscillation

    let lastTime = performance.now();

    const updateSpring = (now: number) => {
      let dt = (now - lastTime) / 1000;
      lastTime = now;
      if (dt > 0.08) dt = 0.08; // Cap step size to handle browser inactive tab cycles gracefully
      if (dt < 0.001) dt = 0.001;

      // Check if elements still exist in DOM
      const currentDeckEl = document.getElementById('interactive-vinyl-3d-deck');
      const currentStudioEl = document.getElementById('focused-studio-album-jacket');
      const currentScrollWrapper = document.getElementById('root-scroll-wrapper');

      if (!currentDeckEl || !currentStudioEl || !currentScrollWrapper) {
        setFlyingOverlay(null);
        cleanupFlyTransitionStyles();
        return;
      }

      // Compute exact live scroll-relative target tracking coordinates
      const currentDeckRect = currentDeckEl.getBoundingClientRect();
      const currentStudioRect = currentStudioEl.getBoundingClientRect();
      const currentWrapperRect = currentScrollWrapper.getBoundingClientRect();

      const liveScrollTop = currentScrollWrapper.scrollTop;
      const liveScrollLeft = currentScrollWrapper.scrollLeft;

      const liveTargetX = to === 'studio'
        ? currentStudioRect.left - currentWrapperRect.left + liveScrollLeft
        : currentDeckRect.left - currentWrapperRect.left + liveScrollLeft;
      const liveTargetY = to === 'studio'
        ? currentStudioRect.top - currentWrapperRect.top + liveScrollTop
        : currentDeckRect.top - currentWrapperRect.top + liveScrollTop;
      const liveTargetW = to === 'studio' ? currentStudioRect.width : currentDeckRect.width;
      const liveTargetH = to === 'studio' ? currentStudioRect.height : currentDeckRect.height;

      // Multi-step integration to solve the spring differential safely
      const substeps = 4;
      const sDt = dt / substeps;
      for (let s = 0; s < substeps; s++) {
        // X Position
        const fX = -kPos * (posX - liveTargetX) - cPos * velX;
        const aX = fX / mass;
        velX += aX * sDt;
        posX += velX * sDt;

        // Y Position
        const fY = -kPos * (posY - liveTargetY) - cPos * velY;
        const aY = fY / mass;
        velY += aY * sDt;
        posY += velY * sDt;

        // Width
        const fW = -kPos * (posW - liveTargetW) - cPos * velW;
        const aW = fW / mass;
        velW += aW * sDt;
        posW += velW * sDt;

        // Height
        const fH = -kPos * (posH - liveTargetH) - cPos * velH;
        const aH = fH / mass;
        velH += aH * sDt;
        posH += velH * sDt;

        // Morph Progress
        const fM = -kMorph * (posMorph - targetMorph) - cMorph * velMorph;
        const aM = fM / mass;
        velMorph += aM * sDt;
        posMorph += velMorph * sDt;
      }

      const dist = Math.sqrt(
        (posX - liveTargetX) ** 2 +
        (posY - liveTargetY) ** 2 +
        (posW - liveTargetW) ** 2 +
        (posH - liveTargetH) ** 2 +
        (posMorph - targetMorph) ** 2
      );

      const maxVel = Math.max(
        Math.abs(velX),
        Math.abs(velY),
        Math.abs(velW),
        Math.abs(velH),
        Math.abs(velMorph)
      );

      const overlayEl = document.getElementById('flying-animation-overlay-container');

      // Pre-handover phase: when closing within 18px of the target, trigger high-perf 0.1s cross-fade
      if (dist < 18) {
        if (overlayEl && overlayEl.style.opacity !== '0') {
          overlayEl.style.transition = 'opacity 100ms cubic-bezier(0.16, 1, 0.3, 1)';
          overlayEl.style.opacity = '0';
        }
        if (currentDeckEl && currentDeckEl.style.opacity === '0') {
          currentDeckEl.style.transition = 'opacity 100ms cubic-bezier(0.16, 1, 0.3, 1)';
          currentDeckEl.style.opacity = '';
        }
        const studios = document.querySelectorAll('.studio-album-jacket-card');
        studios.forEach((el: any) => {
          if (el.style.opacity === '0') {
            el.style.transition = 'opacity 100ms cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.opacity = '';
          }
        });
      }

      setFlyingOverlay({
        active: true,
        coverUrl: currentSong.coverUrl,
        vinylGradient: activeMat.gradient,
        currentLeft: posX,
        currentTop: posY,
        currentWidth: posW,
        currentHeight: posH,
        currentMorph: posMorph,
        type: to === 'studio' ? 'to-studio' : 'to-player'
      });

      // Flawless, absolute landing snap
      if (dist < 0.45 && maxVel < 0.16) {
        // Force absolute snapping of values to target to eliminate any sub-pixel offsets
        setFlyingOverlay({
          active: true,
          coverUrl: currentSong.coverUrl,
          vinylGradient: activeMat.gradient,
          currentLeft: liveTargetX,
          currentTop: liveTargetY,
          currentWidth: liveTargetW,
          currentHeight: liveTargetH,
          currentMorph: targetMorph,
          type: to === 'studio' ? 'to-studio' : 'to-player'
        });

        // Handover frame sequence: unhide original components immediately in this rendering frame
        if (currentDeckEl) {
          currentDeckEl.style.transition = 'none';
          currentDeckEl.style.opacity = '';
        }
        const studios = document.querySelectorAll('.studio-album-jacket-card');
        studios.forEach((el: any) => {
          el.style.transition = 'none';
          el.style.opacity = '';
        });

        // Schedule removal of the overlapping flight card for the next rendering frame
        requestAnimationFrame(() => {
          setFlyingOverlay(null);
          cleanupFlyTransitionStyles();
        });
      } else {
        flyRafRef.current = requestAnimationFrame(updateSpring);
      }
    };

    flyRafRef.current = requestAnimationFrame(updateSpring);
  };

  const handleScroll = (e: any) => {
    const container = e.currentTarget;
    if (!container) return;
    const currentScrollTop = container.scrollTop;
    
    const height = window.innerHeight || 800;
    const newSection = currentScrollTop > height * 0.45 ? 'studio' : 'player';
    
    if (newSection !== activeSection) {
      triggerFlyAnimation(activeSection, newSection, currentScrollTop);
      setActiveSection(newSection);
    }
  };

  const handleSelectSongFromStudio = (song: Song) => {
    const currentScrollTop = scrollContainerRef.current?.scrollTop ?? window.innerHeight;
    triggerFlyAnimation('studio', 'player', currentScrollTop);
    
    setCurrentSong(song);
    setIsPlaying(true);
    setActiveSection('player');
    scrollToPlayer();
  };

  const animateScrollTo = (targetY: number, duration: number = 750) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;
    
    // Temporarily disable scroll snaps to prevent snap engine fighting the smooth scrolling path
    el.style.scrollSnapType = 'none';

    el.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });

    // Safely restore snap behaviors once smooth scrolling completes
    setTimeout(() => {
      if (el) {
        el.style.scrollSnapType = '';
      }
      isScrollingRef.current = false;
    }, duration);
  };

  const scrollToVinylStudio = () => {
    animateScrollTo(window.innerHeight, 900);
  };

  const scrollToPlayer = () => {
    animateScrollTo(0, 900);
  };

  // Handler to update the active song's cover and propagate to the database/lists on-the-fly
  const handleUpdateSongCover = (newCoverUrl: string) => {
    setCurrentSong((prev) => {
      const updated = { ...prev, coverUrl: newCoverUrl };
      
      // Update global in-memory songs list so it persists to IndexedDB
      setSongsList((prevList) => 
        prevList.map((song) => 
          song.id === prev.id ? { ...song, coverUrl: newCoverUrl } : song
        )
      );
      
      return updated;
    });
  };

  // Helper function to turn color RGB into HSL to compute complementary hues is not needed here as we define standard inline helpers
  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) {
        h = (g - b) / d + (g < b ? 6 : 0);
      } else if (max === g) {
        h = (b - r) / d + 2;
      } else {
        h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      r = hue2rgb(h + 1/3);
      g = hue2rgb(h);
      b = hue2rgb(h - 1/3);
    }
    return [parseFloat(r.toFixed(3)), parseFloat(g.toFixed(3)), parseFloat(b.toFixed(3))];
  };

  // Dynamic palette extraction based on the current song's album cover image
  useEffect(() => {
    if (!currentSong) return;

    // Start with the default pre-matched palette
    setDynamicPalette(currentSong.palette);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Load through our same-origin Express proxy to completely resolve CORS constraints
    // 直连封面（CORS 支持取决于 CDN）；无法取色时 fallback 到 procedural palette
    img.src = currentSong.coverUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48; // High-density grid sampling
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 48, 48);
        const imgData = ctx.getImageData(0, 0, 48, 48).data;

        // Bucket clustering in RGB space to identify dominant color sectors
        const bins: Record<string, { rSum: number; gSum: number; bSum: number; count: number }> = {};
        
        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i+1];
          const b = imgData[i+2];
          const a = imgData[i+3];
          
          if (a < 128) continue; // ignore transparent alpha values

          // Cluster into 4x4x4 buckets in RGB space
          const rBin = Math.floor(r / 64);
          const gBin = Math.floor(g / 64);
          const bBin = Math.floor(b / 64);
          const binKey = `${rBin}-${gBin}-${bBin}`;

          if (!bins[binKey]) {
            bins[binKey] = { rSum: 0, gSum: 0, bSum: 0, count: 0 };
          }
          bins[binKey].rSum += r;
          bins[binKey].gSum += g;
          bins[binKey].bSum += b;
          bins[binKey].count += 1;
        }

        // Calculate weighted averages for each bucket
        const list = Object.values(bins).map(bin => {
          const rAvg = bin.rSum / bin.count;
          const gAvg = bin.gSum / bin.count;
          const bAvg = bin.bSum / bin.count;

          // Compute saturation as: (max - min) / 255
          const maxVal = Math.max(rAvg, gAvg, bAvg);
          const minVal = Math.min(rAvg, gAvg, bAvg);
          const saturation = maxVal === 0 ? 0 : (maxVal - minVal) / 255;
          const brightness = (rAvg + gAvg + bAvg) / (3 * 255);

          // Boost weights of vibrant saturated colors, down-weight monochromatic extremes
          let weight = bin.count * (1.0 + saturation * 3.5);
          
          // Down-rate boring/oversaturated pure darks or pure whites
          if (brightness < 0.08 || brightness > 0.95) {
            weight *= 0.1;
          } else if (saturation < 0.12) {
            weight *= 0.3; // prioritize vibrant colors over gray/muted tones
          }

          return {
            r: rAvg,
            g: gAvg,
            b: bAvg,
            weight
          };
        });

        // Sort descending by calculated beautiful weights
        list.sort((a, b) => b.weight - a.weight);

        // Filter out distinct colors
        const selectedColors: Array<[number, number, number]> = [];
        for (const item of list) {
          if (selectedColors.length >= 3) break;
          const color: [number, number, number] = [
            parseFloat((item.r / 255).toFixed(3)),
            parseFloat((item.g / 255).toFixed(3)),
            parseFloat((item.b / 255).toFixed(3))
          ];

          // Check RGB euclidean distance from previously selected colors
          let tooClose = false;
          for (const sel of selectedColors) {
            const dist = Math.sqrt(
              Math.pow(color[0] - sel[0], 2) +
              Math.pow(color[1] - sel[1], 2) +
              Math.pow(color[2] - sel[2], 2)
            );
            if (dist < 0.30) { // minimum distance to ensure color contrast diversity
              tooClose = true;
              break;
            }
          }

          if (!tooClose) {
            selectedColors.push(color);
          }
        }

        // Complimentary generator fallback if not enough distinct colors are selected
        if (selectedColors.length < 3 && selectedColors.length > 0) {
          const primary = selectedColors[0];
          const hsl = rgbToHsl(primary[0] * 255, primary[1] * 255, primary[2] * 255);
          while (selectedColors.length < 3) {
            const shiftHue = (hsl.h + (selectedColors.length * 120)) % 360;
            const fallbackRgb = hslToRgb(shiftHue, Math.max(70, hsl.s), Math.max(35, Math.min(65, hsl.l)));
            selectedColors.push(fallbackRgb);
          }
        } else if (selectedColors.length === 0) {
          const p = currentSong.palette;
          selectedColors.push(p.blob0, p.blob1, p.blob2);
        }

        // Apply top three extracted colors to key WebGL liquid shader coordinates
        setDynamicPalette({
          blob0: selectedColors[0],
          blob1: selectedColors[1],
          blob2: selectedColors[2],
          blob3: selectedColors[0],
          blob4: selectedColors[1]
        });

      } catch (err) {
        console.warn('Dynamic cover extraction warning, fallback to default palette:', err);
      }
    };

    img.onerror = () => {
      console.warn('Dynamic cover extraction failed to load image, using pre-configured palette.');
    };
  }, [currentSong]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync volume of audio tag with volume state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Synchronize loop parameter based on whether we are in single loop mode
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = playMode === 'single';
    }
  }, [playMode]);

  // Intercept mouse wheel scrolling to match the smooth programmatic flying animation
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // If we are already mid-animation, block any further wheel scrolling
      if (isScrollingRef.current) {
        e.preventDefault();
        return;
      }

      // Ignore tiny background movements / noise
      if (Math.abs(e.deltaY) < 5) return;

      // Let carousel / other wheel-zone components handle their own wheel events.
      // Must be checked BEFORE the scrollable child walk.
      // Critical: we call preventDefault() here because React 17+ uses passive
      // listeners for wheel events, meaning the component's onWheel preventDefault()
      // is ignored by the browser. Without this, the browser scrolls the container
      // and handleScroll triggers page switching.
      if ((e.target as HTMLElement).closest('[data-wheel-zone]')) {
        e.preventDefault();
        return;
      }

      // Walk up the DOM to find a scrollable child ancestor.
      // If the user is scrolling inside a child that has room to scroll,
      // let the child handle it instead of switching pages.
      let node: HTMLElement | null = e.target as HTMLElement;
      while (node && node !== el) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          const canScrollDown = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
          const canScrollUp = node.scrollTop > 1;
          if (
            (e.deltaY > 0 && canScrollDown) ||
            (e.deltaY < 0 && canScrollUp)
          ) {
            // Child has room to scroll in this direction — let it handle the event
            return;
          }
          // Child is at boundary — fall through to page switch
          break;
        }
        node = node.parentElement;
      }

      if (e.deltaY > 0 && activeSection === 'player') {
        e.preventDefault();
        scrollToVinylStudio();
      } else if (e.deltaY < 0 && activeSection === 'studio') {
        e.preventDefault();
        scrollToPlayer();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [activeSection]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when focus is in an input/textarea (Tab also skipped in inputs)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'Enter':
          e.preventDefault();
          if (currentSong && currentSong.id !== '__empty__') {
            handleToggleLike(currentSong.id);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioRef.current) {
            const newTime = Math.max(0, audioRef.current.currentTime - 5);
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioRef.current) {
            const newTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5);
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }
          break;
        case 'Tab':
          e.preventDefault();
          cyclePlayMode();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentSong?.id, playMode, songsList]);

  // Manage song change & play states
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    // Put new track URL
    audio.src = currentSong.audioUrl;
    audio.load();

    // If the player was playing, keep it playing automatically after changing songs
    if (isPlaying || shouldAutoPlayRef.current) {
      shouldAutoPlayRef.current = false;
      // Resume AudioContext before attempting play — browser autoplay
      // policy may have suspended it, causing silent playback.
      resumeAudioContext().then(() => {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch((error) => {
            console.log("Audio play deferred until user gesture:", error);
            setIsPlaying(false);
          });
        }
      });
    } else {
      audio.pause();
    }
  }, [currentSong]);

  // Handle play/pause toggle triggers
  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Resume AudioContext before playing — otherwise audio will be
      // silently lost if the context was suspended by autoplay policy.
      await resumeAudioContext();
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Playback failed:', err);
        setIsPlaying(false);
      });
    }
  };

  // Navigating back across tracks
  const handlePrev = () => {
    if (!currentSong || songsList.length === 0) return;
    if (playMode === 'shuffle' && songsList.length > 1) {
      let randIndex = Math.floor(Math.random() * songsList.length);
      const currentIndex = songsList.findIndex((s) => s.id === currentSong.id);
      while (randIndex === currentIndex) {
        randIndex = Math.floor(Math.random() * songsList.length);
      }
      setCurrentSong(songsList[randIndex]);
      setCurrentTime(0);
    } else {
      const currentIndex = songsList.findIndex((s) => s.id === currentSong.id);
      const prevIndex = (currentIndex - 1 + songsList.length) % songsList.length;
      setCurrentSong(songsList[prevIndex]);
      setCurrentTime(0);
    }
  };

  // Navigating forward across tracks
  const handleNext = () => {
    if (!currentSong || songsList.length === 0) return;
    if (playMode === 'shuffle' && songsList.length > 1) {
      let randIndex = Math.floor(Math.random() * songsList.length);
      const currentIndex = songsList.findIndex((s) => s.id === currentSong.id);
      while (randIndex === currentIndex) {
        randIndex = Math.floor(Math.random() * songsList.length);
      }
      setCurrentSong(songsList[randIndex]);
      setCurrentTime(0);
    } else {
      const currentIndex = songsList.findIndex((s) => s.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % songsList.length;
      setCurrentSong(songsList[nextIndex]);
      setCurrentTime(0);
    }
  };

  // Track scrubber seeking action
  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Listen to active audio updates
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || currentSong?.durationSeconds || 0);
      // Apply pending seek from restored player state (first load only)
      if (pendingSeekRef.current !== null) {
        audioRef.current.currentTime = pendingSeekRef.current;
        setCurrentTime(pendingSeekRef.current);
        pendingSeekRef.current = null;
      }
    }
  };

  // Cycle play mode: list → single → shuffle → list
  const cyclePlayMode = () => {
    setPlayMode((prev) => {
      const next = prev === 'list' ? 'single' : prev === 'single' ? 'shuffle' : 'list';
      localStorage.setItem('play_mode', next);
      return next;
    });
  };

  const handleSongEnded = () => {
    if (playMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      handleNext();
    }
  };

  const hexToRgb01 = (hex: string): [number, number, number] => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return [
      parseFloat((r / 255).toFixed(3)),
      parseFloat((g / 255).toFixed(3)),
      parseFloat((b / 255).toFixed(3))
    ];
  };

  const finalPalette = useCustomBgColor
    ? {
        blob0: hexToRgb01(customColors[0] || '#1e3a8a'),
        blob1: hexToRgb01(customColors[1] || '#0d9488'),
        blob2: hexToRgb01(customColors[2] || '#3b82f6'),
        blob3: hexToRgb01(customColors[0] || '#1e3a8a'),
        blob4: hexToRgb01(customColors[1] || '#0d9488')
      }
    : (currentSong ? dynamicPalette : {
        blob0: hexToRgb01('#1e3a8a'),
        blob1: hexToRgb01('#0d9488'),
        blob2: hexToRgb01('#3b82f6'),
        blob3: hexToRgb01('#1e3a8a'),
        blob4: hexToRgb01('#0d9488')
      });

  return (
    <div 
      ref={scrollContainerRef}
      className="h-screen w-full overflow-y-auto snap-y snap-mandatory scroll-smooth scrollbar-none relative"
      id="root-scroll-wrapper"
      onScroll={handleScroll}
    >
      
      {/* Floating Error Toast Notification */}
      {audioError && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm md:max-w-md bg-rose-950/80 border border-rose-500/30 backdrop-blur-xl px-5 py-4 rounded-xl flex items-center gap-3.5 shadow-[0_20px_40px_rgba(244,63,94,0.15)] transition-all duration-300">
          <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <span className="text-rose-400 font-bold text-sm">!</span>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">播放状态提示 &bull; Audio Status</span>
            <p className="text-[11px] text-rose-200/95 leading-normal">{audioError}</p>
          </div>
          <button 
            onClick={() => setAudioError(null)}
            className="text-white/40 hover:text-white/80 p-1 rounded-full hover:bg-white/5 transition-all cursor-pointer"
          >
            <X size={14} className="stroke-[3.5px]" />
          </button>
        </div>
      )}

      {/* 1. Fluid GPU Living-Liquid Shader Canvas Background */}
      <SilkBackground 
        isPlaying={isPlaying} 
        blurAmount={blurAmount} 
        colorPalette={finalPalette}
        flowSpeed={flowSpeed}
        foldDepth={foldDepth}
        saturation={saturation}
        bgContrast={bgContrast}
        bgBrightness={bgBrightness}
        bgHueRotate={bgHueRotate}
        bgScale={bgScale}
        syncBgToBass={syncBgToBass}
        currentSong={displaySong}
      />

      {/* 1.5. Dynamic Darkness Mask (暗度遮罩) */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none transition-all duration-300"
        style={{
          backgroundColor: '#000000',
          opacity: bgDimness,
        }}
        id="bg-darkness-mask"
      />

      {/* 2. Tangible Film Grain Noise Mesh Overlay */}
      <div 
        className="fixed inset-0 z-1 pointer-events-none mix-blend-overlay"
        style={{
          opacity: grainOpacity,
          background: `
            radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%),
            radial-gradient(rgba(255,255,255,0.2) 0.6px, transparent 0.8px)
          `,
          backgroundSize: 'auto, 5px 5px',
        }}
      />

      {/* 3. Audio Element Source (Hidden render) */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleSongEnded}
        onError={handleAudioError}
        preload="auto"
        crossOrigin="anonymous"
      />

      {/* SECTION 1: MAIN LYRICS PLAYER SCREEN */}
      <section className="relative h-screen w-full snap-start flex flex-col justify-between p-4 md:p-8 shrink-0 overflow-x-visible overflow-y-hidden" id="classic-player-view">

      <div className="contents">

      {/* 4. Elegant Hover-to-Reveal Floating Header Bar with Expandable Controls Menu */}
      <div className="absolute top-0 left-0 right-0 z-50 group flex flex-col items-center pt-2 px-4 md:px-8 pointer-events-none">
        <header className={`w-full max-w-6xl flex flex-col pointer-events-auto px-4 py-3 border border-white/10 backdrop-blur-md rounded-2xl bg-slate-950/40 shadow-2xl transition-all duration-300 ease-out ${
          isTopMenuOpen 
            ? 'translate-y-0 opacity-100 scale-100' 
            : 'translate-y-0 opacity-0 scale-[0.99] group-hover:opacity-100 group-hover:scale-100'
        }`}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 border border-emerald-500/10 hover:border-emerald-500/20 rounded-full text-[11px] font-black tracking-widest text-slate-950 cursor-pointer transition-all duration-300 shadow-lg shadow-emerald-500/20 uppercase"
              >
                <Search size={12} className="stroke-[3px]" />
                <span>全网搜歌</span>
              </button>
              <button
                onClick={() => setIsPlaylistsOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 border border-rose-500/10 hover:border-rose-500/20 rounded-full text-[11px] font-black tracking-widest text-white cursor-pointer transition-all duration-300 shadow-lg shadow-rose-500/20 uppercase"
              >
                <FolderHeart size={12} className="stroke-[2.5px]" />
                <span>我的歌单</span>
              </button>
              <button
                onClick={() => setIsLocalImportOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 border border-cyan-500/10 hover:border-cyan-500/20 rounded-full text-[11px] font-black tracking-widest text-slate-950 cursor-pointer transition-all duration-300 shadow-lg shadow-cyan-500/20 uppercase"
              >
                <Upload size={12} className="stroke-[2.5px]" />
                <span>导入本地</span>
              </button>
              <div className="w-[1px] h-3.5 bg-white/10" />
              <Disc className={`w-5 h-5 text-white/50 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              <span className="text-xs uppercase tracking-widest font-extrabold font-mono opacity-65 hidden sm:inline">BINIX MUSIC</span>
            </div>

            {/* Middle Toggle Controls Menu */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTopMenuOpen(!isTopMenuOpen)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider transition-all duration-300 ${
                  isTopMenuOpen 
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-extrabold' 
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                }`}
              >
                <Sliders size={13} className={isTopMenuOpen ? "animate-pulse" : ""} />
                <span>控制中心</span>
                <ChevronDown size={12} className={`transition-transform duration-300 ${isTopMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Translation option togglers */}
            <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5">
              <button
                onClick={toggleFullscreen}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white transition-all duration-300"
                title={isFullscreen ? '退出全屏' : '全屏显示'}
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                onClick={() => setLangMode('both')}
                className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-300 ${langMode === 'both' ? 'bg-white text-slate-950 shadow-md' : 'text-white/60 hover:text-white'}`}
              >
                对照
              </button>
              <button
                onClick={() => setLangMode('en')}
                className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-300 ${langMode === 'en' ? 'bg-white text-slate-950 shadow-md' : 'text-white/60 hover:text-white'}`}
              >
                ENG
              </button>
              <button
                onClick={() => setLangMode('cn')}
                className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-300 ${langMode === 'cn' ? 'bg-white text-slate-950 shadow-md' : 'text-white/60 hover:text-white'}`}
              >
                中文
              </button>
            </div>
          </div>

          {/* Top Menu Dropdown Content with smooth height layout transition */}
          <div className={`overflow-y-auto overflow-x-hidden scrollbar-none transition-all duration-500 ease-in-out ${
            isTopMenuOpen ? 'max-h-[85vh] mt-4 opacity-100 border-t border-white/5 pt-4' : 'max-h-0 opacity-0 pointer-events-none'
          }`}>
            <div className="flex flex-col lg:flex-row gap-6 text-white pb-2">
              
              {/* Column 2: 音乐大小调整 (Scale Sizing) */}
              <div className="flex flex-col min-w-0 flex-1 max-h-[min(360px,40vh)] overflow-y-auto scrollbar-none" id="top-scale-column">
                <h3 className="text-[11px] uppercase tracking-widest font-black text-white/40 mb-3 flex items-center gap-1.5 font-bold">
                  <Maximize2 size={12} className="text-emerald-400" />
                  <span>音乐调整大小</span>
                </h3>
                
                <div className="flex flex-col gap-3.5 bg-white/5 p-3.5 rounded-xl border border-white/5 h-[170px] justify-center">
                  <div className="flex items-center justify-between text-xs font-bold text-white/80">
                    <span>播放器比例:</span>
                    <span className="font-mono bg-emerald-500/20 border border-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-black">
                      {Math.round(playerScale * 100)}%
                    </span>
                  </div>
                  
                  <input 
                    type="range"
                    min="0.75"
                    max="1.25"
                    step="0.05"
                    value={playerScale}
                    onChange={(e) => setPlayerScale(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                    style={{
                      background: `linear-gradient(to right, #10b981 ${(playerScale - 0.75) / (1.25 - 0.75) * 100}%, rgba(255,255,255,0.1) ${(playerScale - 0.75) / (1.25 - 0.75) * 100}%)`
                    }}
                  />

                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[0.85, 1.0, 1.15].map((sh) => (
                      <button
                        key={sh}
                        onClick={() => setPlayerScale(sh)}
                        className={`py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all duration-300 ${
                          playerScale === sh 
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' 
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {sh === 1.0 ? '中(100%)' : sh < 1.0 ? '小(85%)' : '大(115%)'}
                      </button>
                    ))}
                  </div>
                </div>

              {/* Lyrics Display Settings */}
              <div className="mt-3.5 flex flex-col gap-3 bg-white/5 p-3.5 rounded-xl border border-white/5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-white/60">歌词字号</span>
                    <span className="text-purple-400 font-mono font-black">{lyricFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="48"
                    step="1"
                    value={lyricFontSize}
                    className="w-full accent-purple-500 bg-white/10 h-1 rounded cursor-pointer"
                    onChange={(e) => handleLyricFontSizeChange(parseInt(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-white/60">歌词区域高度</span>
                    <span className="text-purple-400 font-mono font-black">{lyricPanelHeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="95"
                    step="1"
                    value={lyricPanelHeight}
                    className="w-full accent-purple-500 bg-white/10 h-1 rounded cursor-pointer"
                    onChange={(e) => handleLyricPanelHeightChange(parseInt(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-white/60">歌词区域宽度</span>
                    <span className="text-purple-400 font-mono font-black">{lyricPanelWidth}%</span>
                  </div>
                  <input
                    type="range"
                    min="55"
                    max="150"
                    step="1"
                    value={lyricPanelWidth}
                    className="w-full accent-purple-500 bg-white/10 h-1 rounded cursor-pointer"
                    onChange={(e) => handleLyricPanelWidthChange(parseInt(e.target.value))}
                  />
                </div>

                {/* Word-by-word highlight toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-[11px] font-bold text-white/70">逐字高亮</span>
                  <button
                    onClick={handleWordByWordToggle}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      wordByWord ? 'bg-purple-500' : 'bg-white/15'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                        wordByWord ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Lyric column ratio slider */}
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-white/60">歌词区占比</span>
                    <span className="text-purple-400 font-mono font-black">{lyricColumnRatio}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="85"
                    step="1"
                    value={lyricColumnRatio}
                    className="w-full accent-purple-500 bg-white/10 h-1 rounded cursor-pointer"
                    onChange={(e) => handleLyricColumnRatioChange(parseInt(e.target.value))}
                  />
                </div>

                {/* Lyric-player gap slider */}
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-white/60">歌词播放区间距</span>
                    <span className="text-purple-400 font-mono font-black">{lyricPlayerGap}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="4"
                    value={lyricPlayerGap}
                    className="w-full accent-purple-500 bg-white/10 h-1 rounded cursor-pointer"
                    onChange={(e) => handleLyricPlayerGapChange(parseInt(e.target.value))}
                  />
                </div>

                {/* Player horizontal offset slider */}
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-white/60">播放控制区偏移</span>
                    <span className="text-purple-400 font-mono font-black">{playerOffsetX}px</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="200"
                    step="4"
                    value={playerOffsetX}
                    className="w-full accent-purple-500 bg-white/10 h-1 rounded cursor-pointer"
                    onChange={(e) => handlePlayerOffsetXChange(parseInt(e.target.value))}
                  />
                </div>
              </div>
              </div>

              {/* Column 3: 渲染参数配置 (Shader Render Tuning) */}
              <div className="flex flex-col min-w-0 flex-1" id="top-render-column">
                <h3 className="text-[11px] uppercase tracking-widest font-black text-white/40 mb-3 flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5"><Sliders size={12} className="text-emerald-400" /> 渲染配置</span>
                  {blurAmount === 0 && <span className="text-[9px] text-yellow-500 font-bold flex items-center gap-0.5 animate-pulse">✨ 极清模式</span>}
                </h3>
                
                <div className="flex flex-col gap-2.5 bg-white/5 p-3.5 rounded-xl border border-white/5 max-h-[min(360px,40vh)] overflow-y-auto justify-start scrollbar-none">
                  {/* Blur Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>背景羽化模糊:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {blurAmount === 0 ? '极清 (0px)' : `${blurAmount}px`}
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="25"
                      step="1"
                      value={blurAmount}
                      onChange={(e) => setBlurAmount(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${blurAmount / 25 * 100}%, rgba(255,255,255,0.1) ${blurAmount / 25 * 100}%)`
                      }}
                    />
                  </div>

                  {/* Flow Speed Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>色彩流动速度:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {flowSpeed === 0 ? '静止 (0.0x)' : `${flowSpeed.toFixed(1)}x`}
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.0"
                      max="3.0"
                      step="0.2"
                      value={flowSpeed}
                      onChange={(e) => setFlowSpeed(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${flowSpeed / 3.0 * 100}%, rgba(255,255,255,0.1) ${flowSpeed / 3.0 * 100}%)`
                      }}
                    />
                  </div>

                  {/* Fold Depth / Relief Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>丝褶起伏立体感:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {(foldDepth * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={foldDepth}
                      onChange={(e) => setFoldDepth(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(foldDepth - 0.1) / (1.0 - 0.1) * 100}%, rgba(255,255,255,0.1) ${(foldDepth - 0.1) / (1.0 - 0.1) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Saturation Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>色彩饱和高色域:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {(saturation * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={saturation}
                      onChange={(e) => setSaturation(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(saturation - 0.5) / (2.5 - 0.5) * 100}%, rgba(255,255,255,0.1) ${(saturation - 0.5) / (2.5 - 0.5) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Film Grain Opacity Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>质感胶片颗粒:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {(grainOpacity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.0"
                      max="0.4"
                      step="0.02"
                      value={grainOpacity}
                      onChange={(e) => setGrainOpacity(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${grainOpacity / 0.4 * 100}%, rgba(255,255,255,0.1) ${grainOpacity / 0.4 * 100}%)`
                      }}
                    />
                  </div>

                  {/* --- 音频兼容与流频谱采集设置 --- */}
                  <div className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400 mt-2 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>音频频谱与兼容性</span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={useRealSpectrum} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setUseRealSpectrum(val);
                          localStorage.setItem('use_real_spectrum', String(val));
                        }} 
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-1.5 text-[9px] font-bold text-white/70">
                        {useRealSpectrum ? "实际采集" : "安全模拟"}
                      </span>
                    </label>
                  </div>

                  <div className="text-[9px] text-white/50 bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1.5 animate-fade-in leading-relaxed">
                    <div className="flex items-center gap-1.5 text-white/80 font-bold">
                      {useRealSpectrum ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping shrink-0" />
                          <span className="text-yellow-400">已激活：实时音频流频谱采样分析</span>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                          <span className="text-emerald-400">已启用：高保真声波动力学模拟（防静音免CORS）</span>
                        </>
                      )}
                    </div>
                    <span>
                      {useRealSpectrum 
                        ? "注意：当前正在直接拦截读取音频源波形。如果部分歌曲、跨域接口（如网易云等外站歌曲）不支持 CORS 授权，可能因 system 安全沙箱被浏览器自动“安全静音”。如无声请切回到安全模拟。" 
                        : "采用全新声波动力学重组，100% 杜绝因播放外站、代理或本地音乐导致的跨域静音 Bug（默认推荐，可在此随时开关）。"}
                    </span>
                  </div>

                  {/* --- 背景氛围重低音同步 (Sync Background Fluid to Bass) --- */}
                  <div className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400 mt-2 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>背景氛围重低音同步</span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={syncBgToBass} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setSyncBgToBass(val);
                          localStorage.setItem('sync_bg_to_bass', String(val));
                        }} 
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-1.5 text-[9px] font-bold text-white/70">
                        {syncBgToBass ? "开启" : "关闭"}
                      </span>
                    </label>
                  </div>

                  <div className="text-[9px] text-white/50 bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1.5 animate-fade-in leading-relaxed">
                    <span>开启后，背景流光将实时响应乐曲中的低频（Bass）重低音能量，添加微弱的节奏性全局亮度脉冲与浸入式呼吸闪烁效果，显著提升沉浸感。</span>
                  </div>

                  {/* --- 飞入动画设置 (Fly-in Animation Option) --- */}
                  <div className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400 mt-2 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>飞入动画切换</span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={useFlyAnimation} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setUseFlyAnimation(val);
                          localStorage.setItem('use_fly_animation', String(val));
                        }} 
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-1.5 text-[9px] font-bold text-white/70">
                        {useFlyAnimation ? "开启" : "关闭"}
                      </span>
                    </label>
                  </div>

                  <div className="text-[9px] text-white/50 bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1.5 animate-fade-in leading-relaxed">
                    <div className="flex items-center gap-1.5 text-white/80 font-bold">
                      {useFlyAnimation ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          <span className="text-emerald-400">已启用：唱片高维轨迹飞人切换</span>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
                          <span className="text-white/60">已停用：默认视图直切（提升滑动流畅度）</span>
                        </>
                      )}
                    </div>
                    <span>
                      {useFlyAnimation 
                        ? "在主播放器与 3D 胶片美学工作室切换时，黑胶唱片将生成流畅的高精度惯性弹性飞行轨迹，极位震撼。" 
                        : "直接进行视图切换与平稳过渡，不触发任何额外的浮动物理轨迹追踪。极致平滑、低延迟省电首选。"}
                    </span>
                  </div>

                  {/* --- 自定义背景颜色模式 (Custom Background Color) --- */}
                  <div className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400 mt-2 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>背景颜色模式</span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={useCustomBgColor} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setUseCustomBgColor(val);
                          localStorage.setItem('use_custom_bg_color', String(val));
                        }} 
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-1.5 text-[9px] font-bold text-white/70">
                        {useCustomBgColor ? "自定义" : "自动取色"}
                      </span>
                    </label>
                  </div>

                  {!useCustomBgColor ? (
                    <div className="text-[10px] text-white/50 bg-white/5 p-2.5 rounded-lg border border-white/5 flex items-center gap-1.5 animate-fade-in line-clamp-2">
                      <Sparkles size={11} className="text-emerald-400 animate-pulse shrink-0 animate-bounce" />
                      <span>已启用流式自动色彩提取，背景随封面歌曲变换</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 bg-white/5 p-2 rounded-xl border border-white/5 animate-fade-in">
                      {/* Pickers for the 3 colors */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-medium text-white/50">渐变三色段配色器:</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {customColors.map((color, index) => (
                            <div key={index} className="flex flex-col items-center gap-1 bg-black/35 p-1 rounded-lg border border-white/5">
                              <label className="text-[7.5px] font-mono text-white/40 uppercase">色段 {index + 1}</label>
                              <div className="relative w-6 h-6 rounded cursor-pointer overflow-hidden border border-white/10 hover:border-emerald-400">
                                <input 
                                  type="color"
                                  value={color || '#1e3a8a'}
                                  onChange={(e) => {
                                    const next = [...customColors];
                                    next[index] = e.target.value;
                                    setCustomColors(next);
                                    localStorage.setItem('custom_bg_colors', JSON.stringify(next));
                                  }} 
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                />
                                <div className="w-full h-full" style={{ backgroundColor: color }} />
                              </div>
                              <span className="text-[7px] font-mono text-white/60 tracking-tighter">{color.toUpperCase()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Built-in Preset Grid */}
                      <div className="flex flex-col gap-1 border-t border-white/5 pt-1.5">
                        <span className="text-[9px] font-medium text-white/50">精选调色预设:</span>
                        <div className="grid grid-cols-2 gap-1 max-h-[85px] overflow-y-auto pr-1">
                          {BUILT_IN_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                setCustomColors(preset.colors);
                                localStorage.setItem('custom_bg_colors', JSON.stringify(preset.colors));
                              }}
                              className="text-[9.5px] text-left p-1 bg-black/25 hover:bg-emerald-500/10 active:scale-[0.98] border border-white/5 rounded transition-all text-white/80 hover:text-white flex items-center justify-between"
                            >
                              <span className="truncate max-w-[55px]">{preset.name}</span>
                              <div className="flex gap-0.5 shrink-0">
                                {preset.colors.map((c, i) => (
                                  <div key={i} className="w-1.5 h-1.5 rounded-full border border-black/30" style={{ backgroundColor: c }} />
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* User Custom Saved Presets */}
                      <div className="flex flex-col gap-1 border-t border-white/5 pt-1.5">
                        <div className="flex items-center justify-between text-[9px] font-medium text-white/50">
                          <span>自定义存盘预设:</span>
                        </div>
                        
                        {localPresets.length === 0 ? (
                          <span className="text-[8px] text-white/35 italic py-1 text-center bg-black/10 rounded">暂无个人收藏预设</span>
                        ) : (
                          <div className="flex flex-col gap-1 max-h-[65px] overflow-y-auto pr-1">
                            {localPresets.map((preset) => (
                              <div 
                                key={preset.id}
                                className="flex items-center justify-between p-1 bg-black/35 border border-white/5 rounded"
                              >
                                <button
                                  onClick={() => {
                                    setCustomColors(preset.colors);
                                    localStorage.setItem('custom_bg_colors', JSON.stringify(preset.colors));
                                  }}
                                  className="text-[9px] text-left text-white/80 hover:text-emerald-400 truncate flex-1 flex items-center gap-1.5"
                                >
                                  <div className="flex gap-0.5 shrink-0">
                                    {preset.colors.map((c, i) => (
                                      <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                                    ))}
                                  </div>
                                  <span className="truncate">{preset.name}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = localPresets.filter(p => p.id !== preset.id);
                                    setLocalPresets(next);
                                    localStorage.setItem('custom_bg_presets', JSON.stringify(next));
                                  }}
                                  className="text-[12px] text-red-400 hover:text-red-300 font-black px-1.5 active:scale-95 cursor-pointer leading-none"
                                  title="删除此预设"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Save Current Colors Button */}
                        <div className="flex gap-1 mt-1">
                          <input 
                            type="text"
                            placeholder="预设命名后存盘..."
                            id="new-preset-name-input"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.currentTarget;
                                const name = input.value.trim() || `自定配色 ${localPresets.length + 1}`;
                                const newPreset = {
                                  id: String(Date.now()),
                                  name,
                                  colors: [...customColors]
                                };
                                const next = [newPreset, ...localPresets];
                                setLocalPresets(next);
                                localStorage.setItem('custom_bg_presets', JSON.stringify(next));
                                input.value = '';
                              }
                            }}
                            className="bg-black/35 border border-white/10 text-white placeholder-white/25 text-[8.5px] px-1.5 py-1 rounded flex-1 focus:outline-none focus:border-emerald-400/50 min-w-0"
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById('new-preset-name-input') as HTMLInputElement | null;
                              const name = (input?.value || '').trim() || `自定配色 ${localPresets.length + 1}`;
                              const newPreset = {
                                id: String(Date.now()),
                                name,
                                colors: [...customColors]
                              };
                              const next = [newPreset, ...localPresets];
                              setLocalPresets(next);
                              localStorage.setItem('custom_bg_presets', JSON.stringify(next));
                              if (input) input.value = '';
                            }}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 active:scale-[0.97] border border-emerald-500/20 text-[8.5px] px-1.5 rounded font-bold transition-all shrink-0 cursor-pointer"
                          >
                            存盘
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- 更多背景详细设置 --- */}
                  <div className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400 mt-2 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>背景高级详细配置</span>
                    <button
                      onClick={() => {
                        setBgDimness(0.4);
                        localStorage.setItem('bg_dimness', '0.4');
                        setBgContrast(1.1);
                        localStorage.setItem('bg_contrast', '1.1');
                        setBgBrightness(1.0);
                        localStorage.setItem('bg_brightness', '1.0');
                        setBgHueRotate(0);
                        localStorage.setItem('bg_hue_rotate', '0');
                        setBgScale(1.0);
                        localStorage.setItem('bg_scale', '1.0');
                        setUseCustomBgColor(false);
                        localStorage.setItem('use_custom_bg_color', 'false');
                      }}
                      className="text-[8px] text-white/40 hover:text-emerald-300 font-bold tracking-normal cursor-pointer underline hover:no-underline"
                      title="重置背景及配色为默认值"
                    >
                      重置所有背景
                    </button>
                  </div>

                  {/* 1. bgDimness Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>背景亮度遮罩:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {(bgDimness * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.0"
                      max="0.9"
                      step="0.05"
                      value={bgDimness}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setBgDimness(val);
                        localStorage.setItem('bg_dimness', String(val));
                      }}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${bgDimness / 0.9 * 100}%, rgba(255,255,255,0.1) ${bgDimness / 0.9 * 100}%)`
                      }}
                    />
                  </div>

                  {/* 2. bgContrast Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>背景对比度:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {(bgContrast * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={bgContrast}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setBgContrast(val);
                        localStorage.setItem('bg_contrast', String(val));
                      }}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(bgContrast - 0.5) / (2.0 - 0.5) * 100}%, rgba(255,255,255,0.1) ${(bgContrast - 0.5) / (2.0 - 0.5) * 100}%)`
                      }}
                    />
                  </div>

                  {/* 3. bgBrightness Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>背景过滤亮度:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {(bgBrightness * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.4"
                      max="1.6"
                      step="0.05"
                      value={bgBrightness}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setBgBrightness(val);
                        localStorage.setItem('bg_brightness', String(val));
                      }}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(bgBrightness - 0.4) / (1.6 - 0.4) * 100}%, rgba(255,255,255,0.1) ${(bgBrightness - 0.4) / (1.6 - 0.4) * 100}%)`
                      }}
                    />
                  </div>

                  {/* 4. bgHueRotate Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>背景色相偏移:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {bgHueRotate}°
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={bgHueRotate}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setBgHueRotate(val);
                        localStorage.setItem('bg_hue_rotate', String(val));
                      }}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${bgHueRotate / 360 * 100}%, rgba(255,255,255,0.1) ${bgHueRotate / 360 * 100}%)`
                      }}
                    />
                  </div>

                  {/* 5. bgScale Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>背景画布缩放:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {bgScale.toFixed(2)}x
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0.2"
                      max="2.5"
                      step="0.02"
                      value={bgScale}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setBgScale(val);
                        localStorage.setItem('bg_scale', String(val));
                      }}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(bgScale - 0.2) / (2.5 - 0.2) * 100}%, rgba(255,255,255,0.1) ${(bgScale - 0.2) / (2.5 - 0.2) * 100}%)`
                      }}
                    />
                  </div>

                </div>
              </div>

              {/* Column 4: 唱针空间微调 (precision mechanical 3D spatial alignment & calibration parameters) */}
              <div className="flex flex-col min-w-0 flex-1" id="top-tonearm-column">
                <h3 className="text-[11px] uppercase tracking-widest font-black text-white/40 mb-3 flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5"><Sliders size={12} className="text-emerald-400" /> 唱片及唱臂空间标定</span>
                  <button
                    onClick={() => {
                      handleArmLengthChange(115);
                      handleCartridgeRotationChange(-12);
                      handleCartridgeXOffsetChange(-2);
                      handleCartridgeYOffsetChange(-18);
                      handleTonearmOffsetXChange(28);
                      handleTonearmOffsetYChange(40);
                      handleCustomRestAngleChange(-18);
                      handleCustomPlayMinAngleChange(8);
                    }}
                    className="text-[8px] text-white/40 hover:text-emerald-300 font-bold tracking-normal cursor-pointer underline hover:no-underline"
                    title="重置所有唱臂空间机械参数到预置默认配置"
                  >
                    重置机械
                  </button>
                </h3>

                <div className="flex flex-col gap-2.5 bg-white/5 p-3.5 rounded-xl border border-white/5 max-h-[min(360px,40vh)] overflow-y-auto justify-start scrollbar-none">
                  
                  {/* Arm Length Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>① 唱臂金属杆长度:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {armLength}px
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="50"
                      max="250"
                      step="1"
                      value={armLength}
                      onChange={(e) => handleArmLengthChange(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(armLength - 50) / (250 - 50) * 100}%, rgba(255,255,255,0.1) ${(armLength - 50) / (250 - 50) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Cartridge Rotation Slider */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>② 磁头/唱头旋转角:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {cartridgeRotation}°
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="-90"
                      max="90"
                      step="1"
                      value={cartridgeRotation}
                      onChange={(e) => handleCartridgeRotationChange(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(cartridgeRotation - (-90)) / (90 - (-90)) * 100}%, rgba(255,255,255,0.1) ${(cartridgeRotation - (-90)) / (90 - (-90)) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Cartridge X Offset */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>③ 唱头 X 轴水平位移:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {cartridgeXOffset}px
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="-50"
                      max="50"
                      step="0.5"
                      value={cartridgeXOffset}
                      onChange={(e) => handleCartridgeXOffsetChange(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(cartridgeXOffset - (-50)) / (50 - (-50)) * 100}%, rgba(255,255,255,0.1) ${(cartridgeXOffset - (-50)) / (50 - (-50)) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Cartridge Y Offset */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>④ 唱头 Y 轴前端位移:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {cartridgeYOffset}px
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="-100"
                      max="0"
                      step="0.5"
                      value={cartridgeYOffset}
                      onChange={(e) => handleCartridgeYOffsetChange(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(cartridgeYOffset - (-100)) / (0 - (-100)) * 100}%, rgba(255,255,255,0.1) ${(cartridgeYOffset - (-100)) / (0 - (-100)) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Tonearm Offset X */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>⑤ 唱臂底座 X 位移:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {tonearmOffsetX}px
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={tonearmOffsetX}
                      onChange={(e) => handleTonearmOffsetXChange(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(tonearmOffsetX - (-100)) / (100 - (-100)) * 100}%, rgba(255,255,255,0.1) ${(tonearmOffsetX - (-100)) / (100 - (-100)) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Tonearm Offset Y */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>⑥ 唱臂底座 Y 位移:</span>
                      <span className="font-mono bg-white/10 text-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {tonearmOffsetY}px
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={tonearmOffsetY}
                      onChange={(e) => handleTonearmOffsetYChange(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(tonearmOffsetY - (-100)) / (100 - (-100)) * 100}%, rgba(255,255,255,0.1) ${(tonearmOffsetY - (-100)) / (100 - (-100)) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Calibration Rest Angle (Red Area) */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>⑦ 标定休眠区 (Rest):</span>
                      <span className="font-mono bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {customRestAngle}°
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="-45"
                      max="0"
                      step="0.5"
                      value={customRestAngle}
                      onChange={(e) => handleCustomRestAngleChange(parseFloat(e.target.value))}
                      className="w-full accent-rose-500 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #ef4444 ${(customRestAngle - (-45)) / (0 - (-45)) * 100}%, rgba(255,255,255,0.1) ${(customRestAngle - (-45)) / (0 - (-45)) * 100}%)`
                      }}
                    />
                  </div>

                  {/* Calibration Play Angle (Green Area) */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                      <span>⑧ 标定播放始点 (Play):</span>
                      <span className="font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {customPlayMinAngle}°
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="45"
                      step="0.5"
                      value={customPlayMinAngle}
                      onChange={(e) => handleCustomPlayMinAngleChange(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-fade-in"
                      style={{
                        background: `linear-gradient(to right, #10b981 ${(customPlayMinAngle - 0) / (45 - 0) * 100}%, rgba(255,255,255,0.1) ${(customPlayMinAngle - 0) / (45 - 0) * 100}%)`
                      }}
                    />
                  </div>

                  <div className="text-[9px] text-emerald-400/80 bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-500/10 flex flex-col gap-1 leading-normal">
                    <div className="flex items-center gap-1.5 text-emerald-300 font-extrabold">
                      <span>💡 唱臂空间机械调教说明</span>
                    </div>
                    <span>
                      您可以实时微调唱机唱臂的长度、唱头的旋转偏角、底座的锚点位置，以及唱片内层与外层的拾针接触接触红绿坐标标记区间。微调将在中间 3D 唱片模型中实时生效。
                    </span>
                  </div>

                </div>
              </div>

            </div>

            {/* EQ & Audio Effects Panel */}
            <EQSonicPanel audioRef={audioRef} isPlaying={isPlaying} />


          </div>
        </header>


      </div>

      {/* Removed scroll and click trigger for Vinyl Customization */}

      {/* 5. Responsive Split Screen Main Column Layout */}
      <section
        className="relative z-10 flex-1 grid items-center w-full mx-auto py-8"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) minmax(0, ${(lyricColumnRatio / (100 - lyricColumnRatio)).toFixed(2)}fr)`,
          gap: `${lyricPlayerGap}px`,
        }}
      >
        
        {/* Left column: Player controllers, cover art, visualizers */}
        <div className="w-full flex items-center justify-center py-4" style={{ transform: `translateX(${playerOffsetX}px) scale(${playerScale})`, transformOrigin: 'center center', transition: 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)' }}>
          <PlayerControls
            currentSong={displaySong}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onPrev={handlePrev}
            onNext={handleNext}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            volume={volume}
            onVolumeChange={setVolume}
            blurAmount={blurAmount}
            setBlurAmount={setBlurAmount}
            playMode={playMode}
            onChangePlayMode={(mode) => {
              setPlayMode(mode);
              localStorage.setItem('play_mode', mode);
            }}
            onToggleSongList={() => setIsTopMenuOpen(!isTopMenuOpen)}
            likedSongIds={likedSongIds}
            onToggleLike={handleToggleLike}
            audioRef={audioRef}
            playerScale={playerScale}
            onUpdateCover={handleUpdateSongCover}
            vinylMaterial={vinylMaterial}
            viscosityPreset={viscosityPreset}
            customRestAngle={customRestAngle}
            setCustomRestAngle={handleCustomRestAngleChange}
            customPlayMinAngle={customPlayMinAngle}
            setCustomPlayMinAngle={handleCustomPlayMinAngleChange}
            cartridgeRotation={cartridgeRotation}
            setCartridgeRotation={handleCartridgeRotationChange}
            armLength={armLength}
            setArmLength={handleArmLengthChange}
            cartridgeXOffset={cartridgeXOffset}
            setCartridgeXOffset={handleCartridgeXOffsetChange}
            cartridgeYOffset={cartridgeYOffset}
            setCartridgeYOffset={handleCartridgeYOffsetChange}
            tonearmOffsetX={tonearmOffsetX}
            setTonearmOffsetX={handleTonearmOffsetXChange}
            tonearmOffsetY={tonearmOffsetY}
            setTonearmOffsetY={handleTonearmOffsetYChange}
            songsList={songsList}
            currentSongId={displaySong.id}
            onSelectSong={(song) => setCurrentSong(song)}
            lyricFontSize={lyricFontSize}
            setLyricFontSize={handleLyricFontSizeChange}
            lyricPanelHeight={lyricPanelHeight}
            setLyricPanelHeight={handleLyricPanelHeightChange}
            lyricPanelWidth={lyricPanelWidth}
            setLyricPanelWidth={handleLyricPanelWidthChange}
          />
        </div>

        {/* Right column: Silky-smooth synchronized flowing lyrics */}
        <div className="w-full flex items-center justify-center py-4">
          <LyricsPanel
            lyrics={displaySong.lyrics}
            currentTime={currentTime}
            onSelectTime={handleSeek}
            langMode={langMode}
            fontSize={lyricFontSize}
            panelHeight={lyricPanelHeight}
            panelWidth={lyricPanelWidth}
            wordByWord={wordByWord}
          />
        </div>
      </section>
      </div>
      </section>

      {/* SECTION 2: 3D VINYL MATERIAL SELECTION STUDIO */}
      <section className="relative min-h-screen w-full snap-start flex flex-col justify-between shrink-0 overflow-hidden" id="vinyl-material-studio-view">
        <VinylSelectionStudio
          currentSong={displaySong}
          onSelectSong={handleSelectSongFromStudio}
          songsList={songsList}
          activeMaterial={vinylMaterial}
          onSelectMaterial={(id) => {
            handleSelectMaterial(id);
          }}
          onScrollUp={scrollToPlayer}
          albumVinylPullDistance={albumVinylPullDistance}
          setAlbumVinylPullDistance={handleUpdateVinylPullDistance}
          viscosityPreset={viscosityPreset}
          onChangeViscosityPreset={handleUpdateViscosityPreset}
        />
      </section>

      {/* FLOATING OVERLAYS (Modals & Drawers) */}
      {/* 6. Apple-style sliding music queue browser Drawer */}
      <SongSelector
        currentSong={displaySong}
        onSelectSong={(song) => {
          setCurrentSong(song);
          setIsPlaying(true);
        }}
        isOpen={isSongListOpen}
        onClose={() => setIsSongListOpen(false)}
        isPlaying={isPlaying}
        playlist={songsList}
        onOpenPlaylists={() => setIsPlaylistsOpen(true)}
      />

      {/* 7. Full-network interactive music search & playlist save modal */}
      <SearchSongsModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        playlist={songsList}
        onSaveTrack={(newSong) => {
          // Dynamic in-memory array concatenation
          setSongsList((prev) => [...prev, newSong]);
          // auto play immediately
          setCurrentSong(newSong);
          setIsPlaying(true);
        }}
      />

      {/* 8. My Playlists and Favorite Music Modal */}
      <PlaylistsModal
        isOpen={isPlaylistsOpen}
        onClose={() => setIsPlaylistsOpen(false)}
        songsList={songsList}
        likedSongIds={likedSongIds}
        onToggleLike={handleToggleLike}
        playlists={playlists}
        onCreatePlaylist={handleCreatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onRenamePlaylist={handleRenamePlaylist}
        onAddSongToPlaylist={handleAddSongToPlaylist}
        onRemoveSongFromPlaylist={handleRemoveSongFromPlaylist}
        onPlaySong={(song) => {
          setCurrentSong(song);
          setIsPlaying(true);
        }}
        onReplaceSongsList={(newSongs) => setSongsList(newSongs)}
        onImportLocalSongs={handleImportLocalSongs}
        currentSong={displaySong}
        isPlaying={isPlaying}
        recentPlays={recentPlays}
      />

      {/* 9. Local Music Importer Modal */}
      <LocalMusicImporter
        isOpen={isLocalImportOpen}
        onClose={() => setIsLocalImportOpen(false)}
        onSongsImported={handleImportLocalSongs}
      />

      {flyingOverlay && flyingOverlay.active && (
        <div 
          className="absolute left-0 top-0 w-full h-[200vh] pointer-events-none z-[100]"
          style={{
            pointerEvents: 'none',
          }}
        >
          {/* The flying element container using real-time spring interpolation values */}
          <div
            id="flying-animation-overlay-container"
            className="absolute flex items-center justify-center overflow-visible"
            style={{
              width: flyingOverlay.currentWidth,
              height: flyingOverlay.currentHeight,
              left: flyingOverlay.currentLeft,
              top: flyingOverlay.currentTop,
              transformStyle: 'preserve-3d',
              userSelect: 'none',
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center overflow-visible">
              {/* Flying Vinyl - size & rotation mapped dynamically to current morph */}
              <div 
                className="absolute rounded-full aspect-square shadow-2xl"
                style={{
                  width: `${80 + 20 * flyingOverlay.currentMorph}%`,
                  height: `${80 + 20 * flyingOverlay.currentMorph}%`,
                  background: flyingOverlay.vinylGradient,
                  boxShadow: 'inset 0 0 1px rgba(255,255,255,0.1), inset 0 0 10px rgba(0,0,0,0.9), 0 8px 24px rgba(0,0,0,0.7)',
                  transform: `translateX(${((flyingOverlay.currentWidth * 0.28) * (1 - flyingOverlay.currentMorph) + albumVinylPullDistance * flyingOverlay.currentMorph).toFixed(2)}px) rotate(${flyingOverlay.currentMorph * 360}deg)`,
                }}
              >
                {/* Vinyl grooving design inside */}
                <div className="absolute inset-0 rounded-full border border-white/5 flex items-center justify-center">
                  <div className="absolute inset-[12%] rounded-full border border-white/5" />
                  <div className="absolute inset-[24%] rounded-full border border-white/5" />
                  <div className="absolute inset-[36%] rounded-full border border-white/5" />
                  {/* Sticker label */}
                  <div className="absolute rounded-full overflow-hidden w-[36%] h-[36%] flex items-center justify-center">
                    <img src={flyingOverlay.coverUrl} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                  </div>
                  {/* Spindle hole */}
                  <div className="absolute w-3 h-3 bg-slate-950 border border-white/20 rounded-full" />
                </div>
              </div>
              
              {/* Flying Jacket - size and translate mapped dynamically to current morph */}
              <div 
                className="absolute overflow-hidden shadow-[0_20px_48px_rgba(0,0,0,0.85)] border border-white/10"
                style={{
                  width: `${74 + 26 * flyingOverlay.currentMorph}%`,
                  height: `${74 + 26 * flyingOverlay.currentMorph}%`,
                  transform: `translateX(${((-flyingOverlay.currentWidth * 0.20) * (1 - flyingOverlay.currentMorph)).toFixed(2)}px)`,
                  borderRadius: `${24 - 12 * flyingOverlay.currentMorph}px`,
                }}
              >
                <img 
                  src={flyingOverlay.coverUrl} 
                  alt="" 
                  className="w-full h-full object-cover select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/15 mix-blend-overlay" />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
