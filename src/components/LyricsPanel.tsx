import React, { useEffect, useRef } from 'react';
import { LyricLine } from '../types';

interface LyricsPanelProps {
  lyrics: LyricLine[];
  currentTime: number;
  onSelectTime: (time: number) => void;
  langMode: 'both' | 'en' | 'cn';
  fontSize?: number;
  panelHeight?: number;
  panelWidth?: number;
  wordByWord?: boolean;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({
  lyrics,
  currentTime,
  onSelectTime,
  langMode,
  fontSize = 32,
  panelHeight = 50,
  panelWidth = 90,
  wordByWord = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Drag-to-scroll refs (all refs — no React re-render during drag)
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const scrollStartTopRef = useRef(0);
  const autoScrollDisabledRef = useRef(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preventClickRef = useRef(false);

  const DRAG_THRESHOLD_PX = 5; // min movement to enter drag mode
  const AUTO_SCROLL_RESUME_MS = 3000;

  // ── Mask float effect refs ──
  const lastScrollTopRef = useRef(0);
  const floatTargetRef = useRef(0);
  const floatCurrentRef = useRef(0);
  const floatRafRef = useRef<number | null>(null);

  const FLOAT_MAX_OFFSET = 10;  // max mask stop shift in percentage
  const FLOAT_SPRING = 0.12;   // spring decay rate per frame

  // Find current active lyric line based on time
  const activeIndex = lyrics.reduce((acc, line, idx) => {
    if (currentTime >= line.time) {
      return idx;
    }
    return acc;
  }, 0);

  // Auto-scroll effect — suppressed during manual drag and for resume delay
  useEffect(() => {
    if (autoScrollDisabledRef.current) return;
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;

      const containerHeight = container.clientHeight;
      const lineOffsetTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;

      container.scrollTo({
        top: lineOffsetTop - containerHeight / 2 + lineHeight / 2,
        behavior: 'smooth'
      });
    }
  }, [activeIndex, lyrics, langMode]);

  // Drag-to-scroll helpers — use containerRef to avoid stale closure
  const enterDragMode = () => {
    const container = containerRef.current;
    if (!container) return;
    isDraggingRef.current = true;
    preventClickRef.current = true;
    container.style.scrollBehavior = 'auto';
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }
    autoScrollDisabledRef.current = true;
  };

  const exitDragMode = () => {
    const container = containerRef.current;
    if (!container) return;
    isDraggingRef.current = false;
    autoScrollTimeoutRef.current = setTimeout(() => {
      if (container) container.style.scrollBehavior = 'smooth';
      autoScrollDisabledRef.current = false;
      autoScrollTimeoutRef.current = null;
    }, AUTO_SCROLL_RESUME_MS);
  };

  // ── Mouse drag: dynamic listeners (registered on mousedown, removed on mouseup) ──
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    dragStartYRef.current = e.clientY;
    scrollStartTopRef.current = container.scrollTop;

    const onMove = (ev: MouseEvent) => {
      const deltaY = dragStartYRef.current - ev.clientY;
      if (!isDraggingRef.current) {
        if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
        enterDragMode();
      }
      container.scrollTop = scrollStartTopRef.current + deltaY;
    };

    const onUp = () => {
      if (isDraggingRef.current) exitDragMode();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Touch drag: dynamic listeners (registered on touchstart, removed on touchend/touchcancel) ──
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const touch = e.touches[0];
    if (!touch) return;
    dragStartYRef.current = touch.clientY;
    scrollStartTopRef.current = container.scrollTop;

    const onMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      const deltaY = dragStartYRef.current - t.clientY;
      if (!isDraggingRef.current) {
        if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
        enterDragMode();
      }
      ev.preventDefault();
      container.scrollTop = scrollStartTopRef.current + deltaY;
    };

    const onEnd = () => {
      if (isDraggingRef.current) exitDragMode();
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  };

  // ── Mask float effect: scroll velocity → spring-animated gradient mask offset ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Set initial mask via DOM (kept out of React style to avoid re-render interference)
    const applyMask = (offset: number) => {
      const topStop = 12 + offset;
      const bottomStop = 88 - offset;
      const gradient = `linear-gradient(to bottom, transparent 0%, #000 ${topStop}%, #000 ${bottomStop}%, transparent 100%)`;
      container.style.maskImage = gradient;
      container.style.WebkitMaskImage = gradient;
    };

    applyMask(0);

    const animateFloat = () => {
      // Spring decay toward target
      const diff = floatTargetRef.current - floatCurrentRef.current;
      floatCurrentRef.current += diff * FLOAT_SPRING;

      if (Math.abs(diff) < 0.02 || !container.isConnected) {
        floatCurrentRef.current = 0;
        floatTargetRef.current = 0;
        applyMask(0);
        floatRafRef.current = null;
        return;
      }

      applyMask(floatCurrentRef.current);
      floatRafRef.current = requestAnimationFrame(animateFloat);
    };

    const onScrollOrWheel = () => {
      const delta = container.scrollTop - lastScrollTopRef.current;
      lastScrollTopRef.current = container.scrollTop;

      // Velocity → float target: faster scroll → bigger offset
      floatTargetRef.current = Math.max(
        -FLOAT_MAX_OFFSET,
        Math.min(FLOAT_MAX_OFFSET, delta * 0.06)
      );

      if (!floatRafRef.current) {
        floatRafRef.current = requestAnimationFrame(animateFloat);
      }
    };

    container.addEventListener('scroll', onScrollOrWheel, { passive: true });
    container.addEventListener('wheel', onScrollOrWheel, { passive: true });

    return () => {
      container.removeEventListener('scroll', onScrollOrWheel);
      container.removeEventListener('wheel', onScrollOrWheel);
      if (floatRafRef.current) cancelAnimationFrame(floatRafRef.current);
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, []);

  // Word-by-word highlight helper: compute per-character progress for the active line
  const renderWordLine = (line: LyricLine, isActive: boolean, baseFontSize: number) => {
    if (!isActive || !wordByWord) return null;

    const text = line.text || line.en || '';
    if (!text) return null;

    const sharedStyle: React.CSSProperties = {
      fontSize: `${baseFontSize}px`,
      textShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
    };
    const sharedClass = 'font-sans tracking-tight text-white leading-tight select-none font-extrabold transition-all duration-500';

    // Use precise word timestamps from YRC parsing when available
    if (line.words && line.words.length > 0) {
      return (
        <span style={sharedStyle} className={sharedClass}>
          {line.words.map((w, i) => {
            const elapsed = currentTime >= w.time;
            return (
              <span key={i} style={{ opacity: elapsed ? 1 : 0.28 }}>
                {w.text}
              </span>
            );
          })}
        </span>
      );
    }

    // Fallback: syllable-aware character timing estimation
    // Instead of naively dividing line duration by character count,
    // assign per-character weights based on syllable complexity:
    // - CJK characters (Chinese/Japanese/Korean): 1 syllable ≈ 1.0 weight
    // - English vowels: longer held in singing ≈ 1.2 weight
    // - English consonants: shorter ≈ 0.5 weight
    // - Spaces: silent gap ≈ 0.0 weight (skipped)
    // - Punctuation: brief pause ≈ 0.1 weight
    const estimateCharWeight = (ch: string): number => {
      if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/.test(ch)) return 1.0;
      if (/[aeiouAEIOU]/.test(ch)) return 1.2;
      if (/[a-zA-Z]/.test(ch)) return 0.5;
      if (/\s/.test(ch)) return 0.0;
      return 0.1; // punctuation / other
    };

    const lineStart = line.time;
    // Find the current line's index in lyrics array (by time match, more robust than reference equality)
    const lineIdx = lyrics.findIndex(l => l.time === line.time);
    const nextLine = lineIdx >= 0 && lineIdx < lyrics.length - 1 ? lyrics[lineIdx + 1] : null;
    const lineEnd = line.endTime || nextLine?.time || lineStart + 4;
    const lineDuration = Math.max(lineEnd - lineStart, 0.5);

    const chars = Array.from(text);
    const weights = chars.map(estimateCharWeight);
    const totalWeight = weights.reduce((a, b) => a + b, 0) || chars.length;

    // Compute per-character start times based on syllable-weighted distribution
    const charTimes: number[] = [];
    let elapsedSec = 0;
    for (let i = 0; i < chars.length; i++) {
      charTimes.push(lineStart + elapsedSec);
      elapsedSec += (weights[i] / totalWeight) * lineDuration;
    }

    return (
      <span style={sharedStyle} className={sharedClass}>
        {chars.map((ch, i) => {
          const elapsed = currentTime >= charTimes[i];
          return (
            <span key={i} style={{ opacity: elapsed ? 1 : 0.28 }}>
              {ch}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className="lyric-container relative overflow-y-auto overflow-x-visible rounded-3xl p-6 md:p-12 scrollbar-none mx-auto"
      style={{
        height: `${panelHeight}vh`,
        width: `${panelWidth}%`,
      }}
      id="lyrics-scrollbar-view"
    >
      <div 
        className="flex flex-col gap-6 items-start"
        style={{ 
          paddingTop: `${panelHeight * 0.3}vh`, 
          paddingBottom: `${panelHeight * 0.45}vh` 
        }}
      >
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex;
          const isNear = Math.abs(index - activeIndex) === 1;
          const isFar = Math.abs(index - activeIndex) > 1;

          return (
            <div
              key={index}
              ref={isActive ? activeLineRef : null}
              onClick={() => {
                if (preventClickRef.current) {
                  preventClickRef.current = false;
                  return;
                }
                onSelectTime(line.time);
              }}
              style={{
                transform: isActive
                  ? 'scale(1) translate3d(0, 0, 0)'
                  : isNear
                  ? 'scale(0.94) translate3d(-10px, 0, 0)'
                  : 'scale(0.88) translate3d(-20px, 0, 0)',
                filter: isActive ? 'blur(0)' : isNear ? 'blur(1px)' : 'blur(2.5px)',
                opacity: isActive ? 1.0 : isNear ? 0.35 : 0.08
              }}
              className={`
                group relative select-none cursor-pointer flex flex-col items-start text-left
                transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]
                hover:opacity-90 hover:scale-[0.98] origin-left
              `}
              id={`lyric-line-${index}`}
            >
              {/* English main lyric line */}
              {(langMode === 'both' || langMode === 'en') && (
                <>
                  {isActive && wordByWord ? (
                    renderWordLine(line, true, fontSize)
                  ) : (
                    <span
                      style={{
                        fontSize: isActive ? `${fontSize}px` : `${Math.round(fontSize * 0.82)}px`,
                        textShadow: isActive ? '0 4px 16px rgba(0, 0, 0, 0.45)' : 'none'
                      }}
                      className={`
                        font-sans tracking-tight text-white leading-tight select-none
                        ${isActive ? 'font-extrabold' : 'font-bold'}
                        transition-all duration-500
                      `}
                    >
                      {line.en}
                    </span>
                  )}
                </>
              )}

              {/* Chinese translation line optionally displayed */}
              {line.cn && (langMode === 'both' || langMode === 'cn') && (
                <span
                  style={{
                    fontSize: isActive ? `${Math.round(fontSize * 0.6)}px` : `${Math.round(fontSize * 0.42)}px`,
                  }}
                  className={`
                    font-sans tracking-wide mt-2 md:mt-3 text-slate-200 select-none
                    ${isActive ? 'font-semibold opacity-90' : 'font-medium opacity-70'}
                    transition-all duration-500
                  `}
                >
                  {line.cn}
                </span>
              )}

              {/* Visual seek indicator on hover */}
              <div 
                className="absolute left-[-24px] top-1/2 -translate-y-1/2 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ fontSize: '10px' }}
              >
                ▶
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
