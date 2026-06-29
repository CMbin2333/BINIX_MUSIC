import { Song, LyricLine } from '../types';

interface RawLyricLine {
  time: number;
  text: string;
}

// ============ 本地 API 配置 ============
const BASE_URL = 'http://localhost:19876';

// ============ 通用 fetch 工具 ============

/**
 * 双阶段 CORS 绕过：直连失败 → AllOrigins 兜底。
 * 不经过 server.ts，纯前端 fetch。
 */
export async function fetchWithFallback(url: string, parseJson = true): Promise<any> {
  const safeParseJson = async (res: Response, origin: string): Promise<any> => {
    const text = await res.text();
    try {
      const trimmed = text.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        throw new Error(`Response from ${origin} is not JSON (starts with "${trimmed.substring(0, 30)}")`);
      }
      return JSON.parse(trimmed);
    } catch (err: any) {
      if (err.message?.startsWith('Response from')) throw err;
      throw new Error(`JSON parse failed from ${origin}: ${text.substring(0, 100)}`);
    }
  };

  // Stage 1: 直连
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseJson ? await safeParseJson(response, 'direct') : await response.text();
  } catch (err) {
    console.warn(`Direct fetch to ${url} failed, trying AllOrigins...`, err);
  }

  // Stage 2: AllOrigins CORS 代理
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseJson ? await safeParseJson(response, 'allorigins') : await response.text();
  } catch (proxyErr: any) {
    console.error(`AllOrigins fetch to ${url} failed:`, proxyErr?.message || proxyErr);
    throw proxyErr;
  }
}

// ============ URL 解析 ============

/**
 * 解析网易云链接提取类型和 ID
 */
export function parseNeteaseLink(url: string): { type: 'song' | 'playlist' | null; id: string | null } {
  try {
    const cleanUrl = url.replace('/#/', '/');
    const urlObj = new URL(cleanUrl);
    const id = urlObj.searchParams.get('id');
    let type: 'song' | 'playlist' | null = null;
    if (urlObj.pathname.includes('/song')) type = 'song';
    else if (urlObj.pathname.includes('/playlist')) type = 'playlist';
    if (id) return { type, id };
  } catch (_) {}

  const songMatch = url.match(/song\?id=(\d+)/) || url.match(/song\/(\d+)/);
  if (songMatch) return { type: 'song', id: songMatch[1] };

  const playlistMatch = url.match(/playlist\?id=(\d+)/) || url.match(/playlist\/(\d+)/);
  if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };

  if (/^\d+$/.test(url.trim())) {
    return { type: 'song', id: url.trim() };
  }

  return { type: null, id: null };
}

// ============ 时间与元数据解析 ============

export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toLowerCase();
  if (clean.endsWith('ms')) return (parseFloat(clean.substring(0, clean.length - 2)) || 0) / 1000;
  if (clean.endsWith('s')) return parseFloat(clean.substring(0, clean.length - 1)) || 0;
  const parts = clean.split(':');
  if (parts.length === 3) {
    return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + (parseFloat(parts[2]) || 0);
  } else if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
  }
  return parseFloat(clean) || 0;
}

export function extractMetadataLines(rawText: string, prefix = ''): string[] {
  if (!rawText) return [];
  const lines = rawText.split(/[\r\n]+/);
  const metadata: string[] = [];
  const metaRegex = /^\[([a-zA-Z]+):([^\]]+)\]/;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(metaRegex);
    if (match) metadata.push(`${prefix}${match[1].trim()}: ${match[2].trim()}`);
  }
  return metadata;
}

export function convertYrcToLrc(rawYrc: string): string {
  if (!rawYrc) return '';
  const lines = rawYrc.split(/[\r\n]+/);
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let cleanLine = trimmed.replace(/\(\d+,\d+(?:,\d+)?\)/g, '');
    const msRegex = /^\[(\d+)\s*,\s*(\d+)\](.*)/;
    const match = cleanLine.match(msRegex);
    if (match) {
      const startMs = parseInt(match[1], 10);
      const content = match[3];
      const startSec = startMs / 1000;
      const min = Math.floor(startSec / 60);
      const sec = (startSec % 60).toFixed(3);
      cleanLine = `[${String(min).padStart(2, '0')}:${String(sec).padStart(6, '0')}]${content}`;
    }
    result.push(cleanLine);
  }
  return result.join('\n');
}

// ============ LRC 解析 ============

