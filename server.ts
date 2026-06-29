import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 19876;

  // Logger Middleware
  app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`);
    next();
  });

  // Body parsing middleware for POST routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Route for Meting API proxy - resolves CORS and HTTP/HTTPS issues
  app.get("/api/meting", async (req, res) => {
    const { server, type, id } = req.query;
    if (!server || !type || !id) {
      return res.status(400).json({ error: "Missing required parameters: server, type, id" });
    }

    const METING_ENDPOINTS = [
      'https://metingapi.nanorocky.top/',
      'https://api.qijieya.cn/meting/',
      'https://music.3e0.cn/'
    ];

    if (type === "url") {
      const getTargetStream = async (targetUrl: string) => {
        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://music.163.com"
        };
        if (req.headers.range) {
          headers["Range"] = req.headers.range as string;
        }

        const streamResponse = await fetch(targetUrl, {
          headers,
          redirect: "follow"
        });

        if (!streamResponse.ok && streamResponse.status !== 206) {
          throw new Error(`Upstream returned status ${streamResponse.status}`);
        }

        // Reject HTML responses (NetEase now redirects invalid audio URLs to /404)
        const contentType = streamResponse.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error(`Upstream returned HTML instead of audio (likely 404 redirect)`);
        }

        return streamResponse;
      };

      const handleStream = async (targetUrl: string): Promise<boolean> => {
        try {
          console.log(`[Proxy URL Stream] Direct fetch with Range: ${targetUrl}`);
          const streamResponse = await getTargetStream(targetUrl);
          
          res.status(streamResponse.status);
          const copyHeaders = [
            'content-type',
            'content-length',
            'content-range',
            'accept-ranges',
            'cache-control'
          ];
          for (const h of copyHeaders) {
            const val = streamResponse.headers.get(h);
            if (val) {
              res.setHeader(h, val);
            }
          }

          if (streamResponse.body) {
            const { Readable } = await import('stream');
            const nodeStream = Readable.fromWeb(streamResponse.body as any);
            nodeStream.pipe(res);
            
            // Handle client abort gracefully
            req.on('close', () => {
              nodeStream.destroy();
            });
            return true;
          }
          return false;
        } catch (streamErr: any) {
          console.error(`[Proxy stream failed for URL ${targetUrl}]:`, streamErr.message);
          return false;
        }
      };

      // 1. Try high-reliability direct NetEase stream
      if (server === 'netease') {
        const directUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
        const success = await handleStream(directUrl);
        if (success) return;
      }

      // 1.5 Try api.qijieya.cn proxy (Meting public mirror) for Netease audio
      if (server === 'netease') {
        try {
          const qiJieUrl = `https://api.qijieya.cn/meting/?type=url&id=${id}`;
          console.log(`[Proxy URL] Trying api.qijieya.cn: ${qiJieUrl}`);
          const qiJieResponse = await fetch(qiJieUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
          });
          if (qiJieResponse.ok) {
            const data = await qiJieResponse.json();
            if (data && data.url) {
              const success = await handleStream(data.url);
              if (success) return;
            }
          }
        } catch (qiJieErr: any) {
          console.error('[Proxy URL] api.qijieya.cn failed:', qiJieErr.message);
        }
      }

      // 2. Fall back to search Meting endpoints for other urls or alternate gateways
      for (const endpoint of METING_ENDPOINTS) {
        try {
          const targetUrl = `${endpoint}?server=${server}&type=url&id=${id}`;
          console.log(`[Proxy URL Fallback Endpoint] Querying: ${targetUrl}`);
          
          const response = await fetch(targetUrl, {
            redirect: "manual",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Referer": "https://y.qq.com/",
            }
          });

          let resolvedUrl: string | null = null;
          if (response.status >= 300 && response.status < 400) {
            resolvedUrl = response.headers.get("location");
          } else if (response.ok) {
            const contentType = response.headers.get("content-type") || "";
            if (contentType.startsWith("audio/")) {
              console.log(`[Proxy URL Raw Audio] Streaming directly from: ${endpoint}`);
              const headers: Record<string, string> = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://music.163.com"
              };
              if (req.headers.range) headers["Range"] = req.headers.range as string;
              const audioStream = await fetch(targetUrl, { headers, redirect: "follow" });
              res.status(audioStream.status);
              for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
                const val = audioStream.headers.get(h);
                if (val) res.setHeader(h, val);
              }
              if (audioStream.body) {
                const { Readable } = await import('stream');
                const nodeStream = Readable.fromWeb(audioStream.body as any);
                nodeStream.pipe(res);
                req.on('close', () => nodeStream.destroy());
                return;
              }
            }
            const text = await response.text();
            try {
              const parsed = JSON.parse(text);
              if (parsed && parsed.url) {
                resolvedUrl = parsed.url;
              }
            } catch (_) {
              if (text && text.trim().startsWith("http")) {
                resolvedUrl = text.trim();
              }
            }
          }

          if (resolvedUrl) {
            console.log(`[Proxy URL Standard Endpoint Resolved] Found stream URL: ${resolvedUrl}`);
            const success = await handleStream(resolvedUrl);
            if (success) return;
          }
        } catch (err: any) {
          console.error(`[Proxy URL Error] Endpoint ${endpoint} failed:`, err.message);
        }
      }

      // 3. Final raw fallback for NetEase
      if (server === 'netease') {
        const directUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
        const success = await handleStream(directUrl);
        if (success) return;
      }

      return res.status(404).send("Audio source not found or could not be streamed.");
    }

    // search / lrc proxy routing fallback (unified through METING_ENDPOINTS)
    let lastError = null;
    for (const endpoint of METING_ENDPOINTS) {
      try {
        const targetUrl = `${endpoint}?server=${server}&type=${type}&id=${encodeURIComponent(id as string)}`;
        console.log(`[Proxy Request] Target: ${targetUrl}`);

        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://y.qq.com/",
          }
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await response.json();
            return res.json(data);
          } else {
            const text = await response.text();
            // Try to parse json just in case headers are set incorrectly but content is JSON
            try {
              const parsed = JSON.parse(text);
              return res.json(parsed);
            } catch (_) {
              return res.send(text);
            }
          }
        }
      } catch (err: any) {
        console.error(`[Proxy Error] Endpoint ${endpoint} failed:`, err.message);
        lastError = err;
      }
    }

    res.status(502).json({
      error: "All music gateways are busy, please try again or switch song source.",
      details: lastError?.message || "Unknown upstream response"
    });
  });

  // ============ QQ Music Proxy Route ============

  // GET /api/qq/search → QQ音乐搜索（调用酪灰 Meting API，多关键词变体合并）
  app.get("/api/qq/search", async (req, res) => {
    try {
      const keywords = req.query.keywords as string;
      if (!keywords) return res.status(400).json({ error: "Missing keywords" });

      const METING_SEARCH_BASE = 'https://metingapi.nanorocky.top/';

      // 生成 8 个搜索变体
      const queryVariants = [
        keywords,
        `${keywords} 新歌`,
        `${keywords} 演唱会`,
        `${keywords} 经典`,
        `${keywords} 热门`,
        `${keywords} 成名曲`,
        `${keywords} 翻唱`,
        `${keywords} 现场版`,
      ];

      const allItems: any[] = [];
      const seenMids = new Set<string>();

      for (const q of queryVariants) {
        const url = `${METING_SEARCH_BASE}?server=tencent&type=search&id=0&keyword=${encodeURIComponent(q)}`;
        console.log(`[QQ Search] Variant "${q}": ${url}`);

        try {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }
          });
          if (!response.ok) {
            console.warn(`[QQ Search] Variant "${q}" HTTP ${response.status}, skipping`);
            continue;
          }
          const raw = await response.json();
          if (!Array.isArray(raw)) continue;

          let added = 0;
          for (const item of raw) {
            // 从 url 字段提取 mid: ?server=tencent&type=url&id=MID
            const midMatch = item.url?.match(/[?&]id=([^&]+)/);
            const mid = midMatch ? midMatch[1] : '';
            if (!mid || seenMids.has(mid)) continue;
            seenMids.add(mid);
            allItems.push(item);
            added++;
          }
          console.log(`[QQ Search] Variant "${q}": got ${raw.length}, new ${added} (total ${allItems.length})`);
        } catch (e: any) {
          console.warn(`[QQ Search] Variant "${q}" fetch error: ${e.message}`);
        }

        if (allItems.length >= 80) break;
      }

      // 映射为 Netease-compatible 格式
      const songs = allItems.map((item: any) => {
        const midMatch = item.url?.match(/[?&]id=([^&]+)/);
        const mid = midMatch ? midMatch[1] : '';
        return {
          id: `qq-${mid}`,
          name: item.name || '',
          ar: [{ name: item.artist || '未知歌手' }],
          artists: item.artist ? item.artist.split('/').map((s: string) => s.trim()) : ['未知歌手'],
          al: {
            name: item.album || '',
            picUrl: mid ? `/api/qq/cover?mid=${mid}` : ''
          },
          dt: (item.duration || 240) * 1000,
          source: 'qq',
          mid,
        };
      });

      console.log(`[QQ Search] Final: ${songs.length} results for "${keywords}"`);
      res.json({ result: { songs } });
    } catch (err: any) {
      console.error(`[QQ Search Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // GET /api/qq/song/url → QQ音乐单曲音频/详情（调用酪灰 Meting API）
  app.get("/api/qq/song/url", async (req, res) => {
    try {
      const mid = req.query.mid as string;
      const msg = req.query.msg as string;
      if (!mid && !msg) return res.status(400).json({ error: "Missing mid or msg" });

      const METING_URL_BASE = 'https://metingapi.nanorocky.top/';
      let resolvedMid = mid || '';

      // 若只有 msg 无 mid，先搜一次酪灰搜索获取 mid
      if (!resolvedMid && msg) {
        try {
          const searchUrl = `${METING_URL_BASE}?server=tencent&type=search&id=0&keyword=${encodeURIComponent(msg)}`;
          console.log(`[QQ Song URL] Searching for mid by msg "${msg}": ${searchUrl}`);
          const searchResp = await fetch(searchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }
          });
          if (searchResp.ok) {
            const results = await searchResp.json();
            if (Array.isArray(results) && results.length > 0) {
              const midMatch = results[0].url?.match(/[?&]id=([^&]+)/);
              resolvedMid = midMatch ? midMatch[1] : '';
              console.log(`[QQ Song URL] Resolved msg="${msg}" → mid="${resolvedMid}"`);
            }
          }
        } catch (e: any) {
          console.warn(`[QQ Song URL] Search by msg failed: ${e.message}`);
        }
      }

      if (!resolvedMid) {
        return res.status(404).json({ error: "Song not found" });
      }

      const audioUrl = `${METING_URL_BASE}?server=tencent&type=url&id=${resolvedMid}&br=320`;
      console.log(`[QQ Song URL] Audio URL for mid=${resolvedMid}: ${audioUrl}`);

      res.json({
        data: [{
          id: resolvedMid,
          url: audioUrl,
          song: msg || '',
          singer: '',
          picture: '',
        }]
      });
    } catch (err: any) {
      console.error(`[QQ Song URL Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // GET /api/qq/cover → QQ音乐封面代理
  // Step 1: 用 songmid 调 QQ 官方 API 获取 albummid（带缓存）
  // Step 2: 用 albummid 拼接 y.gtimg.cn CDN 封面 URL，带 Referer 绕过防盗链
  const coverCache = new Map<string, string>();

  app.get("/api/qq/cover", async (req, res) => {
    try {
      const mid = req.query.mid as string;
      if (!mid) return res.status(400).json({ error: "Missing mid" });

      // Step 1: 获取 albummid（songmid → QQ 官方 API → albummid）
      let albummid = coverCache.get(mid) || '';
      if (!albummid) {
        try {
          const detailUrl = `https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=${encodeURIComponent(mid)}&platform=yqq&format=json`;
          const detailResp = await fetch(detailUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          });
          const detailData = await detailResp.json();
          albummid = detailData?.data?.[0]?.album?.mid || '';
          if (albummid) {
            coverCache.set(mid, albummid);
            console.log(`[QQ Cover] Resolved songmid=${mid} → albummid=${albummid}`);
          } else {
            console.warn(`[QQ Cover] albummid not found in response for songmid=${mid}`);
          }
        } catch (e: any) {
          console.warn(`[QQ Cover] Failed to resolve albummid for mid=${mid}:`, e.message);
        }
      } else {
        console.log(`[QQ Cover] Cache hit for mid=${mid}`);
      }

      if (!albummid) {
        return res.status(404).json({ error: "Album cover not found" });
      }

      // Step 2: 拼接封面 URL 并代理获取（带 Referer 绕过防盗链）
      const coverUrl = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`;
      const response = await fetch(coverUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://y.qq.com/"
        }
      });

      if (!response.ok) {
        console.warn(`[QQ Cover] HTTP ${response.status} for ${coverUrl}`);
        return res.status(404).json({ error: "Cover fetch failed" });
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/jpeg";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error(`[QQ Cover Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // GET /api/qq/lyric → QQ音乐歌词代理
  app.get("/api/qq/lyric", async (req, res) => {
    try {
      const mid = req.query.mid as string;
      if (!mid) return res.status(400).json({ error: "Missing mid" });

      const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${mid}&format=json`;
      console.log(`[QQ Lyric] Fetching: ${url}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://y.qq.com/"
        }
      });

      if (!response.ok) {
        console.warn(`[QQ Lyric] HTTP ${response.status} for mid=${mid}`);
        return res.status(502).json({ error: "Lyric fetch failed" });
      }

      const data = await response.json();
      const lyricB64 = data?.lyric || data?.data?.lyric || '';
      if (!lyricB64) {
        return res.status(404).json({ error: "No lyric found" });
      }

      const lyricText = Buffer.from(lyricB64, 'base64').toString('utf-8');
      res.set("Cache-Control", "public, max-age=86400");
      res.json({ lyric: lyricText });
    } catch (err: any) {
      console.error(`[QQ Lyric Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // GET /api/qq/stream → QQ音乐音频流代理（直接可用作 <audio> src）
  app.get("/api/qq/stream", async (req, res) => {
    try {
      const mid = req.query.mid as string;
      if (!mid) return res.status(400).json({ error: "Missing mid" });

      // Step 1: 通过 api.52vmy.cn 获取播放直链
      const apiUrl = `${QQ_MUSIC_BASE}?msg=${encodeURIComponent(mid)}&n=1&type=json`;
      console.log(`[QQ Stream] Resolving URL from: ${apiUrl}`);
      const apiResp = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
      });
      if (!apiResp.ok) {
        return res.status(502).json({ error: `QQ API returned HTTP ${apiResp.status}` });
      }
      const raw = await apiResp.json();
      let audioUrl = raw?.data?.[0]?.url || raw?.data?.url || '';
      if (!audioUrl || !/^https?:\/\//.test(audioUrl)) {
        // Fallback: music.3e0.cn Meting API
        if (mid) {
          audioUrl = `https://music.3e0.cn/?type=url&id=${encodeURIComponent(mid)}&server=tencent`;
          console.log(`[QQ Stream] Fallback to music.3e0.cn: ${audioUrl}`);
        } else {
          return res.status(404).json({ error: "No playable audio URL found" });
        }
      }

      console.log(`[QQ Stream] Streaming from: ${audioUrl}`);

      // Step 2: 流式转发音频内容（pipe）
      const audioResp = await fetch(audioUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://y.qq.com/"
        },
        redirect: "follow"
      });

      if (!audioResp.ok && audioResp.status !== 206) {
        return res.status(502).json({ error: `Audio upstream returned HTTP ${audioResp.status}` });
      }

      const contentType = audioResp.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        return res.status(404).json({ error: "Audio source returned HTML (likely not playable)" });
      }

      res.status(audioResp.status);
      const copyHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
      for (const h of copyHeaders) {
        const val = audioResp.headers.get(h);
        if (val) res.setHeader(h, val);
      }

      if (audioResp.body) {
        const { Readable } = await import('stream');
        const nodeStream = Readable.fromWeb(audioResp.body as any);
        nodeStream.pipe(res);
        req.on('close', () => nodeStream.destroy());
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error(`[QQ Stream Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // ============ Qijieya Proxy Routes (forwarded from frontend musicApi.ts) ============

  const QIJIEYA_BASE = 'https://api.qijieya.cn/meting/';

  // Extract song id from url or lrc field (e.g. "xxx?id=123456")
  function extractId(raw: string): string {
    if (!raw) return '';
    const m = raw.match(/id=(\d+)/);
    return m ? m[1] : '';
  }

  async function fetchQijieya(params: Record<string, string>): Promise<any> {
    const url = new URL(QIJIEYA_BASE);
    url.searchParams.set('server', 'netease');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    console.log(`[Qijieya Proxy] Fetching: ${url.toString()}`);
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://music.163.com"
      }
    });
    if (!response.ok) throw new Error(`qijieya returned HTTP ${response.status}`);
    return response.json();
  }

  async function fetchQijieyaText(params: Record<string, string>): Promise<string> {
    const url = new URL(QIJIEYA_BASE);
    url.searchParams.set('server', 'netease');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    console.log(`[Qijieya Proxy Text] Fetching: ${url.toString()}`);
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://music.163.com"
      }
    });
    if (!response.ok) throw new Error(`qijieya returned HTTP ${response.status}`);
    return response.text();
  }

  // Shared mapper: qijieya raw item → Netease-compatible song object
  function mapQijieyaItem(item: any) {
    const artist = item.artist || '';
    return {
      id: extractId(item.url || item.lrc || ''),
      name: item.name || '',
      ar: artist ? artist.split(' / ').map((a: string) => ({ name: a.trim() })) : [{ name: '未知歌手' }],
      artists: artist ? artist.split(' / ').map((a: string) => a.trim()) : ['未知歌手'],
      al: { name: '', picUrl: item.pic || '' },
      dt: 240000,
      url: item.url || '',
    };
  }

  // 1. GET /cloudsearch → 网易云搜索（limit=100，突破默认30条限制）
  app.get("/cloudsearch", async (req, res) => {
    try {
      const keywords = req.query.keywords as string;
      if (!keywords) return res.status(400).json({ error: "Missing keywords" });
      const raw = await fetchQijieya({ type: 'search', id: keywords, limit: '100' });
      const songs = (Array.isArray(raw) ? raw : []).map(mapQijieyaItem);
      console.log(`[Cloudsearch] Returned ${songs.length} results for "${keywords}"`);
      res.json({ result: { songs } });
    } catch (err: any) {
      console.error(`[Cloudsearch Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // 2. GET /playlist/track/all → wrap into { songs: [...] }
  app.get("/playlist/track/all", async (req, res) => {
    try {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: "Missing id" });
      const raw = await fetchQijieya({ type: 'playlist', id });
      let songs: any[] = [];
      if (Array.isArray(raw)) {
        songs = raw;
      } else if (raw?.playlist?.tracks) {
        songs = raw.playlist.tracks;
      } else if (raw?.tracks) {
        songs = raw.tracks;
      } else if (raw?.songs) {
        songs = raw.songs;
      }
      const mapped = songs.map(mapQijieyaItem);
      console.log(`[Playlist] Returned ${mapped.length} tracks for playlist ${id}`);
      res.json({ songs: mapped });
    } catch (err: any) {
      console.error(`[Playlist Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // 3. GET /song/detail → wrap into { songs: [{...}] }
  app.get("/song/detail", async (req, res) => {
    try {
      const ids = req.query.ids as string;
      if (!ids) return res.status(400).json({ error: "Missing ids" });
      const raw = await fetchQijieya({ type: 'song', id: ids });
      let songs: any[] = [];
      if (Array.isArray(raw)) {
        songs = raw;
      } else if (raw?.songs) {
        songs = raw.songs;
      } else {
        songs = [raw];
      }
      const mapped = songs.map(mapQijieyaItem);
      console.log(`[Song Detail] Returned ${mapped.length} songs for ids=${ids}`);
      res.json({ songs: mapped });
    } catch (err: any) {
      console.error(`[Song Detail Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // 4. GET /lyric → parses NetEase lyrics, prefers direct API (full JSON with yrc/klyric/tlyric)
  //               falls back to qijieya plain-text LRC if direct API fails
  app.get("/lyric", async (req, res) => {
    try {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: "Missing id" });

      // Try NetEase original API first — returns full JSON including yrc/klyric/tlyric
      // when available, enabling precise word-by-word highlighting
      try {
        const neteaseUrl = `https://music.163.com/api/song/lyric?id=${id}&lv=-1&tv=-1&kv=-1`;
        console.log(`[Lyric] Trying NetEase direct API for song ${id}`);
        const neteaseResp = await fetch(neteaseUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://music.163.com/",
            "Accept": "application/json"
          }
        });
        if (neteaseResp.ok) {
          const data = await neteaseResp.json();
          // NetEase returns { lrc, yrc?, klyric?, tlyric?, ... }
          // Even if yrc is empty now, returning full JSON enables future YRC availability
          if (data.lrc && data.lrc.lyric) {
            console.log(`[Lyric] NetEase direct API success for song ${id} (keys: ${Object.keys(data).join(',')})`);
            res.json(data);
            return;
          }
        }
      } catch (directErr: any) {
        console.warn(`[Lyric] NetEase direct API failed for song ${id}: ${directErr.message}, falling back to qijieya`);
      }

      // Fallback to qijieya
      const text = await fetchQijieyaText({ type: 'lrc', id });
      console.log(`[Lyric] Fetched lyrics via qijieya for song ${id} (${text.length} chars)`);
      res.json({ lrc: { lyric: text } });
    } catch (err: any) {
      console.error(`[Lyric Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // 5. POST /song/url/v1 → construct qijieya URL directly (url type returns audio/mpeg binary)
  app.post("/song/url/v1", async (req, res) => {
    try {
      const id = req.body?.id || req.query.id as string;
      if (!id) return res.status(400).json({ error: "Missing id" });
      const url = `${QIJIEYA_BASE}?type=url&id=${encodeURIComponent(id)}&server=netease`;
      console.log(`[Song URL POST] Constructed URL for song ${id}`);
      res.json({ data: [{ url }] });
    } catch (err: any) {
      console.error(`[Song URL POST Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // 6. GET /song/url/v1 → same as POST
  app.get("/song/url/v1", async (req, res) => {
    try {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: "Missing id" });
      const url = `${QIJIEYA_BASE}?type=url&id=${encodeURIComponent(id)}&server=netease`;
      console.log(`[Song URL GET] Constructed URL for song ${id}`);
      res.json({ data: [{ url }] });
    } catch (err: any) {
      console.error(`[Song URL GET Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // API Route for cover proxy to bypass CORS
  app.get("/api/proxy-cover", async (req, res) => {
    const { url } = req.query;
    if (!url) {
      return res.status(400).send("Parameter url is required.");
    }

    try {
      console.log(`[Proxy Cover] Fetching: ${url}`);
      const response = await fetch(url as string, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
      });
      if (!response.ok) {
        return res.status(response.status).send("Failed to retrieve image from upstream.");
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day client cache

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (err: any) {
      console.error(`[Proxy Cover Error] Failed proxying logos:`, err.message);
      return res.status(500).send("Failed to proxy cover image due to internal error.");
    }
  });

  // ============ TTML Lyrics Proxy (bypass CORS) ============
  app.get("/api/ttml/ncm/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const url = `https://amll-ttml-db.stevexmh.net/ncm/${id}`;
      console.log(`[TTML Proxy] Fetching: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
      });
      if (!response.ok) return res.status(response.status).json({ error: "TTML not found" });
      const text = await response.text();
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(text);
    } catch (err: any) {
      console.error(`[TTML Proxy Error]:`, err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // ============ QQ Music Audio Stream Proxy (via api.52vmy.cn) ============
  // QQ音乐音频流全部通过 /api/qq/song/url 路由，使用 api.52vmy.cn 免费免注册 API

  // General server-side CORS bypass API proxy
  app.get("/api/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "Missing required parameter: url" });
    }

    try {
      const decodedUrl = decodeURIComponent(url as string);
      console.log(`[Proxy API] Proxying request to: ${decodedUrl}`);
      
      const response = await fetch(decodedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://music.163.com",
          "Accept": "application/json, text/plain, */*"
        }
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        return res.json(data);
      } else {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          return res.json(parsed);
        } catch (_) {
          return res.send(text);
        }
      }
    } catch (err: any) {
      console.error(`[Proxy API Error] Failed proxying ${url}:`, err.message);
      return res.status(500).json({ error: "Failed to proxy request", details: err.message });
    }
  });



  // Serve static files and handle Vite development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
