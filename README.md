# BINIX_MUSIC

高保真全栈音乐播放器，支持在线流媒体搜索（网易云 / QQ 音乐）、本地音乐导入与元数据解析、逐词精准歌词高亮、10 段均衡器 + 混响 + 低音增强，以及可定制的黑胶唱片可视化交互界面。

## 功能特性

### 音乐播放
- **多音源支持**：网易云音乐、QQ 音乐在线搜索与流媒体播放，本地文件导入（MP3 / FLAC / WAV / AAC 等）
- **播放列表管理**：添加、删除、拖拽排序，数据通过 IndexedDB 持久化
- **多种播放模式**：列表循环、单曲循环、随机播放
- **断点续播**：自动记忆上次播放歌曲、进度与播放状态

### 歌词系统
- **逐词精准高亮**：支持 LRC / YRC / TTML 格式，毫秒级逐字时间对齐
- **在线歌词获取**：播放时自动匹配网易云 / QQ 音乐歌词
- **翻译与罗马音**：支持歌词翻译（译配）和罗马音标注
- **对唱模式**：TTML 对唱标记自动左 / 右分栏对齐

### 音频处理引擎（Web Audio API）
- **10 段均衡器**：32Hz - 16kHz，内置流行 / 摇滚 / 古典 / 爵士 / 电子 / 人声预设
- **低音增强**：可调节增强强度
- **3D 混响**：物理声学混响模拟，可调衰减时间
- **立体声宽度控制**
- **频谱可视化**：实时频率能量柱状图

### 黑胶唱片交互
- 高仿真黑胶唱片 UI，支持播放 / 暂停旋转动画
- **6 种物理手感预设**：极速回弹、软脂吸附、晶刚锁定等，真实模拟不同材质阻尼
- 唱臂角度、长度、位置自定义
- 唱片盘面材质切换

### 视觉体验
- 专辑封面取色自动生成动态渐变背景
- 响应式布局，暗色主题

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| CSS 框架 | Tailwind CSS 4 |
| 动画库 | Motion (Framer Motion) |
| 图标库 | Lucide React |
| 后端服务器 | Express.js（tsx 运行时） |
| 本地存储 | IndexedDB（idb-keyval） |
| 音频元数据 | music-metadata |
| 在线音乐 API | Meting API / 网易云官方 API / QQ 音乐官方 API |
| AI 集成 | Google Gemini（@google/genai） |

## 安装与运行

### 前置要求

- Node.js 18+
- npm 9+

### 本地开发

```bash
# 1. 克隆项目
git clone <repo-url>
cd BINIX_MUSIC

# 2. 安装依赖
npm install

# 3. 配置 API Key（可选，用于 Gemini AI 功能）
cp .env.example .env.local
# 编辑 .env.local，填入你的 GEMINI_API_KEY

# 4. 启动开发服务器
npm run dev
```

服务默认运行在 `http://localhost:19876`。

### 生产构建

```bash
npm run build
npm start
```

## 项目结构

```
BINIX_MUSIC/
├── public/
│   └── 图标.png                    # 网站图标
├── src/
│   ├── components/
│   │   ├── AudioVisualizer.tsx     # 音频频谱可视化
│   │   ├── EQSonicPanel.tsx        # 均衡器 / 混响 / 低音增强面板
│   │   ├── LocalMusicImporter.tsx   # 本地音乐导入
│   │   ├── LyricsPanel.tsx         # 歌词面板（逐词高亮）
│   │   ├── PlayerControls.tsx      # 播放控制（进度条 / 音量 / 模式切换）
│   │   ├── PlaylistsModal.tsx      # 播放列表管理弹窗
│   │   ├── SearchSongsModal.tsx    # 在线音乐搜索弹窗
│   │   ├── SilkBackground.tsx      # 专辑取色动态背景
│   │   ├── SongSelector.tsx        # 曲目选择器
│   │   └── VinylSelectionStudio.tsx # 黑胶唱片物理 / 材质定制
│   ├── utils/
│   │   ├── localMusicDb.ts         # 本地音乐 IndexedDB 存取
│   │   └── musicApi.ts             # 在线音乐 API 封装
│   ├── App.tsx                     # 主应用组件
│   ├── main.tsx                    # 入口
│   ├── songs.ts                    # 初始曲库
│   ├── types.ts                    # TypeScript 类型定义
│   └── index.css                   # 全局样式
├── server.ts                       # Express 服务器（API 代理 / 静态资源）
├── index.html                      # SPA 入口
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

## API 代理说明

`server.ts` 内置了后端 API 代理，用于解决浏览器 CORS 限制和音乐平台防盗链问题：

- `/api/meting` — Meting API 通用代理（搜索 / 歌词 / 音频流）
- `/api/qq/*` — QQ 音乐搜索、歌词、封面、音频流代理
- `/cloudsearch` — 网易云音乐搜索（100 条上限）
- `/playlist/track/all` — 歌单详情获取
- `/lyric` — 网易云歌词（优先 YRC 逐词格式）
- `/song/url/v1` — 网易云音频直链获取
- `/api/proxy` — 通用 CORS 代理
- `/api/proxy-cover` — 封面图片代理
- `/api/ttml/ncm/:id` — TTML 逐词歌词代理

## License

MIT
