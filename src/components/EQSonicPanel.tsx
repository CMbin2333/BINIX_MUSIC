import React, { useState, useCallback, useEffect, useRef } from 'react';
import AudioVisualizer from './AudioVisualizer';

// ==================== Constants ====================
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: Record<string, number[]> = {
  default:   [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  pop:       [ 3,  2,  0, -1, -2,  0,  2,  3,  4,  3],
  rock:      [ 5,  4,  2, -1, -2,  1,  3,  4,  3,  2],
  classical: [ 0,  0,  0,  0,  1,  2,  3,  3,  2,  1],
  jazz:      [ 4,  3,  1,  0,  0,  1,  2,  3,  4,  3],
  electronic:[ 6,  5,  2, -2, -3, -1,  1,  4,  6,  7],
  vocal:     [-3, -2, -1,  1,  3,  4,  3,  2,  0, -1],
};

// ==================== Module-Level Audio Engine ====================
let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let lastElement: HTMLAudioElement | null = null;

let eqNodes: BiquadFilterNode[] = [];
let bassBoostNode: BiquadFilterNode | null = null;
let masterGain: GainNode | null = null;
let reverbConvolver: ConvolverNode | null = null;
let reverbWetGain: GainNode | null = null;
let reverbDryGain: GainNode | null = null;

let chainBuilt = false;
let eqGains: number[] = [...EQ_PRESETS.default];
let bassOn = false;
let bassLevel = 0.5;
let stereoWidth = 1.0;
let reverbOn = false;
let reverbLevel = 0.3;
let reverbDecay = 2.0;

function generateReverbIR(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * decay));
    }
  }
  return buffer;
}

function buildChain(audio: HTMLAudioElement): void {
  if (chainBuilt) return;
  const ctx = audioCtx!;
  const src = sourceNode!;

  if (analyserNode) analyserNode.disconnect();
  try { src.disconnect(); } catch (_) {}

  masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;

  // 1) 10-band EQ chain
  eqNodes = EQ_BANDS.map((freq, i) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.0;
    filter.gain.value = eqGains[i];
    return filter;
  });
  let prev: AudioNode = src;
  for (const node of eqNodes) {
    prev.connect(node);
    prev = node;
  }
  const eqTail: AudioNode = eqNodes.length > 0 ? eqNodes[eqNodes.length - 1] : src;

  // 2) Bass boost (low shelf)
  bassBoostNode = ctx.createBiquadFilter();
  bassBoostNode.type = 'lowshelf';
  bassBoostNode.frequency.value = 150;
  bassBoostNode.Q.value = 0.7;
  bassBoostNode.gain.value = bassOn ? bassLevel * 15 : 0;
  eqTail.connect(bassBoostNode);

  // 3) Stereo widener mid/side matrix
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  bassBoostNode.connect(splitter);

  const gLL = ctx.createGain();
  const gRL = ctx.createGain();
  const gLR = ctx.createGain();
  const gRR = ctx.createGain();

  const applyWidth = (w: number) => {
    gLL.gain.value = (1 + w) / 2;
    gRL.gain.value = (1 - w) / 2;
    gLR.gain.value = (1 - w) / 2;
    gRR.gain.value = (1 + w) / 2;
  };
  applyWidth(stereoWidth);

  splitter.connect(gLL, 0); splitter.connect(gRL, 1);
  splitter.connect(gLR, 0); splitter.connect(gRR, 1);
  gLL.connect(merger, 0, 0);
  gRL.connect(merger, 0, 0);
  gLR.connect(merger, 0, 1);
  gRR.connect(merger, 0, 1);

  // Store widener updater
  (masterGain as any).__widenerFn = applyWidth;

  // 4) Reverb split
  const revSplit = ctx.createGain();
  merger.connect(revSplit);

  reverbDryGain = ctx.createGain();
  reverbWetGain = ctx.createGain();
  reverbDryGain.gain.value = reverbOn ? 1 - reverbLevel : 1;
  reverbWetGain.gain.value = reverbOn ? reverbLevel : 0;

  reverbConvolver = ctx.createConvolver();
  reverbConvolver.buffer = generateReverbIR(ctx, reverbDecay * 1.5, reverbDecay);

  revSplit.connect(reverbDryGain);
  revSplit.connect(reverbConvolver);
  reverbConvolver.connect(reverbWetGain);

  const revMix = ctx.createGain();
  reverbDryGain.connect(revMix);
  reverbWetGain.connect(revMix);

  // 5) Final: revMix → master → analyser → destination
  revMix.connect(masterGain);
  masterGain.connect(analyserNode!);
  analyserNode!.connect(ctx.destination);

  chainBuilt = true;
}

