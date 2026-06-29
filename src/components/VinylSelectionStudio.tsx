import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, ChevronUp, Music, Disc, Sliders, RotateCcw, X, Play, Sparkles, Heart } from 'lucide-react';
import { Song } from '../types';

export type ViscosityPresetType = 'superfluid' | 'viscous' | 'glassy' | 'superfluid_optics' | 'viscous_optics' | 'glassy_optics';

export interface ViscosityConfig {
  id: ViscosityPresetType;
  name: string;
  enName: string;
  stiffness: number;
  damping: number;
  mass: number;
  description: string;
  accent: string;
}

export const VISCOSITY_PRESETS: ViscosityConfig[] = [
  // Original Physics / Viscosity presets
  {
    id: 'superfluid',
    name: '极速回弹',
    enName: 'Superfluid Rebound',
    stiffness: 220,
    damping: 10,
    mass: 0.5,
    description: '零黏度快弹、优雅清脆的单次微幅回弹。低阻快滑，释手瞬间敏捷缩回，伴随单次极小幅饱满回弹。',
    accent: '#10b981'
  },
  {
    id: 'viscous',
    name: '软脂吸附',
    enName: 'Viscous Adsorption',
    stiffness: 42,
    damping: 38,
    mass: 2.3,
    description: '软脂重阻尼悬重滑动。靠近卡位区自动产生真空吸附力，将动能完美吞噬、蠕动吸入无任何余震。',
    accent: '#f59e0b'
  },
  {
    id: 'glassy',
    name: '晶刚锁定',
    enName: 'Crystalline Glassy Lock',
    stiffness: 390,
    damping: 68,
    mass: 0.95,
    description: '刚性极速卡锁、瞬时完全静止。进入槽位直径范围内立即触发高强度晶刚刚性磁吸落锁。',
    accent: '#3b82f6'
  },
  // New Optics / Material presets
  {
    id: 'superfluid_optics',
    name: '超流体',
    enName: 'Superfluid Optics',
    stiffness: 85,
    damping: 24,
    mass: 1.2,
    description: '极低阻抗，折射高频绚丽光谱闪烁。',
    accent: '#10b981'
  },
  {
    id: 'viscous_optics',
    name: '高粘稠',
    enName: 'Viscous Optics',
    stiffness: 85,
    damping: 24,
    mass: 1.2,
    description: '漫反射，径向重力吸附式阻尼柔角微光。',
    accent: '#f59e0b'
  },
  {
    id: 'glassy_optics',
    name: '玻璃态',
    enName: 'Glassy Optics',
    stiffness: 390,
    damping: 68,
    mass: 0.95,
    description: '晶格极刚，对角硬朗线极速卡锁偏光掠影。',
    accent: '#3b82f6'
  }
];

export interface RecordMaterial {
  id: string;
  name: string;
  cnName: string;
  gradient: string;
  accentColor: string;
  grooveColor: string;
  description: string;
  shineIntensity: number;
}

