import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, Repeat, Repeat1, Shuffle, Sliders, Menu, Sparkles, Disc, Upload, X, Check, ListMusic, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Song } from '../types';
import { RECORD_MATERIALS } from './VinylSelectionStudio';
import { getSharedAnalyser } from './EQSonicPanel';

type ViscosityPresetType = 'superfluid' | 'viscous' | 'glassy' | 'superfluid_optics' | 'viscous_optics' | 'glassy_optics';

interface PlayerControlsProps {
  currentSong: Song;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  blurAmount: number;
  setBlurAmount: (val: number) => void;
  playMode: 'list' | 'single' | 'shuffle';
  onChangePlayMode: (mode: 'list' | 'single' | 'shuffle') => void;
  onToggleSongList: () => void;
  likedSongIds?: string[];
  onToggleLike?: (songId: string) => void;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  playerScale?: number;
  onUpdateCover?: (newCoverUrl: string) => void;
  vinylMaterial?: string;
  viscosityPreset?: ViscosityPresetType;
  customRestAngle?: number;
  setCustomRestAngle?: (val: number) => void;
  customPlayMinAngle?: number;
  setCustomPlayMinAngle?: (val: number) => void;
  cartridgeRotation?: number;
  setCartridgeRotation?: (val: number) => void;
  armLength?: number;
  setArmLength?: (val: number) => void;
  cartridgeXOffset?: number;
  setCartridgeXOffset?: (val: number) => void;
  cartridgeYOffset?: number;
  setCartridgeYOffset?: (val: number) => void;
  tonearmOffsetX?: number;
  setTonearmOffsetX?: (val: number) => void;
  tonearmOffsetY?: number;
  setTonearmOffsetY?: (val: number) => void;
  songsList?: Song[];
  currentSongId?: string;
  onSelectSong?: (song: Song) => void;
  lyricFontSize?: number;
  setLyricFontSize?: (val: number) => void;
  lyricPanelHeight?: number;
  setLyricPanelHeight?: (val: number) => void;
  lyricPanelWidth?: number;
  setLyricPanelWidth?: (val: number) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentSong,
  isPlaying,
  onPlayPause,
  onPrev,
  onNext,
  currentTime,
  duration,
  onSeek,
  isMuted,
  onToggleMute,
  volume,
  onVolumeChange,
  blurAmount,
  setBlurAmount,
  playMode,
  onChangePlayMode,
  onToggleSongList,
  likedSongIds = [],
  onToggleLike,
  audioRef,
  playerScale = 1.0,
  onUpdateCover,
  vinylMaterial = 'obsidian',
  viscosityPreset = 'superfluid',
  customRestAngle: propCustomRestAngle,
  setCustomRestAngle: propSetCustomRestAngle,
  customPlayMinAngle: propCustomPlayMinAngle,
  setCustomPlayMinAngle: propSetCustomPlayMinAngle,
  cartridgeRotation: propCartridgeRotation,
  setCartridgeRotation: propSetCartridgeRotation,
  armLength: propArmLength,
  setArmLength: propSetArmLength,
  cartridgeXOffset: propCartridgeXOffset,
  setCartridgeXOffset: propSetCartridgeXOffset,
  cartridgeYOffset: propCartridgeYOffset,
  setCartridgeYOffset: propSetCartridgeYOffset,
  tonearmOffsetX: propTonearmOffsetX,
  setTonearmOffsetX: propSetTonearmOffsetX,
  tonearmOffsetY: propTonearmOffsetY,
  setTonearmOffsetY: propSetTonearmOffsetY,
  songsList = [],
  currentSongId,
  onSelectSong,
  lyricFontSize = 32,
  setLyricFontSize,
  lyricPanelHeight = 50,
  setLyricPanelHeight,
  lyricPanelWidth = 90,
  setLyricPanelWidth,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeMat = RECORD_MATERIALS.find(m => m.id === vinylMaterial) || RECORD_MATERIALS[0];

  // States for interactive 3D digital physics simulations
  const [rotateX, setRotateX] = useState<number>(0);
  const [rotateY, setRotateY] = useState<number>(0);
  const [shineX, setShineX] = useState<number>(50);
  const [shineY, setShineY] = useState<number>(50);

  // Style state: 'flat' (centered card) vs 'vinyl' (Apple-style left-offset 3D vinyl disc) vs 'vinyl-only' (centered clean spinning vinyl)
  const [coverStyle, setCoverStyle] = useState<'flat' | 'vinyl' | 'vinyl-only'>(() => {
    return (localStorage.getItem('cover_style') as 'flat' | 'vinyl' | 'vinyl-only') || 'vinyl';
  });

  // Brief flash message state upon layout toggle
  const [toastMsg, setToastMsg] = useState<string>('');

  // Volume popup state
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const volumeBtnRef = useRef<HTMLButtonElement>(null);

  // Playlist popup state
  const [showPlaylistPopup, setShowPlaylistPopup] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const playlistBtnRef = useRef<HTMLButtonElement>(null);

  // Vinyl left extraction animation state
  const [isExtractingLeft, setIsExtractingLeft] = useState<boolean>(false);
  const [randomYOffset, setRandomYOffset] = useState<number>(0);
  const [randomRotateZ, setRandomRotateZ] = useState<number>(0);
  const [randomRotateY, setRandomRotateY] = useState<number>(-22);
  const [coverOnTop, setCoverOnTop] = useState<boolean>(() => {
    return localStorage.getItem('cover_on_top') !== 'false';
  });
  const startHoldTimeRef = useRef<number>(0);

  // State for long press style-switcher reveal gestures
  const [progress, setProgress] = useState<number>(0);
  const [showStyleSwitcher, setShowStyleSwitcher] = useState<boolean>(false);
  const holdTimeoutRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-to-seek state
  const isDraggingRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  const rafIdRef = useRef<number>(0);
  const dragPercentRef = useRef<number>(0);
  durationRef.current = duration;
  onSeekRef.current = onSeek;

