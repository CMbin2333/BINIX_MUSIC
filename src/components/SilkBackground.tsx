import React, { useEffect, useRef } from 'react';
import { getSharedAnalyser } from './EQSonicPanel';
import { Song } from '../types';

interface SilkBackgroundProps {
  isPlaying: boolean;
  blurAmount: number; // custom blur adjustment 0-20px (user can play with this!)
  colorPalette: {
    blob0: [number, number, number];
    blob1: [number, number, number];
    blob2: [number, number, number];
    blob3: [number, number, number];
    blob4: [number, number, number];
  };
  flowSpeed?: number;
  foldDepth?: number;
  saturation?: number;
  bgContrast?: number;
  bgBrightness?: number;
  bgHueRotate?: number;
  bgScale?: number;
  syncBgToBass?: boolean;
  currentSong?: Song | null;
}

const vertexShaderSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_relief;

// Reactive blob colors and their configurations
uniform vec3 u_blob0; // [x, y, weight]
uniform vec3 u_blob1;
uniform vec3 u_blob2;
uniform vec3 u_blob3;
uniform vec3 u_blob4;

uniform vec3 u_color0; // RGB
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;

const float TAU = 6.28318530718;

float gaussian(float d, float width) {
  return exp(-(d * d) / width);
}

// Continuous, non-periodic multi-frequency coordinates warping (un-looped & thermodynamic)
vec2 flowWarp(vec2 p, float t) {
  vec2 q = p;
  
  // Use prime frequency multipliers to completely destroy any repetitive periodicity
  float t1 = t * 0.82;
  float t2 = t * 1.17;
  float t3 = t * 0.64;
  
  // High-fidelity luxurious breathing cycle (LFO) for deep harmonic rhythm
  float breathe = 1.0 + 0.16 * sin(t * 0.45 + sin(t * 0.22));

  q.x += 0.145 * sin(q.y * 0.65 + t1) + 0.055 * sin(q.y * 1.35 - t2 + 1.12) + 0.029 * cos(t3);
  q.y += 0.115 * sin(q.x * 0.52 - t1 + 2.15) + 0.040 * sin(q.x * 1.15 + t2 * 1.45 - 0.58) + 0.021 * sin(t3);
  q.x += 0.032 * sin((q.x + q.y) * 0.41 + t2) * breathe;
  q.y += 0.026 * cos((q.x - q.y) * 0.36 - t1) * breathe;
  return q;
}

float heightField(vec2 p, float t) {
  vec2 q = flowWarp(p, t);
  float h = 0.0;
  
  float t1 = t * 0.91;
  float t2 = t * 1.12;
  float t3 = t * 0.74;

  // Intersecting wavy folds (simulating real luxurious fabric layers)
  h += 0.150 * sin(dot(q, vec2(0.51, 0.81)) + t1 + 0.33 * sin(q.x * 0.31 - t2));
  h += 0.100 * sin(dot(q, vec2(-0.41, 0.69)) - t2 + 1.55 + 0.21 * sin(q.y * 0.36 + t1));
  h += 0.053 * sin(dot(q, vec2(0.76, -0.33)) + t3 + 3.14);

  // Soft folds of silk satin
  float d1 = q.y - 0.32 * sin(q.x * 0.51 + t1) - 0.11 * cos(q.x * 0.87 - t2 + 1.22) - 0.057 * sin(t3);
  h += 0.415 * gaussian(d1, 0.12);
  h -= 0.178 * gaussian(d1 + 0.32, 0.19);

  float d2 = 0.56 * q.x + 0.80 * q.y - 0.21 * sin(q.x * 0.34 - q.y * 0.22 - t2 + 1.55) - 0.067 * cos(t1 + q.y * 0.23);
  h += 0.308 * gaussian(d2, 0.17);
  h -= 0.129 * gaussian(d2 - 0.36, 0.25);

  float d3 = -0.41 * q.x + 0.85 * q.y - 0.18 * sin(q.x * 0.31 + q.y * 0.25 + t3 + 2.32) + 0.051 * sin(t2);
  h += 0.246 * gaussian(d3, 0.21);
  h -= 0.096 * gaussian(d3 + 0.420, 0.29);

  // Smooth volumetric localized dynamic squeeze
  vec2 c = q - vec2(0.29 * sin(t1 + 0.82), 0.18 * cos(t2 - 0.42));
  float along = c.x * 0.81 + c.y * 0.59;
  float across = -c.x * 0.59 + c.y * 0.81 - 0.098 * sin(along * 0.62 - t1);
  h += 0.258 * exp(-(across * across / 0.082 + along * along / 3.48));
  h -= 0.092 * exp(-((across + 0.29) * (across + 0.29) / 0.148 + along * along / 3.85));

  return h;
}