export const RECORD_MATERIALS: RecordMaterial[] = [
  {
    id: 'obsidian',
    name: 'Classic Obsidian',
    cnName: '曜石经典黑',
    gradient: 'radial-gradient(circle, #0c0d0f 16%, #282a30 16.5%, #18191c 18%, #111215 30%, #202227 30.5%, #0f1012 42%, #262a30 42.5%, #141618 55%, #0c0d0e 68%, #22252a 68.5%, #070808 80%, #15171a 90%, #030404 100%)',
    accentColor: '#10b981',
    grooveColor: 'rgba(255, 255, 255, 0.05)',
    description: '标准高保真高密度曜石黑胶，经典永不过时的纯黑，具有极其纯正的吸噪能力与浑厚磁性重低音。',
    shineIntensity: 0.35
  },
  {
    id: 'gold',
    name: 'Collector\'s Gold',
    cnName: '皇家黄金收藏盘',
    gradient: 'radial-gradient(circle, #855d05 16%, #d4af37 16.5%, #fff1a0 18%, #aa7c11 30%, #ffe066 30.5%, #7a5006 42%, #ffd700 42.5%, #9a6d0c 55%, #7a5006 68%, #ffe880 68.5%, #614201 80%, #ffd700 90%, #8c620c 100%)',
    accentColor: '#f59e0b',
    grooveColor: 'rgba(255, 255, 255, 0.15)',
    description: '二十四克拉拉丝纯金磁镀层，专为稀世绝版歌剧与交响乐乐谱重塑定制，提供无以伦比的高频清澈感。',
    shineIntensity: 0.65
  },
  {
    id: 'emerald',
    name: 'Jade Emerald Dream',
    cnName: '帝王翡翠琉璃盘',
    gradient: 'radial-gradient(circle, #064e3b 16%, #059669 16.5%, #10b981 18%, #042f1a 30%, #34d399 30.5%, #064e3b 42%, #059669 42.5%, #022c22 55%, #064e3b 68%, #6ee7b7 68.5%, #022c22 80%, #10b981 90%, #022c22 100%)',
    accentColor: '#10b981',
    grooveColor: 'rgba(110, 231, 183, 0.15)',
    description: '华丽的东方帝王翡翠质感，复古祖母绿与冷锻薄荷色泽温润流转。完美烘托新古典乐、传统丝竹以及灵动的新世纪空灵极简律动。',
    shineIntensity: 0.58
  },
  {
    id: 'laser',
    name: 'Cyberpunk Laser',
    cnName: '赛博极光镭射盘',
    gradient: 'radial-gradient(circle, #ff007f 16%, #1c0533 16.5%, #3d0563 18%, #121016 30%, #ec4899 30.5%, #4c0a82 42%, #3b82f6 42.5%, #090212 55%, #701a75 68%, #a855f7 68.5%, #111116 80%, #ec4899 90%, #2f0857 100%)',
    accentColor: '#ec4899',
    grooveColor: 'rgba(255, 0, 127, 0.18)',
    description: '量子涂层纳米漫反射，在折射各种斑斓极光的同时，大幅扩张未来合成器与高解析度电子律动的通透声相。',
    shineIntensity: 0.82
  },
  {
    id: 'amethyst',
    name: 'Celestial Nebula',
    cnName: '星环宇宙霓虹盘',
    gradient: 'radial-gradient(circle, #2e1065 16%, #7c3aed 16.5%, #c084fc 18%, #1e1b4b 30%, #a78bfa 30.5%, #5b21b6 42%, #8b5cf6 42.5%, #1e1b4b 55%, #0f172a 68%, #ddd6fe 68.5%, #020617 80%, #8b5cf6 90%, #2e1065 100%)',
    accentColor: '#a78bfa',
    grooveColor: 'rgba(221, 214, 254, 0.16)',
    description: '神秘幽邃的深空黑洞与星云环流印迹。将炫目碎星尘封入分子，让史诗级管弦交响和巨幅氛围环境乐章在耳朵中立体绽放。',
    shineIntensity: 0.72
  },
  {
    id: 'cyan',
    name: 'Translucent Ocean Cyan',
    cnName: '海洋清透幻灵蓝',
    gradient: 'radial-gradient(circle, #00f2fe 16%, #0d9488 16.5%, #0284c7 18%, #0f1c2a 30%, #38bdf8 30.5%, #0e7490 42%, #0891b2 42.5%, #115e59 55%, #0f2733 68%, #06b6d4 68.5%, #0c1a26 80%, #22d3ee 90%, #016a6a 100%)',
    accentColor: '#0ea5e9',
    grooveColor: 'rgba(255, 255, 255, 0.22)',
    description: '清澈梦幻的深海半透亚克力，专为不插电声乐与古典舒缓钢琴曲融通定制，带来水波般轻灵的声场共鸣。',
    shineIntensity: 0.55
  },
  {
    id: 'ruby',
    name: 'Lava Ruby Splash',
    cnName: '熔岩红宝泼墨盘',
    gradient: 'radial-gradient(circle, #991b1b 16%, #e11d48 16.5%, #f43f5e 18%, #2d0b3a 30%, #ef4444 30.5%, #581c87 42%, #db2777 42.5%, #4c0519 55%, #0d0f19 68%, #e11d48 68.5%, #010103 80%, #d946ef 90%, #4c0519 100%)',
    accentColor: '#f43f5e',
    grooveColor: 'rgba(255, 255, 255, 0.18)',
    description: '红黑泼墨火山限定款，完美展现摇滚、朋克等重金属失真音频的最大动态温度阀值。',
    shineIntensity: 0.7
  },
  {
    id: 'alabaster',
    name: 'Minimal Opal Alabaster',
    cnName: '象牙温润白瓷盘',
    gradient: 'radial-gradient(circle, #ffffff 16%, #f1f5f9 16.5%, #e2e8f0 18%, #cbd5e1 30%, #f8fafc 30.5%, #e2e8f0 42%, #ffffff 42.5%, #cbd5e1 55%, #f1f5f9 68%, #e2e8f0 68.5%, #94a3b8 80%, #f8fafc 90%, #cbd5e1 100%)',
    accentColor: '#cbd5e1',
    grooveColor: 'rgba(15, 23, 42, 0.08)',
    description: '精工白玉瓷釉复合原浆材料。表面平滑如玉，在消除针尖摩擦底噪的同时赋予人声与爵士民谣不可多得的温厚饱满感。',
    shineIntensity: 0.42
  },
  {
    id: 'amber',
    name: 'Whiskey Flowing Amber',
    cnName: '琥珀流砂威士忌',
    gradient: 'radial-gradient(circle, #3f1a01 16%, #b45309 16.5%, #f59e0b 18%, #78350f 30%, #fbbf24 30.5%, #451a03 42%, #d97706 42.5%, #78350f 55%, #451a03 68%, #f59e0b 68.5%, #290e00 80%, #fbbf24 90%, #78350f 100%)',
    accentColor: '#f59e0b',
    grooveColor: 'rgba(251, 191, 36, 0.15)',
    description: '重力感威士忌琥珀温润质地。微醺的焦糖与蜂蜜般饱满渐变，沉淀爵士乐、灵魂蓝调与午夜轻音乐的醇厚回甘与极度松弛。',
    shineIntensity: 0.62
  },
  {
    id: 'sakura',
    name: 'Cherry Blossom Frost',
    cnName: '冰雪樱落极光盘',
    gradient: 'radial-gradient(circle, #fbcfe8 16%, #f472b6 16.5%, #fff1f2 18%, #db2777 30%, #fce7f3 30.5%, #9d174d 42%, #ec4899 42.5%, #be185d 55%, #4c0519 68%, #fbcfe8 68.5%, #fc8181 80%, #f472b6 90%, #831843 100%)',
    accentColor: '#f472b6',
    grooveColor: 'rgba(255, 182, 193, 0.18)',
    description: '柔美梦幻的半透冰粉色胶，融入温润的高精密云母折射。最契合J-Pop都市律动、清新日语ACG以及情绪饱满的治愈系恋曲。',
    shineIntensity: 0.52
  },
  {
    id: 'chrome',
    name: 'Holographic Fluid Chrome',
    cnName: '液态幻彩银铬盘',
    gradient: 'radial-gradient(circle, #1e293b 16%, #cbd5e1 16.5%, #f8fafc 18%, #475569 30%, #e2e8f0 30.5%, #0f172a 42%, #94a3b8 42.5%, #334155 55%, #0f172a 68%, #f1f5f9 68.5%, #020617 80%, #cbd5e1 90%, #1e293b 100%)',
    accentColor: '#cbd5e1',
    grooveColor: 'rgba(255, 255, 255, 0.25)',
    description: '未来感硬朗液态铬合金。折射出纯净镜面银拉丝质感，强力承载数字合成器、硬派电音、重低音说唱以及极简冷基调乐章。',
    shineIntensity: 0.95
  },
  {
    id: 'tundra',
    name: 'Moss Tundra Forest',
    cnName: '迷雾苔原森系盘',
    gradient: 'radial-gradient(circle, #14532d 16%, #166534 16.5%, #4ade80 18%, #022c22 30%, #86efac 30.5%, #14532d 42%, #15803d 42.5%, #052e16 55%, #022c22 68%, #a7f3d0 68.5%, #062f17 80%, #22c55e 90%, #022c22 100%)',
    accentColor: '#10b981',
    grooveColor: 'rgba(134, 239, 172, 0.12)',
    description: '冷峻苍翠的苔原深黛色，如同清晨大雨洗刷后的杉木林。契合独立独奏吉他、不插电民谣演奏、世界乐和大自然白噪音。',
    shineIntensity: 0.45
  },
  {
    id: 'supernova',
    name: 'Supernova Burning Sun',
    cnName: '超新星烈阳焰魂盘',
    gradient: 'radial-gradient(circle, #7c2d12 16%, #ea580c 16.5%, #facc15 18%, #4c0519 30%, #f97316 30.5%, #310842 42%, #d946ef 42.5%, #1c0533 55%, #7c2d12 68%, #e11d48 68.5%, #030008 80%, #facc15 90%, #431407 100%)',
    accentColor: '#f97316',
    grooveColor: 'rgba(249, 115, 22, 0.18)',
    description: '坍缩阶段的璀璨恒星火焰偏光。激荡电吉他、重金属摇滚、朋克、以及恢弘庞大的史诗动作电影原声。',
    shineIntensity: 0.85
  },
  {
    id: 'prism',
    name: 'Multidimensional Hologram Prism',
    cnName: '多维虹光全息棱镜',
    gradient: 'radial-gradient(circle, #f472b6 10%, #60a5fa 18%, #34d399 28%, #fbbf24 38%, #a78bfa 48%, #ec4899 58%, #3b82f6 68%, #10b981 78%, #facc15 88%, #8b5cf6 100%)',
    accentColor: '#60a5fa',
    grooveColor: 'rgba(255, 255, 255, 0.28)',
    description: '极致物理棱镜分光。高浓度霓虹反射层和纳米多重衍射膜，音符流转间，整张盘片折射出完整的光谱彩虹。最适配电子流行、梦幻合成器女声。',
    shineIntensity: 0.98
  },
  {
    id: 'lapis',
    name: 'Royal Lapis Gold Spec',
    cnName: '帝王青金淬金盘',
    gradient: 'radial-gradient(circle, #1e3a8a 12%, #ffffff55 12.5%, #0f172a 20%, #1d4ed8 35%, #f59e0b44 35.5%, #1e40af 50%, #172554 65%, #fbbf2455 65.5%, #1e3a8a 80%, #020617 100%)',
    accentColor: '#3b82f6',
    grooveColor: 'rgba(251, 191, 36, 0.2)',
    description: '浓郁高贵的阿富汗青金石宝蓝结晶。其间点缀着天然黄铁矿形成的金色砂闪，重构极致歌剧院般的声场还原度与富丽堂皇的交响共鸣。',
    shineIntensity: 0.75
  },
  {
    id: 'carbon',
    name: 'Precision Carbon Micro-Fiber',
    cnName: '精密碳纤微晶灰',
    gradient: 'radial-gradient(circle, #18181b 15%, #3f3f46 15.5%, #27272a 24%, #09090b 38%, #52525b 38.5%, #18181b 50%, #111827 65%, #71717a 65.5%, #09090b 80%, #2e2e33 90%, #09090b 100%)',
    accentColor: '#94a3b8',
    grooveColor: 'rgba(255, 255, 255, 0.08)',
    description: '超抗噪、高刚性航空级碳纤维混编原材。折射出极具秩序感的机械灰黑丝线拉丝纹理，带给前卫放克、低音贝斯和机械电吉他绝无仅有的声学结像度。',
    shineIntensity: 0.48
  },
  {
    id: 'terracotta',
    name: 'Warm Rustic Clay Earthing',
    cnName: '暖熔荒野古陶盘',
    gradient: 'radial-gradient(circle, #451a03 16%, #78350f 16.5%, #9a3412 25%, #451a03 35%, #b45309 35.5%, #3f1a01 50%, #c2410c 65%, #ea580c 65.5%, #271c19 80%, #b45309 90%, #3f1a01 100%)',
    accentColor: '#ea580c',
    grooveColor: 'rgba(249, 115, 22, 0.08)',
    description: '取材自古希腊陶土艺术的粗粝熔融色泽。拥有大地泥土一般的质朴亲和感，专为不插电吉他弹唱、大提琴独奏以及人声独白保留最本真、极具空气感的颗粒感。',
    shineIntensity: 0.32
  },
  {
    id: 'opal',
    name: 'Iridescent Liquid Fire Opal',
    cnName: '极光幻彩奶白欧泊',
    gradient: 'radial-gradient(circle, #fdf2f8 14%, #bae6fd 14.5%, #fed7aa 22%, #ddd6fe 32%, #fbcfe8 32.5%, #c084fc 46%, #93c5fd 46.5%, #f472b6 60%, #e0f2fe 74%, #fae8ff 84%, #fbcfe8 100%)',
    accentColor: '#f472b6',
    grooveColor: 'rgba(219, 39, 119, 0.12)',
    description: '温润半透的乳白色欧泊质感，富集折射绿粉霓虹的多彩游彩（Play of Color）。光影旋转下充满流星般的灵动生命力，极为适配唯美卧室电子、梦幻流行、千禧Lo-Fi。',
    shineIntensity: 0.94
  },
  {
    id: 'malachite',
    name: 'Imperial Wavy Forest Malachite',
    cnName: '皇家孔雀石流黛盘',
    gradient: 'radial-gradient(circle, #022c22 15%, #059669 15.5%, #064e3b 24%, #022c22 36%, #10b981 36.5%, #062f17 48%, #115e59 62%, #a7f3d0 62.5%, #022c22 76%, #14532d 88%, #021e17 100%)',
    accentColor: '#10b981',
    grooveColor: 'rgba(16, 185, 129, 0.15)',
    description: '带有同心层状细腻带状花纹的俄罗斯皇家孔雀石绿。如同大自然年轮深处的翠绿波纹，能赋予新古典乐、独立大提琴、凯尔特吹奏乐仿佛林间呼吸般的治愈松弛感。',
    shineIntensity: 0.65
  },
  {
    id: 'nebula',
    name: 'Cosmic Indigo Orion Nebula',
    cnName: '深空幻境猎户座星云',
    gradient: 'radial-gradient(circle, #1e1b4b 12%, #818cf8 12.5%, #090514 20%, #4c1d95 35%, #ec489955 35.5%, #311042 50%, #0d1117 65%, #c084fc66 65.5%, #1e1b4b 80%, #02010a 100%)',
    accentColor: '#818cf8',
    grooveColor: 'rgba(129, 140, 248, 0.22)',
    description: '深邃高贵的幽深暗紫色阶，点缀在猎户座流逝星群交汇处。极致吸收多余环境反射，留存纤细而通透的高频表现力，是后摇、氛围迷幻电子、太空歌剧配乐的灵魂伴侣。',
    shineIntensity: 0.88
  },
  {
    id: 'rosegold',
    name: 'Elite Frosted Liquid Rose Gold',
    cnName: '哑光流金液体玫瑰金',
    gradient: 'radial-gradient(circle, #2a0b0b 16%, #fda4af 16.5%, #ffe4e6 24%, #4c0519 38%, #f43f5e33 38.5%, #310811 50%, #fecdd3 65%, #fb7185 65.5%, #1c0208 80%, #fda4af 90%, #ffe4e6 100%)',
    accentColor: '#f43f5e',
    grooveColor: 'rgba(244, 63, 94, 0.15)',
    description: '至臻奢华的微磨砂玫瑰铜金。高贵优雅的冷金属折射融合了轻盈的红铜色泽，极其优雅高洁，完美诠释现代都市R&B、质感爵士女声、以及声线迷人的高端流行人声。',
    shineIntensity: 0.82
  },
  {
    id: 'glacial_jade',
    name: 'Glacial Jade Alabaster',
    cnName: '冰川羊脂凝脂玉',
    gradient: 'radial-gradient(circle, #f0fdfa 16%, #ccfbf1 16.5%, #99f6e4 18%, #115e59 30%, #e0f2fe 30.5%, #0d9488 42%, #2dd4bf 42.5%, #134e4a 55%, #f0fdf4 68%, #34d399 68.5%, #042f1a 80%, #ccfbf1 90%, #0d9488 100%)',
    accentColor: '#2dd4bf',
    grooveColor: 'rgba(45, 212, 191, 0.15)',
    description: '昆仑冰川羊脂玉无瑕凝脂之作。通体半透而散发盈润辉光，声音温润如风吹麦浪，抚平所有刺耳齿音，是大提琴、小提琴独奏和轻呢人声的极致载体。',
    shineIntensity: 0.52
  },
  {
    id: 'gold_obsidian',
    name: 'Gold Flaked Obsidian Spark',
    cnName: '金箔飞砂曜岩金',
    gradient: 'radial-gradient(circle, #18181b 16%, #ca8a04 16.5%, #fef08a 18%, #09090b 30%, #fbbf24 30.5%, #18181b 42%, #eab308 42.5%, #0c0a09 55%, #1c1917 68%, #fef08a 68.5%, #020617 80%, #fbbf24 90%, #1c1917 100%)',
    accentColor: '#f59e0b',
    grooveColor: 'rgba(251, 191, 36, 0.18)',
    description: '在典藏质感曜石黑中融入细密闪耀的飞金细砂。随光影转动，零星的碎金火花在拉丝波纹中若隐若现，奢华高贵，给电影原声与华丽流行乐重塑不凡质感。',
    shineIntensity: 0.72
  },
  {
    id: 'brushed_copper',
    name: 'Acoustic Precision Raw Copper',
    cnName: '温雅古法熔融铜',
    gradient: 'radial-gradient(circle, #451a03 16%, #c2410c 16.5%, #ffedd5 18%, #7c2d12 30%, #f97316 30.5%, #271c19 42%, #ea580c 42.5%, #431407 55%, #2d1105 68%, #fdba74 68.5%, #110400 80%, #f97316 90%, #7c2d12 100%)',
    accentColor: '#f97316',
    grooveColor: 'rgba(249, 115, 22, 0.16)',
    description: '经匠人红炉淬火古法熔融而成的拉丝铜合金。泛着古雅淳厚、带有微红光泽的暖色漫反射，沉淀出民谣不插电、蓝调布鲁斯和乡村草根乐最真实的饱满空气感。',
    shineIntensity: 0.68
  },
  {
    id: 'abyssal_sapphire',
    name: 'Abyssal Coral Blue Sapphire',
    cnName: '深海潮汐蓝宝盘',
    gradient: 'radial-gradient(circle, #1e3a8a 16%, #60a5fa 16.5%, #93c5fd 18%, #0f172a 30%, #2563eb 30.5%, #1e40af 42%, #60a5fa 42.5%, #172554 55%, #0f1e36 68%, #3b82f6 68.5%, #020617 80%, #3b82f6 90%, #1e3a8a 100%)',
    accentColor: '#3b82f6',
    grooveColor: 'rgba(96, 165, 250, 0.2)',
    description: '深邃皇家蓝宝石结晶，夹带微光点缀的潮汐浪花蓝宝材质。极其纯净的折射度带来完美的声学解像度与宽广的立体声场，彻底释放前卫电子乐、深度氛围环境音的澎湃声浪。',
    shineIntensity: 0.82
  },
  {
    id: 'luminescent_jellyfish',
    name: 'Bio-Luminescent Deep Gel',
    cnName: '深海荧光胶体水母',
    gradient: 'radial-gradient(circle, #020617 12%, #0891b2 16.5%, #4f46e5 24%, #0f172a 38%, #06b6d4 38.5%, #1e1b4b 50%, #312e81 65%, #a855f7 65.5%, #050510 80%, #06b6d4 90%, #1e1b4b 100%)',
    accentColor: '#06b6d4',
    grooveColor: 'rgba(6, 182, 212, 0.22)',
    description: '深海高精半透荧光胶体聚合物。夹带冷光分子，极具科幻灵巧度。振动时如同轻盈水母有节奏地翕张，完美还原蒸汽波、迷幻电子与三维环境环绕声。',
    shineIntensity: 0.9
  },
  {
    id: 'molten_magma_jelly',
    name: 'Thermic Molten Magma Jelly',
    cnName: '熔融岩浆流体果冻',
    gradient: 'radial-gradient(circle, #450a0a 16%, #ef4444 16.5%, #f59e0b 24%, #180000 35%, #f97316 35.5%, #3f1a01 50%, #b91c1c 65%, #facc15 65.5%, #0c0202 80%, #ea580c 90%, #450a0a 100%)',
    accentColor: '#f97316',
    grooveColor: 'rgba(249, 115, 22, 0.2)',
    description: '高黏稠度黏性火山岩浆凝胶。兼备高温热能金属偏光，重阻尼缓慢形变，盘片流转时光斑在重力沉降起伏中展现，最适合重拍电子、野性前卫爵士或重金属音色。',
    shineIntensity: 0.85
  },
  {
    id: 'aurora_dream_pectin',
    name: 'Aurora Pastel Dream Pectin',
    cnName: '极光霓虹流光果凝',
    gradient: 'radial-gradient(circle, #faf5ff 14%, #e9d5ff 14.5%, #fbcfe8 22%, #ddd6fe 32%, #fbcfe8 32.5%, #e0f2fe 46%, #c084fc 46.5%, #818cf8 60%, #e0f2fe 74%, #fae8ff 84%, #fbcfe8 100%)',
    accentColor: '#c084fc',
    grooveColor: 'rgba(216, 180, 254, 0.18)',
    description: '极轻盈超流体马卡龙渐变极光果胶。温润的梦幻冰粉紫偏光层具有高色散折射，旋转中交织出折光彩虹。专为温暖治愈系ACG、卧室都市民谣及唯美声乐重铸声场。',
    shineIntensity: 0.92
  },
  {
    id: 'mercury_fluid',
    name: 'Active Liquid Mercury Colloid',
    cnName: '液态活汞重阻银胶',
    gradient: 'radial-gradient(circle, #020617 14%, #94a3b8 14.5%, #f1f5f9 22%, #1e293b 35%, #e2e8f0 35.5%, #0f172a 48%, #cbd5e1 60%, #94a3b8 60.5%, #020617 76%, #f8fafc 88%, #334155 100%)',
    accentColor: '#cbd5e1',
    grooveColor: 'rgba(255, 255, 255, 0.3)',
    description: '高反光、极致镜面流体银汞强动能胶。盘片微斜即呈流动反光，具有超低瞬态失真，声音极其冰冷明晰，为硬派机械电音、先锋说唱、工业噪音提供极强的微观解析。',
    shineIntensity: 0.97
  },
  {
    id: 'glacial_crystal_gel',
    name: 'Glacial Clear Elastic Gel',
    cnName: '冰川寒晶高弹凝胶',
    gradient: 'radial-gradient(circle, #f0fdfa 12%, #99f6e4 12.5%, #2dd4bf 20%, #0f172a 35%, #e0f2fe 35.5%, #0d9488 48%, #38bdf8 62%, #0891b2 62.5%, #0c1a26 78%, #22d3ee 90%, #0f1c2a 100%)',
    accentColor: '#2dd4bf',
    grooveColor: 'rgba(45, 212, 191, 0.22)',
    description: '极寒零度晶莹透光弹性凝胶。通体呈水亮冰蓝色，极微晶分子杜绝任何微小底噪，拥有超静音特质。小提琴等独奏乐或清空大自然环境白噪音的殿堂级伴侣。',
    shineIntensity: 0.88
  },
  {
    id: 'slime_darkmatter',
    name: 'Cosmic Slime Dark Matter',
    cnName: '暗物质迷幻星泥史莱姆',
    gradient: 'radial-gradient(circle, #120324 16%, #6b21a8 16.5%, #c084fc 25%, #05000d 36%, #a855f7 36.5%, #1e1b4b 48%, #c084fc 62%, #101016 62.5%, #3b0764 76%, #d8b4fe 88%, #030008 100%)',
    accentColor: '#c084fc',
    grooveColor: 'rgba(168, 85, 247, 0.2)',
    description: '外太空深紫色吸光星尘凝胶。含有极细的金紫碎砂粒子，旋转反射出时空黑洞般的渐变阻尼感，深层净化齿音，使后摇、太空歌剧与微醺氛围迷幻乐更富包裹感。',
    shineIntensity: 0.78
  },
  {
    id: 'translucent_honey_amber',
    name: 'Golden Nectar Active Honey Comb',
    cnName: '蜜糖晶莹活态拉丝胶',
    gradient: 'radial-gradient(circle, #78350f 12%, #d97706 14.5%, #fbbf24 22%, #451a03 35%, #f59e0b 35.5%, #78350f 48%, #fbbf24 62%, #f59e0b 62.5%, #3f1a01 78%, #fcd34d 90%, #1e1b4b 100%)',
    accentColor: '#fbbf24',
    grooveColor: 'rgba(251, 191, 36, 0.25)',
    description: '高黏度温润丰盈蜜糖拉丝胶质层。流动时呈现如流星蜜釉的超高厚度镜面反射，极高阻尼声学微孔吸收杂讯，为暖人心脾的高纯人声、不插电大提琴与悠扬萨克斯旋律创造极具温润泛音的回放通道。',
    shineIntensity: 0.81
  },
  {
    id: 'biolum_emerald_gel',
    name: 'Subthermal Biolum Emerald Resin',
    cnName: '低温荧光祖母晶翠凝胶',
    gradient: 'radial-gradient(circle, #022c22 10%, #059669 13.5%, #34d399 21%, #064e3b 34%, #10b981 34.5%, #022c22 47%, #34d399 60%, #059669 60.5%, #022c22 75%, #a7f3d0 88%, #064e3b 100%)',
    accentColor: '#10b981',
    grooveColor: 'rgba(52, 211, 153, 0.22)',
    description: '低温精炼荧光石绿半透凝胶体。特有冷翠荧光增亮层，盘片边缘在灯光下展现神秘微光，拥有超强的高频延展性，把极简微观电音、舒缓流体氛围以及冰晶合成器乐曲表现得格外空灵、清透。',
    shineIntensity: 0.89
  },
  {
    id: 'cosmic_nebula_slime',
    name: 'Cosmic Pearl Nebula Slime',
    cnName: '星云幻彩云母星泥',
    gradient: 'radial-gradient(circle, #311042 12%, #a21caf 14.5%, #c084fc 22%, #1e1b4b 35%, #ec4899 35.5%, #471052 48%, #c084fc 62%, #a21caf 62.5%, #050510 78%, #e9d5ff 90%, #1e293b 100%)',
    accentColor: '#c084fc',
    grooveColor: 'rgba(216, 180, 254, 0.24)',
    description: '幻彩星云云母质感活性史莱姆凝结盘。融合纳米云母闪粉与高反光星尘晶体，旋转时展现跨维度的梦幻晕染，吸收并重整高动态范围内的声轴震荡，极其适合华丽都市流行、迷幻合成器和前卫摇滚。',
    shineIntensity: 0.94
  },
  {
    id: 'chrome_platinum_elastic',
    name: 'Supercooled Liquid Platinum Colloid',
    cnName: '超冷液态电镀白金弹胶',
    gradient: 'radial-gradient(circle, #020617 14%, #cbd5e1 14.5%, #ffffff 22%, #1e293b 35%, #94a3b8 35.5%, #0f172a 48%, #e2e8f0 60%, #94a3b8 60.5%, #020617 76%, #ffffff 88%, #1e293b 100%)',
    accentColor: '#ffffff',
    grooveColor: 'rgba(255, 255, 255, 0.35)',
    description: '超冷镜面电镀白金反射高弹缩聚胶。比传统银色具有更高的反射对比和柔韧的中高频阻尼。流动拉丝辉斑随盘片高频振荡表现出震撼的波纹，令现代重低音说唱、重拍硬核、以及经典声场纤毫毕现。',
    shineIntensity: 0.99
  },
  {
    id: 'opaque_taro_pudding',
    name: 'Elastomeric Taro Milky Pudding',
    cnName: '高弹香芋特调乳泥果冻',
    gradient: 'radial-gradient(circle, #4c1d95 15%, #c084fc 15.5%, #e9d5ff 22%, #2e1065 34%, #fae8ff 34.5%, #4c1d95 48%, #d8b4fe 60%, #c084fc 60.5%, #1e1b4b 76%, #f5f3ff 88%, #2e1065 100%)',
    accentColor: '#d8b4fe',
    grooveColor: 'rgba(167, 139, 250, 0.14)',
    description: '温和治愈系高阻尼香芋特调乳果泥材质。哑光与半透胶体微感有机组合，呈现优雅高级的马卡龙香芋浅紫霓虹，声感蓬松温暖而有弹力，专为清甜人声、温暖Lo-Fi、卧室沙发音乐打造的治愈恩物。',
    shineIntensity: 0.48
  }
];