function teardownChain(): void {
  eqNodes = [];
  bassBoostNode = null;
  reverbConvolver = null; reverbWetGain = null; reverbDryGain = null;
  masterGain = null;
  chainBuilt = false;
}

function getOrCreateCtx(audio: HTMLAudioElement): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audio !== lastElement || !sourceNode) {
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch (_) {}
    }
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 2048;
    lastElement = audio;
    chainBuilt = false;
  }
  return audioCtx;
}

export function getSharedAnalyser(): AnalyserNode | null {
  return analyserNode;
}

export function resumeAudioContext(): Promise<void> {
  if (audioCtx && audioCtx.state === 'suspended') {
    return audioCtx.resume().then(() => {});
  }
  return Promise.resolve();
}

// ==================== React Component ====================
interface EQSonicPanelProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying?: boolean;
}

export default function EQSonicPanel({ audioRef, isPlaying = false }: EQSonicPanelProps) {
  const [eqLocalGains, setEqLocalGains] = useState<number[]>(() => {
    try {
      const s = localStorage.getItem('eq_gains');
      if (s) return JSON.parse(s);
    } catch (_) {}
    return [...EQ_PRESETS.default];
  });
  const [eqPresetName, setEqPresetName] = useState<string>(() => {
    return localStorage.getItem('eq_preset_name') || 'default';
  });
  const [eqBassBoost, setEqBassBoost] = useState<boolean>(() => {
    return localStorage.getItem('eq_bass_boost') === 'true';
  });
  const [eqBassBoostLvl, setEqBassBoostLvl] = useState<number>(() => {
    const v = localStorage.getItem('eq_bass_boost_lvl');
    return v ? parseFloat(v) : 0.5;
  });
  const [eqStereoW, setEqStereoW] = useState<number>(() => {
    const v = localStorage.getItem('eq_stereo_w');
    return v ? parseFloat(v) : 1.0;
  });
  const [eqReverbOnState, setEqReverbOnState] = useState<boolean>(() => {
    return localStorage.getItem('eq_reverb_on') === 'true';
  });
  const [eqReverbLvl, setEqReverbLvl] = useState<number>(() => {
    const v = localStorage.getItem('eq_reverb_lvl');
    return v ? parseFloat(v) : 0.3;
  });
  const [eqReverbDec, setEqReverbDec] = useState<number>(() => {
    const v = localStorage.getItem('eq_reverb_dec');
    return v ? parseFloat(v) : 2.0;
  });
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    const v = localStorage.getItem('playback_speed');
    return v ? parseFloat(v) : 1.0;
  });

  // ==================== Sleep Timer State ====================
  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(() => {
    const saved = localStorage.getItem('sleep_timer_end');
    return saved ? parseFloat(saved) : null;
  });
  const [sleepTimerTotal, setSleepTimerTotal] = useState<number>(() => {
    const saved = localStorage.getItem('sleep_timer_total');
    return saved ? parseFloat(saved) : 0;
  });
  const [sleepRemaining, setSleepRemaining] = useState<number>(0);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize sleep timer remaining from persisted end time
  useEffect(() => {
    if (sleepTimerEnd !== null) {
      const now = Date.now();
      if (now >= sleepTimerEnd) {
        setSleepTimerEnd(null);
        setSleepTimerTotal(0);
        localStorage.removeItem('sleep_timer_end');
        localStorage.removeItem('sleep_timer_total');
      } else {
        setSleepRemaining(Math.ceil((sleepTimerEnd - now) / 1000));
      }
    }
  }, []);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepTimerEnd === null) {
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      setSleepRemaining(0);
      return;
    }

    sleepTimerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((sleepTimerEnd - now) / 1000));
      setSleepRemaining(remaining);

      if (remaining <= 0) {
        if (sleepTimerRef.current) {
          clearInterval(sleepTimerRef.current);
          sleepTimerRef.current = null;
        }
        setSleepTimerEnd(null);
        setSleepTimerTotal(0);
        localStorage.removeItem('sleep_timer_end');
        localStorage.removeItem('sleep_timer_total');
        audioRef.current?.pause();
      }
    }, 200);

    return () => {
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    };
  }, [sleepTimerEnd, audioRef]);

  const startSleepTimer = useCallback((minutes: number) => {
    const end = Date.now() + minutes * 60 * 1000;
    setSleepTimerEnd(end);
    setSleepTimerTotal(minutes * 60);
    localStorage.setItem('sleep_timer_end', String(end));
    localStorage.setItem('sleep_timer_total', String(minutes * 60));
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimerEnd(null);
    setSleepTimerTotal(0);
    localStorage.removeItem('sleep_timer_end');
    localStorage.removeItem('sleep_timer_total');
  }, []);

  // --- Audio chain setup ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const ctx = getOrCreateCtx(audio);

    const onMeta = () => {
      if (ctx.state === 'suspended') ctx.resume();
      if (!chainBuilt) buildChain(audio);
      audio.playbackRate = playbackSpeed;
    };
    audio.addEventListener('loadedmetadata', onMeta);
    if (audio.readyState >= 1 && !chainBuilt) {
      if (ctx.state === 'suspended') ctx.resume();
      buildChain(audio);
      audio.playbackRate = playbackSpeed;
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
    };
  }, [audioRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardownChain();
    };
  }, []);

  // --- Apply functions ---
  const applyEQGains = useCallback((gains: number[], presetName?: string) => {
    setEqLocalGains(gains);
    localStorage.setItem('eq_gains', JSON.stringify(gains));
    eqGains = [...gains];
    eqNodes.forEach((n, i) => { if (i < gains.length) n.gain.value = gains[i]; });
    if (presetName) {
      setEqPresetName(presetName);
      localStorage.setItem('eq_preset_name', presetName);
    }
  }, []);

  const applyBassBoost = useCallback((on: boolean, level: number) => {
    setEqBassBoost(on);
    setEqBassBoostLvl(level);
    localStorage.setItem('eq_bass_boost', String(on));
    localStorage.setItem('eq_bass_boost_lvl', String(level));
    bassOn = on;
    bassLevel = level;
    if (bassBoostNode) bassBoostNode.gain.value = on ? level * 15 : 0;
  }, []);

  const applyStereoWidth = useCallback((w: number) => {
    setEqStereoW(w);
    localStorage.setItem('eq_stereo_w', String(w));
    stereoWidth = w;
    if (masterGain) {
      const fn = (masterGain as any).__widenerFn;
      if (fn) fn(w);
    }
  }, []);

  const applyReverb = useCallback((on: boolean, level: number, decay: number) => {
    setEqReverbOnState(on);
    setEqReverbLvl(level);
    setEqReverbDec(decay);
    localStorage.setItem('eq_reverb_on', String(on));
    localStorage.setItem('eq_reverb_lvl', String(level));
    localStorage.setItem('eq_reverb_dec', String(decay));
    reverbOn = on;
    reverbLevel = level;
    reverbDecay = decay;
    if (reverbDryGain && reverbWetGain && reverbConvolver) {
      reverbDryGain.gain.value = on ? 1 - level : 1;
      reverbWetGain.gain.value = on ? level : 0;
      if (on && audioCtx) {
        reverbConvolver.buffer = generateReverbIR(audioCtx, decay * 1.5, decay);
      }
    }
  }, []);

  const applyPlaybackSpeed = useCallback((s: number) => {
    setPlaybackSpeed(s);
    localStorage.setItem('playback_speed', String(s));
    if (audioRef.current) {
      audioRef.current.playbackRate = s;
    }
  }, [audioRef]);

  const resetAll = useCallback(() => {
    applyEQGains([...EQ_PRESETS.default], 'default');
    applyBassBoost(false, 0.5);
    applyStereoWidth(1.0);
    applyReverb(false, 0.3, 2.0);
    applyPlaybackSpeed(1.0);
  }, [applyEQGains, applyBassBoost, applyStereoWidth, applyReverb, applyPlaybackSpeed]);

  const presetLabels: Record<string, string> = {
    default: '默认', pop: '流行', rock: '摇滚', classical: '古典', jazz: '爵士', electronic: '电子', vocal: '人声',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      {/* ========== Left Column: EQ + Bass ========== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ========== EQ Panel ========== */}
        <div className="flex flex-col min-w-0 bg-white/5 p-3.5 rounded-xl border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-yellow-400/80">10段均衡器 (EQ)</span>
          <span className="text-[8px] font-mono text-yellow-300/60">{eqPresetName === 'default' ? '默认' : presetLabels[eqPresetName]}</span>
        </div>
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-1 mb-2">
          {['default', 'pop', 'rock', 'classical', 'jazz', 'electronic', 'vocal'].map(p => (
            <button
              key={p}
              onClick={() => applyEQGains([...EQ_PRESETS[p]], p)}
              className={`text-[8px] px-1.5 py-0.5 rounded border transition-all ${
                eqPresetName === p
                  ? 'bg-yellow-500/30 border-yellow-400/50 text-yellow-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
              }`}
            >
              {presetLabels[p]}
            </button>
          ))}
        </div>
        {/* 10 vertical sliders */}
        <div className="flex justify-between gap-1 px-1 flex-1 items-stretch">
          {EQ_BANDS.map((freq, i) => (
            <div key={freq} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
              <span className={`text-[7px] font-mono font-bold ${
                eqLocalGains[i] === 0 ? 'text-white/40' : eqLocalGains[i] > 0 ? 'text-yellow-300' : 'text-orange-300'
              }`}>
                {eqLocalGains[i] > 0 ? '+' : ''}{eqLocalGains[i].toFixed(1)}
              </span>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={eqLocalGains[i]}
                className="w-5 flex-1 min-h-0 appearance-none bg-white/10 rounded cursor-pointer [writing-mode:vertical-lr] [direction:rtl] accent-yellow-500"
                style={{ WebkitAppearance: 'slider-vertical' as any }}
                onChange={(e) => {
                  const newGains = [...eqLocalGains];
                  newGains[i] = parseFloat(e.target.value);
                  applyEQGains(newGains);
                }}
              />
              <span className="text-[6px] font-mono text-white/30 leading-none">
                {freq >= 1000 ? `${freq / 1000}K` : freq}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ========== Bass + Stereo + Reverb + Speed Panel ========== */}
      <div className="flex flex-col min-w-0 bg-white/5 p-3.5 rounded-xl border border-white/5 gap-2.5">
        {/* Bass Boost */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-amber-400/80">低音增强</span>
            <button
              onClick={() => applyBassBoost(!eqBassBoost, eqBassBoostLvl)}
              className={`text-[8px] px-2 py-0.5 rounded border transition-all ${
                eqBassBoost
                  ? 'bg-amber-500/30 border-amber-400/50 text-amber-300'
                  : 'bg-white/5 border-white/10 text-white/40'
              }`}
            >
              {eqBassBoost ? 'ON' : 'OFF'}
            </button>
          </div>
          {eqBassBoost && (
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-white/40 w-8">强度</span>
              <input
                type="range" min="0" max="1" step="0.05"
                value={eqBassBoostLvl}
                className="flex-1 accent-amber-500 h-1"
                onChange={(e) => applyBassBoost(true, parseFloat(e.target.value))}
              />
              <span className="text-[8px] font-mono text-amber-300 w-6 text-right">{Math.round(eqBassBoostLvl * 100)}%</span>
            </div>
          )}
        </div>

        {/* Stereo Width */}
        <div className="flex flex-col gap-1 border-t border-white/10 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-cyan-400/80">立体声展宽</span>
            <span className="text-[8px] font-mono font-bold text-cyan-300">
              {eqStereoW < 0.95 ? 'MONO' : eqStereoW < 1.05 ? 'STEREO' : 'WIDE'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[7px] text-white/30 font-mono">0</span>
            <input
              type="range" min="0" max="2" step="0.05"
              value={eqStereoW}
              className="flex-1 accent-cyan-500 h-1"
              onChange={(e) => applyStereoWidth(parseFloat(e.target.value))}
            />
            <span className="text-[7px] text-white/30 font-mono">2</span>
          </div>
          <span className="text-[7px] text-white/30 text-center">{eqStereoW.toFixed(2)}</span>
        </div>

        {/* Reverb */}
        <div className="flex flex-col gap-1 border-t border-white/10 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-pink-400/80">混响效果</span>
            <button
              onClick={() => applyReverb(!eqReverbOnState, eqReverbLvl, eqReverbDec)}
              className={`text-[8px] px-2 py-0.5 rounded border transition-all ${
                eqReverbOnState
                  ? 'bg-pink-500/30 border-pink-400/50 text-pink-300'
                  : 'bg-white/5 border-white/10 text-white/40'
              }`}
            >
              {eqReverbOnState ? 'ON' : 'OFF'}
            </button>
          </div>
          {eqReverbOnState && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-white/40 w-8">干湿</span>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={eqReverbLvl}
                  className="flex-1 accent-pink-500 h-1"
                  onChange={(e) => applyReverb(true, parseFloat(e.target.value), eqReverbDec)}
                />
                <span className="text-[8px] font-mono text-pink-300 w-6 text-right">{Math.round(eqReverbLvl * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-white/40 w-8">衰减</span>
                <input
                  type="range" min="0.5" max="5" step="0.1"
                  value={eqReverbDec}
                  className="flex-1 accent-pink-500 h-1"
                  onChange={(e) => applyReverb(true, eqReverbLvl, parseFloat(e.target.value))}
                />
                <span className="text-[8px] font-mono text-pink-300 w-6 text-right">{eqReverbDec.toFixed(1)}s</span>
              </div>
            </>
          )}
        </div>

        {/* Playback Speed */}
        <div className="flex flex-col gap-1 border-t border-white/10 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-emerald-400/80">播放速度</span>
            <span className="text-[8px] font-mono font-bold text-emerald-300">{playbackSpeed.toFixed(2)}x</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[7px] text-white/30 font-mono">0.5</span>
            <input
              type="range" min="0.5" max="2.0" step="0.05"
              value={playbackSpeed}
              className="flex-1 accent-emerald-500 h-1"
              onChange={(e) => applyPlaybackSpeed(parseFloat(e.target.value))}
            />
            <span className="text-[7px] text-white/30 font-mono">2.0</span>
          </div>
          <div className="flex justify-center gap-1.5">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(s => (
              <button
                key={s}
                onClick={() => applyPlaybackSpeed(s)}
                className={`text-[7px] px-1 py-0.5 rounded border transition-all ${
                  Math.abs(playbackSpeed - s) < 0.01
                    ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={resetAll}
          className="text-[8px] text-white/30 hover:text-white/60 transition-colors w-full text-right underline tracking-wider cursor-pointer border-t border-white/10 pt-2"
        >
          重置均衡器与音效
        </button>

        {/* ==================== Sleep Timer ==================== */}
        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
          {/* Title & Status */}
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-purple-400/80">睡眠定时器</span>
            <span className={`text-[8px] font-mono font-bold ${
              sleepTimerEnd !== null ? 'text-purple-300' : 'text-white/40'
            }`}>
              {sleepTimerEnd !== null
                ? `还剩 ${Math.floor(sleepRemaining / 60)} 分 ${sleepRemaining % 60} 秒`
                : '关闭'}
            </span>
          </div>

          {/* Progress Bar (visible when timer is active) */}
          {sleepTimerEnd !== null && sleepTimerTotal > 0 && (
            <div className="flex flex-col gap-0.5">
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500/70 rounded-full transition-all duration-200"
                  style={{ width: `${Math.min(100, (sleepRemaining / sleepTimerTotal) * 100)}%` }}
                />
              </div>
              <span className="text-[7px] text-white/30 text-right">
                {((sleepRemaining / sleepTimerTotal) * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {/* Quick Buttons */}
          <div className="flex flex-wrap gap-1">
            {[
              { label: '5分钟', mins: 5 },
              { label: '10分钟', mins: 10 },
              { label: '30分钟', mins: 30 },
              { label: '1小时', mins: 60 },
              { label: '2小时', mins: 120 },
              { label: '4小时', mins: 240 },
            ].map(({ label, mins }) => {
              const isActive = sleepTimerEnd !== null && sleepTimerTotal === mins * 60;
              return (
                <button
                  key={mins}
                  onClick={() => startSleepTimer(mins)}
                  className={`text-[7px] px-1.5 py-0.5 rounded border transition-all ${
                    isActive
                      ? 'bg-purple-500/30 border-purple-400/50 text-purple-300'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Custom Time Input */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="480"
              placeholder="自定义分钟数"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const mins = parseInt(customMinutes, 10);
                  if (mins > 0) {
                    startSleepTimer(mins);
                    setCustomMinutes('');
                  }
                }
              }}
              className="flex-1 text-[8px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-white/70 placeholder-white/20 outline-none focus:border-purple-400/50"
            />
            <button
              onClick={() => {
                const mins = parseInt(customMinutes, 10);
                if (mins > 0) {
                  startSleepTimer(mins);
                  setCustomMinutes('');
                }
              }}
              disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
              className="text-[7px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-white/50 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              开始
            </button>
          </div>

          {/* Cancel Button (visible when timer is active) */}
          {sleepTimerEnd !== null && (
            <button
              onClick={cancelSleepTimer}
              className="text-[8px] text-red-400/60 hover:text-red-400 transition-colors text-center underline tracking-wider cursor-pointer"
            >
              取消定时
            </button>
          )}
        </div>
      </div>
      </div>{/* /Left Column */}

      {/* Right Column: Audio Console Visualizer */}
      <AudioVisualizer isPlaying={isPlaying} />
    </div>
  );
}