export function parseLrcRaw(lrcText: string): RawLyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split(/[\r\n]+/);
  const result: RawLyricLine[] = [];
  const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/g;

  for (const line of lines) {
    timeRegex.lastIndex = 0;
    const timestamps: number[] = [];
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const msVal = parseInt(msStr.padEnd(3, '0').substring(0, 3), 10);
      timestamps.push(min * 60 + sec + msVal / 1000);
    }
    const content = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim();
    if (content) {
      for (const t of timestamps) result.push({ time: t, text: content });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split(/[\r\n]+/);
  const list: LyricLine[] = [];
  const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/g;

  for (const line of lines) {
    timeRegex.lastIndex = 0;
    const timestamps: number[] = [];
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const msVal = parseInt(msStr.padEnd(3, '0').substring(0, 3), 10);
      timestamps.push(min * 60 + sec + msVal / 1000);
    }

    let text = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim();

    const enhancedWordRegex = /<(\d+):(\d+)(?:\.(\d+))?>([^<]*)/g;
    const words: any[] = [];
    let cleanText = text;

    if (text.includes('<')) {
      cleanText = text.replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
      let wordMatch;
      while ((wordMatch = enhancedWordRegex.exec(text)) !== null) {
        const wMin = parseInt(wordMatch[1], 10);
        const wSec = parseInt(wordMatch[2], 10);
        const wMsStr = wordMatch[3] || '0';
        const wMsVal = parseInt(wMsStr.padEnd(3, '0').substring(0, 3), 10);
        const wText = wordMatch[4].trim();
        if (wText) words.push({ text: wText, time: wMin * 60 + wSec + wMsVal / 1000, duration: 350 });
      }
    }

    if (cleanText && timestamps.length > 0) {
      for (const t of timestamps) {
        list.push({ time: t, text: cleanText, en: cleanText, cn: cleanText, words: words.length > 0 ? words : undefined, isPreciseTiming: words.length > 0 });
      }
    }
  }
  return list.sort((a, b) => a.time - b.time);
}

// ============ TTML 解析 ============