interface AlbumCardItemProps {
  song: Song;
  i: number;
  albumVinylPullDistance: number;
  currentSong: Song;
  activeMat: any;
  didDrag: React.MutableRefObject<boolean>;
  isClosest: boolean;
  onSelectSong: (song: Song) => void;
  springSnapTo: (i: number) => void;
  isInteracting: boolean;
  centerWeight: number;
  transformStyle: string;
  zIndex: number;
  opacity: number;
  viscosityPreset: ViscosityPresetType;
}

const AlbumCardItem: React.FC<AlbumCardItemProps> = ({
  song,
  i,
  albumVinylPullDistance,
  currentSong,
  activeMat,
  didDrag,
  isClosest,
  onSelectSong,
  springSnapTo,
  isInteracting,
  centerWeight,
  transformStyle,
  zIndex,
  opacity,
  viscosityPreset
}) => {
  const activePreset = VISCOSITY_PRESETS.find(p => p.id === viscosityPreset) || VISCOSITY_PRESETS[0];

  const xMotion = useMotionValue(0);
  const yMotion = useMotionValue(0);

  const rotateXSpring = useSpring(xMotion, {
    stiffness: activePreset.stiffness,
    damping: activePreset.damping,
    mass: activePreset.mass
  });

  const rotateYSpring = useSpring(yMotion, {
    stiffness: activePreset.stiffness,
    damping: activePreset.damping,
    mass: activePreset.mass
  });

  useEffect(() => {
    if ((rotateXSpring as any).setOptions) {
      (rotateXSpring as any).setOptions({
        stiffness: activePreset.stiffness,
        damping: activePreset.damping,
        mass: activePreset.mass
      });
    }
    if ((rotateYSpring as any).setOptions) {
      (rotateYSpring as any).setOptions({
        stiffness: activePreset.stiffness,
        damping: activePreset.damping,
        mass: activePreset.mass
      });
    }
  }, [viscosityPreset, activePreset, rotateXSpring, rotateYSpring]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nx = (x / rect.width) - 0.5;
    const ny = (y / rect.height) - 0.5;
    
    // Luxurious dynamic 3D tilt tracking cursor
    const maxTilt = isClosest ? 16 : 8;
    xMotion.set(-ny * maxTilt);
    yMotion.set(nx * maxTilt);
    setMousePos({ x, y });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    xMotion.set(0);
    yMotion.set(0);
    setIsHovered(false);
  };

  return (
    <div
      onClick={() => {
        if (didDrag.current) return;
        if (isClosest) {
          onSelectSong(song);
        } else {
          springSnapTo(i);
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`absolute w-[210px] md:w-[260px] h-[210px] md:h-[260px] cursor-pointer select-none bg-transparent border-none shadow-none backdrop-blur-none flex flex-col justify-center items-center ${
        isInteracting ? 'transition-none' : 'transition-all duration-[750ms] ease-[cubic-bezier(0.25,1,0.5,1)]'
      }`}
      style={{
        transform: transformStyle,
        zIndex: zIndex,
        opacity: opacity,
        transformStyle: 'preserve-3d'
      }}
    >
      <motion.div 
        id={isClosest ? "focused-studio-album-jacket" : undefined}
        className="studio-album-jacket-card relative w-[210px] md:w-[260px] h-[210px] md:h-[260px] flex items-center justify-center overflow-visible bg-transparent transition-all duration-100 ease-out"
        style={{
          rotateX: rotateXSpring,
          rotateY: rotateYSpring,
          transformStyle: 'preserve-3d',
          z: 10
        }}
      >
        {/* Vinyl disc sticker layout */}
        <div 
          className="absolute left-0 w-[210px] md:w-[260px] h-[210px] md:h-[260px]"
          style={{
            transform: `translateX(${12 + (albumVinylPullDistance - 12) * (isClosest || song.id === currentSong.id ? 1 : centerWeight)}px)`,
            zIndex: 1,
            transition: 'transform 1000ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <div 
            className="w-full h-full rounded-full shadow-[4px_12px_28px_rgba(0,0,0,0.95)] relative overflow-hidden"
            style={{
              background: activeMat.gradient,
              opacity: 0.8 + 0.2 * (isClosest || song.id === currentSong.id ? 1 : centerWeight),
              transform: isClosest && song.id === currentSong.id 
                ? undefined 
                : `rotate(${(isClosest || song.id === currentSong.id ? 1 : centerWeight) * 360}deg)`,
              transition: 'transform 1000ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 800ms ease',
              animation: isClosest && song.id === currentSong.id ? 'spin 15s linear infinite' : 'none',
            }}
          >
             {/* Realistic Concentric Vinyl Grooves Micro-Texture */}
             <div 
               className="absolute inset-0 pointer-events-none z-[1] rounded-full" 
               style={{
                 background: 'repeating-radial-gradient(circle, rgba(0, 0, 0, 0.44) 0px, rgba(0, 0, 0, 0.44) 1px, transparent 1.2px, transparent 2.4px), repeating-radial-gradient(circle, rgba(255, 255, 255, 0.04) 0px, transparent 0.8px, rgba(0, 0, 0, 0.3) 1.6px, transparent 2px)',
                 mixBlendMode: 'overlay',
                 opacity: 0.75
               }}
             />

             {/* Dynamic Realistic Anisotropic Sheen Reflections */}
             <div 
               className="absolute inset-0 pointer-events-none z-[2] rounded-full" 
               style={{
                 background: 'conic-gradient(from 12deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.16) 25deg, rgba(255,255,255,0) 50deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,0.16) 205deg, rgba(255,255,255,0) 230deg, rgba(255,255,255,0) 360deg)',
                 mixBlendMode: 'screen',
                 opacity: 0.8
               }}
             />
             <div 
               className="absolute inset-0 pointer-events-none z-[3] rounded-full" 
               style={{
                 background: 'conic-gradient(from 102deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.12) 20deg, rgba(255,255,255,0) 45deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,0.12) 200deg, rgba(255,255,255,0) 225deg, rgba(255,255,255,0) 360deg)',
                 mixBlendMode: 'overlay',
                 opacity: 0.85
               }}
             />

             {/* Vinyl Sound Bands (Zones of Recorded Audio tracks) */}
             <div className="absolute inset-[10%] rounded-full border border-black/30 pointer-events-none z-[4]" />
             <div className="absolute inset-[24%] rounded-full border border-black/25 pointer-events-none z-[4]" />
             <div className="absolute inset-[36%] rounded-full border border-black/20 pointer-events-none z-[4]" />
             <div className="absolute inset-[52%] rounded-full border border-white/5 pointer-events-none z-[4]" />
             <div className="absolute inset-[68%] rounded-full border border-white/5 pointer-events-none z-[4]" />
             <div className="absolute inset-[82%] rounded-full border border-white/10 pointer-events-none z-[4]" />

             {/* Realistic Refractive Shimmer Highlight Overlay based on fluid preset */}
             <div 
               className="absolute inset-0 pointer-events-none z-[5]" 
               style={(() => {
                 if (viscosityPreset === 'superfluid' || viscosityPreset === 'superfluid_optics') {
                   const rot = isHovered ? (mousePos.x + mousePos.y) * 0.45 % 360 : 45;
                   return {
                     background: `linear-gradient(${rot}deg, transparent 20%, rgba(255,255,255,0.06) 35%, rgba(16,185,129,0.18) 42%, rgba(255,255,255,0.14) 50%, rgba(56,189,248,0.18) 58%, rgba(255,255,255,0.05) 65%, transparent 80%)`,
                     mixBlendMode: 'screen',
                     opacity: isClosest ? 0.85 : 0.4,
                     transition: 'opacity 0.3s ease'
                   } as React.CSSProperties;
                 } else if (viscosityPreset === 'viscous' || viscosityPreset === 'viscous_optics') {
                   const clientCenterX = isHovered ? (mousePos.x / 260) * 100 : 50;
                   const clientCenterY = isHovered ? (mousePos.y / 260) * 100 : 50;
                   return {
                     background: `radial-gradient(circle at ${clientCenterX}% ${clientCenterY}%, rgba(255,255,255,0.18) 0%, rgba(245,158,11,0.08) 35%, transparent 75%)`,
                     mixBlendMode: 'overlay',
                     opacity: isClosest ? 0.8 : 0.35,
                   } as React.CSSProperties;
                 } else {
                   const transX = isHovered ? (mousePos.x - 130) * 0.38 : 0;
                   return {
                     background: `linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.22) 46%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.22) 54%, transparent 62%)`,
                     transform: `translateX(${transX}px) skewX(-12deg)`,
                     mixBlendMode: 'screen',
                     opacity: isClosest ? 0.95 : 0.4,
                     transition: 'transform 0.1s ease-out'
                   } as React.CSSProperties;
                 }
               })()}
             />

             <div className="absolute inset-[38%] bg-black/45 rounded-full flex items-center justify-center shadow-inner z-[6]">
               <div className="w-4 h-4 bg-slate-950 rounded-full border border-white/20" />
             </div>
          </div>
        </div>

        {/* Dynamic Highlight Jacket artwork */}
        <div className="absolute left-0 top-0 w-[210px] md:w-[260px] h-[210px] md:h-[260px] rounded-xl overflow-hidden shadow-[8px_18px_40px_rgba(0,0,0,0.9)] z-10 border border-white/10">
          <img 
            src={song.coverUrl} 
            alt="" 
            className="w-full h-full object-cover select-none pointer-events-none"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
          
          {isHovered && (
            <div 
              className="absolute inset-x-0 inset-y-0 pointer-events-none mix-blend-overlay opacity-80"
              style={{
                background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.22) 0%, transparent 60%)`,
                transition: 'background 0.05s ease-out'
              }}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
};

interface MaterialCardItemProps {
  mat: RecordMaterial;
  i: number;
  activeMaterial: string;
  currentSong: Song;
  didDrag: React.MutableRefObject<boolean>;
  isClosest: boolean;
  onSelectMaterial: (id: string) => void;
  springSnapTo: (i: number) => void;
  isInteracting: boolean;
  transformStyle: string;
  zIndex: number;
  opacity: number;
  centerWeight: number;
  viscosityPreset: ViscosityPresetType;
}

const MaterialCardItem: React.FC<MaterialCardItemProps> = ({
  mat,
  i,
  activeMaterial,
  currentSong,
  didDrag,
  isClosest,
  onSelectMaterial,
  springSnapTo,
  isInteracting,
  transformStyle,
  zIndex,
  opacity,
  centerWeight,
  viscosityPreset
}) => {
  const activePreset = VISCOSITY_PRESETS.find(p => p.id === viscosityPreset) || VISCOSITY_PRESETS[0];

  const xMotion = useMotionValue(0);
  const yMotion = useMotionValue(0);

  const rotateXSpring = useSpring(xMotion, {
    stiffness: activePreset.stiffness,
    damping: activePreset.damping,
    mass: activePreset.mass
  });

  const rotateYSpring = useSpring(yMotion, {
    stiffness: activePreset.stiffness,
    damping: activePreset.damping,
    mass: activePreset.mass
  });

  useEffect(() => {
    if ((rotateXSpring as any).setOptions) {
      (rotateXSpring as any).setOptions({
        stiffness: activePreset.stiffness,
        damping: activePreset.damping,
        mass: activePreset.mass
      });
    }
    if ((rotateYSpring as any).setOptions) {
      (rotateYSpring as any).setOptions({
        stiffness: activePreset.stiffness,
        damping: activePreset.damping,
        mass: activePreset.mass
      });
    }
  }, [viscosityPreset, activePreset, rotateXSpring, rotateYSpring]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nx = (x / rect.width) - 0.5;
    const ny = (y / rect.height) - 0.5;
    
    const maxTilt = isClosest ? 16 : 8;
    xMotion.set(-ny * maxTilt);
    yMotion.set(nx * maxTilt);
    setMousePos({ x, y });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    xMotion.set(0);
    yMotion.set(0);
    setIsHovered(false);
  };

  return (
    <div
      onClick={() => {
        if (didDrag.current) return;
        if (isClosest) {
          onSelectMaterial(mat.id);
        } else {
          springSnapTo(i);
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`absolute w-[200px] md:w-[250px] h-[320px] md:h-[390px] cursor-pointer select-none flex items-center justify-center overflow-visible bg-transparent ${
        isInteracting ? 'transition-none' : 'transition-all duration-[750ms] ease-[cubic-bezier(0.25,1,0.5,1)]'
      }`}
      style={{
        transform: transformStyle,
        zIndex: zIndex,
        opacity: opacity,
        transformStyle: 'preserve-3d'
      }}
    >
      <motion.div 
        className="absolute inset-0 rounded-2xl bg-slate-950 border border-white/10 p-4 pt-5 pb-5 flex flex-col justify-between items-center text-center shadow-[0_22px_45px_rgba(0,0,0,0.85)] transition-all duration-100 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          rotateX: rotateXSpring,
          rotateY: rotateYSpring,
          z: 10,
          boxShadow: `0 22px 45px rgba(0, 0, 0, 0.85), inset 0 0 20px rgba(255, 255, 255, 0.02), 0 0 30px ${mat.accentColor}25`,
          borderColor: isClosest ? `${mat.accentColor}40` : 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <div 
          className="relative w-[120px] md:w-[155px] h-[120px] md:h-[155px] rounded-full shadow-[6px_12px_28px_rgba(0,0,0,0.8)] shrink-0 overflow-hidden"
          style={{
            background: mat.gradient,
            transform: isClosest && mat.id === activeMaterial
              ? undefined 
              : `rotate(${(isClosest ? 1 : centerWeight) * 360}deg)`,
            transition: 'transform 1000ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            animation: isClosest && mat.id === activeMaterial ? 'spin 15s linear infinite' : 'none',
          }}
        >
          {/* Realistic Concentric Vinyl Grooves Micro-Texture */}
          <div 
            className="absolute inset-0 pointer-events-none z-[1] rounded-full" 
            style={{
              background: 'repeating-radial-gradient(circle, rgba(0, 0, 0, 0.44) 0px, rgba(0, 0, 0, 0.44) 1px, transparent 1.2px, transparent 2.4px), repeating-radial-gradient(circle, rgba(255, 255, 255, 0.04) 0px, transparent 0.8px, rgba(0, 0, 0, 0.3) 1.6px, transparent 2px)',
              mixBlendMode: 'overlay',
              opacity: 0.75
            }}
          />

          {/* Dynamic Realistic Anisotropic Sheen Reflections */}
          <div 
            className="absolute inset-0 pointer-events-none z-[2] rounded-full" 
            style={{
              background: 'conic-gradient(from 12deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.16) 25deg, rgba(255,255,255,0) 50deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,0.16) 205deg, rgba(255,255,255,0) 230deg, rgba(255,255,255,0) 360deg)',
              mixBlendMode: 'screen',
              opacity: 0.8
            }}
          />
          <div 
            className="absolute inset-0 pointer-events-none z-[3] rounded-full" 
            style={{
              background: 'conic-gradient(from 102deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.12) 20deg, rgba(255,255,255,0) 45deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,0.12) 200deg, rgba(255,255,255,0) 225deg, rgba(255,255,255,0) 360deg)',
              mixBlendMode: 'overlay',
              opacity: 0.85
            }}
          />

          <div className="absolute inset-[6%] rounded-full border border-white/[0.03] z-[4]" />
          <div className="absolute inset-[15%] rounded-full border border-white/[0.04] z-[4]" />
          <div className="absolute inset-[26%] rounded-full border border-white/[0.02] z-[4]" />

          <div 
            className="absolute inset-[4%] rounded-full opacity-35 mix-blend-screen z-[4]"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.02) 50%, transparent 50.5%)'
            }}
          />

          {/* Realistic Refractive Shimmer Highlight Overlay based on fluid preset */}
          <div 
            className="absolute inset-0 pointer-events-none z-[5]" 
            style={(() => {
              if (viscosityPreset === 'superfluid' || viscosityPreset === 'superfluid_optics') {
                const rot = isHovered ? (mousePos.x + mousePos.y) * 0.45 % 360 : 45;
                return {
                  background: `linear-gradient(${rot}deg, transparent 20%, rgba(255,255,255,0.06) 35%, rgba(16,185,129,0.18) 42%, rgba(255,255,255,0.14) 50%, rgba(56,189,248,0.18) 58%, rgba(255,255,255,0.05) 65%, transparent 80%)`,
                  mixBlendMode: 'screen',
                  opacity: isClosest ? 0.85 : 0.4,
                  transition: 'opacity 0.3s ease'
                } as React.CSSProperties;
              } else if (viscosityPreset === 'viscous' || viscosityPreset === 'viscous_optics') {
                const clientCenterX = isHovered ? (mousePos.x / 250) * 100 : 50;
                const clientCenterY = isHovered ? (mousePos.y / 390) * 100 : 50;
                return {
                  background: `radial-gradient(circle at ${clientCenterX}% ${clientCenterY}%, rgba(255,255,255,0.18) 0%, rgba(245,158,11,0.08) 35%, transparent 75%)`,
                  mixBlendMode: 'overlay',
                  opacity: isClosest ? 0.8 : 0.35,
                } as React.CSSProperties;
              } else {
                const transX = isHovered ? (mousePos.x - 125) * 0.38 : 0;
                return {
                  background: `linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.22) 46%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.22) 54%, transparent 62%)`,
                  transform: `translateX(${transX}px) skewX(-12deg)`,
                  mixBlendMode: 'screen',
                  opacity: isClosest ? 0.95 : 0.4,
                  transition: 'transform 0.1s ease-out'
                } as React.CSSProperties;
              }
            })()}
          />

          <div className="absolute inset-[38%] rounded-full overflow-hidden flex items-center justify-center shadow-inner bg-black/45">
            <img 
              src={currentSong.coverUrl} 
              alt="" 
              className="w-full h-full object-cover rounded-full select-none pointer-events-none"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="flex flex-col items-center mt-3 w-full overflow-hidden select-none">
          <span className="text-xs md:text-[15px] font-black text-white/95 tracking-wide truncate max-w-full block">
            {mat.cnName}
          </span>
          <span 
            className="text-[8px] md:text-[10px] font-mono tracking-widest uppercase mt-0.5"
            style={{ color: mat.accentColor }}
          >
            {mat.name}
          </span>
          
          <div 
            className="w-6 h-[1.5px] rounded-full my-1.5 md:my-2"
            style={{ backgroundColor: mat.accentColor }}
          />

          <p className="text-[9px] md:text-[11px] text-white/70 tracking-wide font-normal line-clamp-3 leading-relaxed px-1">
            {mat.description}
          </p>
        </div>

        {isHovered && (
          <div 
            className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-60 rounded-2xl"
            style={{
              background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.18) 0%, transparent 60%)`,
              transition: 'background 0.05s ease-out'
            }}
          />
        )}
      </motion.div>
    </div>
  );
};

