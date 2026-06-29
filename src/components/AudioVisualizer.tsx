import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { getSharedAnalyser } from './EQSonicPanel';

type VizMode = 'bars' | 'wave' | 'circular';

interface AudioVisualizerProps {
  isPlaying: boolean;
}

const BAR_COUNT = 64;

function freqScale(i: number, total: number): number {
  const t = i / total;
  return Math.pow(t, 1.4);
}

export default function AudioVisualizer({ isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const fftRef = useRef<Uint8Array | null>(null);
  const [mode, setMode] = useState<VizMode>('bars');
  const [analyserReady, setAnalyserReady] = useState(false);

  // Keep isPlaying in a ref so the render closure always reads the latest value
  // without causing the useEffect to re-run on every play/pause toggle.
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // EQ parameter overview state
  const [eqParams, setEqParams] = useState({
    preset: '',
    bassOn: false,
    reverbOn: false,
    speed: '1.00',
  });

  // Poll EQ params from localStorage every 500ms
  useEffect(() => {
    const poll = () => {
      setEqParams({
        preset: localStorage.getItem('eq_preset_name') || 'default',
        bassOn: localStorage.getItem('eq_bass_boost') === 'true',
        reverbOn: localStorage.getItem('eq_reverb_on') === 'true',
        speed: (parseFloat(localStorage.getItem('playback_speed') || '1')).toFixed(2),
      });
    };
    poll();
    const iv = setInterval(poll, 500);
    return () => clearInterval(iv);
  }, []);

  // Periodically check analyser availability
  useEffect(() => {
    const check = () => {
      const a = getSharedAnalyser();
      setAnalyserReady(!!a);
    };
    check();
    const iv = setInterval(check, 1000);
    return () => clearInterval(iv);
  }, []);

  // ---- Canvas sizing ----
  // Use a layout effect + ResizeObserver to guarantee non-zero dimensions
  // before the RAF loop starts.
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasSizeRef = useRef({ w: 300, h: 150 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvasSizeRef.current = { w: rect.width, h: rect.height };
      }
    };
    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ---- Drawing helpers ----
  const drawBars = useCallback((
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    w: number,
    h: number
  ) => {
    const total = BAR_COUNT;
    const barW = (w / total) * 0.7;
    const gap = (w / total) * 0.3;

    for (let i = 0; i < total; i++) {
      const srcIdx = Math.floor(freqScale(i, total) * (data.length - 1));
      const val = data[srcIdx] / 255;
      const barH = val * h * 0.85;

      const t = val;
      const r = Math.round(20 + t * 15);
      const g = Math.round(180 + t * 75);
      const b = Math.round(160 + t * 50);

      ctx.fillStyle = `rgb(${r},${g},${b})`;

      const x = i * (barW + gap) + gap / 2;
      const y = h - barH;
      const radius = Math.min(barW / 2, 3);

      ctx.beginPath();
      ctx.moveTo(x + radius, h);
      ctx.lineTo(x + radius, y + radius);
      ctx.arcTo(x, y + radius, x, y, radius);
      ctx.lineTo(x + barW - radius, y);
      ctx.arcTo(x + barW, y, x + barW, y + radius, radius);
      ctx.lineTo(x + barW, h);
      ctx.closePath();
      ctx.fill();
    }
  }, []);

  const drawWave = useCallback((
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    w: number,
    h: number
  ) => {
    ctx.clearRect(0, 0, w, h);

    const points = Math.min(data.length, 256);
    const step = Math.floor(data.length / points);

    const strokeGrad = ctx.createLinearGradient(0, 0, 0, h);
    strokeGrad.addColorStop(0, 'rgba(45, 212, 191, 0.3)');
    strokeGrad.addColorStop(0.5, 'rgba(45, 212, 191, 0.8)');
    strokeGrad.addColorStop(1, 'rgba(45, 212, 191, 0.3)');

    ctx.strokeStyle = strokeGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i <= points; i++) {
      const idx = Math.min(i * step, data.length - 1);
      const val = data[idx] / 255;
      const x = (i / points) * w;
      const y = (1 - val) * h * 0.8 + h * 0.1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    for (let i = points; i >= 0; i--) {
      const idx = Math.min(i * step, data.length - 1);
      const val = data[idx] / 255;
      const x = (i / points) * w;
      const y = val * h * 0.8 + h * 0.1;
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.stroke();

    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, 'rgba(45, 212, 191, 0.05)');
    fillGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.15)');
    fillGrad.addColorStop(1, 'rgba(45, 212, 191, 0.05)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }, []);

  const drawCircular = useCallback((
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    w: number,
    h: number
  ) => {
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.4;
    const minR = maxR * 0.25;

    const total = BAR_COUNT * 2;
    const sliceAngle = (Math.PI * 2) / total;

    for (let i = 0; i < total; i++) {
      const srcIdx = Math.floor(freqScale(i, total) * (data.length - 1));
      const val = data[srcIdx] / 255;
      const angle = i * sliceAngle - Math.PI / 2;

      const innerR = minR;
      const outerR = minR + val * (maxR - minR);

      const t = val;
      const r = Math.round(20 + t * 20);
      const g = Math.round(160 + t * 95);
      const b = Math.round(140 + t * 60);

      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(angle) * innerR,
        cy + Math.sin(angle) * innerR
      );
      ctx.lineTo(
        cx + Math.cos(angle) * outerR,
        cy + Math.sin(angle) * outerR
      );
      ctx.stroke();

      if (val > 0.6) {
        ctx.strokeStyle = `rgba(69, 255, 200, ${(val - 0.6) * 0.6})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(angle) * (outerR + 2),
          cy + Math.sin(angle) * (outerR + 2)
        );
        ctx.lineTo(
          cx + Math.cos(angle) * (outerR + 6),
          cy + Math.sin(angle) * (outerR + 6)
        );
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(69, 255, 200, 0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const drawIdleState = useCallback((
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    reason: 'stopped' | 'no-analyser' | 'silent-chain'
  ) => {
    ctx.clearRect(0, 0, w, h);

    // Pulse animation
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.003);

    // Subtle background glow
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.4);
    bgGrad.addColorStop(0, `rgba(16, 185, 129, ${0.02 + pulse * 0.02})`);
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Center dashed line (more visible than before)
    ctx.strokeStyle = `rgba(69, 255, 200, ${0.12 + pulse * 0.08})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Status text
    const msgMap: Record<string, string> = {
      'stopped': '等待播放...',
      'no-analyser': '音频引擎初始化中...',
      'silent-chain': '等待音频数据...',
    };

    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + pulse * 0.10})`;
    ctx.font = `${Math.max(10, h * 0.08)}px "SF Mono", "Cascadia Code", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msgMap[reason] || '就绪', w / 2, h / 2);
  }, []);

  // ---- Main render loop ----
  // Effect only depends on mode and draw functions (which are stable due to useCallback([])).
  // isPlaying is read from the ref so changes don't tear down the loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      const { w: cssW, h: cssH } = canvasSizeRef.current;

      // Ensure minimum renderable size
      if (cssW <= 0 || cssH <= 0) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(cssW * dpr);
      const bh = Math.round(cssH * dpr);

      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }

      ctx.clearRect(0, 0, bw, bh);

      const playing = isPlayingRef.current;
      const analyser = getSharedAnalyser();

      // Determine render state
      if (!analyser) {
        drawIdleState(ctx, bw, bh, 'no-analyser');
        animRef.current = requestAnimationFrame(render);
        return;
      }

      if (!playing) {
        drawIdleState(ctx, bw, bh, 'stopped');
        animRef.current = requestAnimationFrame(render);
        return;
      }

      // We have both analyser and playing state → read FFT data
      if (!fftRef.current || fftRef.current.length !== analyser.frequencyBinCount) {
        fftRef.current = new Uint8Array(analyser.frequencyBinCount);
      }

      analyser.getByteFrequencyData(fftRef.current);

      // Check if audio chain is actually delivering data (not all zeros)
      let hasSignal = false;
      const data = fftRef.current;
      for (let i = 0; i < data.length; i++) {
        if (data[i] > 0) { hasSignal = true; break; }
      }

      if (!hasSignal) {
        drawIdleState(ctx, bw, bh, 'silent-chain');
        animRef.current = requestAnimationFrame(render);
        return;
      }

      // Background glow
      const bgGrad = ctx.createRadialGradient(bw / 2, bh / 2, 0, bw / 2, bh / 2, Math.max(bw, bh) * 0.6);
      bgGrad.addColorStop(0, 'rgba(16, 185, 129, 0.04)');
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, bw, bh);

      switch (mode) {
        case 'bars':
          drawBars(ctx, data, bw, bh);
          break;
        case 'wave':
          drawWave(ctx, data, bw, bh);
          break;
        case 'circular':
          drawCircular(ctx, data, bw, bh);
          break;
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [mode, drawBars, drawWave, drawCircular, drawIdleState]);

  const modeLabels: Record<VizMode, { label: string; short: string }> = {
    bars: { label: '频谱柱状', short: '柱状' },
    wave: { label: '镜像波形', short: '波形' },
    circular: { label: '圆形径向', short: '圆形' },
  };

  const presetLabels: Record<string, string> = {
    default: '默认', pop: '流行', rock: '摇滚', classical: '古典',
    jazz: '爵士', electronic: '电子', vocal: '人声',
  };

  return (
    <div className="flex flex-col min-w-0 bg-white/5 p-3.5 rounded-xl border border-white/5 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-emerald-400/80">
            音效控制台
          </span>
          {/* Status indicator dot */}
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
              analyserReady && isPlayingRef.current
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]'
                : analyserReady
                  ? 'bg-yellow-400/60'
                  : 'bg-white/20'
            }`}
          />
        </div>
        <div className="flex gap-1">
          {(Object.keys(modeLabels) as VizMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[8px] px-2 py-0.5 rounded border transition-all ${
                mode === m
                  ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
              }`}
            >
              {modeLabels[m].short}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[2/1] rounded-lg overflow-hidden bg-black/30 border border-white/5 min-h-[120px]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {/* Parameter Overview */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="text-[7px] text-white/30 uppercase tracking-wider mb-0.5">EQ 预设</div>
          <div className="text-[10px] font-bold text-yellow-400/90">
            {presetLabels[eqParams.preset] || eqParams.preset}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="text-[7px] text-white/30 uppercase tracking-wider mb-0.5">低音</div>
          <div className={`text-[10px] font-bold ${eqParams.bassOn ? 'text-amber-400' : 'text-white/30'}`}>
            {eqParams.bassOn ? 'ON' : 'OFF'}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="text-[7px] text-white/30 uppercase tracking-wider mb-0.5">混响</div>
          <div className={`text-[10px] font-bold ${eqParams.reverbOn ? 'text-pink-400' : 'text-white/30'}`}>
            {eqParams.reverbOn ? 'ON' : 'OFF'}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="text-[7px] text-white/30 uppercase tracking-wider mb-0.5">速度</div>
          <div className="text-[10px] font-bold text-emerald-400 font-mono">
            {eqParams.speed}x
          </div>
        </div>
      </div>
    </div>
  );
}