export function parseTtml(ttmlText: string): LyricLine[] {
  if (!ttmlText) return [];

  const list: LyricLine[] = [];
  const metaArr: string[] = [];
  const metaRegex = /<amll:meta\s+key="([^"]+)"\s+value="([^"]+)"\s*\/>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(ttmlText)) !== null) {
    metaArr.push(`${metaMatch[1]}: ${metaMatch[2]}`);
  }

  const pRegex = /<p\s+begin="([^"]+)"\s+end="([^"]+)"([^>]*)>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(ttmlText)) !== null) {
    const beginStr = pMatch[1];
    const endStr = pMatch[2];
    const attrs = pMatch[3];
    const rawContent = pMatch[4];

    const time = parseTimeToSeconds(beginStr);
    const endTime = parseTimeToSeconds(endStr);
    const isBackground = attrs.includes('role="background"') || attrs.includes('class="bg"') || attrs.includes('x-bg');
    let agent = '';
    const agentMatch = attrs.match(/agent="([^"]+)"/) || attrs.match(/role="([^"]+)"/) || attrs.match(/class="([^"]+)"/);
    if (agentMatch) agent = agentMatch[1];

    let align: 'left' | 'right' | undefined = undefined;
    if (agent === 'A' || agent.toLowerCase().includes('female') || agent.toLowerCase().includes('left')) align = 'left';
    else if (agent === 'B' || agent.toLowerCase().includes('male') || agent.toLowerCase().includes('right')) align = 'right';

    let lyricText = '';
    let translation = '';
    let romanization = '';
    const words: any[] = [];

    const spanRegex = /<span\s+begin="([^"]+)"\s+end="([^"]+)"([^>]*)>([\s\S]*?)<\/span>/gi;
    let spanMatch;
    const cleanRawContent = rawContent.replace(/<br\s*\/?>/gi, ' ');

    while ((spanMatch = spanRegex.exec(cleanRawContent)) !== null) {
      const spanBegin = spanMatch[1];
      const spanEnd = spanMatch[2];
      const spanAttrs = spanMatch[3];
      const spanText = spanMatch[4].replace(/<[^>]+>/g, '').trim();

      const sStart = parseTimeToSeconds(spanBegin);
      const sEnd = parseTimeToSeconds(spanEnd);
      const isTrans = spanAttrs.includes('translation') || spanAttrs.includes('x-translation');
      const isRoman = spanAttrs.includes('roman') || spanAttrs.includes('x-roman');

      if (isTrans) translation += (translation ? ' ' : '') + spanText;
      else if (isRoman) romanization += (romanization ? ' ' : '') + spanText;
      else {
        lyricText += (lyricText ? ' ' : '') + spanText;
        words.push({ text: spanText, time: sStart, duration: Math.round((sEnd - sStart) * 1000) });
      }
    }

    if (words.length === 0) {
      translation = (rawContent.match(/<span\s+(?:role|class)="translation"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
      romanization = (rawContent.match(/<span\s+(?:role|class)="romanization"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
      lyricText = rawContent.replace(/<span\s+(?:role|class)="translation"[^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/<span\s+(?:role|class)="romanization"[^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/<[^>]+>/g, '').trim();
    }

    if (lyricText) {
      list.push({
        time, endTime, text: lyricText, en: lyricText, cn: translation || lyricText,
        words: words.length > 0 ? words : undefined,
        translation: translation || undefined, romanization: romanization || undefined,
        isBackground, isPreciseTiming: words.length > 0,
        isDuet: align !== undefined || agent !== '', agent: agent || undefined, align,
      });
    }
  }

  const sorted = list.sort((a, b) => a.time - b.time);
  const finalWithInterludes: LyricLine[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const line = sorted[i];
    if (i > 0) {
      const prevLine = sorted[i - 1];
      const gap = line.time - (prevLine.endTime || prevLine.time);
      if (gap > 8) {
        finalWithInterludes.push({
          time: prevLine.endTime || (prevLine.time + 1), endTime: line.time,
          text: '\u25c7 \u25c7 \u25c7 \u95f4\u594f \u25c7 \u25c7 \u25c7',
          en: '\u25c7 \u25c7 \u25c7 Instrumental \u25c7 \u25c7 \u25c7',
          cn: '\u25c7 \u25c7 \u25c7 \u95f4\u594f \u25c7 \u25c7 \u25c7',
          isInterlude: true,
        });
      }
    }
    finalWithInterludes.push(line);
  }
  return finalWithInterludes;
}

// ============ YRC 解析 ============

export function parseNeteaseLyrics(yrcText: string, lrcText?: string): LyricLine[] {
  if (!yrcText) return [];
  const lines = yrcText.split(/[\r\n]+/);
  const results: LyricLine[] = [];
  const yrcLineRegex = /^\[(\d+)\s*,\s*(\d+)\](.*)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(yrcLineRegex);
    if (match) {
      const lineStart = parseInt(match[1], 10) / 1000;
      const lineDuration = parseInt(match[2], 10) / 1000;
      const remains = match[3];
      const wordRegex = /\((\d+),(\d+)(?:,\d+)?\)([^\(]*)/g;
      const words: any[] = [];
      let fullText = '';
      let wordMatch;
      while ((wordMatch = wordRegex.exec(remains)) !== null) {
        const rStartMs = parseInt(wordMatch[1], 10);
        const durationMs = Math.min(parseInt(wordMatch[2], 10), 10000);
        const text = wordMatch[3];
        words.push({ text, time: lineStart + rStartMs / 1000, duration: durationMs });
        fullText += text;
      }
      if (words.length > 0) {
        results.push({ time: lineStart, endTime: lineStart + lineDuration, text: fullText, en: fullText, cn: fullText, words, isPreciseTiming: true });
      }
    }
  }

  const sorted = results.sort((a, b) => a.time - b.time);
  if (lrcText && sorted.length > 0) {
    const lrcLines = parseLrc(lrcText);
    for (const line of sorted) {
      const matches = lrcLines.filter(l => Math.abs(l.time - line.time) < 2.0);
      if (matches.length > 0) {
        const hasChinese = (t: string) => /[\u4e00-\u9fa5]/.test(t);
        const best = matches.find(m => hasChinese(m.text)) || matches[0];
        line.translation = best.text;
        line.cn = best.text;
      }
    }
  }
  return sorted;
}

// ============ 歌词合并 ============

export function mergeLyrics(originalRaw: RawLyricLine[], translatedRaw: RawLyricLine[]): LyricLine[] {
  const result: LyricLine[] = [];
  const usedTrans = new Set<number>();
  const hasChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);

  for (const orig of originalRaw) {
    let matchIdx = -1;
    let minDiff = 1.0;
    for (let i = 0; i < translatedRaw.length; i++) {
      if (usedTrans.has(i)) continue;
      const diff = Math.abs(translatedRaw[i].time - orig.time);
      if (diff < minDiff) { minDiff = diff; matchIdx = i; }
    }
    if (matchIdx !== -1) {
      usedTrans.add(matchIdx);
      const transObj = translatedRaw[matchIdx];
      let enVal = orig.text, cnVal = transObj.text;
      if (hasChinese(orig.text) && !hasChinese(transObj.text)) { enVal = transObj.text; cnVal = orig.text; }
      else if (!hasChinese(orig.text) && hasChinese(transObj.text)) { enVal = orig.text; cnVal = transObj.text; }
      result.push({ time: orig.time, text: enVal, en: enVal, cn: cnVal, translation: cnVal });
    } else {
      result.push({ time: orig.time, text: orig.text, en: orig.text, cn: hasChinese(orig.text) ? orig.text : '' });
    }
  }
  if (result.length === 0 && originalRaw.length > 0) {
    return originalRaw.map(r => ({ time: r.time, text: r.text, en: r.text, cn: hasChinese(r.text) ? r.text : '' }));
  }
  return result.sort((a, b) => a.time - b.time);
}

// ============ 统一歌词解析路由 ============

export function parseLyrics(content: string | any, translationContent?: string, options?: any): LyricLine[] {
  if (!content) return [];

  let yrcContent = '', lrcContent = '', tlyricContent = '', ttmlContent = '';
  let parsedJson: any = null;

  if (typeof content === 'object' && content !== null) parsedJson = content;
  else if (typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
    try { parsedJson = JSON.parse(content); } catch (_) {}
  }

  if (parsedJson) {
    yrcContent = parsedJson.yrc?.lyric || '';
    lrcContent = parsedJson.lrc?.lyric || '';
    tlyricContent = parsedJson.tlyric?.lyric || '';
    ttmlContent = parsedJson.ttml || '';
  } else if (typeof content === 'string') {
    if (content.includes('<tt') || (content.includes('<p') && content.includes('begin='))) ttmlContent = content;
    else if (content.includes('[') && content.includes(']') && content.includes('(') && content.includes(',')) yrcContent = content;
    else lrcContent = content;
  }

  if (translationContent) {
    if (translationContent.includes('<tt') || (translationContent.includes('<p') && translationContent.includes('begin='))) ttmlContent = translationContent;
    else if (translationContent.includes('[') && translationContent.includes(']') && translationContent.includes('(') && translationContent.includes(',')) yrcContent = translationContent;
    else if (!lrcContent) lrcContent = translationContent;
    else tlyricContent = translationContent;
  }

  if (ttmlContent) return parseTtml(ttmlContent);
  if (yrcContent) return parseNeteaseLyrics(yrcContent, lrcContent || tlyricContent);

  const primary = parseLrc(lrcContent || yrcContent);
  if (!tlyricContent) return primary;

  const translation = parseLrc(tlyricContent);
  const rawOrig = primary.map(p => ({ time: p.time, text: p.text || p.en || '' }));
  const rawTrans = translation.map(t => ({ time: t.time, text: t.text || t.en || '' }));
  return mergeLyrics(rawOrig, rawTrans);
}

export function parseMultiFormatLyrics(rawOriginal: string | any, rawTranslated?: string, rawTtml?: string): LyricLine[] {
  if (rawTtml && (rawTtml.includes('<tt') || (rawTtml.includes('<p') && rawTtml.includes('begin=')))) {
    try { return parseTtml(rawTtml); } catch (e) { console.warn('Failed parsing raw TTML lyrics, falling back:', e); }
  }
  return parseLyrics(rawOriginal, rawTranslated);
}

// ============ 调色板生成 ============

export function getProceduralPaletteForSong(title: string, artist: string) {
  const safeTitle = title || '未知歌名';
  const safeArtist = artist || '未知歌手';
  const hash = Math.abs(
    safeTitle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) +
    safeArtist.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  );

  const hue1 = (hash * 17) % 360;
  const hue2 = (hash * 31 + 120) % 360;
  const hue3 = (hash * 47 + 240) % 360;

  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    h /= 360; s /= 100; l /= 100;
    let r: number, g: number, b: number;
    if (s === 0) { r = g = b = l; } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hue2rgb(h + 1 / 3); g = hue2rgb(h); b = hue2rgb(h - 1 / 3);
    }
    return [parseFloat(r.toFixed(3)), parseFloat(g.toFixed(3)), parseFloat(b.toFixed(3))];
  };

  return {
    blob0: hslToRgb(hue1, 85, 45), blob1: hslToRgb(hue2, 90, 40),
    blob2: hslToRgb(hue3, 85, 35), blob3: hslToRgb((hue1 + 180) % 360, 90, 50),
    blob4: hslToRgb((hue2 + 180) % 360, 80, 45),
  };
}

// ============ API 请求函数（纯前端 fetch + AllOrigins 兜底） ============

/**
 * 搜索歌曲 → localhost:3000/cloudsearch（GET）
 * 返回全部结果，服务端已处理上游限制（limit=100）
 */
export async function searchSongsOnCloud(query: string): Promise<any[]> {
  const url = `${BASE_URL}/cloudsearch?keywords=${encodeURIComponent(query)}&type=1`;
  const data = await fetchWithFallback(url);
  return (data && data.result && Array.isArray(data.result.songs)) ? data.result.songs : [];
}

/**
 * QQ音乐搜索 → localhost:3000/api/qq/search（多关键词变体合并，突破10条硬上限）
 */
export async function searchQQSongs(query: string): Promise<any[]> {
  const url = `${BASE_URL}/api/qq/search?keywords=${encodeURIComponent(query)}`;
  const data = await fetchWithFallback(url);
  return (data && data.result && Array.isArray(data.result.songs)) ? data.result.songs : [];
}

/**
 * QQ音乐获取单曲音频 URL → localhost:3000/api/qq/song/url（server.ts 代理转发 api.52vmy.cn，免注册免费）
 */
export async function fetchQQSongUrl(songName: string, mid?: string, n: string | number = '1'): Promise<any> {
  const midParam = mid ? `&mid=${encodeURIComponent(mid)}` : '';
  const url = `${BASE_URL}/api/qq/song/url?msg=${encodeURIComponent(songName)}&n=${n}${midParam}`;
  const data = await fetchWithFallback(url);
  const result = data?.data?.[0] || null;
  if (result && result.url && !/^https?:\/\//.test(result.url)) {
    result.url = '';
  }
  return result;
}

/**
 * 获取歌单全部歌曲 → localhost:3000/playlist/track/all
 */
export async function fetchPlaylistTracks(playlistId: string): Promise<any[]> {
  const url = `${BASE_URL}/playlist/track/all?id=${playlistId}&limit=50`;
  const data = await fetchWithFallback(url);
  if (data && Array.isArray(data.songs)) return data.songs;
  if (data && data.playlist && Array.isArray(data.playlist.tracks)) return data.playlist.tracks;
  if (data && Array.isArray(data)) return data;
  return [];
}

/**
 * 获取单曲详情 → localhost:3000/song/detail
 */
export async function fetchSongDetail(songId: string): Promise<any | null> {
  const url = `${BASE_URL}/song/detail?ids=${songId}`;
  const data = await fetchWithFallback(url);
  if (data && Array.isArray(data.songs) && data.songs.length > 0) {
    return data.songs[0];
  }
  return null;
}

/**
 * 多音源 fallback 解析音频直链
 *
 * Stage 1: POST localhost:3000/song/url/v1 (level=exhigh)
 * Stage 2: api.qijieya.cn/meting (netease, 返回 audio/mpeg 直链可用作 <audio> src)
 * Stage 3: zm.wwoyun.cn/song/url/v1 (GET, level=standard, 兜底)
 *
 * 所有路径均失败时返回空字符串，由前端展示原有错误提示。
 */
export async function resolveMetingAudioUrl(songId: string): Promise<string> {
  // Stage 1: 本地 API POST /song/url/v1 (exhigh)
  try {
    const params = new URLSearchParams({ id: songId, level: 'exhigh' });
    const resp = await fetch(`${BASE_URL}/song/url/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.data?.[0]?.url) return data.data[0].url;
    }
  } catch (e) {
    console.warn('Stage 1 (local API) failed:', e);
  }

  // Stage 2: api.qijieya.cn/meting 直链代理（返回 audio/mpeg 二进制）
  // 该 URL 可直接用作 <audio> src，无需二次解析
  const metingUrl = `https://api.qijieya.cn/meting/?type=url&id=${songId}&server=netease`;

  // Stage 3: zm.wwoyun.cn 外部代理兜底
  try {
    const data = await fetchWithFallback(
      `https://zm.wwoyun.cn/song/url/v1?id=${songId}&level=standard`
    );
    if (data?.data?.[0]?.url) return data.data[0].url;
  } catch (e) {
    console.warn('Stage 3 (zm.wwoyun.cn) failed:', e);
  }

  // 返回 meting 直链作为最后兜底
  return metingUrl;
}

/**
 * 并行获取歌词：TTML DB + localhost:3000/lyric，优先 TTML
 */
export async function fetchLyricsById(songId: string): Promise<LyricLine[]> {
  const results = await Promise.allSettled([
    fetchWithFallback(`${BASE_URL}/api/ttml/ncm/${songId}`, false),
    fetchWithFallback(`${BASE_URL}/lyric?id=${songId}`, true),
  ]);

  let ttmlText = '';
  let neteaseJson: any = null;

  if (results[0].status === 'fulfilled' && typeof results[0].value === 'string') {
    ttmlText = results[0].value;
  }
  if (results[1].status === 'fulfilled' && results[1].value) {
    neteaseJson = results[1].value;
  }

  // TTML 优先
  if (ttmlText && (ttmlText.includes('<tt') || (ttmlText.includes('<p') && ttmlText.includes('begin=')))) {
    try {
      const parsedTtml = parseTtml(ttmlText);
      if (parsedTtml.length > 0) {
        // 如果有翻译歌词，注入 translations
        const translationText = neteaseJson?.tlyric?.lyric || '';
        if (translationText) {
          const transLines = parseLrc(translationText);
          for (const line of parsedTtml) {
            const match = transLines.find(tl => Math.abs(tl.time - line.time) < 2.0);
            if (match) { line.translation = match.text; line.cn = match.text; }
          }
        }
        return parsedTtml;
      }
    } catch (e) {
      console.warn('Failed parsing TTML, falling back to Netease:', e);
    }
  }

  // 网易云歌词兜底
  if (neteaseJson) {
    const lrcs = parseLyrics(neteaseJson);
    if (lrcs && lrcs.length > 0) return lrcs;
  }

  const rawLrc = neteaseJson?.lrc?.lyric || '';
  const rawTLrc = neteaseJson?.tlyric?.lyric || '';
  if (rawLrc) return parseLyrics(rawLrc, rawTLrc);

  return [];
}

/**
 * 按 QQ音乐 mid 获取歌词 → localhost:3000/api/qq/lyric
 */
export async function fetchQQLyrics(mid: string): Promise<LyricLine[]> {
  try {
    const url = `${BASE_URL}/api/qq/lyric?mid=${encodeURIComponent(mid)}`;
    const data = await fetchWithFallback(url);
    const lyricText = data?.lyric || '';
    if (!lyricText) return [];
    return parseLrc(lyricText);
  } catch (err) {
    console.warn(`[QQ Lyric] Failed to fetch lyric for mid=${mid}:`, err);
    return [];
  }
}

/**
 * 按歌名+歌手搜索并匹配歌词
 * 多轮查询策略：完整匹配 → 歌名匹配 → 歌名+歌手简化匹配
 */
export async function searchAndMatchLyrics(title: string, artist: string): Promise<LyricLine[]> {
  // 清理多余空格和特殊字符
  const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanArtist = artist.replace(/\s+/g, ' ').trim();

  const queries = [
    `${cleanTitle} ${cleanArtist}`,           // 歌名 + 歌手
    cleanTitle,                                  // 仅歌名
    `${cleanTitle} ${cleanArtist.split(' ')[0]}` // 歌名 + 第一位歌手
  ];

  for (const query of queries) {
    try {
      console.log(`[Lyrics Match] Trying query: "${query}"`);
      const songs = await searchSongsOnCloud(query);
      if (songs && songs.length > 0) {
        // 优先选择歌手名匹配的结果
        let bestMatch = songs[0];
        for (const song of songs) {
          const songArtists = (song.ar || []).map((a: any) => a.name).join(' ');
          if (songArtists.toLowerCase().includes(cleanArtist.toLowerCase().replace(/\s+/g, ''))) {
            bestMatch = song;
            break;
          }
        }
        const songId = String(bestMatch.id);
        console.log(`[Lyrics Match] Best match: ${bestMatch.name} - ${(bestMatch.ar || []).map((a: any) => a.name).join('/')} (id=${songId})`);
        const lyrics = await fetchLyricsById(songId);
        if (lyrics && lyrics.length > 0) return lyrics;
        console.warn(`[Lyrics Match] Matched song has no lyrics, trying next query...`);
      }
    } catch (err) {
      console.warn(`[Lyrics Match] Query "${query}" failed:`, err);
    }
  }

  console.warn(`[Lyrics Match] All queries exhausted for "${title}" - "${artist}"`);
  return [];
}

// ============ Song 构造 ============

/**
 * 将网易云原始数据映射为应用 Song 对象。
 * audioUrl 设为本地 API 地址，调用方需在播放前通过 resolveMetingAudioUrl 多音源 fallback 解析为真实直链。
 */
export function mapNeteaseSongToAppSong(neteaseSong: any): Song {
  const neteaseId = String(neteaseSong.id);
  const title = neteaseSong.name || neteaseSong.title || '未知歌名';
  const artist = Array.isArray(neteaseSong.ar)
    ? neteaseSong.ar.map((a: any) => a.name).join(' / ')
    : (neteaseSong.artist || neteaseSong.author || '未知歌手');
  const coverUrl = (neteaseSong.al?.picUrl) || neteaseSong.pic || neteaseSong.cover ||
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80';
  const album = neteaseSong.al?.name || neteaseSong.album || '单曲';

  let duration = '4:00';
  let durationSeconds = 240;
  if (neteaseSong.dt) {
    durationSeconds = Math.round(neteaseSong.dt / 1000);
    const m = Math.floor(durationSeconds / 60);
    const s = durationSeconds % 60;
    duration = `${m}:${String(s).padStart(2, '0')}`;
  }

  const palette = getProceduralPaletteForSong(title, artist);

  // 使用本地 API 作为音频源（需 resolveMetingAudioUrl 多音源 fallback 解析）
  const metingUrl = `${BASE_URL}/song/url/v1?id=${neteaseId}&level=exhigh`;

  return {
    id: `netease-${neteaseId}`,
    title,
    artist,
    album,
    coverUrl,
    audioUrl: metingUrl,
    fileUrl: metingUrl,
    duration,
    durationSeconds,
    lyrics: [],
    palette,
    accentColor: '#ea580c',
    source: 'remote',
    isNetease: true,
    neteaseId,
    needsLyricsMatch: true,
  };
}

/**
 * 将QQ音乐原始数据映射为应用 Song 对象。
 */
export function mapQQSongToAppSong(qqSong: any): Song {
  const mid = qqSong.mid || '';
  const qqId = `qq-${mid}`;
  const title = qqSong.name || qqSong.title || '未知歌名';
  const artist = Array.isArray(qqSong.ar)
    ? qqSong.ar.map((a: any) => a.name).join(' / ')
    : (Array.isArray(qqSong.artists) ? qqSong.artists.join(' / ') : (qqSong.singer || '未知歌手'));
  // 封面：QQ歌曲走 /api/qq/cover 代理（songmid→albummid→y.gtimg.cn+Referer），网易云歌曲直连
  let coverUrl = '';
  if (mid) {
    coverUrl = `${BASE_URL}/api/qq/cover?mid=${mid}`;
  } else {
    coverUrl = (qqSong.al?.picUrl) || qqSong.pic || qqSong.cover ||
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80';
  }
  const album = qqSong.al?.name || qqSong.album || '单曲';

  let duration = '4:00';
  let durationSeconds = 240;
  if (qqSong.dt) {
    durationSeconds = Math.round(qqSong.dt / 1000);
    const m = Math.floor(durationSeconds / 60);
    const s = durationSeconds % 60;
    duration = `${m}:${String(s).padStart(2, '0')}`;
  }

  const palette = getProceduralPaletteForSong(title, artist);

  // QQ音乐音频源：通过本地流媒体代理 /api/qq/stream 兜底，避免 NotSupportedError
  const audioUrl = mid ? `${BASE_URL}/api/qq/stream?mid=${mid}` : '';

  return {
    id: qqId,
    title,
    artist,
    album,
    coverUrl,
    audioUrl,
    fileUrl: audioUrl,
    duration,
    durationSeconds,
    lyrics: [],
    palette,
    accentColor: '#ea580c',
    source: 'remote',
    isNetease: false,
    neteaseId: undefined,
    needsLyricsMatch: true,
    qqSongName: qqSong.name || title,
    qqMid: mid,
  };
}