interface VinylSelectionStudioProps {
  currentSong: Song;
  onSelectSong: (song: Song) => void;
  songsList: Song[];
  activeMaterial: string;
  onSelectMaterial: (id: string) => void;
  onScrollUp: () => void;
  albumVinylPullDistance?: number;
  setAlbumVinylPullDistance?: (val: number) => void;
  viscosityPreset?: ViscosityPresetType;
  onChangeViscosityPreset?: (preset: ViscosityPresetType) => void;
}

export const VinylSelectionStudio: React.FC<VinylSelectionStudioProps> = ({
  currentSong,
  onSelectSong,
  songsList = [],
  activeMaterial,
  onSelectMaterial,
  onScrollUp,
  albumVinylPullDistance: propAlbumVinylPullDistance,
  setAlbumVinylPullDistance: propSetAlbumVinylPullDistance,
  viscosityPreset: propViscosityPreset,
  onChangeViscosityPreset
}) => {
  // 3D dynamic fluid viscosity preset switcher state
  const [internalViscosityPreset, setInternalViscosityPreset] = useState<ViscosityPresetType>('superfluid');
  const viscosityPreset = propViscosityPreset || internalViscosityPreset;
  const setViscosityPreset = onChangeViscosityPreset || setInternalViscosityPreset;

  // Material Selection indices
  const materialIndex = RECORD_MATERIALS.findIndex(m => m.id === activeMaterial);
  const currentMaterialSafeIndex = materialIndex === -1 ? 0 : materialIndex;
  
  // High performance local material focus state decoupled from parent re-render overhead with spring-smoothing support
  const [focusedMaterialIndex, setFocusedMaterialIndex] = useState<number>(currentMaterialSafeIndex);
  const activeMat = RECORD_MATERIALS[focusedMaterialIndex];

  // Album/Song Selection state for focus tracking (not automatically playing)
  const initialSongIndex = songsList.findIndex(s => s.id === currentSong.id);
  const [focusedSongIndex, setFocusedSongIndex] = useState(initialSongIndex === -1 ? 0 : initialSongIndex);
  const [lastSongId, setLastSongId] = useState(currentSong.id);
  const [lastMaterialId, setLastMaterialId] = useState(activeMaterial);

  // Smooth offset trackers for continuous dynamic drag/flick
  const [albumOffset, _setAlbumOffset] = useState<number>(initialSongIndex === -1 ? 0 : initialSongIndex);
  const [materialOffset, _setMaterialOffset] = useState<number>(currentMaterialSafeIndex);
  
  const albumOffsetRef = useRef<number>(initialSongIndex === -1 ? 0 : initialSongIndex);
  const materialOffsetRef = useRef<number>(currentMaterialSafeIndex);

  // ── Carousel click sound effect (white noise burst + dual-tone body) ──
  const tickCtxRef = useRef<AudioContext | null>(null);
  const prevSongIdxRef = useRef(focusedSongIndex);
  const prevMatIdxRef = useRef(focusedMaterialIndex);

  const playClick = () => {
    if (!tickCtxRef.current) tickCtxRef.current = new AudioContext();
    const ctx = tickCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;

    // --- Layer 1: White noise transient "click" attack (15ms) ---
    const noiseLen = 0.015;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseSrc.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseLen);
    noiseSrc.start(t);
    noiseSrc.stop(t + noiseLen);

    // --- Layer 2 & 3: Dual-tone body (800Hz + 1600Hz, 65ms) ---
    [800, 1600].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(freq === 800 ? 0.28 : 0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      osc.start(t);
      osc.stop(t + 0.065);
    });
  };

  useEffect(() => {
    if (prevSongIdxRef.current !== focusedSongIndex) {
      playClick();
      prevSongIdxRef.current = focusedSongIndex;
    }
  }, [focusedSongIndex]);

  useEffect(() => {
    if (prevMatIdxRef.current !== focusedMaterialIndex) {
      playClick();
      prevMatIdxRef.current = focusedMaterialIndex;
    }
  }, [focusedMaterialIndex]);

  const setAlbumOffset = (val: number) => {
    albumOffsetRef.current = val;
    _setAlbumOffset(val);
  };

  const setMaterialOffset = (val: number) => {
    materialOffsetRef.current = val;
    _setMaterialOffset(val);
  };

  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  // 3D parameters for Album View
  const [albumSpacing, setAlbumSpacing] = useState(95);             // Horizontal overlap gap
  const [albumFoldAngle, setAlbumFoldAngle] = useState(37);         // Rotation of standby albums
  const [albumSelectedZ, setAlbumSelectedZ] = useState(168);        // Z position of active album
  const [albumUnselectedZ, setAlbumUnselectedZ] = useState(100);     // Z position of standby albums
  const [albumLiftHeight, setAlbumLiftHeight] = useState(-32);      // Hover floating offset of center album
  const [localAlbumVinylPullDistance, setLocalAlbumVinylPullDistance] = useState(117); // Distance vinyl protrudes
  const albumVinylPullDistance = propAlbumVinylPullDistance ?? localAlbumVinylPullDistance;
  const setAlbumVinylPullDistance = propSetAlbumVinylPullDistance ?? setLocalAlbumVinylPullDistance;
  const [albumStandbyOpacity, setAlbumStandbyOpacity] = useState(1.0); // Standby opacity

  // 3D parameters for Material View (Independent control calibration!)
  const [materialSpacing, setMaterialSpacing] = useState(95);             // Horizontal overlap gap
  const [materialFoldAngle, setMaterialFoldAngle] = useState(37);         // Rotation of standby materials
  const [materialSelectedZ, setMaterialSelectedZ] = useState(168);        // Z position of active material
  const [materialUnselectedZ, setMaterialUnselectedZ] = useState(100);     // Z position of standby materials
  const [materialLiftHeight, setMaterialLiftHeight] = useState(-32);      // Hover floating offset of center material
  const [materialVinylPullDistance, setMaterialVinylPullDistance] = useState(117); // Distance vinyl protrudes
  const [materialStandbyOpacity, setMaterialStandbyOpacity] = useState(1.0); // Standby opacity

  const [isConsoleUnlocked, setIsConsoleUnlocked] = useState(false); // Only displayed if right-clicked on album area
  const [isConsoleOpen, setIsConsoleOpen] = useState(false); // Closed/hidden by default
  const [consoleTab, setConsoleTab] = useState<'album' | 'material'>('album'); // Active console configuration tab
  const [consolePos, setConsolePos] = useState<{ x: number; y: number }>({ x: 20, y: 120 });
  const [isConsoleDragging, setIsConsoleDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  // Position console at top-right on initial open
  React.useEffect(() => {
    if (isConsoleOpen) {
      const initialX = window.innerWidth > 768 ? window.innerWidth - 380 : 16;
      const initialY = 120;
      setConsolePos({ x: initialX, y: initialY });
    }
  }, [isConsoleOpen]);

  // Global dragging event listeners
  React.useEffect(() => {
    if (!isConsoleDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newX = e.clientX - dragStartOffset.current.x;
      let newY = e.clientY - dragStartOffset.current.y;

      const panelWidth = 340;
      const panelHeight = 580;
      if (newX < 10) newX = 10;
      if (newX + panelWidth > window.innerWidth - 10) {
        newX = window.innerWidth - panelWidth - 10;
      }
      if (newY < 10) newY = 10;
      if (newY + panelHeight > window.innerHeight - 10) {
        newY = window.innerHeight - panelHeight - 10;
      }

      setConsolePos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsConsoleDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isConsoleDragging]);

  const [activeView, setActiveView] = useState<'album' | 'material'>('album'); // Default carousel is album view
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    type: 'album' | 'material';
  } | null>(null);
  const [contextMenuTab, setContextMenuTab] = useState<'control' | 'fluid'>('control');

  const handleResetParameters = () => {
    if (consoleTab === 'album') {
      setAlbumSpacing(95);
      setAlbumFoldAngle(37);
      setAlbumSelectedZ(168);
      setAlbumUnselectedZ(100);
      setAlbumLiftHeight(-32);
      setAlbumVinylPullDistance(117);
      setAlbumStandbyOpacity(1.0);
    } else {
      setMaterialSpacing(95);
      setMaterialFoldAngle(37);
      setMaterialSelectedZ(168);
      setMaterialUnselectedZ(100);
      setMaterialLiftHeight(-32);
      setMaterialVinylPullDistance(117);
      setMaterialStandbyOpacity(1.0);
    }
  };

  // Sync state if active song or material changes from external player panels
  if (currentSong.id !== lastSongId) {
    setLastSongId(currentSong.id);
    const idx = songsList.findIndex(s => s.id === currentSong.id);
    if (idx !== -1) {
      setFocusedSongIndex(idx);
      setAlbumOffset(idx);
    }
  }
  if (activeMaterial !== lastMaterialId) {
    setLastMaterialId(activeMaterial);
    const idx = RECORD_MATERIALS.findIndex(m => m.id === activeMaterial);
    if (idx !== -1) {
      setMaterialOffset(idx);
      setFocusedMaterialIndex(idx);
    }
  }

  // A pristine, frame-rate independent second-order Spring damping physics animator with custom non-linear tactilities
  const activeSpringAnim = useRef<number | null>(null);

  const springSnapTo = (target: number, initialVelocity: number = 0) => {
    // Prevent animation overlap clash from previous releases
    if (activeSpringAnim.current !== null) {
      cancelAnimationFrame(activeSpringAnim.current);
      activeSpringAnim.current = null;
    }

    setIsInteracting(true);

    let currentVal = activeView === 'album' ? albumOffsetRef.current : materialOffsetRef.current;
    let currentVelocity = initialVelocity;

    // Premium physical constants loaded reactively from active viscosity preset
    const activePreset = VISCOSITY_PRESETS.find(p => p.id === viscosityPreset) || VISCOSITY_PRESETS[0];
    const stiffness = activePreset.stiffness;
    const damping = activePreset.damping;
    const mass = activePreset.mass;

    let lastTime = performance.now();

    const step = (time: number) => {
      if (isDragging.current) {
        activeSpringAnim.current = null;
        return; // Stopped instantly on manual touch override
      }

      let dt = (time - lastTime) / 1000;
      lastTime = time;

      // Handle OS or browser frame delays safely
      if (dt > 0.1) dt = 0.1;
      if (dt <= 0) {
        activeSpringAnim.current = requestAnimationFrame(step);
        return;
      }

      // 4 steps of Symplectic Euler integration to prevent numerical overshoot/clipping
      const substeps = 4;
      const subDt = dt / substeps;

      for (let j = 0; j < substeps; j++) {
        const x = currentVal - target;
        const absX = Math.abs(x);
        let springForce = 0;
        let dampingForce = 0;

        if (viscosityPreset === 'superfluid' || viscosityPreset === 'superfluid_optics') {
          // #SUPERFLUID: 极速自然回弹
          // Use standard linear second-order physical spring-mass-damper equation directly.
          // This provides a mathematically pristine harmonic oscillation that decays organically,
          // providing a highly premium, elastic, and smooth "natural" bounce.
          springForce = -stiffness * x;
          dampingForce = -damping * currentVelocity;
        } else if (viscosityPreset === 'viscous' || viscosityPreset === 'viscous_optics') {
          // #VISCOUS: 软脂吸附 (sticky memory-foam grease)
          // Heavy weight mass with fluidic suction pull on mendekat targets
          const suctionRange = 0.5;
          let suctionAttr = 1.0;
          if (absX < suctionRange) {
            // Stronger vacuum pull as it nears the center
            suctionAttr = 1.65 - (absX / suctionRange) * 0.8;
          }
          springForce = -stiffness * Math.sign(x) * absX * suctionAttr;
          
          // Colloid fluid damping. Increases dramatically closer to lock, absorbing all velocity to prevent overshoot
          let stickyDamping = damping * (1.1 + (0.2 / (absX + 0.05)));
          dampingForce = -stickyDamping * currentVelocity;
        } else {
          // #GLASSY: 晶刚锁定 (crystalline diamond-hard lockout)
          let dynamicStiffness = stiffness;
          let lockDamping = damping;
          
          if (absX < 0.28) {
            dynamicStiffness = stiffness * 3.5; // extreme rigid attraction
            lockDamping = damping * 2.6;         // instantaneous lock momentum absorption
          }
          springForce = -dynamicStiffness * x;
          dampingForce = -lockDamping * currentVelocity;
        }

        const acceleration = (springForce + dampingForce) / mass;
        currentVelocity += acceleration * subDt;
        currentVal += currentVelocity * subDt;
      }

      const maxOffset = activeView === 'album' ? songsList.length - 1 : RECORD_MATERIALS.length - 1;

      // Update position on every frame, with decoupled localized focus updates to avoid layout lag
      if (activeView === 'album') {
        setAlbumOffset(currentVal);
        const nearest = Math.max(0, Math.min(maxOffset, Math.round(currentVal)));
        setFocusedSongIndex(nearest);
      } else {
        setMaterialOffset(currentVal);
        const nearest = Math.max(0, Math.min(RECORD_MATERIALS.length - 1, Math.round(currentVal)));
        setFocusedMaterialIndex(nearest);
      }

      const diff = Math.abs(currentVal - target);
      const speed = Math.abs(currentVelocity);

      // Adjust settle limits to highlight distinct tactile characteristics of each preset
      let settleDiff = 0.0015;
      let settleSpeed = 0.01;

      if (viscosityPreset === 'glassy' || viscosityPreset === 'glassy_optics') {
        settleDiff = 0.009; // Rigid crisp lock threshold
        settleSpeed = 0.09;
      } else if (viscosityPreset === 'viscous' || viscosityPreset === 'viscous_optics') {
        settleDiff = 0.0006; // Fine slow colloid creep settling limits
        settleSpeed = 0.002;
      }

      if (diff < settleDiff && speed < settleSpeed) {
        if (activeView === 'album') {
          setAlbumOffset(target);
          setFocusedSongIndex(target);
        } else {
          setMaterialOffset(target);
          setFocusedMaterialIndex(target);
          // Apply changes once perfectly settled
          onSelectMaterial(RECORD_MATERIALS[target].id);
        }
        setIsInteracting(false);
        activeSpringAnim.current = null;
      } else {
        activeSpringAnim.current = requestAnimationFrame(step);
      }
    };

    activeSpringAnim.current = requestAnimationFrame(step);
  };

  // Material helpers using our pristine physical spring engine
  const handlePrevMaterial = () => {
    const nextIdx = (focusedMaterialIndex - 1 + RECORD_MATERIALS.length) % RECORD_MATERIALS.length;
    springSnapTo(nextIdx);
  };

  const handleNextMaterial = () => {
    const nextIdx = (focusedMaterialIndex + 1) % RECORD_MATERIALS.length;
    springSnapTo(nextIdx);
  };

  // Song helpers using our pristine physical spring engine
  const handlePrevSong = () => {
    if (songsList.length === 0) return;
    const nextIdx = (focusedSongIndex - 1 + songsList.length) % songsList.length;
    springSnapTo(nextIdx);
  };

  const handleNextSong = () => {
    if (songsList.length === 0) return;
    const nextIdx = (focusedSongIndex + 1) % songsList.length;
    springSnapTo(nextIdx);
  };

  // Continuous fluid dragging state references
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastDragPos = useRef<{ x: number; y: number } | null>(null);
  const lastDragTime = useRef<number>(0);
  const velocity = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const didDrag = useRef<boolean>(false);
  const hasLockedDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const startOffset = useRef<number>(0);

  // Wheel free-scroll state
  const wheelAccumRef = useRef(0);
  const wheelStartOffsetRef = useRef(0);
  const wheelIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const WHEEL_SENSITIVITY = 0.005;
  const WHEEL_IDLE_MS = 150;

  // Wheel spring tracking: wheelTargetRef is the live target that the tracking spring chases
  const wheelTargetRef = useRef(0);
  const wheelSpringRafRef = useRef<number | null>(null);

  const handleDragStart = (clientX: number, clientY: number) => {
    setContextMenu(null);
    dragStartPos.current = { x: clientX, y: clientY };
    lastDragPos.current = { x: clientX, y: clientY };
    lastDragTime.current = Date.now();
    velocity.current = 0;
    isDragging.current = true;
    didDrag.current = false;
    setIsInteracting(true);
    hasLockedDirection.current = null;
    startOffset.current = activeView === 'album' ? albumOffsetRef.current : materialOffsetRef.current;
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!dragStartPos.current || !isDragging.current) return;
    
    const diffX = clientX - dragStartPos.current.x; // positive -> dragged right
    const diffY = clientY - dragStartPos.current.y; // positive -> dragged down
    
    // Set didDrag to true if user moves more than a minor 5px threshold to separate clicks from drags
    if (Math.abs(diffX) > 5 || Math.abs(diffY) > 5) {
      didDrag.current = true;
    }
    
    // Lock drag direction after exceeding threshold
    if (!hasLockedDirection.current) {
      if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
        hasLockedDirection.current = 'horizontal';
      } else if (Math.abs(diffY) > 15 && Math.abs(diffY) > Math.abs(diffX)) {
        hasLockedDirection.current = 'vertical';
      }
    }
    
    if (hasLockedDirection.current === 'horizontal') {
      const now = Date.now();
      const timeDelta = now - lastDragTime.current;
      const xDelta = clientX - (lastDragPos.current?.x ?? clientX);
      
      // Horizontal sensitivity: 220px to shift 1 complete cover item offset
      const multiplier = 0.0045;
      
      let targetOffset = startOffset.current - diffX * multiplier;
      const maxOffset = activeView === 'album' ? songsList.length - 1 : RECORD_MATERIALS.length - 1;
      
      // Rubberband elastic bounds check
      if (targetOffset < 0) {
        targetOffset = targetOffset / 2.5;
      } else if (targetOffset > maxOffset) {
        targetOffset = maxOffset + (targetOffset - maxOffset) / 2.5;
      }
      
      if (activeView === 'album') {
        setAlbumOffset(targetOffset);
      } else {
        setMaterialOffset(targetOffset);
      }
      
      // Calculate velocity (offset unit delta scaled to standard 60fps frame duration of 16.67ms)
      if (timeDelta > 0) {
        velocity.current = -(xDelta * multiplier) * (16.67 / timeDelta);
      }
      
      lastDragPos.current = { x: clientX, y: clientY };
      lastDragTime.current = now;
    } else if (hasLockedDirection.current === 'vertical') {
      lastDragPos.current = { x: clientX, y: clientY };
    }
  };

  const handleDragEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (hasLockedDirection.current === 'horizontal') {
      // Direct drag inertia momentum decay
      // We customize input velocity bounds and gliding coeff according to fluid viscosity to mimic real physical models
      let maxVelClamp = 0.45;
      let glideProjCoeff = 3.2;

      if (viscosityPreset === 'superfluid' || viscosityPreset === 'superfluid_optics') {
        maxVelClamp = 0.85;       // Extreme-speed swipe allowed for zero viscosity
        glideProjCoeff = 5.2;     // Hyper-fluidic glide
      } else if (viscosityPreset === 'viscous' || viscosityPreset === 'viscous_optics') {
        maxVelClamp = 0.22;       // Colloid viscous resistance limits swiping speed
        glideProjCoeff = 1.35;    // Dense grease heavy drag, very short crawl distance
      } else {
        maxVelClamp = 0.48;       // Crystalline snappy clamp
        glideProjCoeff = 2.6;     // Standard glass snapping
      }

      const currentVelocity = Math.max(-maxVelClamp, Math.min(maxVelClamp, velocity.current));
      
      const currentOffset = activeView === 'album' ? albumOffsetRef.current : materialOffsetRef.current;
      const maxOffset = activeView === 'album' ? songsList.length - 1 : RECORD_MATERIALS.length - 1;
      
      // Project final index with a premium natural deceleration factor
      // This represents where the carousel would coast to under friction.
      const projectedOffset = currentOffset + currentVelocity * glideProjCoeff;
      const finalTarget = Math.max(0, Math.min(maxOffset, Math.round(projectedOffset)));
      
      // Seed our second-order spring solver with the correct initial velocity (offset units per second)
      const velocityInSec = currentVelocity * 60;
      springSnapTo(finalTarget, velocityInSec);
    } else if (hasLockedDirection.current === 'vertical') {
      const diffY = (lastDragPos.current && dragStartPos.current) ? lastDragPos.current.y - dragStartPos.current.y : 0;
      if (Math.abs(diffY) > 25) {
        if (activeView === 'album') {
          setActiveView('material');
        } else {
          setActiveView('album');
        }
      }
      setIsInteracting(false);
    } else {
      setIsInteracting(false);
    }
    
    hasLockedDirection.current = null;
    dragStartPos.current = null;
  };

  // Mouse wheel → free-scrolling carousel with spring tracking + snap on idle
  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.custom-scrollbar')) return;

    e.preventDefault();

    // Cancel any active spring snap animation — wheel takes over
    if (activeSpringAnim.current !== null) {
      cancelAnimationFrame(activeSpringAnim.current);
      activeSpringAnim.current = null;
    }

    const maxOffset = activeView === 'album'
      ? songsList.length - 1
      : RECORD_MATERIALS.length - 1;

    // First wheel event in a sequence: snapshot the current offset as anchor
    if (!wheelIdleTimeoutRef.current) {
      wheelStartOffsetRef.current = activeView === 'album'
        ? albumOffsetRef.current
        : materialOffsetRef.current;
      wheelAccumRef.current = 0;
    }

    // Accumulate delta (positive deltaY = scroll down = next = offset increases)
    wheelAccumRef.current += e.deltaY * WHEEL_SENSITIVITY;
    let targetOffset = wheelStartOffsetRef.current + wheelAccumRef.current;

    // Rubberband elastic bounds (same as drag)
    if (targetOffset < 0) {
      targetOffset = targetOffset / 2.5;
    } else if (targetOffset > maxOffset) {
      targetOffset = maxOffset + (targetOffset - maxOffset) / 2.5;
    }

    // Feed target into spring tracking for smooth eased motion
    wheelTargetRef.current = targetOffset;
    startWheelTracking();

    // Reset idle timer — snap to nearest after scrolling stops
    if (wheelIdleTimeoutRef.current) clearTimeout(wheelIdleTimeoutRef.current);
    wheelIdleTimeoutRef.current = setTimeout(() => {
      wheelIdleTimeoutRef.current = null;
      wheelAccumRef.current = 0;

      // Stop wheel tracking spring and hand off to springSnapTo for final settle
      if (wheelSpringRafRef.current !== null) {
        cancelAnimationFrame(wheelSpringRafRef.current);
        wheelSpringRafRef.current = null;
      }

      const snapTarget = Math.max(0, Math.min(maxOffset, Math.round(targetOffset)));
      springSnapTo(snapTarget);
    }, WHEEL_IDLE_MS);
  };

  // Spring tracking animation: continuously chases wheelTargetRef with the active viscosity model
  // Runs in a rAF loop; stopped by idle timeout or drag takeover
  const startWheelTracking = () => {
    if (wheelSpringRafRef.current !== null) return; // Already running

    const activePreset = VISCOSITY_PRESETS.find(p => p.id === viscosityPreset) || VISCOSITY_PRESETS[0];
    const { stiffness, mass } = activePreset;
    const damping = activePreset.damping / 2; // Halved for tighter wheel tracking response

    setIsInteracting(true);
    let currentVal = activeView === 'album' ? albumOffsetRef.current : materialOffsetRef.current;
    let currentVelocity = 0;
    let lastTime = performance.now();

    const step = (time: number) => {
      // Stop if drag takes over
      if (isDragging.current) {
        wheelSpringRafRef.current = null;
        return;
      }

      // Stop if wheel has ended (idle timeout fired and cleared the ref)
      if (!wheelIdleTimeoutRef.current) {
        wheelSpringRafRef.current = null;
        return;
      }

      let dt = (time - lastTime) / 1000;
      lastTime = time;
      if (dt > 0.1) dt = 0.1;
      if (dt <= 0) {
        wheelSpringRafRef.current = requestAnimationFrame(step);
        return;
      }

      const target = wheelTargetRef.current;
      const maxOffset = activeView === 'album'
        ? songsList.length - 1
        : RECORD_MATERIALS.length - 1;

      // 4-step Symplectic Euler integration with same non-linear models as springSnapTo
      const substeps = 4;
      const subDt = dt / substeps;

      for (let j = 0; j < substeps; j++) {
        const x = currentVal - target;
        const absX = Math.abs(x);
        let springForce = 0;
        let dampingForce = 0;

        if (viscosityPreset === 'superfluid' || viscosityPreset === 'superfluid_optics') {
          springForce = -stiffness * x;
          dampingForce = -damping * currentVelocity;
        } else if (viscosityPreset === 'viscous' || viscosityPreset === 'viscous_optics') {
          const suctionRange = 0.5;
          let suctionAttr = 1.0;
          if (absX < suctionRange) {
            suctionAttr = 1.65 - (absX / suctionRange) * 0.8;
          }
          springForce = -stiffness * Math.sign(x) * absX * suctionAttr;
          const stickyDamping = damping * (1.1 + (0.2 / (absX + 0.05)));
          dampingForce = -stickyDamping * currentVelocity;
        } else {
          let dynamicStiffness = stiffness;
          let lockDamping = damping;
          if (absX < 0.28) {
            dynamicStiffness = stiffness * 3.5;
            lockDamping = damping * 2.6;
          }
          springForce = -dynamicStiffness * x;
          dampingForce = -lockDamping * currentVelocity;
        }

        const acceleration = (springForce + dampingForce) / mass;
        currentVelocity += acceleration * subDt;
        currentVal += currentVelocity * subDt;
      }

      // Soft clamp with wider bounds during tracking (allows gentle overshoot)
      currentVal = Math.max(-1, Math.min(maxOffset + 1, currentVal));

      const nearest = Math.max(0, Math.min(maxOffset, Math.round(currentVal)));

      if (activeView === 'album') {
        setAlbumOffset(currentVal);
        setFocusedSongIndex(nearest);
      } else {
        setMaterialOffset(currentVal);
        setFocusedMaterialIndex(nearest);
      }

      wheelSpringRafRef.current = requestAnimationFrame(step);
    };

    wheelSpringRafRef.current = requestAnimationFrame(step);
  };

  return (
    <div 
      className="relative min-h-screen w-full flex flex-col items-center justify-center text-white p-4 md:p-10 font-sans select-none overflow-hidden animate-fade-in bg-transparent" 
      id="vinyl-selection-studio-overlay"
    >



      {/* ================= DYNAMIC 3D COVERS/MATERIALS STAGE ================= */}
      <div className="w-full max-w-7xl z-10 flex flex-col items-center mt-12 mb-6 text-center">



        <section 
          data-wheel-zone="carousel"
          className="w-full relative flex justify-center items-center h-[460px] md:h-[520px] lg:h-[580px] cursor-grab active:cursor-grabbing overflow-visible select-none"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => {
            if (e.button !== 0) return; // Only process left click drags
            handleDragStart(e.clientX, e.clientY);
          }}
          onMouseMove={(e) => {
            handleDragMove(e.clientX, e.clientY);
          }}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onWheel={handleWheel}
          onContextMenu={(e) => {
            e.preventDefault();
            let posX = e.clientX;
            let posY = e.clientY;
            const menuWidth = 320;
            const menuHeight = 440;
            if (posX + menuWidth > window.innerWidth) {
              posX = window.innerWidth - menuWidth - 20;
            }
            if (posY + menuHeight > window.innerHeight) {
              posY = window.innerHeight - menuHeight - 20;
            }
            if (posX < 20) posX = 20;
            if (posY < 20) posY = 20;
            
            setContextMenuTab('control'); // Always reset to control tab on open
            setContextMenu({
              x: posX,
              y: posY,
              visible: true,
              type: activeView
            });
          }}
          title="长按鼠标：左右拖动切换唱片/材质；上下拖动切换3D胶体材质流与唱片专辑；单击右键：微调 3D 黄金配比"
        >
          {/* Album Flow Section */}
          <div 
            className="absolute inset-0 w-full h-full flex justify-center items-center transition-all duration-[750ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-visible"
            style={{
              opacity: activeView === 'album' ? 1 : 0,
              transform: activeView === 'album' 
                ? 'translateY(0px) rotateX(0deg) scale(1)' 
                : 'translateY(-120px) rotateX(40deg) scale(0.8)',
              pointerEvents: activeView === 'album' ? 'auto' : 'none',
              transformStyle: 'preserve-3d',
              zIndex: activeView === 'album' ? 30 : 10
            }}
          >
            {/* 3D album container */}
            <div 
              className="relative w-full h-full flex items-center justify-center overflow-visible"
              style={{ perspective: '1100px', transformStyle: 'preserve-3d' }}
            >
              {songsList.map((song, i) => {
                const diff = i - albumOffset;
                const absDiff = Math.abs(diff);

                // Include and align adjacent items to form a complete spectacular horizontal line row without disappearing early
                if (absDiff > 14) return null;

                const centerWeight = Math.max(0, 1 - absDiff);
                const isClosest = Math.round(albumOffset) === i;

                // Spacing & Folding variables continuous calculations
                const rotationY = Math.sign(diff) * Math.min(1, absDiff) * -albumFoldAngle;
                
                // Keep overlapping tidy: as they stretch, add fold gap width
                const foldGap = Math.sign(diff) * 65 * Math.min(1, absDiff);
                const translationX = diff * albumSpacing + foldGap;

                // Depth & height interpolation
                const currentTranslateZ = albumUnselectedZ + (albumSelectedZ - albumUnselectedZ) * centerWeight;
                const currentTranslateY = 15 + (albumLiftHeight - 15) * centerWeight;

                // Magnified centered scale up on the focused card, side cards are scaled down gracefully creating a deep perspective row look
                const transformStyle = `translateX(${translationX}px) translateY(${currentTranslateY}px) translateZ(${currentTranslateZ}px) rotateY(${rotationY}deg) scale(${0.88 + 0.12 * centerWeight})`;
                const zIndex = Math.round(40 - absDiff * 10);
                const opacity = Math.max(0.15, 1 - absDiff * 0.1);

                return (
                  <AlbumCardItem
                    key={song.id}
                    song={song}
                    i={i}
                    albumVinylPullDistance={albumVinylPullDistance}
                    currentSong={currentSong}
                    activeMat={activeMat}
                    didDrag={didDrag}
                    isClosest={isClosest}
                    onSelectSong={onSelectSong}
                    springSnapTo={springSnapTo}
                    isInteracting={isInteracting}
                    centerWeight={centerWeight}
                    transformStyle={transformStyle}
                    zIndex={zIndex}
                    opacity={opacity}
                    viscosityPreset={viscosityPreset}
                  />
                );
              })}
            </div>
          </div>

          {/* Material Coating Section */}
          <div 
            className="absolute inset-0 w-full h-full flex justify-center items-center transition-all duration-[750ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-visible"
            style={{
              opacity: activeView === 'material' ? 1 : 0,
              transform: activeView === 'material' 
                ? 'translateY(0px) rotateX(0deg) scale(1)' 
                : 'translateY(120px) rotateX(-40deg) scale(0.8)',
              pointerEvents: activeView === 'material' ? 'auto' : 'none',
              transformStyle: 'preserve-3d',
              zIndex: activeView === 'material' ? 30 : 10
            }}
          >
            {/* 3D Material Cover Flow */}
            <div 
              className="relative w-full h-full flex items-center justify-center overflow-visible"
              style={{ perspective: '1100px', transformStyle: 'preserve-3d' }}
            >
              {RECORD_MATERIALS.map((mat, i) => {
                const diff = i - materialOffset;
                const absDiff = Math.abs(diff);

                // Include and align adjacent items to form a complete spectacular horizontal line row without disappearing early
                if (absDiff > 14) return null;

                const centerWeight = Math.max(0, 1 - absDiff);
                const isClosest = Math.round(materialOffset) === i;

                // reuse parameters for perfect concentric looks
                const isLeft = diff < 0;
                const rotationY = Math.sign(diff) * Math.min(1, absDiff) * -materialFoldAngle;
                const foldGap = Math.sign(diff) * 65 * Math.min(1, absDiff);
                const translationX = diff * materialSpacing + foldGap;

                const currentTranslateZ = materialUnselectedZ + (materialSelectedZ - materialUnselectedZ) * centerWeight;
                const currentTranslateY = 15 + (materialLiftHeight - 15) * centerWeight;

                // Magnified centered scale up on the focused card, side cards are scaled down gracefully creating a deep perspective row look
                const transformStyle = `translateX(${translationX}px) translateY(${currentTranslateY}px) translateZ(${currentTranslateZ}px) rotateY(${rotationY}deg) scale(${0.88 + 0.12 * centerWeight})`;
                const zIndex = Math.round(40 - absDiff * 10);
                const opacity = Math.max(0.15, 1 - absDiff * 0.1);

                return (
                  <MaterialCardItem
                    key={mat.id}
                    mat={mat}
                    i={i}
                    activeMaterial={activeMaterial}
                    currentSong={currentSong}
                    didDrag={didDrag}
                    isClosest={isClosest}
                    onSelectMaterial={onSelectMaterial}
                    springSnapTo={springSnapTo}
                    isInteracting={isInteracting}
                    transformStyle={transformStyle}
                    zIndex={zIndex}
                    opacity={opacity}
                    centerWeight={centerWeight}
                    viscosityPreset={viscosityPreset}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* Current focused song info below carousel */}
        {activeView === 'album' && songsList[focusedSongIndex] && (
          <div className="flex flex-col items-center gap-0.5 select-none transition-all duration-300">
            <span className="text-sm font-black text-white/90 tracking-wide">
              {songsList[focusedSongIndex].title}
            </span>
            <span className="text-[11px] text-white/40 tracking-wide">
              {songsList[focusedSongIndex].artist}
            </span>
          </div>
        )}
      </div>

      {/* ================= EXTRA: DRAGGABLE COMPACT 3D PARAMETERS CALIBRATION CONSOLE (NON-FULLSCREEN AS REQUESTED) ================= */}
      {isConsoleOpen && (() => {
        const currentSpacing = consoleTab === 'album' ? albumSpacing : materialSpacing;
        const currentFoldAngle = consoleTab === 'album' ? albumFoldAngle : materialFoldAngle;
        const currentSelectedZ = consoleTab === 'album' ? albumSelectedZ : materialSelectedZ;
        const currentUnselectedZ = consoleTab === 'album' ? albumUnselectedZ : materialUnselectedZ;
        const currentLiftHeight = consoleTab === 'album' ? albumLiftHeight : materialLiftHeight;
        const currentVinylPullDistance = consoleTab === 'album' ? albumVinylPullDistance : materialVinylPullDistance;
        const currentStandbyOpacity = consoleTab === 'album' ? albumStandbyOpacity : materialStandbyOpacity;

        const setCurrentSpacing = consoleTab === 'album' ? setAlbumSpacing : setMaterialSpacing;
        const setCurrentFoldAngle = consoleTab === 'album' ? setAlbumFoldAngle : setMaterialFoldAngle;
        const setCurrentSelectedZ = consoleTab === 'album' ? setAlbumSelectedZ : setMaterialSelectedZ;
        const setCurrentUnselectedZ = consoleTab === 'album' ? setAlbumUnselectedZ : setMaterialUnselectedZ;
        const setCurrentLiftHeight = consoleTab === 'album' ? setAlbumLiftHeight : setMaterialLiftHeight;
        const setCurrentVinylPullDistance = consoleTab === 'album' ? setAlbumVinylPullDistance : setMaterialVinylPullDistance;
        const setCurrentStandbyOpacity = consoleTab === 'album' ? setAlbumStandbyOpacity : setMaterialStandbyOpacity;

        const handleConsoleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
          // Prevent dragging if clicking onto interactable elements
          if (
            (e.target as HTMLElement).closest('input') || 
            (e.target as HTMLElement).closest('button') || 
            (e.target as HTMLElement).closest('select')
          ) {
            return;
          }
          e.preventDefault();
          setIsConsoleDragging(true);
          dragStartOffset.current = {
            x: e.clientX - consolePos.x,
            y: e.clientY - consolePos.y,
          };
        };

        return (
          <div
            className="fixed z-[120] w-[340px] bg-slate-950/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col select-none animate-fade-in backdrop-blur-xl transition-shadow duration-300 animate-slide-in"
            style={{
              left: `${consolePos.x}px`,
              top: `${consolePos.y}px`,
              boxShadow: isConsoleDragging ? '0 30px 70px rgba(0,0,0,0.95), 0 0 15px rgba(20,184,166,0.15)' : '0 20px 50px rgba(0,0,0,0.85)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Draggable Panel Header Area */}
            <div 
              onMouseDown={handleConsoleDragStart}
              className="px-4 py-3 bg-slate-900 border-b border-white/5 rounded-t-2xl flex flex-col gap-1 cursor-grab active:cursor-grabbing"
              title="按住此区域可以拖拽移动面板"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Sliders size={13} className={isConsoleDragging ? "animate-spin" : "animate-pulse"} />
                  <span className="text-[10px] uppercase font-extrabold tracking-widest font-mono text-white/90">
                    3D 物理舞台参数调节器
                  </span>
                </div>
                <button 
                  onClick={() => setIsConsoleOpen(false)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/55 hover:text-white transition-all cursor-pointer"
                  title="关闭控制台"
                >
                  <X size={14} />
                </button>
              </div>
              <span className="text-[9px] text-white/20 font-mono tracking-tight select-none">
                DRAG HEADER TO MOVE &bull; 按住顶部栏拖动面板
              </span>
            </div>

            {/* Split Dual-stage Tab switcher */}
            <div className="grid grid-cols-2 border-b border-white/5 bg-slate-950 p-1.5 gap-1.5">
              <button
                onClick={() => setConsoleTab('album')}
                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                  consoleTab === 'album'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/5 border-transparent'
                }`}
              >
                <Music size={11} />
                <span>唱片专辑流</span>
              </button>
              <button
                onClick={() => setConsoleTab('material')}
                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                  consoleTab === 'material'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/5 border-transparent'
                }`}
              >
                <Disc size={11} />
                <span>胶体材质流</span>
              </button>
            </div>

            {/* Sliders Area (Neatly vertical stacked layout) */}
            <div className="p-4 flex flex-col gap-3.5 max-h-[360px] overflow-y-auto custom-scrollbar">
              
              {/* Spacing Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-white/60">唱片重叠视差 (Spacing)</span>
                  <span className="text-teal-400 font-extrabold">{currentSpacing}px</span>
                </div>
                <input 
                  type="range" 
                  min="60" 
                  max="240" 
                  value={currentSpacing}
                  onChange={(e) => setCurrentSpacing(Number(e.target.value))}
                  className="w-full accent-teal-400 bg-white/10 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

              {/* Fold Angle Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-white/60">边缘立体旋转 (Rotate Y)</span>
                  <span className="text-teal-400 font-extrabold">{currentFoldAngle}°</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="90" 
                  value={currentFoldAngle}
                  onChange={(e) => setCurrentFoldAngle(Number(e.target.value))}
                  className="w-full accent-teal-400 bg-white/10 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

              {/* Lift Height */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-white/60">中央前凸高度 (Lift Y)</span>
                  <span className="text-emerald-400 font-extrabold">{-currentLiftHeight}px</span>
                </div>
                <input 
                  type="range" 
                  min="-120" 
                  max="10" 
                  value={currentLiftHeight}
                  onChange={(e) => setCurrentLiftHeight(Number(e.target.value))}
                  className="w-full accent-emerald-400 bg-white/10 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

              {/* selectedZ */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-white/60">最前镜拉伸深度 (Selected Z)</span>
                  <span className="text-cyan-400 font-extrabold">{currentSelectedZ}px</span>
                </div>
                <input 
                  type="range" 
                  min="40" 
                  max="350" 
                  value={currentSelectedZ}
                  onChange={(e) => setCurrentSelectedZ(Number(e.target.value))}
                  className="w-full accent-cyan-400 bg-white/10 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

              {/* unselectedZ */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-white/60">背景页退缩深度 (Standby Z)</span>
                  <span className="text-cyan-400 font-extrabold">{currentUnselectedZ}px</span>
                </div>
                <input 
                  type="range" 
                  min="-220" 
                  max="100" 
                  value={currentUnselectedZ}
                  onChange={(e) => setCurrentUnselectedZ(Number(e.target.value))}
                  className="w-full accent-cyan-400 bg-white/10 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

              {/* Pull distance / Slip */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-white/60">
                    {consoleTab === 'album' ? '黑胶内芯右移 (Vinyl Slip)' : '卡片偏振视差 (Colloid Gap)'}
                  </span>
                  <span className="text-amber-400 font-extrabold">{currentVinylPullDistance}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="220" 
                  value={currentVinylPullDistance}
                  onChange={(e) => setCurrentVinylPullDistance(Number(e.target.value))}
                  className="w-full accent-amber-400 bg-white/10 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

              {/* Standby Opacity Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-white/60">待命不透明度 (Sub-Opacity)</span>
                  <span className="text-pink-400 font-extrabold">{Math.round(currentStandbyOpacity * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={Math.round(currentStandbyOpacity * 100)}
                  onChange={(e) => setCurrentStandbyOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-pink-400 bg-white/10 rounded-lg appearance-none h-1 cursor-pointer"
                />
              </div>

            </div>

            {/* Compact Lower Controls */}
            <div className="p-3 bg-slate-900 border-t border-white/5 rounded-b-2xl flex items-center justify-between gap-2">
              <button
                onClick={handleResetParameters}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 hover:text-teal-400 border border-white/5 rounded-lg text-[9px] font-mono transition-all cursor-pointer"
                title="重置选项"
              >
                <RotateCcw size={10} />
                <span>初始配比</span>
              </button>
              <button
                onClick={() => setIsConsoleOpen(false)}
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 active:scale-95 text-slate-950 font-bold rounded-lg text-[10px] transition-all cursor-pointer"
              >
                收起控制台
              </button>
            </div>

          </div>
        );
      })()}

      {/* ================= ROYAL EXTRA: ADVANCED CUSTOM RIGHT-CLICK FLOATING CONTEXT MENU OPTIONS ================= */}
      {contextMenu && contextMenu.visible && (
        <>
          {/* Fullscreen click-shield barrier to dismiss instant on click outside */}
          <div 
            className="fixed inset-0 z-[100] cursor-default bg-transparent"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />

          {/* Floating Action Context Menu Container */}
          <div
            className="fixed z-[101] w-[320px] bg-slate-950/90 border border-white/10 rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.85)] p-4 select-none animate-fade-in flex flex-col gap-4 transition-all outline outline-1 outline-white/5 backdrop-blur-2xl"
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'album' ? (
              (() => {
                const song = songsList[focusedSongIndex];
                if (!song) return null;
                const isCurrent = song.id === currentSong.id;
                return (
                  <>
                    {/* Title header block */}
                    <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                      <img 
                        src={song.coverUrl} 
                        alt="" 
                        className="w-12 h-12 object-cover rounded-lg shadow-md border border-white/10 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-teal-400 font-extrabold uppercase tracking-widest font-mono">唱片智能悬浮面板</span>
                        <span className="text-sm font-black text-white/95 truncate leading-tight mt-0.5">{song.title}</span>
                        <span className="text-[11px] text-white/40 truncate mt-0.5">{song.artist}</span>
                      </div>
                    </div>

                    {/* Integrated Segment Tabs */}
                    <div className="grid grid-cols-2 p-0.5 bg-white/[0.03] border border-white/5 rounded-xl text-center">
                      <button 
                        onClick={() => setContextMenuTab('control')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition-all border outline-none cursor-pointer ${
                          contextMenuTab === 'control' 
                            ? 'bg-teal-500/10 text-teal-300 border-teal-500/20 shadow-sm font-black'
                            : 'text-white/40 border-transparent hover:text-white/80'
                        }`}
                      >
                        <Play size={11} />
                        <span>播放控制</span>
                      </button>
                      <button 
                        onClick={() => setContextMenuTab('fluid')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition-all border outline-none cursor-pointer ${
                          contextMenuTab === 'fluid' 
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/20 shadow-sm font-black'
                            : 'text-white/40 border-transparent hover:text-white/80'
                        }`}
                      >
                        <Sliders size={11} />
                        <span>流体阻尼</span>
                      </button>
                    </div>

                    {/* Tab Panels */}
                    {contextMenuTab === 'control' ? (
                      /* Options actions list */
                      <div className="flex flex-col gap-1 text-xs">
                        <button
                          onClick={() => {
                            onSelectSong(song);
                            setContextMenu(null);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-teal-500/10 text-teal-300 transition-all font-semibold group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Play size={13} className="group-hover:scale-110 transition-transform text-teal-400" />
                            <span>{isCurrent ? "重新播放此唱片" : "立即试听该唱片"}</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-mono">PLAY</span>
                        </button>

                        <button
                          onClick={() => {
                            handleNextSong();
                            setContextMenu(null);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/5 text-white/80 transition-all font-semibold cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <ChevronRight size={13} />
                            <span>右旋切到下一首</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-mono">NEXT</span>
                        </button>

                        <button
                          onClick={() => {
                            handlePrevSong();
                            setContextMenu(null);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/5 text-white/80 transition-all font-semibold cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <ChevronLeft size={13} />
                            <span>左旋切到上一首</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-mono">PREV</span>
                        </button>

                        {/* Switch to Material configuration */}
                        <button
                          onClick={() => {
                            setActiveView('material');
                            setContextMenu(null);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-purple-500/10 text-purple-300 transition-all font-semibold cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Disc size={13} className="text-purple-400" />
                            <span>切换至胶体材质流</span>
                          </div>
                          <span className="text-[9px] text-white/30 font-mono">MATERIAL</span>
                        </button>

                        {/* Toggle parameters calibrator */}
                        <button
                          onClick={() => {
                            setConsoleTab('album');
                            setIsConsoleOpen(true);
                            setContextMenu(null);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-emerald-500/10 text-emerald-300 border border-white/5 mt-1 transition-all font-semibold cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Sliders size={13} className="text-emerald-400" />
                            <span>微调 3D 黄金折叠配比</span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-mono">⌘ CAL</span>
                        </button>
                      </div>
                    ) : (
                      /* 3D Dynamics Physical/Optical Preset Toggles */
                      <div className="flex flex-col gap-3.5">
                        {/* 1. Physical damping */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-emerald-400 font-extrabold tracking-wider uppercase font-mono">
                              流体物理阻尼 &bull; DAMPING
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                            {VISCOSITY_PRESETS.filter(p => !p.id.endsWith('_optics')).map((p) => {
                              const active = viscosityPreset === p.id;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setViscosityPreset(p.id);
                                    if (activeView === 'album') {
                                      springSnapTo(focusedSongIndex);
                                    } else {
                                      springSnapTo(focusedMaterialIndex);
                                    }
                                  }}
                                  className={`px-1 py-1.5 text-[10px] font-bold rounded-lg transition-all text-center cursor-pointer border ${
                                    active 
                                      ? 'bg-emerald-500/10 text-white border-emerald-500/30'
                                      : 'text-white/40 hover:text-white/80 hover:bg-white/5 border-transparent'
                                  }`}
                                >
                                  <div>{p.name}</div>
                                  <div className="text-[6.5px] scale-90 opacity-60 font-mono tracking-tight font-normal">
                                    {p.id.toUpperCase()}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Optical presets */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                            <span className="text-[10px] text-teal-400 font-extrabold tracking-wider uppercase font-mono">
                              精细胶片材质光效 &bull; OPTICS
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 bg-white/[0.02] border border-white/5 p-1 rounded-xl">
                            {VISCOSITY_PRESETS.filter(p => p.id.endsWith('_optics')).map((p) => {
                              const active = viscosityPreset === p.id;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setViscosityPreset(p.id);
                                    if (activeView === 'album') {
                                      springSnapTo(focusedSongIndex);
                                    } else {
                                      springSnapTo(focusedMaterialIndex);
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all border outline-none text-[11px] cursor-pointer ${
                                    active 
                                      ? 'bg-teal-500/10 border-teal-500/35 text-white shadow-md'
                                      : 'bg-transparent border-transparent text-white/50 hover:bg-white/5 hover:text-white/95'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: p.accent }} />
                                    <span style={{ color: active ? p.accent : 'inherit' }}>{p.name}</span>
                                  </div>
                                  {active && (
                                    <span className="text-[7.5px] bg-teal-500/25 text-teal-300 px-1 py-0.5 rounded font-black tracking-tight scale-90 uppercase">
                                      ACTIVE
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Help prompt */}
                        <p className="text-[9.5px] leading-relaxed text-white/40 border-t border-white/5 pt-2 pl-0.5 select-none">
                          💡 <span className="font-semibold text-teal-400/90">提示:</span> 即使黑胶高速旋转，动态折射光晕依然紧密跟踪您的鼠标轨迹，营造令人惊叹的胶片流动美学。
                        </p>
                      </div>
                    )}

                    {/* Micro info display */}
                    <div className="border-t border-white/5 pt-2 flex items-center justify-between text-[10px] font-mono text-white/30">
                      <span>流式状态: {isCurrent ? "ONLINE 播放中" : "STANDBY 待命"}</span>
                      <span>唱片 #{focusedSongIndex + 1}</span>
                    </div>
                  </>
                );
              })()
            ) : (
              (() => {
                const mat = RECORD_MATERIALS[focusedMaterialIndex];
                if (!mat) return null;
                const isApplied = mat.id === activeMaterial;
                return (
                  <>
                    {/* Title header block */}
                    <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                      {/* Color Circle preview */}
                      <div 
                        className="w-12 h-12 rounded-full shadow-inner border border-white/20 flex-shrink-0 relative overflow-hidden"
                        style={{ background: mat.gradient }}
                      >
                        <div className="absolute inset-[35%] bg-black/60 rounded-full" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: mat.accentColor }}>
                          胶体流高级操控面板
                        </span>
                        <span className="text-sm font-black text-white/95 truncate leading-tight mt-0.5">{mat.cnName}</span>
                        <span className="text-[11px] text-white/45 truncate mt-0.5">{mat.name}</span>
                      </div>
                    </div>

                    {/* Integrated Segment Tabs */}
                    <div className="grid grid-cols-2 p-0.5 bg-white/[0.03] border border-white/5 rounded-xl text-center">
                      <button 
                        onClick={() => setContextMenuTab('control')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition-all border outline-none cursor-pointer ${
                          contextMenuTab === 'control' 
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-sm font-black'
                            : 'text-white/40 border-transparent hover:text-white/80'
                        }`}
                      >
                        <Play size={11} />
                        <span>材质控制</span>
                      </button>
                      <button 
                        onClick={() => setContextMenuTab('fluid')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition-all border outline-none cursor-pointer ${
                          contextMenuTab === 'fluid' 
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/20 shadow-sm font-black'
                            : 'text-white/40 border-transparent hover:text-white/80'
                        }`}
                      >
                        <Sliders size={11} />
                        <span>流体物理</span>
                      </button>
                    </div>

                    {/* Tab Panels */}
                    {contextMenuTab === 'control' ? (
                      <div className="flex flex-col gap-2.5 text-xs">
                        {/* Compact Description info box */}
                        <p className="text-[10.5px] leading-relaxed text-white/60 bg-white/[0.02] border border-white/5 rounded-xl p-2.5 text-justify">
                          {mat.description}
                        </p>

                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => {
                              onSelectMaterial(mat.id);
                              setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-emerald-500/10 text-emerald-300 transition-all font-semibold group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              {isApplied ? <Check size={13} className="text-emerald-400" /> : <Play size={13} className="group-hover:scale-110 transition-transform text-emerald-400" />}
                              <span>{isApplied ? "材质已经生效中" : "应用为此黑胶材质"}</span>
                            </div>
                            <span className="text-[9px] text-white/30 font-mono">APPLY</span>
                          </button>

                          <button
                            onClick={() => {
                              handleNextMaterial();
                              setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/5 text-white/80 transition-all font-semibold cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <ChevronRight size={13} />
                              <span>切向下一个材质</span>
                            </div>
                            <span className="text-[9px] text-white/30 font-mono">NEXT</span>
                          </button>

                          <button
                            onClick={() => {
                              handlePrevMaterial();
                              setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/5 text-white/80 transition-all font-semibold cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <ChevronLeft size={13} />
                              <span>切向上一个材质</span>
                            </div>
                            <span className="text-[9px] text-white/30 font-mono">PREV</span>
                          </button>

                          {/* Switch to Album View back */}
                          <button
                            onClick={() => {
                              setActiveView('album');
                              setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-teal-500/10 text-teal-300 transition-all font-semibold cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Music size={13} className="text-teal-400" />
                              <span>返回选择唱片专辑</span>
                            </div>
                            <span className="text-[9px] text-white/30 font-mono">ALBUMS</span>
                          </button>

                          {/* Toggle parameters calibrator */}
                          <button
                            onClick={() => {
                              setConsoleTab('material');
                              setIsConsoleOpen(true);
                              setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-purple-500/10 text-purple-300 border border-white/5 mt-1 transition-all font-semibold cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Sliders size={13} className="text-purple-400" />
                              <span>打开 3D 高维调速配比</span>
                            </div>
                            <span className="text-[10px] text-purple-400 font-mono">⌘ CAL</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 3D Dynamics Physical/Optical Preset Toggles */
                      <div className="flex flex-col gap-3.5">
                        {/* 1. Physical damping */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] text-amber-400 font-extrabold tracking-wider uppercase font-mono">
                              流体物理阻尼 &bull; DAMPING
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                            {VISCOSITY_PRESETS.filter(p => !p.id.endsWith('_optics')).map((p) => {
                              const active = viscosityPreset === p.id;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setViscosityPreset(p.id);
                                    if (activeView === 'album') {
                                      springSnapTo(focusedSongIndex);
                                    } else {
                                      springSnapTo(focusedMaterialIndex);
                                    }
                                  }}
                                  className={`px-1 py-1.5 text-[10px] font-bold rounded-lg transition-all text-center cursor-pointer border ${
                                    active 
                                      ? 'bg-amber-500/10 text-white border-amber-500/30'
                                      : 'text-white/40 hover:text-white/80 hover:bg-white/5 border-transparent'
                                  }`}
                                >
                                  <div>{p.name}</div>
                                  <div className="text-[6.5px] scale-90 opacity-60 font-mono tracking-tight font-normal">
                                    {p.id.toUpperCase()}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Optical presets */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] text-amber-400 font-extrabold tracking-wider uppercase font-mono">
                              精细胶片材质光效 &bull; OPTICS
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 bg-white/[0.02] border border-white/5 p-1 rounded-xl">
                            {VISCOSITY_PRESETS.filter(p => p.id.endsWith('_optics')).map((p) => {
                              const active = viscosityPreset === p.id;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setViscosityPreset(p.id);
                                    if (activeView === 'album') {
                                      springSnapTo(focusedSongIndex);
                                    } else {
                                      springSnapTo(focusedMaterialIndex);
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all border outline-none text-[11px] cursor-pointer ${
                                    active 
                                      ? 'bg-amber-500/10 border-amber-500/35 text-white shadow-md'
                                      : 'bg-transparent border-transparent text-white/50 hover:bg-white/5 hover:text-white/95'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: p.accent }} />
                                    <span style={{ color: active ? p.accent : 'inherit' }}>{p.name}</span>
                                  </div>
                                  {active && (
                                    <span className="text-[7.5px] bg-amber-500/25 text-amber-300 px-1 py-0.5 rounded font-black tracking-tight scale-90 uppercase">
                                      ACTIVE
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Help prompt */}
                        <p className="text-[9.5px] leading-relaxed text-white/40 border-t border-white/5 pt-2 pl-0.5 select-none">
                          💡 <span className="font-semibold text-amber-400/90">提示:</span> 即使黑胶高速旋转，动态折射光晕依然紧密跟踪您的鼠标轨迹，营造令人惊叹的胶片流动美学。
                        </p>
                      </div>
                    )}

                    {/* Micro info footer display */}
                    <div className="border-t border-white/5 pt-2 flex items-center justify-between text-[10px] font-mono text-white/30">
                      <span>反射系数: ~{(mat.shineIntensity * 100).toFixed(0)}% Gloss</span>
                      <span>材质 #{focusedMaterialIndex + 1}</span>
                    </div>
                  </>
                );
              })()
            )}

          </div>
        </>
      )}

    </div>
  );
};