  const PRESET_COVERS = [
    "https://images.unsplash.com/photo-1579033461380-adb47c3eb938?w=500&q=80",
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=80",
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=500&q=80",
    "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=500&q=80",
    "https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&q=80",
    "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=500&q=80",
    "https://images.unsplash.com/photo-1517783999520-f068d7431a60?w=500&q=80"
  ];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingArm) return; // Freeze 3D calculations during physical drag to avoid cursor offset drift
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nx = (x / rect.width) - 0.5;
    const ny = (y / rect.height) - 0.5;
    // Set tilting based on layout - very subtle and perfectly centered
    const maxTilt = 8;
    setRotateX(-ny * maxTilt);
    setRotateY(nx * maxTilt);
    setShineX((x / rect.width) * 100);
    setShineY((y / rect.height) * 100);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setShineX(50);
    setShineY(50);
    endHold();
  };

  const startHold = (e: React.MouseEvent | React.TouchEvent, target: 'cover' | 'vinyl') => {
    e.stopPropagation();
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    startHoldTimeRef.current = Date.now();
    setProgress(1);
    const startTime = Date.now();
    const holdDuration = 650; // ms

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const percent = Math.min((elapsed / holdDuration) * 100, 100);
      setProgress(percent);
      if (percent >= 100) {
        clearInterval(progressIntervalRef.current!);
      }
    }, 16);

    holdTimeoutRef.current = setTimeout(() => {
      setCoverStyle(prev => {
        let next: 'flat' | 'vinyl' | 'vinyl-only' = prev;
        if (target === 'cover') {
          next = prev === 'flat' ? 'vinyl' : 'flat';
        } else {
          next = prev === 'vinyl-only' ? 'vinyl' : 'vinyl-only';
        }
        localStorage.setItem('cover_style', next);
        
        let msg = '';
        if (next === 'flat') msg = '已进入：单封面模式 💿';
        else if (next === 'vinyl-only') msg = '已进入：单黑胶模式 🖲️';
        else msg = '已恢复：双重立体黑胶模型 💿';
        
        // Silenced green layout switch toast popup per user request
        return next;
      });
      setProgress(0);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      startHoldTimeRef.current = 0;
    }, holdDuration);
  };

  const endHold = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    // Check quick tap
    if (startHoldTimeRef.current > 0) {
      const elapsed = Date.now() - startHoldTimeRef.current;
      if (elapsed < 300) {
        if (coverStyle === 'vinyl') {
          if (!isExtractingLeft) {
            // Generate clean, realistically random Y offsets (-22px to +22px)
            const randomY = (Math.random() - 0.5) * 44; 
            
            // Corresponding direction tilt matching the Y displacement direction!
            // If randomY is positive (slid downwards to the left), tilt is clockwise (positive Z).
            // If randomY is negative (slid upwards to the left), tilt is counter-clockwise (negative Z).
            const sign = randomY >= 0 ? 1 : -1;
            const randomRot = sign * (6 + Math.random() * 8); // Range: +6deg to +14deg or -6deg to -14deg
            
            // Randomize the 3D perspectival Y-rotation a bit too
            const randomRotYVal = -22 + (Math.random() - 0.5) * 10; // -17deg to -27deg
            
            setRandomYOffset(randomY);
            setRandomRotateZ(randomRot);
            setRandomRotateY(randomRotYVal);
            setIsExtractingLeft(true);
            
            // Exactly at the peak of the smooth slide-out, when the sleeve completely clears the record
            // (the slide-out transition is 550ms, so 460ms is perfect, near peak with 0% coordinate overlap)
            setTimeout(() => {
              // Swap the layers instantly without any transition 
              setCoverOnTop(prev => {
                const next = !prev;
                localStorage.setItem('cover_on_top', String(next));
                return next;
              });
              
              // Immediately initiate the slide-back animation
              setIsExtractingLeft(false);
            }, 460);
          }
        }
      }
    }
    startHoldTimeRef.current = 0;
    setProgress(0);
  };

  const handleTogglePlayMode = () => {
    let nextMode: 'list' | 'single' | 'shuffle' = 'list';
    if (playMode === 'list') nextMode = 'single';
    else if (playMode === 'single') nextMode = 'shuffle';
    else nextMode = 'list';
    onChangePlayMode(nextMode);

    let msg = '';
    if (nextMode === 'list') msg = '已切换至：列表顺序播放 🔁';
    else if (nextMode === 'single') msg = '已切换至：单曲循环播放 🔂';
    else msg = '已切换至：随机播放模式 🔀';
    // Silenced green playMode toggle toast popup per user request
  };

  const processImageFile = (file: File) => {
    if (!file.type.match('image.*')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        onUpdateCover?.(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // Interactive Tonearm (唱头唱针) dragging state and coordinate mapping mechanics
  const [isDraggingArm, setIsDraggingArm] = useState<boolean>(false);
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const pivotRef = useRef<HTMLDivElement | null>(null);
  const cachedPivotRef = useRef<{ x: number; y: number } | null>(null);

  // Custom calibration states for physical resting and active start angles
  const [localCustomRestAngle, setLocalCustomRestAngle] = useState<number>(() => {
    const saved = localStorage.getItem('custom_rest_angle');
    return saved ? parseFloat(saved) : -18;
  });
  const customRestAngle = propCustomRestAngle !== undefined ? propCustomRestAngle : localCustomRestAngle;
  const setCustomRestAngle = (val: number) => {
    if (propSetCustomRestAngle) {
      propSetCustomRestAngle(val);
    } else {
      setLocalCustomRestAngle(val);
      localStorage.setItem('custom_rest_angle', String(val));
    }
  };

  const [localCustomPlayMinAngle, setLocalCustomPlayMinAngle] = useState<number>(() => {
    const saved = localStorage.getItem('custom_play_min_angle');
    return saved ? parseFloat(saved) : 8;
  });
  const customPlayMinAngle = propCustomPlayMinAngle !== undefined ? propCustomPlayMinAngle : localCustomPlayMinAngle;
  const setCustomPlayMinAngle = (val: number) => {
    if (propSetCustomPlayMinAngle) {
      propSetCustomPlayMinAngle(val);
    } else {
      setLocalCustomPlayMinAngle(val);
      localStorage.setItem('custom_play_min_angle', String(val));
    }
  };

  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(() => {
    return localStorage.getItem('is_calibration_open') === 'true';
  });

  // States for precision tonearm custom dimensions & mechanical alignment (Developer Mode)
  const [localCartridgeRotation, setLocalCartridgeRotation] = useState<number>(() => {
    const saved = localStorage.getItem('cartridge_rotation');
    return saved ? parseFloat(saved) : -12;
  });
  const cartridgeRotation = propCartridgeRotation !== undefined ? propCartridgeRotation : localCartridgeRotation;
  const setCartridgeRotation = (val: number) => {
    if (propSetCartridgeRotation) {
      propSetCartridgeRotation(val);
    } else {
      setLocalCartridgeRotation(val);
      localStorage.setItem('cartridge_rotation', String(val));
    }
  };

  const [localArmLength, setLocalArmLength] = useState<number>(() => {
    const saved = localStorage.getItem('arm_length');
    return saved ? parseFloat(saved) : 115;
  });
  const armLength = propArmLength !== undefined ? propArmLength : localArmLength;
  const setArmLength = (val: number) => {
    if (propSetArmLength) {
      propSetArmLength(val);
    } else {
      setLocalArmLength(val);
      localStorage.setItem('arm_length', String(val));
    }
  };

  const [localCartridgeXOffset, setLocalCartridgeXOffset] = useState<number>(() => {
    const saved = localStorage.getItem('cartridge_x_offset');
    return saved ? parseFloat(saved) : -2;
  });
  const cartridgeXOffset = propCartridgeXOffset !== undefined ? propCartridgeXOffset : localCartridgeXOffset;
  const setCartridgeXOffset = (val: number) => {
    if (propSetCartridgeXOffset) {
      propSetCartridgeXOffset(val);
    } else {
      setLocalCartridgeXOffset(val);
      localStorage.setItem('cartridge_x_offset', String(val));
    }
  };

  const [localCartridgeYOffset, setLocalCartridgeYOffset] = useState<number>(() => {
    const saved = localStorage.getItem('cartridge_y_offset');
    return saved ? parseFloat(saved) : -18;
  });
  const cartridgeYOffset = propCartridgeYOffset !== undefined ? propCartridgeYOffset : localCartridgeYOffset;
  const setCartridgeYOffset = (val: number) => {
    if (propSetCartridgeYOffset) {
      propSetCartridgeYOffset(val);
    } else {
      setLocalCartridgeYOffset(val);
      localStorage.setItem('cartridge_y_offset', String(val));
    }
  };

  const [localTonearmOffsetX, setLocalTonearmOffsetX] = useState<number>(() => {
    const saved = localStorage.getItem('tonearm_offset_x');
    return saved ? parseFloat(saved) : 28;
  });
  const tonearmOffsetX = propTonearmOffsetX !== undefined ? propTonearmOffsetX : localTonearmOffsetX;
  const setTonearmOffsetX = (val: number) => {
    if (propSetTonearmOffsetX) {
      propSetTonearmOffsetX(val);
    } else {
      setLocalTonearmOffsetX(val);
      localStorage.setItem('tonearm_offset_x', String(val));
    }
  };

  const [localTonearmOffsetY, setLocalTonearmOffsetY] = useState<number>(() => {
    const saved = localStorage.getItem('tonearm_offset_y');
    return saved ? parseFloat(saved) : 40;
  });
  const tonearmOffsetY = propTonearmOffsetY !== undefined ? propTonearmOffsetY : localTonearmOffsetY;
  const setTonearmOffsetY = (val: number) => {
    if (propSetTonearmOffsetY) {
      propSetTonearmOffsetY(val);
    } else {
      setLocalTonearmOffsetY(val);
      localStorage.setItem('tonearm_offset_y', String(val));
    }
  };

  const [isDevFloatingOpen, setIsDevFloatingOpen] = useState<boolean>(false);

  const [devPos, setDevPos] = useState<{ x: number; y: number }>(() => {
    const saved = localStorage.getItem('dev_floating_pos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Auto-upgrade from old default y: 120 directly to the pristine top placement
          if (parsed.y === 120) {
            const upgraded = { x: window.innerWidth > 768 ? window.innerWidth - 340 : 20, y: 16 };
            localStorage.setItem('dev_floating_pos', JSON.stringify(upgraded));
            return upgraded;
          }
          return parsed;
        }
      } catch (e) {}
    }
    return { x: window.innerWidth > 768 ? window.innerWidth - 340 : 20, y: 16 };
  });
  
  const [isDraggingDev, setIsDraggingDev] = useState(false);
  const devDragStartRef = useRef({ x: 0, y: 0 });

  const handleDevDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setIsDraggingDev(true);
    devDragStartRef.current = {
      x: clientX - devPos.x,
      y: clientY - devPos.y
    };
  };

  useEffect(() => {
    if (!isDraggingDev) return;

    const handleGlobalMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const nextX = clientX - devDragStartRef.current.x;
      const nextY = clientY - devDragStartRef.current.y;
      
      const boundedX = Math.max(10, Math.min(window.innerWidth - 330, nextX));
      const boundedY = Math.max(10, Math.min(window.innerHeight - 300, nextY));

      const newPos = { x: boundedX, y: boundedY };
      setDevPos(newPos);
      localStorage.setItem('dev_floating_pos', JSON.stringify(newPos));
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingDev(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalMouseMove, { passive: false });
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalMouseMove);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isDraggingDev]);

  useEffect(() => {
    const handleToggle = () => {
      setIsDevFloatingOpen(prev => {
        const next = !prev;
        localStorage.setItem('is_dev_floating_open', String(next));
        return next;
      });
    };
    window.addEventListener('toggle-dev-floating', handleToggle);
    return () => window.removeEventListener('toggle-dev-floating', handleToggle);
  }, []);

  const pivotAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDraggingArm) return;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      const pivot = cachedPivotRef.current;
      if (!pivot) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dx = clientX - pivot.x;
      const dy = clientY - pivot.y;
      
      // Calculate polar angle. 90 deg is straight down, 180 is straight left.
      const polarAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      // Map to CSS rotation angle relative to vertical-down (0 deg)
      const cssAngle = polarAngle - 90;
      
      // Capped range under custom layout calibration is super wide to allow absolute freedom of placement (-45 deg to 90 deg)
      const cappedAngle = Math.max(-45, Math.min(90, cssAngle));
      setDragAngle(cappedAngle);
    };

    const handleGlobalUp = () => {
      setIsDraggingArm(false);
      if (dragAngle !== null) {
        // High-sensitivity activation threshold: midway between rest angle and minimum play angle
        const activationThreshold = (customRestAngle + customPlayMinAngle) / 2;
        const shouldPlay = dragAngle >= activationThreshold;
        if (shouldPlay) {
          if (!isPlaying) onPlayPause();
        } else {
          if (isPlaying) onPlayPause();
        }
      }
      setDragAngle(null);
      cachedPivotRef.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    window.addEventListener('touchend', handleGlobalUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDraggingArm, dragAngle, isPlaying, onPlayPause, customRestAngle, customPlayMinAngle]);

  // Dynamically calculate the physical arm orientation using custom calibrated parameters
  let currentArmAngle = customRestAngle; // Resting angle
  if (isDraggingArm && dragAngle !== null) {
    currentArmAngle = dragAngle;
  } else if (isPlaying && !isExtractingLeft) {
    // Elegant tracking crawl: sweeps from the custom play boundary smoothly to inner tracks
    const progressPercent = duration > 0 ? currentTime / duration : 0;
    currentArmAngle = customPlayMinAngle + progressPercent * 20;
  } else {
    currentArmAngle = customRestAngle;
  }

  const armTransformStyle = {
    transform: `rotate(${currentArmAngle}deg)`,
    transformOrigin: '24px 24px',
    transition: isDraggingArm ? 'none' : 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)'
  };

  // Smoothly interpolated height arrays for fluid 60fps animations
  const barHeightsRef = useRef<number[]>(Array(50).fill(4));

  // Request Animation Frame Loop for 60fps glow bars
  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fast Canvas DPI adjustment mechanism
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const numBars = 50;
    const analyser = getSharedAnalyser();
    const fftData = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);

    const getSongBPM = (song: Song) => {
      let hash = 0;
      const str = (song.title || '') + (song.artist || '');
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return 85 + (Math.abs(hash) % 55); // stable calculated BPM between 85 and 140
    };

    const render = () => {
      animationId = requestAnimationFrame(render);
      const analyserNode = getSharedAnalyser();
      
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, width, height);

      // 1. Fetch real frequency spectrum if available
      let hasRealInput = false;
      if (analyserNode && isPlaying) {
        analyserNode.getByteFrequencyData(fftData);
        for (let idx = 0; idx < fftData.length; idx++) {
          if (fftData[idx] > 0) {
            hasRealInput = true;
            break;
          }
        }
      }

      // 2. Compute heights for 50 bars
      const currentActiveVolume = isMuted ? 0 : volume;
      const targetHeights: number[] = [];

      const audio = audioRef?.current;
      const baseElapsedTime = audio ? audio.currentTime : (performance.now() * 0.001);
      const bpm = getSongBPM(currentSong);
      const bps = bpm / 60; // Beats per second

      for (let i = 0; i < numBars; i++) {
        let rawVal = 0;

        if (hasRealInput && analyserNode) {
          // Logarithmic/exponential frequency mapping is much superior for visual music representation
          // Bass/Mids contain more energy, while high frequencies need logarithmic dispersion and progressive amplitude boosting
          const percent = i / numBars;
          
          // Curve index mapping so more visualizer bars represent detailed bass and crisp mids
          const curvedPercent = Math.pow(percent, 1.35);
          const mapIdx = Math.min(fftData.length - 1, Math.floor(curvedPercent * (fftData.length * 0.85)));
          const rawValFromFFT = fftData[mapIdx] / 255.0;
          
          // Progressive amplitude boosting for higher frequency ranges (treble) for hyper-responsive bounces
          const frequencyLift = 1.0 + percent * 1.6;
          rawVal = Math.min(1.0, rawValFromFFT * frequencyLift * currentActiveVolume);
        } else {
          // Quantum Fluid Frequency Synthesizer (QFFS) aligned to actual audio timeline and tempo
          if (isPlaying) {
            const beatClock = baseElapsedTime * bps;
            const isBass = i < 11;
            const isMid = i >= 11 && i < 34;

            // Generate an organic synchronized beat amplitude
            const beatWave = Math.pow(Math.sin(beatClock * Math.PI) * 0.5 + 0.5, 3.5);
            
            // Ultra-responsive high-speed micro-jitter noise & sharp transients
            const fastNoise = Math.sin(performance.now() * 0.07 + i * 2.3) * 0.5 + 0.5;
            const sharpTransient = Math.max(0, Math.sin(performance.now() * 0.045 + i * 3.1) * 0.6 - 0.1);
            
            if (isBass) {
              // Beating bass bars dancing exactly on the beat with fast vibration modeling
              const subDrift = Math.sin(beatClock * 0.6 + i * 0.35) * 0.12;
              const bassJump = Math.pow(Math.sin(beatClock * Math.PI - 0.05), 4) * 0.45;
              rawVal = (beatWave * 0.55 + bassJump * 0.3 + subDrift + fastNoise * 0.15) * currentActiveVolume;
            } else if (isMid) {
              // Mellifluous flowing mid-range waves + sharp acoustic vocal/guitar transients
              const flowA = Math.sin(beatClock * 1.35 + i * 0.22) * 0.28;
              const flowB = Math.cos(-beatClock * 0.75 + i * 0.38) * 0.18;
              const syncMid = Math.pow(Math.sin(beatClock * Math.PI + Math.PI/4) * 0.5 + 0.5, 1.8);
              rawVal = Math.max(0.06, (flowA + flowB + syncMid * 0.22 + sharpTransient * 0.38 + fastNoise * 0.18) * currentActiveVolume);
            } else {
              // Delicate sparkling hi-hat sparkles and fast snare snaps
              const offBeatSparkle = Math.pow(Math.cos(beatClock * Math.PI) * 0.5 + 0.5, 2.5);
              const highScatter = Math.sin(performance.now() * 0.11 * (1 + (i % 3) * 0.5) + i * 1.3) * 0.38;
              rawVal = Math.max(0.03, (offBeatSparkle * 0.22 + highScatter * 0.42 + sharpTransient * 0.55 + fastNoise * 0.18) * currentActiveVolume);
            }
          } else {
            // Calm, flat warm breathing waves when paused
            rawVal = 0.02 + Math.sin(i * 0.14) * 0.015;
          }
        }

        // Apply visual height scaling factors (bars span from 4px to height-4px)
        const minH = 4;
        const maxH = height - 4;
        const computedPixelHeight = minH + rawVal * (maxH - minH);
        targetHeights.push(Math.min(maxH, Math.max(minH, computedPixelHeight)));
      }

      // 3. Apply inertia (smoothing) so transition stands soft like real silk Satin
      const smoothedHeights = barHeightsRef.current;
      const inertia = isPlaying ? 0.32 : 0.08; // Faster, more snappy and exciting responsive jumps

      for (let i = 0; i < numBars; i++) {
        smoothedHeights[i] = smoothedHeights[i] + (targetHeights[i] - smoothedHeights[i]) * inertia;
      }

      // 4. Draw bars on canvas context
      const barWidth = 3.6;
      const gap = 2.4;
      const totalWidth = numBars * barWidth + (numBars - 1) * gap;
      const startX = (width - totalWidth) / 2;

      // Draw shiny vertical pill bars
      for (let i = 0; i < numBars; i++) {
        const x = startX + i * (barWidth + gap);
        const barH = smoothedHeights[i];
        const y = height - barH; // Anchored at the bottom, so only the top fluctuates/bounces

        // Pure premium white color gradient or solid white with clean neon-like aura
        const barGrad = ctx.createLinearGradient(x, height, x, y);
        barGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)'); // elegant translucent white base
        barGrad.addColorStop(1, '#ffffff'); // pure glowing white tip
        
        ctx.fillStyle = barGrad;
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isPlaying, currentSong, volume, isMuted]);

  // Format time (in seconds) to e.g., "0:10" or "3:38"
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const secsRemainder = Math.floor(secs % 60);
    return `${mins}:${String(secsRemainder).padStart(2, '0')}`;
  };

  // Compute seek percentage from clientX relative to track (fast: no DOM reads besides rect)
  const getSeekPercent = (clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
  };

  // rAF-driven DOM update: directly set fill width + ball position, zero React overhead
  const updateProgressDOM = (percent: number) => {
    if (fillRef.current) {
      fillRef.current.style.width = `${percent * 100}%`;
    }
    if (ballRef.current) {
      ballRef.current.style.left = `${percent * 100}%`;
      ballRef.current.style.opacity = '1';
    }
  };

  // Hide floating ball (called on drag end)
  const hideBallDOM = () => {
    if (ballRef.current) {
      ballRef.current.style.opacity = '0';
    }
  };

  // rAF loop: apply DOM update + seek on each frame
  const rafTick = () => {
    const pct = dragPercentRef.current;
    updateProgressDOM(pct);
    // Only seek on rAF frames (60fps max, avoids flooding audio engine)
    onSeekRef.current(pct * durationRef.current);
  };

  // Drag-to-seek handlers
  const handleSeekStart = (clientX: number) => {
    isDraggingRef.current = true;
    const pct = getSeekPercent(clientX);
    dragPercentRef.current = pct;
    updateProgressDOM(pct);
    onSeekRef.current(pct * durationRef.current);
    if (fillRef.current) fillRef.current.style.transition = 'none';
  };

  const handleSeekMove = (clientX: number) => {
    if (!isDraggingRef.current) return;
    dragPercentRef.current = getSeekPercent(clientX);
    // Schedule rAF tick if not already pending
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
        rafTick();
      });
    }
  };

  const handleSeekEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    // Process final frame
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    rafTick();
    // Restore CSS transitions for normal React-driven updates
    if (fillRef.current) fillRef.current.style.transition = '';
    hideBallDOM();
  };

  // Mouse events on track
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleSeekStart(e.clientX);
  };

  // Touch events on track
  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleSeekStart(e.touches[0].clientX);
  };

  // Global move/end listeners (attached to document to handle drag outside track)
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleSeekMove(e.clientX);
    const onMouseUp = () => handleSeekEnd();
    const onTouchMove = (e: TouchEvent) => handleSeekMove(e.touches[0].clientX);
    const onTouchEnd = () => handleSeekEnd();

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-4 md:p-8 w-full max-w-sm sm:max-w-md mx-auto select-none" id="player-controls-container">
      {/* 1. Large Cover Art / Album Vinyl Plate with 3D Perspective and Hold-to-Toggle Layouts */}
      <div 
        className="relative group perspective-1000 mb-6 md:mb-8 flex items-center justify-center h-[340px] w-full select-none" 
        id="album-artwork-view"
      >
        <div
          className="relative flex items-center justify-center transition-all duration-300 ease-out cursor-pointer"
          style={{
            width: `${Math.round(320 * playerScale)}px`,
            height: `${Math.round(320 * playerScale)}px`,
            maxWidth: '90vw',
            maxHeight: '90vw',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${isDraggingArm ? 0 : rotateX}deg) rotateY(${isDraggingArm ? 0 : rotateY}deg) scale(${isDraggingArm ? 1.0 : (isPlaying ? 1.03 : 1.0)})`,
            transition: isDraggingArm ? 'transform 0.3s ease-out' : 'transform 0.15s ease-out'
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          id="interactive-vinyl-3d-deck"
          title="长按左侧封面进入单封面，长按右侧黑胶盘进入单黑胶"
        >
          {/* Backglow shadow mirroring cover photo - smoothly transitioned to prevent popping */}
          <div 
            className="absolute inset-[15%] rounded-full blur-[60px] pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${currentSong.accentColor || '#10b981'} 0%, transparent 70%)`,
              opacity: coverStyle !== 'vinyl' ? 0.6 : 0,
              transition: 'opacity 550ms cubic-bezier(0.25, 1, 0.3, 1)'
            }}
          />



          {/* THE VINYL BLACK LP RECORD - Slides out to the right when style is 'vinyl' or draws to the left on tap */}
          <div 
            className="absolute rounded-full select-none cursor-pointer aspect-square shadow-[0_12px_28px_rgba(0,0,0,0.6)] pointer-events-auto overflow-hidden"
            style={{
              width: coverStyle === 'vinyl-only' ? '92%' : '80%',
              height: coverStyle === 'vinyl-only' ? '92%' : '80%',
              opacity: coverStyle !== 'flat' ? 1 : 0,
              pointerEvents: coverStyle === 'flat' ? 'none' : 'auto',
              transition: 'transform 550ms cubic-bezier(0.25, 1, 0.3, 1), opacity 500ms ease-in-out, width 550ms cubic-bezier(0.25, 1, 0.3, 1), height 550ms cubic-bezier(0.25, 1, 0.3, 1)',
              transform: coverStyle === 'vinyl'
                ? 'translateZ(20px) translateX(28%) scale(1.0)'
                : coverStyle === 'vinyl-only'
                ? 'translateZ(20px) translateX(0%) scale(1.03)'
                : 'translateZ(-5px) translateX(28%) scale(0.6)',
              background: activeMat.gradient,
              boxShadow: 'inset 0 0 1px rgba(255,255,255,0.1), inset 0 0 10px rgba(0,0,0,0.9), 0 8px 24px rgba(0,0,0,0.5)'
            }}
            onMouseDown={(e) => startHold(e, 'vinyl')}
            onMouseUp={endHold}
            onTouchStart={(e) => startHold(e, 'vinyl')}
            onTouchEnd={endHold}
            title="黑胶唱片：长按进入/退出 单黑胶模式"
          >
            {/* Realistic Concentric Vinyl Grooves Micro-Texture */}
            <div 
              className="absolute inset-0 pointer-events-none z-[1] rounded-full" 
              style={{
                background: 'repeating-radial-gradient(circle, rgba(0, 0, 0, 0.44) 0px, rgba(0, 0, 0, 0.44) 1px, transparent 1.2px, transparent 2.4px), repeating-radial-gradient(circle, rgba(255, 255, 255, 0.04) 0px, transparent 0.8px, rgba(0, 0, 0, 0.3) 1.6px, transparent 2px)',
                mixBlendMode: 'overlay',
                opacity: 0.75
              }}
            />

            {/* Dynamic Realistic Anisotropic Sheen Reflections */}
            <div 
              className="absolute inset-0 pointer-events-none z-[2] rounded-full" 
              style={{
                background: 'conic-gradient(from 12deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.16) 25deg, rgba(255,255,255,0) 50deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,0.16) 205deg, rgba(255,255,255,0) 230deg, rgba(255,255,255,0) 360deg)',
                mixBlendMode: 'screen',
                opacity: 0.8
              }}
            />
            <div 
              className="absolute inset-0 pointer-events-none z-[3] rounded-full" 
              style={{
                background: 'conic-gradient(from 102deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.12) 20deg, rgba(255,255,255,0) 45deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,0.12) 200deg, rgba(255,255,255,0) 225deg, rgba(255,255,255,0) 360deg)',
                mixBlendMode: 'overlay',
                opacity: 0.85
              }}
            />

            {/* Sound track bands */}
            <div className="absolute inset-[10%] rounded-full border border-black/30 pointer-events-none z-[4]" />
            <div className="absolute inset-[24%] rounded-full border border-black/25 pointer-events-none z-[4]" />
            <div className="absolute inset-[36%] rounded-full border border-black/20 pointer-events-none z-[4]" />
            <div className="absolute inset-[52%] rounded-full border border-white/5 pointer-events-none z-[4]" />
            <div className="absolute inset-[68%] rounded-full border border-white/5 pointer-events-none z-[4]" />
            <div className="absolute inset-[82%] rounded-full border border-white/10 pointer-events-none z-[4]" />

            {/* Realistic Refractive Shimmer Highlight Overlay based on fluid preset */}
            <div 
              className="absolute inset-0 pointer-events-none z-[5]" 
              style={(() => {
                const isHovered = rotateX !== 0 || rotateY !== 0;
                if (viscosityPreset === 'superfluid' || viscosityPreset === 'superfluid_optics') {
                  const rot = isHovered ? (shineX + shineY) * 1.8 % 360 : 45;
                  return {
                    background: `linear-gradient(${rot}deg, transparent 20%, rgba(255,255,255,0.06) 35%, rgba(16,185,129,0.18) 42%, rgba(255,255,255,0.14) 50%, rgba(56,189,248,0.18) 58%, rgba(255,255,255,0.05) 65%, transparent 80%)`,
                    mixBlendMode: 'screen',
                    opacity: 0.85,
                    transition: 'opacity 0.3s ease'
                  } as React.CSSProperties;
                } else if (viscosityPreset === 'viscous' || viscosityPreset === 'viscous_optics') {
                  const clientCenterX = isHovered ? shineX : 50;
                  const clientCenterY = isHovered ? shineY : 50;
                  return {
                    background: `radial-gradient(circle at ${clientCenterX}% ${clientCenterY}%, rgba(255,255,255,0.18) 0%, rgba(245,158,11,0.08) 35%, transparent 75%)`,
                    mixBlendMode: 'overlay',
                    opacity: 0.82,
                  } as React.CSSProperties;
                } else {
                  const transX = isHovered ? (shineX - 50) * 3.5 : 0;
                  return {
                    background: `linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.22) 46%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.22) 54%, transparent 62%)`,
                    transform: `translateX(${transX}px) skewX(-12deg)`,
                    mixBlendMode: 'screen',
                    opacity: 0.95,
                    transition: 'transform 0.1s ease-out'
                  } as React.CSSProperties;
                }
              })()}
            />

            {/* Spinning groove animations */}
            <div 
              className={`absolute inset-0 rounded-full flex items-center justify-center z-[5] ${isPlaying ? 'animate-spin' : ''}`}
              style={{ animationDuration: isPlaying ? '14s' : '48s' }}
            >
              {/* Concentric groove physical ridges */}
              <div className="absolute inset-[6%] rounded-full border z-[5]" style={{ borderColor: activeMat.grooveColor || 'rgba(255,255,255,0.03)' }} />
              <div className="absolute inset-[12%] rounded-full border z-[5]" style={{ borderColor: activeMat.grooveColor || 'rgba(255,255,255,0.04)' }} />
              <div className="absolute inset-[24%] rounded-full border z-[5]" style={{ borderColor: activeMat.grooveColor || 'rgba(255,255,255,0.03)' }} />
              <div className="absolute inset-[36%] rounded-full border z-[5]" style={{ borderColor: activeMat.grooveColor || 'rgba(255,255,255,0.04)' }} />
              <div className="absolute inset-[46%] rounded-full border z-[5]" style={{ borderColor: activeMat.grooveColor || 'rgba(255,255,255,0.02)' }} />

              {/* Dynamic center sticker label */}
              <div 
                className="absolute rounded-full overflow-hidden flex items-center justify-center shadow-lg z-[6]"
                style={{
                  width: '36%',
                  height: '36%',
                }}
              >
                <img 
                  src={currentSong.coverUrl || undefined} 
                  alt="" 
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/10 rounded-full border border-black/30 mix-blend-overlay" />
                <div className="absolute inset-[15%] rounded-full border border-white/10" />
              </div>
            </div>

            {/* Spindle hole */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-950 border border-white/20 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] z-10 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-black rounded-full" />
            </div>
          </div>

          {/* THE OUTER JACKET WRAPPER (Handles smooth coordinate/sliding translation & rotation tilt) */}
          <div 
            className="absolute rounded-3xl select-none cursor-pointer pointer-events-auto"
            style={{
              width: coverStyle === 'vinyl' ? '74%' : '88%',
              height: coverStyle === 'vinyl' ? '74%' : '88%',
              transformStyle: 'preserve-3d',
              transition: 'transform 550ms cubic-bezier(0.25, 1, 0.3, 1), opacity 500ms ease-in-out, width 550ms cubic-bezier(0.25, 1, 0.3, 1), height 550ms cubic-bezier(0.25, 1, 0.3, 1), box-shadow 550ms cubic-bezier(0.25, 1, 0.3, 1)',
              opacity: coverStyle === 'vinyl-only' ? 0 : 1,
              pointerEvents: coverStyle === 'vinyl-only' ? 'none' : 'auto',
              transform: coverStyle === 'vinyl' 
                ? (isExtractingLeft 
                    ? `translateX(-108%) translateY(${randomYOffset}px) rotateY(${randomRotateY}deg) rotateZ(${randomRotateZ}deg)` 
                    : 'translateX(-20%)')
                : 'translateX(0%)',
              boxShadow: coverStyle !== 'vinyl' 
                ? '0 20px 48px rgba(0,0,0,0.65)' 
                : '0 8px 24px rgba(0,0,0,0.3)',
            }}
            onMouseDown={(e) => startHold(e, 'cover')}
            onMouseUp={endHold}
            onTouchStart={(e) => startHold(e, 'cover')}
            onTouchEnd={endHold}
            title="包装封面：长按进入/退出 单封面模式"
          >
            {/* THE INNER JACKET COVER SLEEVE (Handles direct instant 3D layering via absolute Z translation with NO TRANSITION to prevent clip-through) */}
            <div 
              className="w-full h-full rounded-3xl overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-md shadow-2xl"
              style={{
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'none', // Absolutely instant Z translation snap with zero frame lag at the peak!
                transform: coverStyle === 'vinyl' 
                  ? (coverOnTop ? 'translateZ(32px)' : 'translateZ(8px)')
                  : 'translateZ(20px)',
                boxShadow: undefined
              }}
            >
              <img 
                className="w-full h-full object-cover select-none pointer-events-none"
                src={currentSong.coverUrl || undefined} 
                alt={currentSong.album} 
                referrerPolicy="no-referrer"
              />
              
              {/* Spine indentations and lighting shadow overlay */}
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/40 via-white/5 to-transparent pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/45 to-transparent pointer-events-none" />

              {/* Specular highlights mapping to mouse cursor */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-35 mix-blend-screen"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.04) 40%, transparent 40.5%, transparent 100%)'
                }}
              />
              <div 
                className="absolute inset-[0%] pointer-events-none mix-blend-overlay opacity-25"
                style={{
                  background: `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.8) 0%, transparent 60%)`
                }}
              />
            </div>
          </div>

          {/* 3D PHYSICALLY INTERACTIVE TONEARM (唱针唱臂) */}
          {coverStyle !== 'flat' && (
            <div 
              className="absolute select-none pointer-events-none z-30"
              style={{
                right: coverStyle === 'vinyl-only' ? '3%' : '-12%', // Placed perfectly outside the spinning disc boundary
                top: '-4%',
                width: '64px',
                height: '64px',
                transition: 'right 550ms cubic-bezier(0.25, 1, 0.3, 1)',
                transform: `translateX(${tonearmOffsetX}px) translateY(${tonearmOffsetY}px) translateZ(45px)`, // custom calibrated spatial position
              }}
            >
              {/* Unrotated stable anchor point representing center of pivot */}
              <div 
                ref={pivotAnchorRef}
                className="absolute w-1 h-1 pointer-events-none"
                style={{
                  right: '36px', // Matches center of rotatable pivot (right 12 + pivot radius 24)
                  top: '36px', // Matches center of rotatable pivot (top 12 + pivot radius 24)
                }}
              />

              {/* static rest stand fork matching resting offset */}
              <div 
                className="absolute bg-zinc-700 w-1 h-8 rounded-full shadow-md origin-top animate-fade-in"
                style={{
                  right: '36px',
                  top: '25px',
                  transform: `rotate(${customRestAngle}deg) translateY(24px)`,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.4)',
                }}
              >
                <div className="absolute bottom-0 -left-1 w-3 h-1.5 bg-zinc-600 rounded-t-full border-b border-zinc-900" />
              </div>

              {/* Rotatable component group containing counterweight, shaft, cartridge */}
              <div 
                ref={pivotRef}
                className="absolute w-12 h-12 cursor-grab active:cursor-grabbing pointer-events-auto select-none"
                style={{
                  right: '12px',
                  top: '12px',
                  ...armTransformStyle
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (pivotAnchorRef.current) {
                    const rect = pivotAnchorRef.current.getBoundingClientRect();
                    cachedPivotRef.current = {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2
                    };
                  }
                  setIsDraggingArm(true);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (pivotAnchorRef.current) {
                    const rect = pivotAnchorRef.current.getBoundingClientRect();
                    cachedPivotRef.current = {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2
                    };
                  }
                  setIsDraggingArm(true);
                }}
              >
                {/* 1. 唱针针压指示器：微磨砂金属边框与刻度盘 */}
                <div 
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-zinc-700/90 via-zinc-900/95 to-zinc-800/90 border border-white/20 backdrop-blur-md shadow-[0_12px_24px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center justify-center pointer-events-none transition-all duration-300 ${isPlaying ? 'animate-metal-sheen saturate-[1.1]' : ''}`}
                  style={{
                    backgroundSize: '200% 200%',
                  }}
                >
                  {/* Micro concentric brushed metal texture overlay */}
                  <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle,rgba(255,255,255,0.012)_0px,rgba(255,255,255,0.012)_1px,transparent_1.5px,transparent_3px)] mix-blend-overlay" />
                  
                  {/* Frosted silver border frame with a secondary metallic edge */}
                  <div className="absolute inset-[1px] rounded-full border border-white/10 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent)] mix-blend-overlay" />

                  {/* High fidelity weight tracking tick markings (0.5g to 3.0g indicators) */}
                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                    <div 
                      key={deg}
                      className="absolute bg-white/45"
                      style={{
                        width: '1px',
                        height: deg % 90 === 0 ? '4.5px' : '2.5px',
                        transform: `rotate(${deg}deg) translateY(-23px)`,
                        opacity: deg % 90 === 0 ? 0.8 : 0.4,
                      }}
                    />
                  ))}

                  {/* Center glass indicator weight mark */}
                  <span className="absolute bottom-[2px] font-mono font-bold text-[6.5px] text-white/60 tracking-tight scale-90">1.5g</span>
                </div>

                {/* 1b. Metal pivot core (the physical hub) inside the weight ring */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-zinc-300 via-zinc-700 to-zinc-900 shadow-xl border border-white/25 flex items-center justify-center pointer-events-none">
                  <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-yellow-500/25 via-zinc-200 to-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]" />
                </div>

                {/* 2. Weight balance / counter-weight extension */}
                <div 
                  className={`absolute bg-gradient-to-r from-zinc-600 to-zinc-800 border border-zinc-700/60 rounded-sm shadow-md transition-all ${isPlaying ? 'animate-metal-sheen' : ''}`}
                  style={{
                    width: '10px',
                    height: '18px',
                    top: '-2px',
                    left: '19px', // aligned to the pivot center 24px
                    backgroundSize: '200% 200%'
                  }}
                />

                {/* 3. Sleek classic tonearm rod (starts at pivot center (24px, 24px) extending down) */}
                <div 
                  className={`absolute w-[3px] bg-gradient-to-b from-zinc-100 via-zinc-400 to-zinc-500 shadow-sm origin-top transition-all ${isPlaying ? 'animate-metal-sheen' : ''}`}
                  style={{
                    left: '22.5px', // centered at 24px
                    top: '24px',
                    height: `${armLength}px`, // custom calibrated shaft length
                    backgroundSize: '200% 200%'
                  }}
                >
                  {/* S-elbow or angled transition style connection */}
                  <div 
                    className="absolute w-[3px] h-4 bg-zinc-400 origin-top"
                    style={{
                      bottom: '-12px',
                      transform: 'rotate(-12deg)',
                    }}
                  />

                  {/* 4. The Phono Cartridge headshell (at the end of the shaft) with frosted silver bevel outer-edge */}
                  <div 
                    className={`absolute bg-zinc-900/95 border border-zinc-700/80 shadow-[0_4px_10px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center transition-all ${isPlaying ? 'animate-metal-sheen' : ''}`}
                    style={{
                      width: '12.5px',
                      height: '23px',
                      bottom: `${cartridgeYOffset}px`,
                      left: `${cartridgeXOffset}px`,
                      transform: `rotate(${cartridgeRotation}deg)`,
                      clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)', // premium block aesthetic
                      backgroundSize: '200% 200%'
                    }}
                  >
                    {/* Inner metal sheen micro highlight overlay */}
                    <div className="absolute inset-[0.5px] rounded-sm bg-gradient-to-br from-white/10 via-transparent to-black/20 pointer-events-none" />

                    {/* Stylus needle body */}
                    <div className="w-[1.5px] h-3 bg-zinc-300 absolute bottom-0 left-1/2 -translate-x-1/2" />
                    
                    {/* Golden stylus accent clip */}
                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-sm absolute bottom-1 left-1.5 shadow-[0_0_2px_rgba(234,179,8,0.5)]" />

                    {/* Micro glowing LED to indicate active stylus reading */}
                    <div 
                      className={`w-1 h-1 rounded-full absolute top-1.5 right-1.5 shadow-[0_0_4px_rgba(255,255,255,0.6)] ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} 
                    />
                  </div>

                  {/* 5. Sleek metal finger lift (classic vinyl arm lever) */}
                  <div 
                    className="absolute bg-zinc-400 border border-zinc-600 rounded-full"
                    style={{
                      width: '8px',
                      height: '2px',
                      bottom: `${cartridgeYOffset + 9}px`,
                      left: `${cartridgeXOffset + 11.5}px`,
                    }}
                  />

                  {/* 6. High-tactility grab overlay (makes stylus dragging incredibly responsive & "跟手") */}
                  <div 
                    className="absolute rounded-full w-16 h-16 cursor-grab active:cursor-grabbing hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 flex items-center justify-center transition-all duration-300 pointer-events-auto"
                    style={{
                      bottom: `${cartridgeYOffset - 21}px`,
                      left: `${cartridgeXOffset - 26}px`,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (pivotAnchorRef.current) {
                        const rect = pivotAnchorRef.current.getBoundingClientRect();
                        cachedPivotRef.current = {
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2
                        };
                      }
                      setIsDraggingArm(true);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (pivotAnchorRef.current) {
                        const rect = pivotAnchorRef.current.getBoundingClientRect();
                        cachedPivotRef.current = {
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2
                        };
                      }
                      setIsDraggingArm(true);
                    }}
                    title="拖动唱针放置到右侧黑胶上播放/暂停"
                  >
                    {/* Glowing lead-in core to draw attention */}
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/30 animate-ping absolute" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_#10b981]" />
                  </div>
                </div>

              </div>
            </div>
          )}



         </div>
      </div>

          {/* Layout layout change feedback toast */}
          {toastMsg && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md border border-white/20 animate-bounce pointer-events-none">
              {toastMsg}
            </div>
          )}

      {/* 2. Song Metadata (Title and Artist Name) */}
      <div className="text-center w-full mb-4 px-2" id="song-metadata-info">
        <h1 
          className="text-lg md:text-xl font-extrabold tracking-tight text-white mb-1 transition-all duration-300 line-clamp-1 drop-shadow-md"
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          {currentSong.title}
        </h1>
        <p className="text-sm md:text-md text-white/60 font-semibold" style={{ fontFamily: '"Inter", sans-serif' }}>
          {currentSong.artist} — <span className="opacity-80 font-medium italic">{currentSong.album}</span>
        </p>
      </div>

      {/* 3. High-fidelity Interactive Real-Time Audio Equalizer Waveform Spikes */}
      <div className="w-full h-12 mb-4 overflow-hidden relative flex items-center justify-center" id="interactive-wave-spikes">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full max-w-[340px] drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)] pointer-events-none"
        />
      </div>

      {/* 4. Timeline Slider (Current Time + Scrub Track) */}
      <div className="w-full flex flex-col gap-2 mb-6" id="audio-timeline-scrubber">
        {/* Scrubber track bar */}
        <div 
          ref={trackRef}
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
          className="track-container w-full h-[5px] rounded-full bg-white/15 hover:bg-white/25 cursor-pointer relative group transition-all duration-300"
        >
          {/* Progress fill */}
          <div 
            ref={fillRef}
            className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-100 ease-out pointer-events-none"
            style={{ 
              width: `${(currentTime / (duration || 1)) * 100}%`,
              backgroundColor: currentSong.accentColor 
            }}
          />
          {/* Floating interactive ball */}
          <div 
            ref={ballRef}
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
            style={{ 
              left: `${(currentTime / (duration || 1)) * 100}%`,
              transform: 'translate(-50%, -50%) scale(1.0)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
            }}
          />
        </div>
        
        {/* Time stamps */}
        <div className="flex justify-between text-[11px] font-mono text-white/55 px-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 5. Core Player Controls Container */}
      <div className="w-full flex items-center justify-between px-2 mb-6" id="playback-buttons-bar">
        {/* Loop option toggler */}
        <button 
          onClick={handleTogglePlayMode}
          className="p-2 rounded-full transition-all duration-300 text-white/50 hover:text-white hover:scale-110"
          style={{ color: playMode !== 'list' ? currentSong.accentColor : undefined }}
          aria-label="Toggle play mode"
          title={playMode === 'list' ? '列表顺序播放' : playMode === 'single' ? '单曲循环' : '随机播放'}
        >
          {playMode === 'list' && <Repeat size={18} />}
          {playMode === 'single' && <Repeat1 size={18} />}
          {playMode === 'shuffle' && <Shuffle size={18} />}
        </button>

        {/* Volume popup trigger (blue box position) */}
        <div className="relative">
          <button 
            ref={volumeBtnRef}
            onClick={() => setShowVolumePopup(!showVolumePopup)}
            className="p-2 rounded-full transition-all duration-300 text-white/50 hover:text-white hover:scale-110"
            aria-label="Volume"
          >
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          {showVolumePopup && (
            <div 
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex flex-col items-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-50"
              onMouseLeave={() => setShowVolumePopup(false)}
            >
              <button 
                onClick={onToggleMute} 
                className="text-white/50 hover:text-white transition-colors"
                aria-label="Toggle mute"
              >
                {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="h-28 w-1.5 rounded-lg cursor-pointer appearance-none outline-none"
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  WebkitAppearance: 'slider-vertical',
                  background: `linear-gradient(to top, #fff ${volume * 100}%, rgba(255,255,255,0.15) ${volume * 100}%)`,
                }}
                orient="vertical"
              />
              <span className="text-[10px] text-white/40 font-mono">{Math.round(volume * 100)}</span>
            </div>
          )}
        </div>

        {/* Previous Song */}
        <button 
          onClick={onPrev}
          className="p-2 text-white/75 hover:text-white hover:scale-110 active:scale-95 transition-all duration-300"
          aria-label="Previous track"
        >
          <SkipBack size={26} fill="currentColor" />
        </button>

        {/* Primary Play/Pause Orb */}
        <button 
          onClick={onPlayPause}
          className="w-16 h-16 rounded-full bg-white text-slate-950 flex items-center justify-center hover:scale-[1.08] active:scale-95 transition-all duration-300 shadow-xl self-center relative overflow-hidden cursor-pointer"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          style={{
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          }}
        >
          <motion.svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            className="w-10 h-10 text-slate-950 fill-current"
            animate={{ rotate: isPlaying ? 0 : 360 }}
            transition={{ type: 'spring', damping: 18, stiffness: 120 }}
          >
            <motion.path
              animate={{
                d: isPlaying 
                  ? "M 5,4 L 10,4 L 10,20 L 5,20 Z" 
                  : "M 5,4 L 21,12 L 21,12 L 5,20 Z"
              }}
              transition={{ type: 'spring', damping: 15, stiffness: 140 }}
              fill="currentColor"
            />
            <motion.path
              animate={{
                d: isPlaying 
                  ? "M 14,4 L 19,4 L 19,20 L 14,20 Z" 
                  : "M 15,12 L 15,12 L 15,12 L 15,12 Z"
              }}
              transition={{ type: 'spring', damping: 15, stiffness: 140 }}
              fill="currentColor"
            />
          </motion.svg>
        </button>

        {/* Next Song */}
        <button 
          onClick={onNext}
          className="p-2 text-white/75 hover:text-white hover:scale-110 active:scale-95 transition-all duration-300"
          aria-label="Next track"
        >
          <SkipForward size={26} fill="currentColor" />
        </button>

        {/* Playlist popup trigger (red box position) */}
        <div className="relative">
          <button 
            ref={playlistBtnRef}
            onClick={() => {
              if (showPlaylistPopup) setPlaylistSearch('');
              setShowPlaylistPopup(!showPlaylistPopup);
            }}
            className="p-2 rounded-full transition-all duration-300 text-white/50 hover:text-white hover:scale-110"
            aria-label="Playlist"
          >
            <ListMusic size={18} />
          </button>
          {showPlaylistPopup && (
            <div 
              className="absolute bottom-full right-0 mb-2 w-56 max-h-72 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-50 flex flex-col overflow-hidden"
            >
              <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest font-mono">播放队列</span>
                <span className="text-[9px] text-white/30 font-mono">{songsList.length} 首</span>
              </div>
              <div className="px-2 py-1.5 border-b border-white/5">
                <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-2.5 py-1">
                  <Search size={11} className="text-white/25 flex-shrink-0" />
                  <input
                    type="text"
                    value={playlistSearch}
                    onChange={(e) => setPlaylistSearch(e.target.value)}
                    placeholder="搜索歌名或歌手..."
                    className="flex-1 bg-transparent text-[10px] text-white/70 placeholder:text-white/20 outline-none border-none font-mono"
                  />
                  {playlistSearch && (
                    <button
                      onClick={() => setPlaylistSearch('')}
                      className="text-white/20 hover:text-white/50 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {(() => {
                  const filtered = playlistSearch.trim()
                    ? songsList.filter(
                        (s) =>
                          s.title.toLowerCase().includes(playlistSearch.toLowerCase()) ||
                          s.artist.toLowerCase().includes(playlistSearch.toLowerCase())
                      )
                    : songsList;

                  if (songsList.length === 0) {
                    return <div className="py-6 text-center text-white/20 text-xs">暂无歌曲</div>;
                  }
                  if (filtered.length === 0) {
                    return <div className="py-6 text-center text-white/20 text-xs">无匹配歌曲</div>;
                  }
                  return filtered.map((song) => {
                    const isActive = song.id === currentSong?.id;
                    return (
                      <button
                        key={song.id}
                        onClick={() => {
                          onSelectSong?.(song);
                          setShowPlaylistPopup(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors ${
                          isActive ? 'bg-white/[0.06]' : ''
                        }`}
                      >
                        <img 
                          src={song.coverUrl} 
                          alt="" 
                          className="w-7 h-7 rounded-md object-cover flex-shrink-0 bg-white/5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-bold truncate ${isActive ? 'text-emerald-400' : 'text-white/85'}`}>
                            {song.title}
                          </p>
                          <p className="text-[9px] text-white/35 truncate">{song.artist}</p>
                        </div>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Custom heart favor */}
        <button 
          onClick={() => onToggleLike?.(currentSong.id)}
          className={`p-2 rounded-full transition-all duration-300 ${likedSongIds.includes(currentSong.id) ? 'scale-115' : 'text-white/45 hover:text-white/70'}`}
          style={{ color: likedSongIds.includes(currentSong.id) ? '#ef4444' : undefined }}
          aria-label="Favorite track"
        >
          <Heart size={18} fill={likedSongIds.includes(currentSong.id) ? 'currentColor' : 'none'} />
        </button>
      </div>



      {/* 8. Gorgeous Draggable Floating 3D Stylus/Cartridge Dev Mode Tuner Window */}
      {isDevFloatingOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[99999] backdrop-blur-xl bg-slate-950/90 border border-emerald-500/30 rounded-2xl w-80 shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_20px_rgba(16,185,129,0.15)] flex flex-col font-sans select-none overflow-hidden"
          style={{
            left: `${devPos.x}px`,
            top: `${devPos.y}px`,
          }}
        >
          {/* Header (Acts as Grabbing Handle for dragging) */}
          <div 
            onMouseDown={handleDevDragStart}
            onTouchStart={handleDevDragStart}
            className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-emerald-950/60 to-slate-950/80 border-b border-white/10 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black text-emerald-400 tracking-widest uppercase truncate font-sans">唱机 3D 悬浮调教中心</span>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Snap/Pin to Very Top Button */}
              <button
                onClick={() => {
                  const newPos = { x: window.innerWidth > 768 ? window.innerWidth - 340 : 20, y: 16 };
                  setDevPos(newPos);
                  localStorage.setItem('dev_floating_pos', JSON.stringify(newPos));
                  setToastMsg('已一键置顶最上方');
                  setTimeout(() => setToastMsg(''), 1800);
                }}
                className="p-1 px-1.5 rounded-md hover:bg-white/10 text-emerald-400 hover:text-emerald-300 transition-colors text-[10px] font-black tracking-wide flex items-center gap-0.5 border border-emerald-500/10 hover:border-emerald-500/20 cursor-pointer"
                title="一键置顶最上方"
              >
                <span>置顶 ▲</span>
              </button>

              <button 
                onClick={() => {
                  setIsDevFloatingOpen(false);
                  localStorage.setItem('is_dev_floating_open', 'false');
                }}
                className="p-1 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                title="关闭微调窗口"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Subheader info or tip */}
          <div className="px-3 pb-1 pt-2 bg-emerald-500/5 text-[9px] text-emerald-400/80 leading-normal border-b border-white/5 font-medium flex items-center justify-between">
            <span>🖱️ 拖拽此头部可在屏幕任意摆放</span>
            <span className="text-white/30">•</span>
            <span>唱针随调随变 100% 实时同步</span>
          </div>

          {/* Controls Scroll Panel */}
          <div className="p-3.5 flex flex-col gap-3.5 max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 text-left">
            
            {/* 1. Arm Length Shaft (Height) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-white/60">① 唱臂金属杆长度 (Arm Length)</span>
                <span className="text-emerald-400 font-mono font-black">{armLength}px</span>
              </div>
              <input 
                type="range"
                min="50"
                max="250"
                step="1"
                value={armLength}
                className="w-full accent-emerald-500 bg-white/10 h-1 rounded cursor-pointer"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setArmLength(val);
                  localStorage.setItem('arm_length', String(val));
                }}
              />
            </div>

            {/* 2. Cartridge Rotation (Angle) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-white/60">② 唱头/磁头旋转角 (Cartridge Rot)</span>
                <span className="text-emerald-400 font-mono font-black">{cartridgeRotation}°</span>
              </div>
              <input 
                type="range"
                min="-90"
                max="90"
                step="1"
                value={cartridgeRotation}
                className="w-full accent-emerald-500 bg-white/10 h-1 rounded cursor-pointer"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCartridgeRotation(val);
                  localStorage.setItem('cartridge_rotation', String(val));
                }}
              />
            </div>

            {/* 3. Cartridge X & Y offsets */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-bold text-white/50">
                  <span>③ 唱头 X 偏移</span>
                  <span className="text-emerald-400 font-mono">{cartridgeXOffset}px</span>
                </div>
                <input 
                  type="range"
                  min="-50"
                  max="50"
                  step="0.5"
                  value={cartridgeXOffset}
                  className="w-full accent-emerald-500 bg-white/10 h-1 rounded cursor-pointer"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCartridgeXOffset(val);
                    localStorage.setItem('cartridge_x_offset', String(val));
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-bold text-white/50">
                  <span>④ 唱头 Y 偏移</span>
                  <span className="text-emerald-400 font-mono">{cartridgeYOffset}px</span>
                </div>
                <input 
                  type="range"
                  min="-100"
                  max="0"
                  step="0.5"
                  value={cartridgeYOffset}
                  className="w-full accent-emerald-500 bg-white/10 h-1 rounded cursor-pointer"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCartridgeYOffset(val);
                    localStorage.setItem('cartridge_y_offset', String(val));
                  }}
                />
              </div>
            </div>

            {/* 4. Tonearm Parent Pivot X & Y Offsets */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-bold text-white/50">
                  <span>⑤ 唱臂底座 X 位移</span>
                  <span className="text-emerald-400 font-mono">{tonearmOffsetX}px</span>
                </div>
                <input 
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={tonearmOffsetX}
                  className="w-full accent-emerald-500 bg-white/10 h-1 rounded cursor-pointer"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTonearmOffsetX(val);
                    localStorage.setItem('tonearm_offset_x', String(val));
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-bold text-white/50">
                  <span>⑥ 唱臂底座 Y 位移</span>
                  <span className="text-emerald-400 font-mono">{tonearmOffsetY}px</span>
                </div>
                <input 
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={tonearmOffsetY}
                  className="w-full accent-emerald-500 bg-white/10 h-1 rounded cursor-pointer"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTonearmOffsetY(val);
                    localStorage.setItem('tonearm_offset_y', String(val));
                  }}
                />
              </div>
            </div>

            {/* 5. Custom Rest and Play start angles */}
            <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-white/60">⑦ 休眠/红区 角度 (Rest Angle)</span>
                  <span className="text-rose-400 font-mono font-black">{customRestAngle}°</span>
                </div>
                <input 
                  type="range"
                  min="-45"
                  max="45"
                  step="1"
                  value={customRestAngle}
                  className="w-full accent-rose-500 bg-white/10 h-1 rounded cursor-pointer"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setCustomRestAngle(val);
                    localStorage.setItem('custom_rest_angle', String(val));
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-white/60">⑧ 播放/绿区 角度 (Play Min Angle)</span>
                  <span className="text-emerald-400 font-mono font-black">{customPlayMinAngle}°</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={customPlayMinAngle}
                  className="w-full accent-emerald-500 bg-white/10 h-1 rounded cursor-pointer"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setCustomPlayMinAngle(val);
                    localStorage.setItem('custom_play_min_angle', String(val));
                  }}
                />
              </div>
            </div>

            {/* Quick action controls */}
            <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/5">
              <button 
                onClick={() => {
                  const currentAngle = isDraggingArm && dragAngle !== null ? dragAngle : currentArmAngle;
                  const val = parseFloat(currentAngle.toFixed(1));
                  setCustomRestAngle(val);
                  localStorage.setItem('custom_rest_angle', String(val));
                  setToastMsg(`已录入休眠位置: ${val}°`);
                  setTimeout(() => setToastMsg(''), 2000);
                }}
                className="py-1 px-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-300 text-[9px] font-bold rounded-lg transition-all duration-200 cursor-pointer"
                title="拖拽唱针对齐实体休眠架后，点击这里一键录入标定角度"
              >
                💾 录入当前为【红区】
              </button>
              <button 
                onClick={() => {
                  const currentAngle = isDraggingArm && dragAngle !== null ? dragAngle : currentArmAngle;
                  const val = parseFloat(currentAngle.toFixed(1));
                  setCustomPlayMinAngle(val);
                  localStorage.setItem('custom_play_min_angle', String(val));
                  setToastMsg(`已录入播放位置: ${val}°`);
                  setTimeout(() => setToastMsg(''), 2000);
                }}
                className="py-1 px-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-300 text-[9px] font-bold rounded-lg transition-all duration-200 cursor-pointer"
                title="拖拽唱针对齐黑胶绿区最外圈后，点击这里一键录入标定角度"
              >
                💾 录入当前为【绿区】
              </button>
            </div>

            {/* Factory Parameter Reset */}
            <button
              onClick={() => {
                setCustomRestAngle(-18);
                localStorage.setItem('custom_rest_angle', '-18');
                setCustomPlayMinAngle(8);
                localStorage.setItem('custom_play_min_angle', '8');
                setCartridgeRotation(-12);
                localStorage.setItem('cartridge_rotation', '-12');
                setArmLength(115);
                localStorage.setItem('arm_length', '115');
                setCartridgeXOffset(-2);
                localStorage.setItem('cartridge_x_offset', '-2');
                setCartridgeYOffset(-18);
                localStorage.setItem('cartridge_y_offset', '-18');
                setTonearmOffsetX(28);
                localStorage.setItem('tonearm_offset_x', '28');
                setTonearmOffsetY(40);
                localStorage.setItem('tonearm_offset_y', '40');
                const defaultPos = { x: window.innerWidth > 768 ? window.innerWidth - 340 : 20, y: 16 };
                setDevPos(defaultPos);
                localStorage.setItem('dev_floating_pos', JSON.stringify(defaultPos));
                setToastMsg('唱机 3D 空间参数已全部重置');
                setTimeout(() => setToastMsg(''), 2500);
              }}
              className="text-[9px] text-white/30 hover:text-white/60 transition-colors w-full text-right underline tracking-wider cursor-pointer"
            >
              🔄 恢复出厂机械标定 (Factory Reset)
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
