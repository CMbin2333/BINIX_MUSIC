export interface LyricWord {
  text: string;
  time: number;       // relative or absolute offset
  duration: number;   // in ms
}

export interface LyricLine {
  time: number; // in seconds
  en: string;   // Maps to text (backward compatibility)
  cn: string;   // Maps to translation (backward compatibility)
  
  // Advanced fields as specified by user
  endTime?: number;       // 结束时间（秒）
  text?: string;          // 歌词文本
  words?: LyricWord[];    // 逐字时间信息
  translation?: string;   // 翻译
  romanization?: string;  // 罗马音
  isInterlude?: boolean;  // 间奏标记
  isBackground?: boolean; // 和声/背景轨
  isPreciseTiming?: boolean; // 是否精确逐字时间
  key?: string;           // TTML key（用于对唱匹配）
  isDuet?: boolean;       // 对唱标记
  agent?: string;         // 对唱角色
  align?: "left" | "right"; // 对唱对齐
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  duration: string; // "3:38"
  durationSeconds: number; // 218
  lyrics: LyricLine[];
  palette: {
    blob0: [number, number, number];
    blob1: [number, number, number];
    blob2: [number, number, number];
    blob3: [number, number, number];
    blob4: [number, number, number];
  };
  accentColor: string; // e.g., '#c41224'
  
  // Custom properties for remote NetEase integration
  source?: string; // "remote"
  isNetease?: boolean;
  fileUrl?: string;
  neteaseId?: string;
  qqSongName?: string; // QQ音乐原始歌名，用于通过歌名动态获取播放URL
  qqMid?: string; // QQ音乐歌曲mid，用于版权歌曲fallback解析
  needsLyricsMatch?: boolean; // flag indicating that lyrics should be retrieved dynamically at playback time
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
}
