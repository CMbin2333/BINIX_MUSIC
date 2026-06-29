/**
 * 探针脚本：测试 QQ 和网易云上游 API 的分页/参数行为
 * 用法：node temp/probe_api.js
 */
const https = require('https');
const http = require('http');

const SAMPLE_QUERY = '周杰伦';

async function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers, timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, raw: body.substring(0, 500) }); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

function extractMids(data) {
  const info = data?.data?.info || data?.info || [];
  return info.map(i => i.mid || i.songmid || '').filter(Boolean);
}

function extractNeteaseIds(data) {
  const arr = Array.isArray(data) ? data : (data?.data || []);
  return arr.map(i => {
    const m = (i.url || i.lrc || '').match(/id=(\d+)/);
    return m ? m[1] : '';
  }).filter(Boolean);
}

async function testQQ() {
  console.log('========== QQ 音乐 (api.52vmy.cn) ==========\n');

  const combos = [
    { label: '默认（无额外参数）', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&type=json` },
    { label: 'n=30', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&n=30&type=json` },
    { label: 'n=30, page=1', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&n=30&page=1&type=json` },
    { label: 'n=30, page=2', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&n=30&page=2&type=json` },
    { label: 'n=30, page=3', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&n=30&page=3&type=json` },
    { label: 'n=100', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&n=100&type=json` },
    { label: 'num=30', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&num=30&type=json` },
    { label: 'limit=30', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&limit=30&type=json` },
    { label: 'pn=2 (第2页)', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&pn=2&type=json` },
    { label: 'p=2', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&p=2&type=json` },
    { label: 'per_page=30', url: `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(SAMPLE_QUERY)}&per_page=30&type=json` },
  ];

  const results = [];
  for (const c of combos) {
    try {
      const res = await fetchJson(c.url);
      const mids = extractMids(res.data);
      results.push({ label: c.label, count: mids.length, mids });
      console.log(`[${c.label}] 返回 ${mids.length} 首, mids: [${mids.slice(0, 5).join(', ')}${mids.length > 5 ? '...' : ''}]`);
    } catch (e) {
      console.log(`[${c.label}] 失败: ${e.message}`);
      results.push({ label: c.label, count: 0, mids: [], error: e.message });
    }
  }

  // 对比 page=1 和 page=2 是否不同
  const page1 = results.find(r => r.label.includes('page=1'));
  const page2 = results.find(r => r.label.includes('page=2'));
  if (page1 && page2 && page1.mids.length > 0 && page2.mids.length > 0) {
    const overlap = page1.mids.filter(m => page2.mids.includes(m));
    console.log(`\n  → page=1 vs page=2: 重叠 ${overlap.length}/${page2.mids.length} 首 => ${overlap.length === page2.mids.length ? '完全重复，page 参数无效' : '有不同结果，page 有效！'}`);
  }

  // 对比 n=30 和 默认
  const def = results.find(r => r.label === '默认（无额外参数）');
  const n30 = results.find(r => r.label === 'n=30');
  if (def && n30 && def.mids.length > 0 && n30.mids.length > 0) {
    const overlap = def.mids.filter(m => n30.mids.includes(m));
    console.log(`  → 默认 vs n=30: 默认${def.mids.length}首, n=30共${n30.mids.length}首, 默认被包含于n=30: ${overlap.length === def.mids.length && n30.mids.length > def.mids.length ? 'n参数可能有效' : 'n参数效果有限'}`);
  }

  return results;
}