float snoise(vec2 p) {
  return sin(p.x * 2.15 + sin(p.y * 3.42)) * cos(p.y * 1.85 + cos(p.x * 2.92));
}

vec3 gradientMap(float factor) {
  float x = clamp(factor, 0.0, 1.0);
  if (x < 0.5) {
    return mix(u_color0, u_color1, smoothstep(0.0, 0.5, x));
  } else {
    return mix(u_color1, u_color2, smoothstep(0.5, 1.0, x));
  }
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * vec2(2.0 * aspect, 2.0);
  float t = u_time * 0.46; // Continuous master timeline without loop wrap points

  float e = 0.0045;
  float h0 = heightField(p, t);
  float hxp = heightField(p + vec2(e, 0.0), t);
  float hxm = heightField(p - vec2(e, 0.0), t);
  float hyp = heightField(p + vec2(0.0, e), t);
  float hym = heightField(p - vec2(0.0, e), t);
  
  float hx = (hxp - hxm) / (2.0 * e);
  float hy = (hyp - hym) / (2.0 * e);
  float lap = (hxp + hxm + hyp + hym - 4.0 * h0) / (e * e);

  float relief = u_relief;
  vec3 n = normalize(vec3(-hx * relief, -hy * relief, 1.0));
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 l = normalize(vec3(-0.30 + 0.075 * sin(t * 1.12), 0.38 + 0.055 * cos(t * 0.82), 0.88));
  vec3 halfV = normalize(l + v);
  float ndl = max(dot(n, l), 0.0);
  float ndh = max(dot(n, halfV), 0.0);

  vec3 tangent = normalize(vec3(1.0, 0.0, hx * relief));
  vec3 bitangent = normalize(cross(n, tangent));
  float ht = dot(halfV, tangent);
  float hb = dot(halfV, bitangent);
  float hn = max(dot(halfV, n), 0.035);
  float ward = exp(-((ht * ht) / (0.52 * 0.52) + (hb * hb) / (0.18 * 0.18)) / (hn * hn));

  // High-precision anisotropic and shiny metallic silk satin specular highlights
  float broad = pow(ndh, 3.4) * 0.245;
  float tight = pow(ndh, 18.0) * 0.155;
  float anisotropic = ward * 0.275;
  float curvature = clamp(abs(lap) * 0.00090, 0.0, 1.0);
  float crest = smoothstep(0.09, 0.73, curvature) * pow(ndh, 2.1) * 0.040;

  // Modern physical-artistic equations requested:
  // 1. Distortion field (difference between flows)
  vec2 q = flowWarp(p, t);
  float distortion = length(q - p);

  // 2. Density calculation based on active fluid blob weights
  float w0 = 0.035 + u_blob0.z * exp(-((q.x - u_blob0.x) * (q.x - u_blob0.x) / (0.88 * 0.88) + (q.y - u_blob0.y) * (q.y - u_blob0.y) / (0.78 * 0.78)) * 1.14);
  float w1 = 0.035 + u_blob1.z * exp(-((q.x - u_blob1.x) * (q.x - u_blob1.x) / (0.82 * 0.82) + (q.y - u_blob1.y) * (q.y - u_blob1.y) / (0.88 * 0.88)) * 1.14);
  float w2 = 0.035 + u_blob2.z * exp(-((q.x - u_blob2.x) * (q.x - u_blob2.x) / (0.82 * 0.82) + (q.y - u_blob2.y) * (q.y - u_blob2.y) / (0.88 * 0.88)) * 1.14);
  float w3 = 0.035 + u_blob3.z * exp(-((q.x - u_blob3.x) * (q.x - u_blob3.x) / (0.94 * 0.94) + (q.y - u_blob3.y) * (q.y - u_blob3.y) / (1.02 * 1.02)) * 1.14);
  float w4 = 0.035 + u_blob4.z * exp(-((q.x - u_blob4.x) * (q.x - u_blob4.x) / (0.88 * 0.88) + (q.y - u_blob4.y) * (q.y - u_blob4.y) / (0.96 * 0.96)) * 1.14);
  float density = w0 + w1 + w2 + w3 + w4;

  // 3. Noise field (stochastic and organic micro-movements)
  float noise = snoise(q * 2.3);

  // 亮度 = 噪声 + 扭曲 + 密度
  // We apply fine-tuned coefficients to create balanced high-contrast ratios
  float brightness = clamp(noise * 0.15 + distortion * 0.42 + density * 0.45, 0.0, 2.0);

  // 颜色 = 光强 × 渐变映射
  // Compute Light Intensity based on brightness, diffuse lighting, and high-frequency specularities
  float ambientLift = 0.031 + 0.021 * sin(h0 * 1.20 + t);
  float light_intensity = brightness * (0.84 + 0.16 * ndl) + (broad + tight + anisotropic + crest) * 1.35 + ambientLift;

  // Get luxurious 3-color gradient mapping
  float gFactor = clamp((h0 + 0.45) * 0.82 + 0.18 * sin(p.x * 1.15 + t), 0.0, 1.0);
  vec3 gradient_map = gradientMap(gFactor);

  vec3 coolGlint = vec3(0.205, 0.690, 0.750) * pow(ndh, 7.3) * 0.035;
  vec3 color = light_intensity * gradient_map + coolGlint * 0.5;

  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += max(0.0, 0.235 - lum) * (u_color0 * 0.42);
  color = clamp(color, 0.0, 1.0);
  color = pow(color, vec3(0.955));
  outColor = vec4(color, 1.0);
}`;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothStep = (t: number) => t * t * (3 - 2 * t);

interface PhysBlob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseW: number;
  w: number;
}

export const SilkBackground: React.FC<SilkBackgroundProps> = ({ 
  isPlaying, 
  blurAmount, 
  colorPalette, 
  flowSpeed = 1.0, 
  foldDepth = 0.52, 
  saturation = 1.4,
  bgContrast = 1.1,
  bgBrightness = 1.0,
  bgHueRotate = 0,
  bgScale = 1.0,
  syncBgToBass = true,
  currentSong = null
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bassMaskRef = useRef<HTMLDivElement | null>(null);
  const fftDataRef = useRef<Uint8Array | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const timeRef = useRef<number>(10); // Start from a non-zero time coordinate
  const lastTimeRef = useRef<number>(performance.now());
  const blobsRef = useRef<PhysBlob[]>([]);
  const currentColorsRef = useRef<[number, number, number][] | null>(null);
  
  const propsRef = useRef({ 
    colorPalette, 
    flowSpeed, 
    foldDepth, 
    saturation, 
    blurAmount,
    isPlaying,
    syncBgToBass,
    currentSong 
  });

  // Keep propsRef in sync with latest props
  useEffect(() => {
    propsRef.current = { 
      colorPalette, 
      flowSpeed, 
      foldDepth, 
      saturation, 
      blurAmount,
      isPlaying,
      syncBgToBass,
      currentSong 
    };
  }, [colorPalette, flowSpeed, foldDepth, saturation, blurAmount, isPlaying, syncBgToBass, currentSong]);

  // Initialize randomized organic thermodynamic seeds with dynamic paths
  const initBlobs = () => {
    const bases = [
      [-0.8, 0.5],     // Corner top-left
      [-0.5, -0.5],    // Margin bottom-left
      [0.0, 0.0],      // Center core
      [0.5, -0.5],     // Margin bottom-right
      [0.8, 0.5]       // Corner top-right
    ];

    blobsRef.current = Array.from({ length: 5 }, (_, i) => {
      const [bX, bY] = bases[i];
      const angle = Math.random() * Math.PI * 2;
      // High-viscosity velocity speed multiplier (faster baseline drift) with completely random speed multipliers
      const speed = 0.7 + Math.random() * 1.5;
      const baseW = 0.8 + Math.random() * 0.7; // random dimensions

      return {
        x: bX,
        y: bY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        baseW,
        w: baseW
      };
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      desynchronized: true
    });

    if (!gl) {
      console.error('WebGL2 is not supported on this device/browser.');
      return;
    }

    const compileShader = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not create shader');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Shader compilation error: ' + error);
      }
      return shader;
    };

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
      gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
      }
    } catch (err) {
      console.error('Shader compilation or linking failed:', err);
      return;
    }

    // Set up geometry (fullscreen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      relief: gl.getUniformLocation(program, 'u_relief'),
      blobs: [0, 1, 2, 3, 4].map((i) => gl.getUniformLocation(program, 'u_blob' + i)),
      colors: [0, 1, 2, 3, 4].map((i) => gl.getUniformLocation(program, 'u_color' + i)),
    };

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // High definition but with a cap for efficiency
      const w = Math.max(16, Math.floor(window.innerWidth * dpr));
      const h = Math.max(16, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Generate random dynamics on first load of current theme
    if (blobsRef.current.length === 0) {
      initBlobs();
    }

    const loop = (now: number) => {
      let dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Clamp deltaTime to prevent extreme calculations when switching tabs or backgrounding
      if (dt > 0.1) dt = 0.1;

      // Calculate new coordinates continuously so the background keeps moving even when paused
      {
        timeRef.current += dt * 1.5 * propsRef.current.flowSpeed; // faster baseline drift for micro-textures flow

        const blobs = blobsRef.current;
        if (blobs.length < 5) {
          initBlobs();
        }

        // 1. Calculate physical fluid mutual interactive forces (Squeezing, Attraction & Coalescing)
        for (let i = 0; i < 5; i++) {
          const bI = blobs[i];
          for (let j = i + 1; j < 5; j++) {
            const bJ = blobs[j];
            const dx = bJ.x - bI.x;
            const dy = bJ.y - bI.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

            // Merge attraction drag range (when close, they pull towards each other)
            const cohesionRange = 1.35;
            if (dist < cohesionRange) {
              const attraction = 0.52 * (cohesionRange - dist);
              bI.vx += (dx / dist) * attraction * dt;
              bI.vy += (dy / dist) * attraction * dt;
              bJ.vx -= (dx / dist) * attraction * dt;
              bJ.vy -= (dy / dist) * attraction * dt;
            }

            // Real physical core overlapping squeeze repulsion
            const squeezeRange = 0.52;
            if (dist < squeezeRange) {
              const repulsion = 1.65 * (squeezeRange - dist);
              bI.vx -= (dx / dist) * repulsion * dt;
              bI.vy -= (dy / dist) * repulsion * dt;
              bJ.vx += (dx / dist) * repulsion * dt;
              bJ.vy += (dy / dist) * repulsion * dt;
            }
          }
        }

        // 2. Individual physics updates: Brownian chaotic drift (ensures completely random trajectories)
        const aspect = window.innerWidth / Math.max(window.innerHeight, 1.0);
        const marginX = aspect + 0.15;
        const marginY = 1.15;

        for (let i = 0; i < 5; i++) {
          const b = blobs[i];

          // Continuous stochastic variance (Brownian random walk) so they NEVER go back-and-forth
          const randomNoise = 3.2; // highly active randomized changes
          b.vx += (Math.random() - 0.5) * randomNoise * dt;
          b.vy += (Math.random() - 0.5) * randomNoise * dt;

          // Gentle center attraction so they don't drift into empty spaces indefinitely
          const gravityConstant = 0.15;
          b.vx -= b.x * gravityConstant * dt;
          b.vy -= b.y * gravityConstant * dt;

          // Screen boundaries boundary smooth elastic bouncing (pushes back elegantly)
          if (b.x > marginX) {
            b.vx -= 6.0 * (b.x - marginX) * dt;
            b.vx *= 0.94;
          } else if (b.x < -marginX) {
            b.vx += 6.0 * (-marginX - b.x) * dt;
            b.vx *= 0.94;
          }

          if (b.y > marginY) {
            b.vy -= 6.0 * (b.y - marginY) * dt;
            b.vy *= 0.94;
          } else if (b.y < -marginY) {
            b.vy += 6.0 * (-marginY - b.y) * dt;
            b.vy *= 0.94;
          }

          // Dynamic speed limit (fast and energetic, yet gorgeous and visually harmonic)
          const maxSpeed = 2.4;
          const currentSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 0.001;
          if (currentSpeed > maxSpeed) {
            b.vx = (b.vx / currentSpeed) * maxSpeed;
            b.vy = (b.vy / currentSpeed) * maxSpeed;
          }

          // Apply physical integration
          b.x += b.vx * dt * propsRef.current.flowSpeed;
          b.y += b.vy * dt * propsRef.current.flowSpeed;
        }

        // 3. Volumetric squeeze dynamic weight scaling (makes them visibly swell/merge and thin out!)
        for (let i = 0; i < 5; i++) {
          const bI = blobs[i];
          let totalSqueeze = 0;
          for (let j = 0; j < 5; j++) {
            if (i === j) continue;
            const bJ = blobs[j];
            const dx = bJ.x - bI.x;
            const dy = bJ.y - bI.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

            if (dist < 1.0) {
              const overlap = 1.0 - dist;
              totalSqueeze += overlap * 0.58;
            }
          }
          const targetW = bI.baseW + Math.min(0.9, totalSqueeze);
          bI.w = bI.w + (targetW - bI.w) * 0.15; // Smooth dynamic scaling
        }
      }

      gl.useProgram(program);

      // Update resolution
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, timeRef.current);
      gl.uniform1f(uniforms.relief, propsRef.current.foldDepth);

      // Extract current frame coordinates
      const blobs = blobsRef.current;
      if (blobs.length < 5) {
        initBlobs();
      }

      for (let i = 0; i < 5; i++) {
        if (uniforms.blobs[i]) {
          gl.uniform3f(uniforms.blobs[i], blobs[i].x, blobs[i].y, blobs[i].w);
        }
      }

      // Dynamically push colors of current song's palette to shaders with elegant smooth interpolation
      const targetColors = [
        propsRef.current.colorPalette.blob0,
        propsRef.current.colorPalette.blob1,
        propsRef.current.colorPalette.blob2,
        propsRef.current.colorPalette.blob3,
        propsRef.current.colorPalette.blob4
      ];

      if (!currentColorsRef.current) {
        currentColorsRef.current = targetColors.map(c => [c[0], c[1], c[2]]);
      } else {
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 3; j++) {
            currentColorsRef.current[i][j] = mix(
              currentColorsRef.current[i][j],
              targetColors[i][j],
              1.0 - Math.exp(-dt * 2.5) // smooth framerate-independent transitions
            );
          }
        }
      }

      for (let i = 0; i < 5; i++) {
        if (uniforms.colors[i]) {
          const col = currentColorsRef.current[i];
          gl.uniform3f(uniforms.colors[i], col[0], col[1], col[2]);
        }
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // 4. Heavy Bass dynamic breathing and micro-contrast pulse overlay (节奏性全局亮度脉冲 & 重低音闪烁)
      let bassVal = 0;
      const { isPlaying: pPlaying, syncBgToBass: pSync, currentSong: pSong } = propsRef.current;
      if (pSync && pPlaying) {
        const analyser = getSharedAnalyser();
        if (analyser) {
          if (!fftDataRef.current || fftDataRef.current.length !== analyser.frequencyBinCount) {
            fftDataRef.current = new Uint8Array(analyser.frequencyBinCount);
          }
          analyser.getByteFrequencyData(fftDataRef.current);
          let sum = 0;
          const count = Math.min(8, fftDataRef.current.length); // Bass bins
          for (let idx = 0; idx < count; idx++) {
            sum += fftDataRef.current[idx];
          }
          bassVal = sum / (count * 255.0);
        } else {
          // Fallback BPM-synced organic bass waves simulation when WebAudio is CORS-blocked or bypassed
          let hash = 0;
          const titleStr = pSong ? ((pSong.title || '') + (pSong.artist || '')) : 'music';
          for (let i = 0; i < titleStr.length; i++) {
            hash = titleStr.charCodeAt(i) + ((hash << 5) - hash);
          }
          const simulatedBpm = 85 + (Math.abs(hash) % 55); // stable customized song tempo
          const bps = simulatedBpm / 60;
          const beatClock = (performance.now() * 0.001) * bps;
          
          bassVal = Math.pow(Math.sin(beatClock * Math.PI) * 0.5 + 0.5, 3.5);
        }
      }

      let targetOpacity = 0;
      if (pSync && pPlaying) {
        // A. Subtle rhythmically slow global breathing brightness pulse (微弱的节奏性全局亮度脉冲)
        const breatheTime = performance.now() * 0.0015;
        const slowPulse = 0.02 * Math.sin(breatheTime * Math.PI); // -0.02 to +0.02
        
        // B. Real-time dynamic response for Heavy Bass (低音重音闪烁)
        const bassTrigger = Math.max(0, bassVal - 0.25) * 0.16; // reactive breathing flash on heavy bass beats
        
        // C. Combine into overlay mask value
        targetOpacity = Math.max(0, 0.03 + slowPulse + bassTrigger);
      }

      // Smoothly interpolate inside the RAF animation loop to fully prevent jitter and flashing
      if (bassMaskRef.current) {
        const prevOpacity = parseFloat(bassMaskRef.current.style.opacity) || 0;
        const nextOpacity = prevOpacity + (targetOpacity - prevOpacity) * 0.16;
        bassMaskRef.current.style.opacity = nextOpacity.toFixed(4);
      }

      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
    };
  }, []); // Only compile and bind once on mount for seamless non-stop active visuals without any leaking/dropped frames

  return (
    <div
      style={{
        position: 'fixed',
        inset: '-7%',
        width: '114%',
        height: '114%',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: `rgb(${Math.round((colorPalette.blob0[0] || 0) * 12)}, ${Math.round((colorPalette.blob0[1] || 0) * 12)}, ${Math.round((colorPalette.blob0[2] || 0) * 12)})`,
        // We apply a customizable and optimized blur filter.
        // If blur === 0, you get full high-contrast, razor-sharp gorgeous silk gloss (specularities)!
        // If blur is slightly higher, it behaves more like soft ambient light!
        filter: `saturate(${saturation}) contrast(${bgContrast}) brightness(${bgBrightness}) hue-rotate(${bgHueRotate}deg) blur(${blurAmount}px)`,
        transform: `translate3d(0, 0, 0) scale(${bgScale})`,
        transition: 'filter 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}
      id="silk-bg-container"
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '114%',
          pointerEvents: 'none'
        }}
      />
      {/* Bass Pulse breathing mask overlay (低音节奏与全局呼吸暗度微调遮罩) */}
      <div
        ref={bassMaskRef}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000000',
          opacity: 0,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
          willChange: 'opacity'
        }}
        id="bg-bass-pulse-mask"
      />
    </div>
  );
};
