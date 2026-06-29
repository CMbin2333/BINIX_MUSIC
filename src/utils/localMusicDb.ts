import { get, set, del } from 'idb-keyval';
import { Song } from '../types';

const DEFAULT_COVER_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1"/>
        <stop offset="50%" style="stop-color:#0d9488;stop-opacity:1"/>
        <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#bg)"/>
    <circle cx="200" cy="200" r="80" fill="none" stroke="white" stroke-width="3" stroke-opacity="0.3"/>
    <circle cx="200" cy="200" r="20" fill="white" fill-opacity="0.15"/>
    <g transform="translate(200,140)" fill="white" fill-opacity="0.6">
      <path d="M0,0 C-20,40 -30,60 -30,75 C-30,95 -15,110 0,110 C15,110 30,95 30,75 C30,60 20,40 0,0Z"/>
    </g>
    <line x1="30" y1="185" x2="30" y2="275" stroke="white" stroke-width="8" stroke-linecap="round" stroke-opacity="0.6"/>
    <line x1="30" y1="275" x2="30" y2="275" stroke="white" stroke-width="8" stroke-linecap="round" stroke-opacity="0.3"/>
    <rect x="8" y="270" width="44" height="10" rx="3" fill="white" fill-opacity="0.25"/>
    <text x="200" y="350" text-anchor="middle" fill="white" fill-opacity="0.35" font-family="system-ui,sans-serif" font-size="16" font-weight="bold">本地音乐</text>
  </svg>`
)}`;

export async function storeLocalAudio(songId: string, audioBuffer: ArrayBuffer): Promise<void> {
  await set(`local_audio_${songId}`, audioBuffer);
}

export async function storeLocalCover(songId: string, coverBuffer: ArrayBuffer): Promise<void> {
  await set(`local_cover_${songId}`, coverBuffer);
}

function createAudioBlobUrl(songId: string, audioBuffer: ArrayBuffer): string {
  const blob = new Blob([audioBuffer]);
  return URL.createObjectURL(blob);
}

function createCoverBlobUrl(songId: string, coverBuffer: ArrayBuffer): string {
  const blob = new Blob([coverBuffer]);
  return URL.createObjectURL(blob);
}

export async function loadLocalSongUrls(song: Song): Promise<Song> {
  if (song.source !== 'local') return song;

  const audioBuffer = await get<ArrayBuffer>(`local_audio_${song.id}`);
  if (!audioBuffer) {
    console.warn(`Missing audio data for local song ${song.id}, removing from playlist`);
    return song; // caller should handle removal
  }

  const audioUrl = createAudioBlobUrl(song.id, audioBuffer);

  let coverUrl = DEFAULT_COVER_SVG;
  const coverBuffer = await get<ArrayBuffer>(`local_cover_${song.id}`);
  if (coverBuffer) {
    coverUrl = createCoverBlobUrl(song.id, coverBuffer);
  }

  return { ...song, audioUrl, coverUrl };
}

export async function buildLocalSongEntry(
  songId: string,
  audioBuffer: ArrayBuffer,
  metadata: {
    title: string;
    artist: string;
    album: string;
    durationSeconds: number;
    duration: string;
  },
  coverBuffer?: ArrayBuffer
): Promise<Song> {
  await storeLocalAudio(songId, audioBuffer);
  if (coverBuffer) {
    await storeLocalCover(songId, coverBuffer);
  }

  const audioUrl = createAudioBlobUrl(songId, audioBuffer);
  const coverUrl = coverBuffer ? createCoverBlobUrl(songId, coverBuffer) : DEFAULT_COVER_SVG;

  const song: Song = {
    id: songId,
    title: metadata.title || '未知歌曲',
    artist: metadata.artist || '未知艺术家',
    album: metadata.album || '未知专辑',
    coverUrl,
    audioUrl,
    duration: metadata.duration,
    durationSeconds: metadata.durationSeconds,
    lyrics: [],
    palette: {
      blob0: [30 / 255, 58 / 255, 138 / 255],
      blob1: [13 / 255, 148 / 255, 136 / 255],
      blob2: [59 / 255, 130 / 255, 246 / 255],
      blob3: [30 / 255, 58 / 255, 138 / 255],
      blob4: [13 / 255, 148 / 255, 136 / 255],
    },
    accentColor: '#1e3a8a',
    source: 'local',
  };

  return song;
}

export async function deleteLocalSong(songId: string): Promise<void> {
  try {
    await Promise.all([
      del(`local_audio_${songId}`),
      del(`local_cover_${songId}`),
    ]);
  } catch (err) {
    console.warn('Failed to delete local song data:', err);
  }
}

export function generateLocalSongId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export { DEFAULT_COVER_SVG };