async function testQijieya() {
  console.log('\n\n========== 网易云 (api.qijieya.cn) ==========\n');

  const combos = [
    { label: '默认', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}` },
    { label: 'limit=50', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&limit=50` },
    { label: 'limit=100', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&limit=100` },
    { label: 'offset=0, limit=30', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&offset=0&limit=30` },
    { label: 'offset=30, limit=30', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&offset=30&limit=30` },
    { label: 'offset=60, limit=30', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&offset=60&limit=30` },
    { label: 'page=1', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&page=1` },
    { label: 'page=2', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&page=2` },
    { label: 'page=3', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&page=3` },
    { label: 'pn=2', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&pn=2&limit=30` },
    { label: 'type=1', url: `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(SAMPLE_QUERY)}&limit=50` },
  ];

  const results = [];
  for (const c of combos) {
    try {
      const res = await fetchJson(c.url);
      const ids = extractNeteaseIds(res.data);
      results.push({ label: c.label, count: ids.length, ids });
      console.log(`[${c.label}] 返回 ${ids.length} 首, ids: [${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}]`);
    } catch (e) {
      console.log(`[${c.label}] 失败: ${e.message}`);
      results.push({ label: c.label, count: 0, ids: [], error: e.message });
    }
  }

  // 对比 offset=0 和 offset=30
  const off0 = results.find(r => r.label.includes('offset=0'));
  const off30 = results.find(r => r.label.includes('offset=30'));
  if (off0 && off30 && off0.ids.length > 0 && off30.ids.length > 0) {
    const overlap = off0.ids.filter(m => off30.ids.includes(m));
    console.log(`\n  → offset=0 vs offset=30: 重叠 ${overlap.length}/${off30.ids.length} 首 => ${overlap.length === off30.ids.length ? '完全重复，offset 参数无效' : '有不同结果，offset 有效！'}`);
  }

  // 对比 page=1 和 page=2
  const pg1 = results.find(r => r.label === 'page=1');
  const pg2 = results.find(r => r.label === 'page=2');
  if (pg1 && pg2 && pg1.ids.length > 0 && pg2.ids.length > 0) {
    const overlap = pg1.ids.filter(m => pg2.ids.includes(m));
    console.log(`  → page=1 vs page=2: 重叠 ${overlap.length}/${pg2.ids.length} 首 => ${overlap.length === pg2.ids.length ? '完全重复，page 参数无效' : '有不同结果，page 有效！'}`);
  }

  // 对比 默认 和 limit=100
  const def = results.find(r => r.label === '默认');
  const lim100 = results.find(r => r.label === 'limit=100');
  if (def && lim100 && def.ids.length > 0 && lim100.ids.length > 0) {
    console.log(`  → 默认(${def.ids.length}) vs limit=100(${lim100.ids.length}): limit参数${lim100.ids.length > def.ids.length ? '可能有效' : '无效，上游有固定上限'}`);
  }

  return results;
}

async function testQQMultiQuery() {
  console.log('\n\n========== QQ 多关键词变体策略测试 ==========\n');
  
  const variants = [
    SAMPLE_QUERY,
    `${SAMPLE_QUERY} 歌`,
    `${SAMPLE_QUERY} 热门`,
    `${SAMPLE_QUERY} 经典`,
    `${SAMPLE_QUERY} 新歌`,
    `${SAMPLE_QUERY} 专辑`,
    `${SAMPLE_QUERY} 演唱会`,
    `${SAMPLE_QUERY} 慢歌`,
  ];

  const allMids = new Set();
  const results = [];

  for (const v of variants) {
    try {
      const url = `https://api.52vmy.cn/api/music/qq/vip?msg=${encodeURIComponent(v)}&type=json`;
      const res = await fetchJson(url);
      const mids = extractMids(res.data);
      let added = 0;
      for (const m of mids) { if (!allMids.has(m)) { allMids.add(m); added++; } }
      results.push({ variant: v, count: mids.length, added });
      console.log(`[QQ "${v}"] 返回 ${mids.length} 首，新增 ${added} 首 (累计 ${allMids.size})`);
    } catch (e) {
      console.log(`[QQ "${v}"] 失败: ${e.message}`);
    }
  }
  console.log(`\n  → QQ 多查询合并: 共 ${allMids.size} 首`);

  // Also test Netease multi-query as bonus
  console.log('\n\n========== 网易云 多关键词变体策略测试 ==========\n');
  
  const allNeteaseIds = new Set();
  
  for (const v of variants) {
    try {
      const url = `https://api.qijieya.cn/meting/?server=netease&type=search&id=${encodeURIComponent(v)}&limit=100`;
      const res = await fetchJson(url);
      const ids = extractNeteaseIds(res.data);
      let added = 0;
      for (const id of ids) { if (!allNeteaseIds.has(id)) { allNeteaseIds.add(id); added++; } }
      console.log(`[Netease "${v}"] 返回 ${ids.length} 首，新增 ${added} 首 (累计 ${allNeteaseIds.size})`);
    } catch (e) {
      console.log(`[Netease "${v}"] 失败: ${e.message}`);
    }
  }
  console.log(`\n  → 网易云 多查询合并: 共 ${allNeteaseIds.size} 首`);
}

(async () => {
  console.log('=============================================');
  console.log(`探针脚本：${SAMPLE_QUERY} 搜索 API 参数探测`);
  console.log('=============================================\n');
  
  await testQQ();
  await testQijieya();
  await testQQMultiQuery();
  
  console.log('\n\n=============================================');
  console.log('探测完成。请根据上方日志分析。');
  console.log('=============================================');
})();
