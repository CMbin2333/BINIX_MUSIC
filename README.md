Markdown
# 🎵 BINIX MUSIC

> 一个具有极致视觉美学、3D 黑胶交互以及 GPU 流体渲染的高级沉浸式网页音乐播放器。

BINIX MUSIC 致力于打破传统 Web 音乐播放器的边界，通过引入高精度的 3D 机械空间标定、动态液态背景流体（Liquid Shaders）、精确到逐字的歌词高亮系统以及跨多平台（本地导入/全网搜歌）的音乐支持，为您提供发烧级的聆听与视觉双重盛宴。

---

## ✨ 核心特性 

### 🎨 极致的视觉体验 (Premium Visuals)
* 搭载 **GPU 流体动态背景 (Living-Liquid Shader Canvas)**，并支持根据音乐重低音 (Bass) 实时同步律动脉冲。
* 基于当前播放歌曲封面的**动态主色调提取**技术（基于 48x48 像素网格高密度采样），自动生成沉浸式渐变三色段背景。
* 支持添加具有质感的胶片颗粒噪音叠加层 (Film Grain Noise Mesh) 与暗度遮罩。
* 平滑的高维度惯性弹性飞行轨迹动画，在主播放器与 3D 胶片美学工作室之间实现极具震撼的视图无缝切换。

### 💽 3D 黑胶美学工作室 (3D Vinyl Studio)
* 全面支持 **唱臂与唱片的空间机械微调**，包括唱臂金属杆长度、磁头旋转角、水平/前端位移、底座锚点，以及红绿坐标标记区间的精准标定。
* 支持定制化的黑胶唱片材质（如黑曜石等），并伴有物理级别的金属光泽与粘滞度预设。

### 🎤 发烧级歌词系统 (Advanced Lyrics Engine)
* 支持基于 TTML/YRC 数据的**精确逐字高亮匹配**，能够完美处理对唱、间奏与和声轨。
* 提供中英双语对照、纯英文、纯中文三种歌词显示模式。
* 高度自定义的歌词面板：支持调整歌词字号、播放器/歌词面板占比、间距以及高度。

### 🎧 强大的音乐管理 (Music Management)
* **全网搜歌与解析**：内置针对网易云、QQ 音乐等跨域音乐平台的智能匹配系统与歌词 fallback 机制。
* **本地音乐导入**：完全支持本地音乐文件导入，自动解析并在浏览器内生成播放 URL。
* **数据持久化**：使用 `IndexedDB` 与 `localStorage` 进行高性能的离线数据存盘，您的播放列表、最近播放记录 (最大 50 首) 以及上次播放的进度皆可无缝恢复。

---

## ⌨️ 全局快捷键指南

BINIX MUSIC 提供了直观的键盘控制，支持在无鼠标情况下轻松管理播放：

| 按键 | 功能描述 | 
| :--- | :--- |
| `Space (空格键)` | 播放 / 暂停音乐 |
| `Enter (回车键)` | 收藏 / 取消收藏当前播放的歌曲 |
| `Arrow Left (←)` | 快退 5 秒 |
| `Arrow Right (→)` | 快进 5 秒 |
| `Arrow Up (↑)` | 切换至上一首歌曲 |
| `Arrow Down (↓)` | 切换至下一首歌曲 |
| `Tab` | 循环切换播放模式（列表循环、单曲循环、随机播放） |

---

## 🛠️ 技术栈架构

* **前端框架:** React 18+ / TypeScript
* **样式引擎:** Tailwind CSS v4 配合原生 CSS 动画 (如 `metalSheen` 等高级关键帧)
* **图标库:** Lucide React (提供 Sparkles, Sliders, Disc 等矢量图标)
* **本地存储:** IndexedDB (通过 `idb-keyval` 驱动) 与原生 LocalStorage API
* **交互细节:** 完美适配触控，彻底禁用移动端原生点击高亮 (`-webkit-tap-highlight-color: transparent`)，并定制无滚动条隐藏式设计

---

## 🚀 启动与安装

1. **克隆仓库**
   ```bash
   git clone [https://github.com/your-username/binix-music.git](https://github.com/your-username/binix-music.git)
   cd binix-music
安装依赖

Bash
npm install
# 或使用 yarn / pnpm
启动开发服务器

Bash
npm run dev
构建生产版本

Bash
npm run build
💡 设计哲学 & UI/UX
本应用的渲染设计遵循了极高的 UI/UX 标准。在 控制中心 内，您可以微调近乎所有渲染参数：从背景羽化模糊（甚至开启极清模式）、色彩流动速度、到丝褶立体起伏感。您可以保存自己的专属配色预设，也可以将背景调节为极夜暗色遮罩来沉浸式享受音乐。

我们致力于构建一个“有温度”、“可触摸”的现代 Web 音乐枢纽。

Made with ❤️ by BINIX MUSIC
